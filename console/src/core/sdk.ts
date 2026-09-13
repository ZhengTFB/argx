/*
 * 阶段三 SDK 的接入点。
 *
 * 小白控制台和 Demo 播放器都走这一个 SDK，而不是再写一套——
 * 理由和模拟器复用 device/virtual_device.js 一样：同一份逻辑只留一份。
 *
 * 那个文件是 UMD（挂 globalThis.ARGX），没有 ESM 导出，所以这里用
 * 副作用导入 + 全局对象包装。故意不写 .js 后缀：这样 TS 会认旁边的
 * sdk/argx.d.ts，Vite 那边会自己补上扩展名。
 *
 * 注意：SDK 是**单例**（一个页面一个）。小白控制台只用一个会话，
 * 所以够用；将来要同时接两台装置，得先给它加个实例化的入口。
 */

import * as sdkModule from '../../../sdk/argx';

/** SDK 的传输层契约：收发的是**对象**，序列化与帧定界由传输层负责 */
export interface ArgxTransport {
  label?: string;
  connect(): void | Promise<void>;
  send(frame: Record<string, unknown>): void | Promise<void>;
  onMessage(cb: (frame: Record<string, unknown>) => void): void;
  onClose(cb: (reason: string) => void): void;
  close(): void | Promise<void>;
}

export interface ArgxCaps {
  out: string[];
  in: string[];
}

export interface ArgxStateFrame {
  dev?: string;
  uptime?: number;
  out: Record<string, { i: number; ttl: number; pri: number }>;
  in: Record<string, unknown>;
}

export interface ArgxApi {
  init(opts?: {
    transport?: 'auto' | 'serial' | 'mock' | ArgxTransport;
    quiet?: boolean;
    keep?: boolean;
  }): ArgxApi;
  connect(): Promise<boolean>;
  close(): Promise<void>;
  fire(name: string): boolean;
  cue(id: string, p?: Record<string, unknown>): boolean;
  batch(cues: { id: string; p?: Record<string, unknown> }[]): boolean;
  reset(): void;
  defineEvent(name: string, cues: { id: string; p?: Record<string, unknown> }[], meta?: { label?: string; desc?: string }): boolean;
  events(): Record<string, { label: string; desc: string; cues: { id: string; p?: Record<string, unknown> }[] }>;
  state(opts?: { timeout?: number }): Promise<ArgxStateFrame | null>;
  on(type: string, fn: (...args: never[]) => void): ArgxApi;
  off(type: string, fn?: (...args: never[]) => void): ArgxApi;
  status(): string;
  mode(): 'serial' | 'mock' | 'host';
  caps(): ArgxCaps | null;
  device(): string | null;
  hint(): string;
}

/*
 * 两条路都取一次，因为 dev 与 build 拿到它的方式**不一样**：
 *
 *   dev    Vite 原样服务那个 UMD，它自己跑 `root.ARGX = factory()` → 走 globalThis
 *   build  打包器把 UMD 当成 CJS，喂给它一个假的 module/exports，
 *          于是它走 `module.exports = factory()` 那条分支，**根本不碰 globalThis**。
 *
 * 只认 globalThis 的话，dev 全绿、构建产物一片白 —— 而且构建产物没人跑过，
 * 这坑就一直藏着（阶段五部署 Pages 时第一次暴露）。两边都取就没这问题。
 */
const api =
  (globalThis as unknown as { ARGX?: ArgxApi }).ARGX ??
  (sdkModule as unknown as { default?: ArgxApi }).default;

if (!api) {
  throw new Error(
    '没能加载 sdk/argx.js。小白控制台与 Demo 播放器都靠它——' +
      '确认 console/vite.config.ts 里的 fs.allow 覆盖到了仓库根，' +
      '并且这个文件是从 ../../../sdk/argx 导入的。'
  );
}

export const ARGX: ArgxApi = api;
