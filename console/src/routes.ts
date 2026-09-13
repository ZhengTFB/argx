import type { ComponentType } from 'react';
import {
  IcoDebug, IcoDevice, IcoDocs, IcoGuide, IcoLibrary, IcoSimulator
} from './ui/icons';

/*
 * 路由：只有一套界面，hash 空间按六个栏目重定。
 *
 *   #onboarding  #library  #device  #simulator  #docs  #debug
 *   #play:<workId>   自家作品的站内播放页（不算一级栏目，ARG 库那一格保持高亮）
 *
 * 旧的两套 hash（小白版的 #home / #help，专业版的 #overview / #works /
 * #timeline / #creator）**不留死链**：重定向到最接近的新栏目，并且**改写地址栏** ——
 * 只跳转不改地址的话，"没留死链"这件事没法被验证，用户也会看到地址栏里躺着一个
 * 已经不存在的页面名。
 */

export type SectionKey = 'onboarding' | 'library' | 'device' | 'simulator' | 'docs' | 'debug';

export const SECTION_KEYS: SectionKey[] = [
  'onboarding', 'library', 'device', 'simulator', 'docs', 'debug'
];

export interface SectionMeta {
  key: SectionKey;
  /** 顶部胶囊 tab 里的文字 */
  label: string;
  /** 侧栏 tooltip 里的文字（比 tab 长一点没关系） */
  tip: string;
  Icon: ComponentType;
}

export const SECTIONS: SectionMeta[] = [
  { key: 'onboarding', label: '引导',  tip: '引导',     Icon: IcoGuide },
  { key: 'library',    label: 'ARG 库', tip: 'ARG 库',   Icon: IcoLibrary },
  { key: 'device',     label: '设备',  tip: '设备',     Icon: IcoDevice },
  { key: 'simulator',  label: '模拟器', tip: '模拟器',   Icon: IcoSimulator },
  { key: 'docs',       label: '文档',  tip: '文档',     Icon: IcoDocs },
  { key: 'debug',      label: '调试',  tip: '功能调试', Icon: IcoDebug }
];

export interface Route {
  section: SectionKey;
  /** 站内播放的作品 id（#play:<id>） */
  play?: string;
  /**
   * 地址栏里的 hash 不是新空间里的值时，这里给出该改写成的值。
   * App 会用它做 history.replaceState —— 旧链接能落到合理位置，而且地址栏跟着变干净。
   */
  rewrite?: string;
}

/** 旧 hash → 新栏目。四个语义没变的直接复用；其余映射到最接近的一个。 */
export const OLD_HASH_MAP: Record<string, SectionKey> = {
  // 语义没变，直接复用
  device: 'device',
  library: 'library',
  simulator: 'simulator',
  docs: 'docs',
  // 小白版
  home: 'onboarding',
  help: 'onboarding',
  // 专业版
  overview: 'device',   // 总览讲的是装置状态，并进设备页
  devices: 'device',
  works: 'library',
  timeline: 'debug',    // 旧时间线并入调试栏目
  creator: 'library'    // 旧的创作者平台是空占位，并进作品目录
};

const NEW_HASHES = new Set<string>(SECTION_KEYS);

export function parseHash(rawHash: string): Route {
  const h = rawHash.replace(/^#/, '').trim();
  if (!h) return { section: 'onboarding' };

  if (h.startsWith('play:')) {
    const id = h.slice(5);
    return id ? { section: 'library', play: id } : { section: 'library' };
  }

  if (NEW_HASHES.has(h)) return { section: h as SectionKey };

  const mapped = OLD_HASH_MAP[h];
  if (mapped) return { section: mapped, rewrite: `#${mapped}` };

  // 认不出来的也落到引导页，但**不改写地址栏** ——
  // 未知 hash 有可能是别人自己的锚点，替他改掉更糟。
  return { section: 'onboarding' };
}

export function hashOf(section: SectionKey): string {
  return `#${section}`;
}

export function playHash(workId: string): string {
  return `#play:${workId}`;
}
