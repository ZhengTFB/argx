import type { Transport } from '../transports/types';

/*
 * 网页端会话层。
 *
 * 与设备端是**对等**的：同一套握手、心跳、掉线判定、序号规则，
 * 只是注册的处理器不同。协议里没有主从，这里也不该有。
 *
 * 三个数字来自 protocol/PROTOCOL.md §13，不许各写一套：
 *   HEARTBEAT_MS  3 秒发一次 ping
 *   LINK_LOST_MS  10 秒没收到 pong 判定掉线
 *   协议版本        v: 1
 *
 * 这个文件不依赖 React，也不依赖任何框架——阶段三的 SDK 可以把它整段搬过去。
 */

export const HEARTBEAT_MS = 3000;
export const LINK_LOST_MS = 10000;
export const PROTOCOL_VERSION = 1;

export type LinkStatus =
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'active'
  | 'stale'
  | 'lost';

export interface Caps {
  out: string[];
  in: string[];
}

export type Dir = 'in' | 'out' | 'info' | 'error';

export interface SessionHooks {
  /** 每一条收发都过这里，时间线就是它的下游 */
  onFrame(dir: Dir, text: string): void;
  onCaps(caps: Caps, dev: string): void;
  onAck(seq: number, r: string, res?: Record<string, string>): void;
  onState(frame: Record<string, unknown>): void;
  onInput(frame: Record<string, unknown>): void;
  onErr(frame: Record<string, unknown>): void;
  onStatus(status: LinkStatus, detail: string): void;
  /** 心跳往返耗时 */
  onPong(latencyMs: number): void;
  /** 判定掉线，上层据此通知用户并回到未连接态 */
  onLinkLost(reason: string): void;
}

export interface CueSpec {
  id: string;
  p?: Record<string, unknown>;
}

export class Session {
  private transport: Transport | null = null;
  private hooks: SessionHooks;
  private seq = 1;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private helloRetry: ReturnType<typeof setTimeout> | null = null;

  private status: LinkStatus = 'disconnected';
  /** 正在由我们自己执行 disconnect，此时收到的 transport 关闭事件不算掉线 */
  private closingByUs = false;
  private lastPongAt = 0;
  private pendingPings = new Map<number, number>(); // seq → 发出时刻
  private gotCaps = false;

  constructor(hooks: SessionHooks) {
    this.hooks = hooks;
  }

  // ------------------------------------------------------------------ 连接

  async connect(transport: Transport): Promise<void> {
    this.transport = transport;
    this.lastPongAt = performance.now();
    this.gotCaps = false;
    this.pendingPings.clear();
    this.setStatus('connecting', `正在连接 ${transport.label}`);

    transport.onMessage((line) => this.onLine(line));
    transport.onClose((reason) => {
      this.stopTimers();
      this.setStatus('disconnected', reason);
      // 被动的断开（拔线、对端自己断了）必须通知用户。
      // 我们自己点的"断开"不算掉线——那个有按钮反馈，再弹一次横幅是噪音。
      if (!this.closingByUs) this.hooks.onLinkLost(reason);
    });

    await transport.connect();

    // 先主动 hello 一次：设备连上时会自己发 ready，但那一帧有可能丢
    //（故障注入「不发 ready」就是模拟这个）。发 hello 能把它要回来。
    this.sendRaw({ c: 'hello', seq: this.nextSeq() });

    // 1.5 秒还没拿到 caps 就再喊一次，别让用户对着空白面板猜
    this.helloRetry = setTimeout(() => {
      if (!this.gotCaps) {
        this.hooks.onFrame('info', '1.5 秒没等到能力声明，重发一次 hello');
        this.sendRaw({ c: 'hello', seq: this.nextSeq() });
      }
    }, 1500);

    this.pingTimer = setInterval(() => this.ping(), HEARTBEAT_MS);
    this.watchTimer = setInterval(() => this.checkLink(), 1000);
  }

  async disconnect(): Promise<void> {
    this.stopTimers();
    const t = this.transport;
    this.transport = null;
    this.closingByUs = true;
    try {
      if (t) await t.close();
    } finally {
      this.closingByUs = false;
    }
    this.setStatus('disconnected', '已断开');
  }

  isConnected(): boolean {
    return this.transport !== null && this.status !== 'disconnected' && this.status !== 'lost';
  }

  // ------------------------------------------------------------------ 发送

  private nextSeq(): number {
    return this.seq++;
  }

