import { useSyncExternalStore } from 'react';
import { ARGX, type ArgxCaps, type ArgxTransport } from './sdk';
import { asArgxTransport } from './sdkTransports';
import { MockTransport } from '../transports/mock';
import { SerialTransport } from '../transports/serial';
import { streams } from './streams';
import type { ArgxVirtualDevice, DeviceFaults } from './virtualDevice';

/*
 * 全站唯一的那条连接。
 *
 * 阶段二、三有两条：专业版走 core/session.ts 的裸会话，小白版走 SDK。
 * 阶段四只剩一套界面，**这条就是 SDK 那条** —— 因为验收要求
 * 「右侧状态栏的数据全部来自 ARGX.state() 回查，界面不本地记账」，
 * 而回查是 SDK 的能力。connection.ts / store.ts 因此没有使用者，已删；
 * 它们有用的三样东西（帧日志、心跳延迟序列、回执与错误计数）搬进了 core/streams.ts。
 *
 * 这个文件是**全站唯一调用 ARGX API 的模块**。（`sdkTransports.ts` 里有一个
 * `import type { ArgxTransport }`，那只是搬运类型、不碰 API，不算例外。）
 * 原因有四条，都是踩出来的：
 *
 * 1. `ARGX.state()` 是先进先出队列，不按 seq 配对（sdk/argx.js 的 _pendingState.shift()）。
 *    两个调用者同时查，第二个的应答会解到第一个头上。所以：
 *    唯一的轮询器住在这里，别处一律调 `queryNow()`，它挂在下一个完成的查询上，
 *    保证任何时刻**只有一个 state 请求在飞**。
 *
 * 2. `ARGX.on('frame')` 给的是**对象**不是文本，写进日志要自己 JSON.stringify。
 *
 * 3. `ARGX.mode()` 分不出模拟器与真机 —— 只要传 Transport 进去，SDK 一律包成
 *    HostTransport，`mode()` 恒为 'host'。所以传输类型由本文件自己记。
 *
 * 4. `off(type)` 不带处理器会**清空整张处理器表**（sdk/argx.js）。所以不得
 *    随手 off：每个事件类型只在模块初始化时注册一次，退订按精确 token。
 *
 * 另外一条不属于 SDK 但同样致命：**不要复用 MockTransport 实例**。
 * VirtualDevice.close() 不清 _lineListeners，而 MockTransport.connect() 每次都重新注册，
 * 复用 + 重连 N 次 = 每一帧被投递 N 次、还留着 N 个僵尸会话。
 * 所以每次 attach 新建一个，故障开关作为这个模块自己的状态保存、再重新施加。
 */

export type DeviceKind = 'simulator' | 'hardware';

/** 协议 state 帧里的每一路输出 */
export interface OutState {
  i: number;
  ttl: number;
  pri: number;
}
export type OutMap = Record<string, OutState>;

export interface DeviceSnapshot {
  /** null = 还没选过装置 */
  kind: DeviceKind | null;
  /** 传输通道的人话名字（'虚拟装置（模拟器）' / '真实装置（USB 串口）'） */
  transportLabel: string | null;
  /** SDK 的会话状态：disconnected / connecting / ready / active / stale / lost / host */
  status: string;
  /** SDK 给的补充说明（掉线原因之类） */
  detail: string;
  dev: string | null;
  caps: ArgxCaps | null;
  /** 最近一次回查到的输出。空对象 = 还没问到 */
  out: OutMap;
  /** 最近一次回查成功的时刻 */
  outAt: number;
  /** 装置自报的开机时长（ms），来自 state.uptime */
  uptime: number | null;
  connecting: boolean;
  /** 常驻在界面上的一句话（不是弹窗） */
  note: string | null;
  /** 一次性通知（掉线之类）。noticeSeq 单调递增，界面消费一次就别再弹 */
  notice: string | null;
  noticeSeq: number;
  /** 每换一次装置 +1。作品播放器拿它当 iframe 的 key */
  sessionNo: number;
  /** 故障注入开关（控制台自己的状态，重连后重新施加到虚拟装置上） */
  faults: DeviceFaults;
  /** 给虚拟装置注册一个示例输入（见 setInputSample 的注释） */
  inputSample: boolean;
  /** SDK 给的环境提示（file:// 打不开串口之类），空串 = 没问题 */
  hint: string;
}

