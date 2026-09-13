/*
 * 四路输出的界面词汇表。
 *
 * 和 core/capabilities.ts 的分工：
 *   capabilities.ts  讲原理 —— 引脚、要串多大电阻、买什么（接线文档用）
 *   channels.ts      讲界面 —— 这一路是连续量还是开关量、有哪些参数、状态词怎么写
 *
 * 为什么不从装置问：协议里 `caps.out` 只是一串 id 字符串（`"light.main"`），
 * 不带任何元数据——没有中文名、没有"这是连续量还是开关量"、没有参数范围。
 * 这些是协议的固定约定（PROTOCOL.md §6 / §13），所以只能在网页端硬编码一份。
 *
 * 颜色不在这里：走 design/tokens.css 的 `[data-ch="..."]` 作用域变量，
 * 组件加一个 data-ch 属性就能拿到 --ch / --ch-soft / --ch-fg / --ch-c1 / --ch-c2。
 * 这样"四路各一色"只有一处定义，不会在三个组件里各抄一遍。
 */

export type ChannelKey = 'light' | 'sound' | 'motion' | 'relay';

/** 连续量（配电平轨道与滑杆） / 开关量（只有两态，没有滑杆，切换无过渡） */
export type ChannelKind = 'level' | 'binary';

export interface ChannelParam {
  /** 协议里 p 的键：i / dur / ramp */
  key: 'i' | 'dur' | 'ramp';
  label: string;
  min: number;
  max: number;
  step: number;
  /** 0~1 的强度按百分比显示，其余按毫秒 */
  kind: 'level' | 'ms';
  def: number;
}

export interface Channel {
  id: string;
  key: ChannelKey;
  label: string;
  kind: ChannelKind;
  /**
   * 这一路此刻算不算"在工作"的门槛。
   * 判断只看 `i`，不看 `ttl` —— 关闭一条正在跑的效果时 `i` 归零但 `ttl` 仍是剩余毫秒，
   * 拿 `ttl` 判活会把"关"看成"开"。
   * 继电器是开关量，协议规定 i ≥ 0.5 才算吸合（PROTOCOL.md §6）。
   */
  threshold: number;
  /** 强度那一栏叫什么：灯光叫"亮度"，其余叫"强度" */
  intensityLabel: string;
  /** 模拟器/设备页上给这一路的参数控件（继电器是空的，它是开关量） */
  params: ChannelParam[];
  /** 状态词：空闲 / 在工作 / 常驻（ttl 报 -1，协议 §7） */
  states: { idle: string; active: string; resident: string };
}

const INTENSITY = (label: string, def: number): ChannelParam => ({
  key: 'i', label, min: 0, max: 1, step: 0.01, kind: 'level', def
});

const DURATION = (def: number): ChannelParam => ({
  key: 'dur', label: '时长', min: 0, max: 10000, step: 100, kind: 'ms', def
});

export const CHANNELS: Channel[] = [
  {
    id: 'light.main',
    key: 'light',
    label: '灯光',
    kind: 'level',
    threshold: 0.02,
    intensityLabel: '亮度',
    // 灯光是唯一给"渐变"滑杆的一路：它是故事里最常用来铺氛围的那个，
    // 声与振在作品里都是短促的一下，配渐变没有意义（原型也是这么给的）。
    params: [
      INTENSITY('亮度', 0.7),
      { key: 'ramp', label: '渐变', min: 0, max: 5000, step: 50, kind: 'ms', def: 800 },
      { key: 'dur', label: '持续', min: 0, max: 10000, step: 100, kind: 'ms', def: 3000 }
    ],
    states: { idle: '待机', active: '渐亮中', resident: '常驻' }
  },
  {
    id: 'sound.beeper',
    key: 'sound',
    label: '声音',
    kind: 'level',
    threshold: 0.02,
    intensityLabel: '强度',
    // 注意：协议支持连续强度，但**当前固件实现是二值的**
    //（i > 0.02 就输出 2.7kHz 方波，否则静音，音量不可调 —— 见 firmware/argx_mvp/capabilities.cpp）。
    // 所以滑杆保留（协议与虚拟装置都按连续量处理 i），文档页会如实写明这个差别。
    params: [INTENSITY('强度', 0.8), DURATION(500)],
    states: { idle: '待机', active: '发声', resident: '常驻' }
  },
  {
    id: 'motion.vibrate',
    key: 'motion',
    label: '振动',
    kind: 'level',
    threshold: 0.02,
    intensityLabel: '强度',
    params: [INTENSITY('强度', 0.6), DURATION(300)],
    states: { idle: '待机', active: '振动', resident: '常驻' }
  },
  {
    id: 'env.relay',
    key: 'relay',
    label: '继电器',
    kind: 'binary',
    threshold: 0.5,
    intensityLabel: '',
    // 开关量：**没有滑杆**。这不是漏写，是刻意的 ——
    // "第四路和前三路不是一回事"要在控件形态上直接看出来。
    params: [],
    states: { idle: '断开', active: '通路', resident: '通路' }
  }
];

export const CHANNEL_BY_ID: Record<string, Channel> = Object.fromEntries(
  CHANNELS.map((c) => [c.id, c])
);

export function channelOf(id: string): Channel | undefined {
  return CHANNEL_BY_ID[id];
}

/** 装置报回来的一路，没有就是 0（还没回查到、或者装置没声明这一路） */
export function levelOf(out: Record<string, { i: number }> | undefined, id: string): number {
  return out?.[id]?.i ?? 0;
}

/** 这一路此刻算不算在工作 —— 只看 `i`，门槛由能力自身的性质决定 */
export function isActive(id: string, i: number): boolean {
  const ch = CHANNEL_BY_ID[id];
  return i >= (ch?.threshold ?? 0.02);
}

/**
 * 状态词。
 * `ttl === -1` 是协议里"常驻效果"的表示法（不新增字段），
 * 所以常驻要单独说，不能混在普通倒计时里。
 */
export function stateWord(id: string, i: number, ttl: number): string {
  const ch = CHANNEL_BY_ID[id];
  if (!ch) return '—';
  if (!isActive(id, i)) return ch.states.idle;
  return ttl === -1 ? ch.states.resident : ch.states.active;
}

/** 强度写成人看的样子：0~1 的按百分比，毫秒的带单位 */
export function formatParam(p: ChannelParam, v: number): string {
  return p.kind === 'level' ? `${Math.round(v * 100)}%` : `${Math.round(v)}ms`;
}
