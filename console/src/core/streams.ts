/*
 * 高频流：收发时间线、心跳延迟、回执、错误计数。
 *
 * 这些能力原来住在 core/store.ts 里（阶段二专业版那条连接）。
 * 阶段四只剩一条连接，所以把它们搬到这里 —— 内容留着，文件本身删掉。
 * 去向：
 *   帧日志          → 调试栏目的收发时间线
 *   心跳延迟序列    → 设备页的心跳折线图与心跳记录表
 *   回执 + 错误计数 → 调试页「手动发 cue」的回执区
 *
 * 为什么要和 device.ts 的快照分开：
 *   device 的快照是低频的（连接状态、能力、当前输出），一次重连才变一跳。
 *   这里是高频的 —— 一次自检或一次 batch 能在几百毫秒里产生几十帧。
 *   如果混进同一个 useSyncExternalStore 快照，每追加一行都会让六个栏目整树重渲染。
 *   所以这里攒着，**合并到约 8 次/秒**再通知订阅者。
 */

import { useSyncExternalStore } from 'react';

export type LogDir = 'in' | 'out' | 'undelivered' | 'info' | 'error';

export interface LogEntry {
  id: number;
  /** 墙钟时刻（Date.now()），显示成 HH:MM:SS.mmm */
  t: number;
  dir: LogDir;
  text: string;
}

/** 心跳记录表的一行：一次 ping/pong 往返，或者一次掉线 */
export interface HbRow {
  id: number;
  t: number;
  ok: boolean;
  /** 掉线那行没有往返时间 */
  ms: number | null;
}

export interface AckInfo {
  seq: number;
  r: string;
  /** 只出现在 batch 的 ack 上：逐条结果 */
  res?: Record<string, string>;
}

export interface Streams {
  log: LogEntry[];
  /** 最近 40 次往返，给折线图用 */
  latency: number[];
  lastLatency: number | null;
  pongCount: number;
  errCount: number;
  lastAck: AckInfo | null;
  hb: HbRow[];
}

const MAX_LOG = 400;
const MAX_LATENCY = 40;
const MAX_HB = 60;
const FLUSH_MS = 120;

const EMPTY: Streams = {
  log: [],
  latency: [],
  lastLatency: null,
  pongCount: 0,
  errCount: 0,
  lastAck: null,
  hb: []
};

/** 往返超过这个毫秒数就标成「延迟」（虚拟装置是同步应答，真机上会高一些） */
export const SLOW_MS = 200;

class StreamsStore {
  private snap: Streams = EMPTY;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 1;

  getSnapshot = (): Streams => this.snap;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  /** 攒一会儿再通知 —— 见文件头注释 */
  private schedule(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      for (const cb of this.listeners) cb();
    }, FLUSH_MS);
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  // ------------------------------------------------------------ 写入

  /** 追加一行。text 已经是给人看的样子（帧要 JSON.stringify 过） */
  push(dir: LogDir, text: string): void {
    const s = this.snap;
    const log = s.log.length >= MAX_LOG ? s.log.slice(s.log.length - MAX_LOG + 1) : s.log.slice();
    log.push({ id: this.nextId++, t: Date.now(), dir, text });
    this.snap = { ...s, log };
    this.schedule();
  }

  /** 每个收到的 pong 记一行（**收到才有事件**，缺 pong 不是事件） */
  pong(ms: number): void {
    const s = this.snap;
    const hb = [...s.hb, { id: this.nextId++, t: Date.now(), ok: true, ms }].slice(-MAX_HB);
    const latency = [...s.latency, ms].slice(-MAX_LATENCY);
    this.snap = {
      ...s,
      hb,
      latency,
      lastLatency: ms,
      pongCount: s.pongCount + 1
    };
    this.schedule();
  }

  /**
   * 掉线。补一行「超时」—— SDK 只会在 10 秒没应答之后发 lost，
   * 没有"某一次 pong 没回来"这种事件，所以超时行只能挂在这里。
   */
  lost(): void {
    const s = this.snap;
    const hb = [...s.hb, { id: this.nextId++, t: Date.now(), ok: false, ms: null }].slice(-MAX_HB);
    this.snap = { ...s, hb, latency: [], lastLatency: null };
    this.schedule();
  }

  ack(a: AckInfo): void {
    this.snap = { ...this.snap, lastAck: a };
    this.schedule();
  }

  bumpErr(): void {
    this.snap = { ...this.snap, errCount: this.snap.errCount + 1 };
    this.schedule();
  }

  clearLog(): void {
    this.snap = { ...this.snap, log: [] };
    this.schedule();
  }

  /** 换装置时清空：否则设备页会显示上一台装置的曲线与计数 */
  reset(): void {
    this.snap = EMPTY;
    this.schedule();
  }
}

export const streams = new StreamsStore();

/**
 * 订阅高频流。
 * 因为 store 已经把通知合并到约 8 次/秒，这里用 useSyncExternalStore 是安全的 ——
 * 快照只在 flush 时换新对象，两次 flush 之间 getSnapshot 返回同一个引用。
 */
export function useStreams(): Streams {
  return useSyncExternalStore(streams.subscribe, streams.getSnapshot);
}

/** 折线图的纵轴上限：按观测到的最大值取整，并且留一个最低量程 */
export function latencyCeiling(latency: number[]): number {
  const max = latency.length ? Math.max(...latency) : 0;
  if (max <= 10) return 20;
  if (max <= 40) return 50;
  if (max <= 90) return 100;
  return Math.ceil(max / 100) * 100;
}
