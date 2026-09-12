/*
 * 小白控制台的分区。
 *
 * 故意和专业版的 hash 不重名（专业版用 overview / devices / works / …），
 * 这样顶层可以靠一个字符串判断该渲染哪一套，老链接也照旧有效。
 */

export type BasicSection = 'home' | 'device' | 'library' | 'help';

export const BASIC_SECTIONS: BasicSection[] = ['home', 'device', 'library', 'help'];

/** 作品播放页的 hash：#play:<作品 id> */
export function playHash(workId: string): string {
  return `play:${workId}`;
}
