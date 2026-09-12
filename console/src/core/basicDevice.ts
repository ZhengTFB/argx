import { useSyncExternalStore } from 'react';
import { ARGX, type ArgxCaps, type ArgxTransport } from './sdk';
import { asArgxTransport } from './sdkTransports';
import { MockTransport } from '../transports/mock';
import { SerialTransport } from '../transports/serial';

/*
 * 小白控制台的那一条连接。
 *
 * 和专业控制台是**两条独立的连接**（各连各的装置），因为两边的用途不一样：
 * 专业版在调试协议，小白版只是"选个装置、看看它现在什么样"。
 * 好处是小白版可以整个建在 SDK 上——它就该是 SDK 的第一个用户，
 * 自己人都不用，怎么指望外人用。
 *
 * 三个决定：
 *   1. 传输层复用阶段二的 MockTransport / SerialTransport（不重写），
 *      中间隔一层 sdkTransports 翻译文本↔对象。
 *   2. 装置状态**靠回查**（ARGX.state()）而不是本地记账：
 *      "设备反馈什么就显示什么"，自检也才有判断依据。
 *   3. 这条通道同时交给 Demo 播放器（window.ARGX_HOST_TRANSPORT），
 *      所以 Demo 在房间里做的事，右边那栏看得见。
 */

export type DeviceKind = 'simulator' | 'hardware';

export interface OutState {
  i: number;
  ttl: number;
  pri: number;
}

export interface BasicDeviceSnapshot {
  kind: DeviceKind | null;
  /** SDK 的会话状态：disconnected / connecting / ready / active / stale / lost / mock */
  status: string;
  dev: string | null;
  caps: ArgxCaps | null;
  /** 最近一次回查到的输出状态。空对象 = 还没问到 */
  out: Record<string, OutState>;
  /** 最近一次回查成功的时刻，给界面显示"这是刚刚问到的" */
  outAt: number;
  connecting: boolean;
  /** 出问题时的一句话（不弹窗、不打断，直接写在界面上） */
  note: string | null;
  /**
   * 第几条会话。每换一次装置就 +1——Demo 播放器拿它当 iframe 的 key：
   * 换了装置，嵌在里面的作品要重新加载才能跟上新的通道。
   */
  sessionNo: number;
}

const POLL_MS = 800;
const QUERY_TIMEOUT_MS = 700;

const INITIAL: BasicDeviceSnapshot = {
  kind: null,
  status: 'disconnected',
  dev: null,
  caps: null,
  out: {},
  outAt: 0,
  connecting: false,
  note: null,
  sessionNo: 0
};

class BasicDevice {
  private snap: BasicDeviceSnapshot = INITIAL;
  private listeners = new Set<() => void>();
  private mock: MockTransport | null = null;
  private host: ArgxTransport | null = null;
  private poller: ReturnType<typeof setInterval> | null = null;
  private listening = false;
  /** 只增不减：Demo 播放器拿它当 key，重连一次就该重新加载一次 */
  private sessionCounter = 0;

  // ------------------------------------------------------------ 订阅

  getSnapshot = (): BasicDeviceSnapshot => this.snap;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  private patch(next: Partial<BasicDeviceSnapshot>): void {
    this.snap = { ...this.snap, ...next };
    for (const cb of this.listeners) cb();
  }

  /** 交给 Demo 播放器的通道。iframe 里的作品读的就是它 */
  get hostTransport(): ArgxTransport | null {
    return this.host;
  }

  // ------------------------------------------------------------ 连接

  /** 模拟器：复用阶段二的虚拟装置（反复连接复用同一台，状态不会莫名被重置） */
  useSimulator(): void {
    // 已经连上模拟器就别再连一次：StrictMode 会把 effect 跑两遍，
    // 而握手是异步的（刚 init 完还是 connecting），不加这一条会被连出两条会话
    if (this.snap.kind === 'simulator' && this.host && ARGX.status() !== 'lost') return;
    this.teardown();
    if (!this.mock) this.mock = new MockTransport('ARGX-0001');
    this.host = asArgxTransport(this.mock, '虚拟装置（模拟器）');
    this.attach('simulator');
  }

