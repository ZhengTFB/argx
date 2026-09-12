/*
 * 内置能力的中文名、引脚、需要什么元件。
 *
 * 引脚号必须与 firmware/WIRING.md 以及 firmware/argx_mvp/capabilities.h 一致——
 * 那是接线时的唯一真值来源，这里只是把它搬到界面里给人看。
 * 改引脚时三处一起改。
 */

export interface CapInfo {
  id: string;
  label: string;
  /** 这个能力在故事里能干什么 */
  what: string;
  pin: string;
  /** 外围元件与注意事项 */
  parts: string;
  /** 玩家要买什么 */
  buy: string;
}

export const CAPABILITIES: Record<string, CapInfo> = {
  'light.main': {
    id: 'light.main',
    label: '灯光',
    what: '亮度 0~1 可调，支持渐变。最常用的一路，氛围全靠它',
    pin: 'GPIO4',
    parts: 'LED 或 LED 灯带的数据线。LED 必须串 220~330Ω 电阻，不串会烧',
    buy: '5V LED 灯带（WS2812 之类）或普通 LED 若干'
  },
  'sound.beeper': {
    id: 'sound.beeper',
    label: '声音',
    what: '鸣响与停止，固件用 2.7kHz 方波驱动，音量不可调',
    pin: 'GPIO18',
    parts: '有源或无源蜂鸣器，两根线，不分极性',
    buy: '有源蜂鸣器模块（几块钱）'
  },
  'motion.vibrate': {
    id: 'motion.vibrate',
    label: '振动',
    what: '强度 0~1 可调，适合做"敲击""震动"这种体感反馈',
    pin: 'GPIO17',
    parts: '振动马达必须经三极管或马达驱动模块，直连 GPIO 会烧引脚或让板子反复重启',
    buy: '振动马达 + 马达驱动模块'
  },
  'env.relay': {
    id: 'env.relay',
    label: '环境',
    what: '开关量，i≥0.5 视为吸合。接风扇、电磁锁、台灯这类市电设备',
    pin: 'GPIO16',
    parts: '继电器模块 VCC 必须接 5V/VIN，不能从 3V3 取电',
    buy: '5V 继电器模块（控制台灯、风扇等）'
  }
};

export const DEFAULT_CAP_IDS = Object.keys(CAPABILITIES);

export function capLabel(id: string): string {
  return CAPABILITIES[id]?.label ?? id;
}

/** 电容/电阻这类元件名对不懂硬件的人不友好，统一转成"人话需求清单" */
export function hardwareNeedsText(needs: string[]): string {
  if (needs.length === 0) return '不需要任何装置，纯网页作品';
  return needs.map((id) => CAPABILITIES[id]?.buy ?? id).join('；');
}