export const NO_FAULTS: DeviceFaults = {
  noReady: false,
  delayMs: 0,
  dropRate: 0,
  dropSeqs: [],
  garbage: false,
  autoDisconnectMs: 0,
  resetHoldMs: 0
};

/** 示例输入 id。只在"注册示例输入"打开时给虚拟装置注册，真机固件不受影响 */
export const EXAMPLE_INPUT_ID = 'input.button';

const POLL_MS = 800;
const QUERY_TIMEOUT_MS = 700;

const INITIAL: DeviceSnapshot = {
  kind: null,
  transportLabel: null,
  status: 'disconnected',
  detail: '',
  dev: null,
  caps: null,
  out: {},
  outAt: 0,
  uptime: null,
  connecting: false,
  note: null,
  notice: null,
  noticeSeq: 0,
  sessionNo: 0,
  faults: NO_FAULTS,
  inputSample: false,
  hint: ''
};

class Device {
  private snap: DeviceSnapshot = INITIAL;
  private listeners = new Set<() => void>();
  private mock: MockTransport | null = null;
  private host: ArgxTransport | null = null;
  private poller: ReturnType<typeof setInterval> | null = null;
  private sessionCounter = 0;

  /** 等着下一次回查结果的人（见 queryNow） */
  private waiters: Array<(out: OutMap | null) => void> = [];
  /** 有没有一次 ARGX.state() 正在飞 —— 这条保证同时只飞一个 */
  private ticking = false;

  // ------------------------------------------------------------ 订阅

  getSnapshot = (): DeviceSnapshot => this.snap;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  private patch(next: Partial<DeviceSnapshot>): void {
    this.snap = { ...this.snap, ...next };
    for (const cb of this.listeners) cb();
  }

  /** 一次性通知：走单调递增的序号，界面只消费一次 */
  private notify(text: string): void {
    this.patch({ notice: text, noticeSeq: this.snap.noticeSeq + 1 });
  }

  /** 交给作品播放器的通道。iframe 里的作品读 window.ARGX_HOST_TRANSPORT */
  get hostTransport(): ArgxTransport | null {
    return this.host;
  }

  /** 模拟器与故障注入面板要直接操作虚拟装置。真机连接时是 null */
  get virtualDevice(): ArgxVirtualDevice | null {
    return this.mock ? this.mock.device : null;
  }

  // ------------------------------------------------------------ 连接

  /**
   * 连虚拟装置。
   * 每次新建 MockTransport（绝不复用，见文件头第 4 条），
   * 然后把控制台保存的故障开关重新施加上去 —— 重连不该把故障悄悄清掉，
   * 否则"我设了故障但没生效"会变成常态。
   */
  useSimulator(): void {
    if (this.snap.kind === 'simulator' && this.host && ARGX.status() !== 'lost') return;

    const mock = new MockTransport('ARGX-0001');
    if (this.snap.inputSample) {
      // 注册在 init 之前：装置的 caps 是在 ready 时遍历注册表生成的，
      // 连上之后再注册就得等下一次 hello 才会出现在 caps 里。
      mock.device.registerInput(EXAMPLE_INPUT_ID, () => { /* 虚拟按钮，没有实体 */ });
    }
    mock.device.setFaults(this.snap.faults);

    this.mock = mock;
    this.host = asArgxTransport(mock, '虚拟装置（模拟器）');
    this.attach('simulator');
  }

