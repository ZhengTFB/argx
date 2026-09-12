/* cue 参数的统一形状与转换。手动测试台、模拟器、预设按钮共用这一份。 */

export interface CueParams {
  /** 强度 0~1 */
  i: number;
  /** 持续毫秒 */
  dur: number;
  /** 渐变毫秒 */
  ramp: number;
  /** 0=critical 1=high 2=normal 3=ambient */
  pri: number;
  /** 常驻：忽略 dur，直到被抢占或复位 */
  hold: boolean;
}

export const DEFAULT_CUE: CueParams = { i: 1, dur: 5000, ramp: 0, pri: 2, hold: false };

export const PRIORITY_OPTIONS = [
  { value: '0', label: 'critical（永远抢占，先清空全部）' },
  { value: '1', label: 'high（剧情关键节点）' },
  { value: '2', label: 'normal（默认）' },
  { value: '3', label: 'ambient（氛围，可被打断）' }
];

/**
 * 转成协议里的 p 对象。
 * hold 时干脆不发 dur——协议里 dur 会被忽略，发过去只会让线上帧看起来自相矛盾。
 */
export function toWireParams(c: CueParams): Record<string, unknown> {
  const p: Record<string, unknown> = { i: c.i, pri: c.pri };
  if (!c.hold) p.dur = c.dur;
  if (c.ramp > 0) p.ramp = c.ramp;
  if (c.hold) p.hold = true;
  return p;
}

/** 界面上给人看的参数摘要 */
export function describeParams(c: CueParams): string {
  const bits = [`强度 ${c.i}`];
  if (c.hold) bits.push('常驻');
  else bits.push(`持续 ${c.dur}ms`);
  if (c.ramp > 0) bits.push(`渐变 ${c.ramp}ms`);
  bits.push(`优先级 ${c.pri}`);
  return bits.join(' · ');
}
