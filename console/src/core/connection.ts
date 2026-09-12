import { MockTransport } from '../transports/mock';
import { SerialTransport } from '../transports/serial';
import type { Transport } from '../transports/types';
import { Session } from './session';
import { store } from './store';


/*
 * 把会话层、传输层、全局状态粘在一起，并保证全局只有一份。
 *
 * 界面只跟这个对象打交道：connectMock / connectSerial / disconnect。
 * 换传输方式不影响上面任何东西——这正是把传输层抽象出来的意义。
 */
class Connection {
  readonly session: Session;
  private mockSingleton: MockTransport | null = null;
  /** 防重入：连点两下按钮、或 React 严格模式把 effect 跑两遍时，都不该连出两条通道 */
  private connecting = false;

  constructor() {
    this.session = new Session({
      onFrame: (dir, text) => store.log(dir, text),
      onCaps: (caps, dev) => {
        store.patchConn({ caps, dev });
        store.log('info', `能力声明：${caps.out.length} 路输出、${caps.in.length} 路输入`);
      },
      onAck: (seq, r, res) => {
        const extra = res ? ` ${JSON.stringify(res)}` : '';
        store.log('info', `ack seq=${seq} → ${r}${extra}`);
        store.patchConn({ lastAck: res ? { seq, r, res } : { seq, r } });
      },
      onState: (frame) => {
        store.log('info', `state：${JSON.stringify(frame.out ?? {})}`);
      },
      onInput: (frame) => {
        store.log('info', `input：${String(frame.id)} ${String(frame.e)}=${String(frame.v)}`);
      },
      onErr: (frame) => {
        store.log('error', `err ${String(frame.code)}：${String(frame.msg ?? '')}`);
        store.patchConn({ errCount: store.get().conn.errCount + 1 });
      },
      onStatus: (status, detail) => {
        store.patchConn({ status, detail });
      },
      onPong: (latencyMs) => {
        const ms = Math.round(latencyMs);
        const prev = store.get().conn;
        // 只留最近 40 次，连接测试看的是近期稳定性，不是从头到尾的平均值
        const latencies = [...prev.latencies, ms].slice(-40);
        store.patchConn({ latency: ms, latencies, pongCount: prev.pongCount + 1 });
      },
      onLinkLost: (reason) => {
        store.patchConn({
          status: 'disconnected',
          detail: reason,
          notice: `连接已断开：${reason}`,
          latency: null
        });
        store.log('error', `掉线：${reason}`);
      }
    });
  }

  /**
   * 连虚拟装置。反复连接复用同一个实例：
   * 故障注入的开关不会因为重连被悄悄重置——那会让"我设了故障但没生效"变成常态。
   */
  async connectMock(): Promise<void> {
    if (this.connecting) return;
    if (!this.mockSingleton) this.mockSingleton = new MockTransport();
    const t: Transport = this.mockSingleton;
    this.connecting = true;
    store.patchConn({
      kind: 'mock',
      label: this.mockSingleton.label,
      notice: null,
      detail: '正在连接虚拟装置',
      latencies: [],
      pongCount: 0,
      errCount: 0,
      lastAck: null
    });
    try {
      await this.session.connect(t);
    } finally {
      this.connecting = false;
    }
  }

  async connectSerial(): Promise<void> {
    if (this.connecting) return;
    const t = new SerialTransport();
    this.connecting = true;
    store.patchConn({
      kind: 'serial',
      label: t.label,
      notice: null,
      detail: '正在连接真实串口',
      latencies: [],
      pongCount: 0,
      errCount: 0,
      lastAck: null
    });
    try {
      await this.session.connect(t);
    } catch (e) {
      // 用户取消端口选择、或者没有权限，都走这里。
      // 不是崩溃，只是回到未连接态并把原因说清楚。
      const msg = e instanceof Error ? e.message : String(e);
      store.patchConn({ status: 'disconnected', detail: msg, notice: `连接失败：${msg}` });
      store.log('error', `连接失败：${msg}`);
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    await this.session.disconnect();
  }

  /** 模拟器要直接操作虚拟装置（故障注入面板、预设按钮） */
  get mock(): MockTransport | null {
    return this.mockSingleton;
  }
}

export const connection = new Connection();