  /** 真实硬件：必须由用户的点击直接走到这里，浏览器才允许弹端口选择框 */
  async useHardware(): Promise<void> {
    if (this.snap.connecting) return;

    const serial = new SerialTransport();
    if (!serial.available) {
      // 连不上不是错误，是一种正常结局：把原因用一句人话写在界面上就够
      this.teardown();
      this.patch({
        ...INITIAL,
        faults: this.snap.faults,
        inputSample: this.snap.inputSample,
        note: serial.unavailableReason ?? '这个浏览器不能连串口'
      });
      return;
    }

    this.mock = null;
    this.host = asArgxTransport(serial, '真实装置（USB 串口）');
    // attach 里会调 ARGX.init()，而 init 里就是 requestPort()。
    // 中间不能 await 别的东西，否则会跳出用户点击的那个调用栈，浏览器直接拒绝弹窗。
    this.attach('hardware', { connecting: true, note: null });

    // ARGX.connect() 对串口来说是等端口打开；对已 init 的 host 通道会立刻返回 true
    const ok = await ARGX.connect();
    this.patch({
      connecting: false,
      note: ok ? null : '没能连上装置（也许你点了取消，或者线没插好）'
    });
    if (!ok) this.stopPolling();
  }

  disconnect(): void {
    this.teardown();
    this.patch({ ...INITIAL, faults: this.snap.faults, inputSample: this.snap.inputSample });
  }

  /** 进模拟器时用：还没选过装置就默认连虚拟装置 */
  ensure(): void {
    if (this.snap.kind === null) this.useSimulator();
  }

  private attach(kind: DeviceKind, extra: Partial<DeviceSnapshot> = {}): void {
    this.stopPolling();
    void ARGX.close(); // 上一台装置的会话先收干净

    // 换装置就把上一台留下的日志、延迟曲线、计数清掉
    streams.reset();

    this.patch({
      ...INITIAL,
      faults: this.snap.faults,
      inputSample: this.snap.inputSample,
      kind,
      transportLabel: this.host?.label ?? null,
      sessionNo: ++this.sessionCounter,
      ...extra
    });

    ARGX.init({ transport: this.host ?? 'mock' });
    // 把通道挂到 window 上：作品播放器的 iframe 就是这么拿到它的
    (window as unknown as { ARGX_HOST_TRANSPORT?: ArgxTransport }).ARGX_HOST_TRANSPORT =
      this.host ?? undefined;

    streams.push('info', `已连接 ${this.snap.transportLabel ?? kind}`);
    this.sync();
    this.startPolling();
  }

  private sync(): void {
    this.patch({
      status: ARGX.status(),
      dev: ARGX.device(),
      caps: ARGX.caps(),
      hint: ARGX.hint()
    });
  }

  /* ---------------- 给事件接线用的公开入口（下面的 listen 只调这三个） ---------------- */

  /** 会话状态变了。detail 是 SDK 给的原话，一字不改透出去 */
  applyStatus(status: string, detail: string): void {
    this.patch({ status, detail, dev: ARGX.device(), caps: ARGX.caps() });
  }

  /** 重新对一遍能力与设备号（收到 ready 时用） */
  resync(): void {
    this.patch({ dev: ARGX.device(), caps: ARGX.caps(), status: ARGX.status() });
  }

  /** 掉线：停轮询、清掉画面上的输出、留一句通知 */
  applyLost(reason: string): void {
    this.stopPolling();
    // 输出清空是必须的：装置已经不在话下了，再显示上一次的亮度就是本地记账
    this.patch({ out: {}, outAt: 0, uptime: null, status: 'lost', detail: reason });
    this.notify(`连接已断开：${reason}`);
  }

  private isAlive(): boolean {
    const s = ARGX.status();
    return s === 'ready' || s === 'active' || s === 'stale';
  }

  // ------------------------------------------------------------ 回查

  private startPolling(): void {
    this.stopPolling();
    void this.tick();
    this.poller = setInterval(() => void this.tick(), POLL_MS);
  }

