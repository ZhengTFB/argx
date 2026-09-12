/*
 * 阶段一虚拟设备的接入点。
 *
 * 模拟器**复用** device/virtual_device.js 这一份文件，不复制、不重写协议逻辑。
 * 那个文件是 UMD：在浏览器里它会把自己挂到 globalThis.ArgxVirtualDevice，
 * 所以这里用副作用导入把它加载进来，再把全局对象取出来做类型包装。
 *
 * 为什么不用 `import { VirtualDevice } from '...'`：那个文件按 UMD 写的，
 * 没有 ESM 导出，直接具名导入会拿到 undefined。改它又会动到阶段一已验收的产物。
 */

// 注意相对层级：本文件在 console/src/core/，仓库根要走三层。
// 故意不写 .js 后缀：这样 TS 会认旁边的 virtual_device.d.ts（写了 .js 后缀时
// TS 只会去找 virtual_device.js.d.ts 这种名字），Vite 那边会自己补上扩展名。
import '../../../device/virtual_device';

export interface DeviceCapState {
  i: number;
  active: boolean;
  pri: number;
  hold: boolean;
  ttl: number;
}

export interface DeviceState {
  dev: string;
  connected: boolean;
  state: 'disconnected' | 'ready' | 'active' | 'stale' | 'idle';
  resetting: boolean;
  t: number;
  uptime: number;
  caps: { out: string[]; in: string[] };
  out: Record<string, DeviceCapState>;
  in: Record<string, { active: boolean }>;
  lastFrameAt: number;
  transcript: string[];
}

export interface DeviceFaults {
  noReady: boolean;
  delayMs: number;
  dropRate: number;
  dropSeqs: number[];
  garbage: boolean;
  autoDisconnectMs: number;
  resetHoldMs: number;
}

export interface ArgxVirtualDevice {
  dev: string;
  faults: DeviceFaults;
  connect(): void;
  close(): void;
  isConnected(): boolean;
  send(frame: unknown): void;
  onMessage(cb: (frame: Record<string, unknown>) => void): this;
  onLine(cb: (line: string) => void): this;
  advance(ms: number): void;
  getState(): DeviceState;
  level(id: string): number;
  lines(): string[];
  registerCue(id: string, fn: (p: Record<string, unknown>) => void): unknown;
  registerInput(id: string, fn: (e: string, v: number) => void): unknown;
  injectInput(id: string, event: string, value: number): boolean;
  setFaults(f: Partial<DeviceFaults>): void;
  clearFaults(): void;
}

interface DeviceModule {
  VirtualDevice: new (opts?: Record<string, unknown>) => ArgxVirtualDevice;
  PROTOCOL: Record<string, number>;
  PRIORITY: Record<'critical' | 'high' | 'normal' | 'ambient', number>;
  PRIORITY_NAME: string[];
  DEFAULT_OUTPUTS: string[];
}

const mod = (globalThis as unknown as { ArgxVirtualDevice?: DeviceModule })
  .ArgxVirtualDevice;

if (!mod) {
  throw new Error(
    '没能加载 device/virtual_device.js。' +
      '它是阶段一的虚拟设备，模拟器直接复用这一份文件；' +
      '如果你刚挪动过目录，请确认 console/vite.config.ts 里的 server.fs.allow 覆盖到了仓库根。'
  );
}

export const VirtualDevice = mod.VirtualDevice;
export const PROTOCOL = mod.PROTOCOL;
export const PRIORITY = mod.PRIORITY;
export const PRIORITY_NAME = mod.PRIORITY_NAME;
export const DEFAULT_OUTPUTS = mod.DEFAULT_OUTPUTS;
