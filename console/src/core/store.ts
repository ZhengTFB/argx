import { useSyncExternalStore } from 'react';
import type { Caps, Dir, LinkStatus } from './session';

/*
 * 极简全局状态。
 *
 * 不引状态管理库：整个控制台共享的东西就两块——连接状态与时间线，
 * 一个订阅/通知的对象加 useSyncExternalStore 就够了，还省一个依赖。
 *
 * 注意给 useStore 传的选择器只能返回**切片本身或基本类型**，
 * 不要在选择器里现造数组/对象（每次都是新引用，React 会认为状态一直在变）。
 */

export interface LogEntry {
  id: number;
  t: number;
  dir: Dir;
  text: string;
}

export interface AckInfo {
  seq: number;
  r: string;
  res?: Record<string, string>;
}

export interface ConnState {
  kind: 'mock' | 'serial' | null;
  label: string;
  status: LinkStatus;
  detail: string;
  dev: string | null;
  caps: Caps | null;
  latency: number | null;
  /** 最近若干次 pong 的往返耗时，连接测试用 */
  latencies: number[];
  /** 收到的 pong 总数，连接测试按差值算丢包 */
  pongCount: number;
  /** 收到的 err 总数 */
  errCount: number;
  lastAck: AckInfo | null;
  notice: string | null;
}

export interface AppState {
  conn: ConnState;
  log: LogEntry[];
}

const MAX_LOG = 400;

const initial: AppState = {
  conn: {
    kind: null,
    label: '',
    status: 'disconnected',
    detail: '未连接',
    dev: null,
    caps: null,
    latency: null,
    latencies: [],
    pongCount: 0,
    errCount: 0,
    lastAck: null,
    notice: null
  },
  log: []
};

class Store {
  private state: AppState = initial;
  private listeners = new Set<() => void>();
  private logId = 1;

  get = (): AppState => this.state;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  private emit(): void {
    for (const cb of this.listeners) cb();
  }

  patch(next: Partial<AppState>): void {
    this.state = { ...this.state, ...next };
    this.emit();
  }

  patchConn(next: Partial<ConnState>): void {
    this.patch({ conn: { ...this.state.conn, ...next } });
  }

  log(dir: Dir, text: string): void {
    const entry: LogEntry = { id: this.logId++, t: Date.now(), dir, text };
    const log = this.state.log.length >= MAX_LOG
      ? [...this.state.log.slice(this.state.log.length - MAX_LOG + 1), entry]
      : [...this.state.log, entry];
    this.patch({ log });
  }

  clearLog(): void {
    this.patch({ log: [] });
  }

  resetConnection(): void {
    this.patchConn({
      kind: null,
      label: '',
      status: 'disconnected',
      detail: '未连接',
      dev: null,
      caps: null,
      latency: null,
      latencies: [],
      lastAck: null
    });
  }
}

export const store = new Store();

export function useStore<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