  private stopPolling(): void {
    if (this.poller !== null) clearInterval(this.poller);
    this.poller = null;
    const waiters = this.waiters;
    this.waiters = [];
    for (const w of waiters) w(null);
  }

  /** 全站唯一调 ARGX.state() 的地方。ticking 保证任何时刻只有一个请求在飞 */
  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const st = this.isAlive() ? await ARGX.state({ timeout: QUERY_TIMEOUT_MS }) : null;
      if (st) {
        this.patch({ out: st.out as OutMap, uptime: st.uptime ?? null, outAt: Date.now() });
      }
      const waiters = this.waiters;
      this.waiters = [];
      for (const w of waiters) w(st ? (st.out as OutMap) : null);
    } finally {
      this.ticking = false;
    }
  }

  /**
   * 立刻要一份最新的输出状态（自检、连接测试用）。
   *
   * 它不自己调 ARGX.state()，而是**挂在下一个完成的轮询上** ——
   * 否则调用方和轮询器会同时发查询，而 SDK 的应答是按先来后到配对的，
   * 两边会各自拿到对方的应答。没应答就 resolve(null)，界面据此判"没回查到"。
   */
  queryNow(): Promise<OutMap | null> {
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      void this.tick();
    });
  }

  // ------------------------------------------------------------ 故障注入

  /**
   * 改一个故障开关：既更新界面状态，也立刻施加到虚拟装置上。
   *
   * `restart` 用在**只在连接那一刻起作用**的故障上（不发 ready、延迟应答、
   * 中途断连）：它们要么在 connect() 里排好定时器，要么在握手时生效，
   * 对一条已经连上的通道拨开关是没有用的。不自动重连的话，
   * 就只能靠一行小字告诉用户"重连后生效"——而没人会去重连。
   */
  setFault<K extends keyof DeviceFaults>(key: K, value: DeviceFaults[K], restart = false): void {
    const faults = { ...this.snap.faults, [key]: value };
    this.patch({ faults });
    this.virtualDevice?.setFaults({ [key]: value } as Partial<DeviceFaults>);
    if (restart) this.restart();
  }

  /** 断掉重连（只有虚拟装置能这样，真机得让用户再点一次按钮） */
  restart(): void {
    if (this.snap.kind !== 'simulator') return;
    this.teardown();
    this.patch({ ...INITIAL, faults: this.snap.faults, inputSample: this.snap.inputSample });
    this.useSimulator();
  }

  clearFaults(): void {
    this.patch({ faults: { ...NO_FAULTS } });
    this.virtualDevice?.clearFaults();
  }

  /**
   * 要不要给虚拟装置注册一个示例输入。
   *
   * 真机固件没有接任何物理输入（caps.in 是空的），所以"注入 input 看上行链路"
   * 这件事在默认状态下只能看到 err:unknown_input。打开这个开关，虚拟装置会多声明
   * 一个 input.button，上行链路就能真的走通一次。
   *
   * 注册必须在连接之前完成（caps 是 ready 时生成的），所以这里改完要重连一次。
   */
  setInputSample(on: boolean): void {
    if (this.snap.inputSample === on) return;
    this.patch({ inputSample: on });
    // 重连一次，让新的 caps 生效
    this.restart();
  }

  /** 手动注入一帧反向通道 input（只有虚拟装置能收，真机没有这个入口） */
  injectInput(id: string, event: string, value: number): boolean {
    return this.virtualDevice?.injectInput(id, event, value) ?? false;
  }

  // ------------------------------------------------------------ 下行指令
  //
  // 界面不直接 import core/sdk（文件头那条规矩），要发什么一律走这四个。
  // 它们都是 SDK 的透传，SDK 自己保证「没连接、file:// 一律静默降级，不抛错」。

  /*
   * 发完立刻回查一次。
   *
   * 为什么不能等轮询：轮询 800ms 一次，而振动、短鸣这些效果的 dur 只有 300~500ms ——
   * 等下一拍再查，效果早就结束了，右栏会**从头到尾都没显示过**。
   * 这不是本地记账（那会被明令禁止），走的是同一条 query → state 链路，
   * 只是把时机提前了：出站帧和查询帧走同一条通道，装置按顺序处理，
   * 所以查到的状态一定已经包含刚发的那条 cue。
   */
  private refreshSoon(): void {
    void this.queryNow();
  }

  /** 单个能力 */
  cue(id: string, p?: Record<string, unknown>): boolean {
    const ok = ARGX.cue(id, p);
    this.refreshSoon();
    return ok;
  }

  /** 一帧同时触发多个（协议上限 8 条，校验原子） */
  batch(cues: Array<{ id: string; p?: Record<string, unknown> }>): boolean {
    const ok = ARGX.batch(cues);
    this.refreshSoon();
    return ok;
  }

  /** 按事件词表触发（作者写的那套语言） */
  fire(name: string): boolean {
    const ok = ARGX.fire(name);
    this.refreshSoon();
    return ok;
  }

  /** 强制回到空闲。critical 优先级，先清空全部输出 */
  reset(): void {
    ARGX.reset();
    this.refreshSoon();
  }

  /** 事件词表：内置六个 + 作品自己 defineEvent 注册的 */
  events(): Record<string, { label: string; desc: string; cues: Array<{ id: string; p?: Record<string, unknown> }> }> {
    return ARGX.events();
  }

  /** 开发期热更新：不清干净的话，换一次模块就会多一个轮询器在跑 */
  dispose(): void {
    this.stopPolling();
    streams.dispose();
    this.teardown();
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

export const device = new Device();

export function useDevice(): DeviceSnapshot {
  return useSyncExternalStore(device.subscribe, device.getSnapshot);
}

/* ============================================================
   事件接线
   ------------------------------------------------------------
   每个事件类型**只在模块初始化时注册一次**，处理器具名。
   绝不 `off(type)` —— 不带处理器的 off 会清空整张表（文件头第 4 条），
   两个组件各订阅一次再各自退订就会互相抹掉。
   ============================================================ */
type AnyFn = (...args: never[]) => void;
const listen = (type: string, fn: (...args: unknown[]) => void): void => {
  ARGX.on(type, fn as unknown as AnyFn);
};

const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''));