  send(frame: Record<string, unknown>): void {
    this.sendRaw(frame);
  }

  private sendRaw(frame: Record<string, unknown>): void {
    if (!this.transport) return;
    const text = JSON.stringify({ v: PROTOCOL_VERSION, ...frame });
    void this.transport.send(text);
    this.hooks.onFrame('out', text);
  }

  cue(id: string, p: Record<string, unknown> = {}): void {
    this.sendRaw({ c: 'cue', id, p, seq: this.nextSeq() });
  }

  /** 一帧同时触发多个效果。共用时间戳，灯和声音才是真的同时动 */
  batch(cues: CueSpec[]): void {
    this.sendRaw({ c: 'batch', p: { cues }, seq: this.nextSeq() });
  }

  query(): void {
    this.sendRaw({ c: 'query', seq: this.nextSeq() });
  }

  reset(): void {
    this.sendRaw({ c: 'reset', seq: this.nextSeq() });
  }

  configure(p: Record<string, unknown>): void {
    this.sendRaw({ c: 'cfg', p, seq: this.nextSeq() });
  }

  ping(): void {
    if (!this.transport) return;
    const seq = this.nextSeq();
    this.pendingPings.set(seq, performance.now());
    this.sendRaw({ c: 'ping', seq });
  }

  // ------------------------------------------------------------------ 接收

  private onLine(rawLine: string): void {
    const line = rawLine.replace(/\r$/, '');

    // 协议 §2：只处理以 { 开头的行。ESP32 上电会往同一通道吐 ROM 日志，
    // 垃圾行静默丢弃——不回 err，也不进时间线的"帧"里，只当噪音记一笔。
    if (line.length === 0) return;
    if (line[0] !== '{') {
      this.hooks.onFrame('info', `丢弃非协议行：${line.slice(0, 80)}`);
      return;
    }

    this.hooks.onFrame('in', line);

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return; // 坏 JSON 由设备端回 err，这里不重复报
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.v !== undefined && msg.v !== PROTOCOL_VERSION) return;

    const seq = typeof msg.seq === 'number' ? msg.seq : -1;
    const now = performance.now();
    this.lastPongAt = now; // 任何有效帧都算对端还活着
    if (this.status === 'stale' || this.status === 'ready') {
      this.setStatus('active', '收到有效帧');
    }

    switch (msg.c) {
      case 'ready': {
        const caps = (msg.caps as Caps) ?? { out: [], in: [] };
        this.gotCaps = true;
        this.hooks.onCaps(caps, String(msg.dev ?? '未知装置'));
        if (this.status !== 'active') this.setStatus('ready', '握手完成');
        break;
      }
      case 'pong': {
        const sent = this.pendingPings.get(seq);
        if (sent !== undefined) {
          this.pendingPings.delete(seq);
          this.hooks.onPong(now - sent);
        }
        break;
      }
      case 'ack':
        this.hooks.onAck(seq, String(msg.r ?? ''), msg.res as Record<string, string> | undefined);
        break;
      case 'state':
        this.hooks.onState(msg);
        break;
      case 'input':
        this.hooks.onInput(msg);
        break;
      case 'err':
        this.hooks.onErr(msg);
        break;
      default:
        this.hooks.onFrame('info', `未知命令 ${String(msg.c)}`);
    }
  }

  private checkLink(): void {
    if (!this.transport) return;
    const silent = performance.now() - this.lastPongAt;
    if (silent > LINK_LOST_MS) {
      const reason = `${LINK_LOST_MS / 1000} 秒没收到 pong，判定掉线`;
      this.stopTimers();
      const t = this.transport;
      this.transport = null;
      void t?.close();
      this.setStatus('lost', reason);
      this.hooks.onLinkLost(reason);
    } else if (silent > HEARTBEAT_MS * 2 && this.status === 'active') {
      this.setStatus('stale', '心跳变慢，可能不稳');
    }
  }

  private stopTimers(): void {
    if (this.pingTimer !== null) clearInterval(this.pingTimer);
    if (this.watchTimer !== null) clearInterval(this.watchTimer);
    if (this.helloRetry !== null) clearTimeout(this.helloRetry);
    this.pingTimer = null;
    this.watchTimer = null;
    this.helloRetry = null;
  }

  private setStatus(status: LinkStatus, detail: string): void {
    if (this.status === status) return;
    this.status = status;
    this.hooks.onStatus(status, detail);
  }
}
