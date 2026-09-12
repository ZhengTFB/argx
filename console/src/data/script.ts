/*
 * 剧本数据的入口。
 *
 * 唯一的真值来源是 demo/script.json——那是 Demo 页面自己读的那一份
 * （game.js 用 fetch 拿它）。这里只是把它 import 进来，让控制台也能用同一份，
 * 而不是在 React 里再抄一遍剧情。
 *
 * 这份数据同时喂三个地方：
 *   demo/index.html + game.js     第三方作品的样板，独立打开也能玩
 *   小白控制台的 ARG 库            列出每个剧本、人话说明、硬件需求
 *   小白控制台的播放器             嵌进 iframe 跑的就是 demo/ 那一页
 *
 * 所以它必须留在 demo/ 目录里，不能搬进 console/src——搬进来 Demo 就读不到了。
 */

import raw from '../../../demo/script.json';

export interface ScriptCue {
  /** 事件名（SDK 词表里的，或本剧本自定义的） */
  event: string;
  /** 给非专业人员看的一句话，不出现任何术语 */
  desc: string;
}

export interface ScriptOption {
  label: string;
  next: string;
}

export interface ScriptAction {
  type: 'button' | 'input' | 'choice' | 'restart';
  label?: string;
  prompt?: string;
  answer?: string;
  hint?: string;
  wrong?: string;
  options?: ScriptOption[];
}

export interface ScriptNode {
  id: string;
  /** 展示名称：这一幕叫什么 */
  title: string;
  /** 一句话说明这一幕房间会发生什么（人话，无术语） */
  desc: string;
  lines: string[];
  cues: ScriptCue[];
  action: ScriptAction;
  next?: string;
}

export interface ScriptEventDef {
  label: string;
  desc: string;
  cues: { id: string; p?: Record<string, unknown> }[];
}

export interface Script {
  /** 对应 works.ts 里的作品 id */
  workId: string;
  title: string;
  pitch: string;
  start: string;
  events: Record<string, ScriptEventDef>;
  nodes: ScriptNode[];
}

// JSON 推不出上面的联合类型（type 会是 string），所以先过一道 unknown
export const SCRIPT = raw as unknown as Script;

export function scriptFor(workId: string): Script | null {
  return SCRIPT.workId === workId ? SCRIPT : null;
}

/** 这个剧本总共会触发几次（给"克制原则"用：一个场景 3–8 个） */
export function cueCount(s: Script): number {
  return s.nodes.reduce((n, node) => n + node.cues.length, 0);
}

/** 剧本用到的全部能力 id（含自定义事件里的） */
export function scriptCapabilities(s: Script): string[] {
  const out = new Set<string>();
  for (const node of s.nodes) {
    for (const cue of node.cues) {
      const def = s.events[cue.event];
      if (!def) continue; // 词表里的内置事件由 SDK 负责展开
      for (const c of def.cues) out.add(c.id);
    }
  }
  return [...out];
}