listen('status', (...args) => {
  const [status, detail] = args as [string, string];
  device.applyStatus(str(status), str(detail));
});

listen('ready', (...args) => {
  device.resync();
  const [caps] = args as [{ out?: string[] } | undefined];
  streams.push('info', `装置自报能力：${caps?.out?.length ?? ARGX.caps()?.out.length ?? 0} 路输出`);
});

listen('frame', (...args) => {
  const [msg, dir] = args as [Record<string, unknown>, string];
  // SDK 给的是对象，日志里要自己序列化。
  // err 帧只记一条：这里按错误色记，下面那个 'err' 处理器只累加计数 ——
  // 两个都记的话，「只看错误」会对同一个错误显示两行。
  streams.push(
    msg && msg.c === 'err' ? 'error' : (str(dir) as 'in' | 'out' | 'undelivered'),
    JSON.stringify(msg)
  );
});

listen('err', () => {
  streams.bumpErr();
});

listen('ack', (...args) => {
  const [a] = args as [{ seq: number; r: string; res?: Record<string, string> }];
  streams.ack({ seq: a.seq, r: a.r, res: a.res });
});

listen('pong', (...args) => {
  const [ms] = args as [number];
  streams.pong(Math.round(ms));
});

listen('lost', (...args) => {
  const [reason] = args as [string];
  streams.lost();
  streams.push('error', `掉线：${str(reason)}`);
  device.applyLost(str(reason));
});

/* 开发期热更新：不清干净的话，换一次模块就多一个轮询器 + 一份 SDK 处理器 */
const hot = (import.meta as unknown as { hot?: { dispose(cb: () => void): void } }).hot;
hot?.dispose(() => device.dispose());