  /** 真实硬件：必须由用户的点击走到这里，浏览器才允许弹端口选择框 */
  async useHardware(): Promise<void> {
    if (this.snap.connecting) return;
    this.teardown();

    const serial = new SerialTransport();
    if (!serial.available) {
      // 连不上不是错误，是一种正常结局：把原因用一句人话写在界面上就够
      this.patch({ kind: null, status: 'disconnected', note: serial.unavailableReason ?? '这个浏览器不能连串口' });
      return;
    }
    this.host = asArgxTransport(serial, '真实装置（USB 串口）');
    this.attach('hardware', { connecting: true, note: null });

    // ARGX.connect() 里就是 requestPort()。中间不能 await 别的东西，
    // 否则会跳出用户点击的那个调用栈，浏览器直接拒绝弹窗。
    const ok = await ARGX.connect();
    this.patch({ connecting: false, note: ok ? null : '没能连上装置（也许你点了取消，或者线没插好）' });
    if (!ok) this.stopPolling();
  }

  disconnect(): void {
    this.teardown();
    this.patch({ ...INITIAL });
  }

  /** 进小白控制台时用：还没选过装置就默认连模拟器（和专业版的模拟器同一个做法） */
  ensure(): void {
    if (this.snap.kind === null) this.useSimulator();
  }

  private attach(kind: DeviceKind, extra: Partial<BasicDeviceSnapshot> = {}): void {
    this.listen();

    // 先清掉上一台装置留下的东西，否则换装置后右边那栏会显示上一次的数字
    this.patch({ ...INITIAL, kind, sessionNo: ++this.sessionCounter, ...extra });

    ARGX.init({ transport: this.host ?? 'mock' });
    // 把通道挂到 window 上：Demo 播放器的 iframe 就是这么拿到它的
    (window as unknown as { ARGX_HOST_TRANSPORT?: ArgxTransport }).ARGX_HOST_TRANSPORT = this.host ?? undefined;

    this.sync();
    this.startPolling();
  }

  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    // SDK 是单例，处理器会累积——所以每次重连前先清空这几类
    ARGX.off('status');
    ARGX.off('ready');
    ARGX.off('lost');
    ARGX.on('status', () => this.sync());
    ARGX.on('ready', () => this.sync());
    ARGX.on('lost', () => {
      this.stopPolling();
      this.patch({ out: {}, note: '装置断开了。可以重新选一次装置。' });
      this.sync();
    });
  }

  private sync(): void {
    this.patch({
      status: ARGX.status(),
      dev: ARGX.device(),
      caps: ARGX.caps()
    });
  }

  private isAlive(): boolean {
    const s = ARGX.status();
    return s === 'ready' || s === 'active' || s === 'stale';
  }

  // ------------------------------------------------------------ 回查

  private startPolling(): void {
    this.stopPolling();
    const tick = async () => {
      if (!this.isAlive()) return;
      const st = await ARGX.state({ timeout: QUERY_TIMEOUT_MS });
      if (!st) return; // 没应答就保持上一次的画面，不显示假数据
      this.patch({ out: st.out, outAt: Date.now() });
    };
    void tick();
    this.poller = setInterval(() => void tick(), POLL_MS);
  }

  private stopPolling(): void {
    if (this.poller !== null) clearInterval(this.poller);
    this.poller = null;
  }

  private teardown(): void {
    this.stopPolling();
    void ARGX.close();
    try {
      delete (window as unknown as { ARGX_HOST_TRANSPORT?: ArgxTransport }).ARGX_HOST_TRANSPORT;
    } catch {
      /* 删不掉也无所谓 */
    }
    this.mock = null;
    this.host = null;
  }
}

export const basicDevice = new BasicDevice();

export function useBasicDevice(): BasicDeviceSnapshot {
  return useSyncExternalStore(basicDevice.subscribe, basicDevice.getSnapshot);
}
