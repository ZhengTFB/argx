import type { OutState } from '../../core/basicDevice';

/*
 * 小白版眼睛里的四路输出。
 *
 * 和专业版 core/capabilities.ts 的分工：那边讲原理（引脚、要串多大电阻、买什么），
 * 这里只讲"现在是什么样"——所以只有一句人话的状态文案，一个术语都没有。
 *
 * 判断"是不是亮着"各路的门槛不同，这是能力本身的性质，不是显示问题：
 * 继电器是开关量（协议里 i≥0.5 才算吸合），灯光声音振动是连续的。
 */

export interface BasicCap {
  id: string;
  label: string;
  /** 现在什么样，一句话，无术语 */
  status(i: number): string;
  /** 这一路此刻算不算"在工作" */
  active(i: number): boolean;
}

const ON = 0.02;

export const BASIC_CAPS: BasicCap[] = [
  {
    id: 'light.main',
    label: '灯光',
    status: (i) => (i > ON ? `亮着 ${Math.round(i * 100)}%` : '没亮'),
    active: (i) => i > ON
  },
  {
    id: 'sound.beeper',
    label: '声音',
    status: (i) => (i > ON ? '响着' : '安静'),
    active: (i) => i > ON
  },
  {
    id: 'motion.vibrate',
    label: '振动',
    status: (i) => (i > ON ? '在震' : '停着'),
    active: (i) => i > ON
  },
  {
    id: 'env.relay',
    label: '环境',
    // 继电器只有通与断，协议规定 i≥0.5 算吸合
    status: (i) => (i >= 0.5 ? '通电' : '断开'),
    active: (i) => i >= 0.5
  }
];

/** 设备反馈里的那一路，没有就是 0（还没回查到时也走这里） */
export function levelOf(out: Record<string, OutState>, id: string): number {
  return out[id]?.i ?? 0;
}
