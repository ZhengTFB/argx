/*
 * 文档页的数据形状。
 *
 * 这是**手写**文件，正文不在这里 —— 正文的唯一来源是仓库根上的 `guide/*.md`，
 * 由 `tools/build-guide.mjs` 生成 `docs.generated.ts`。
 * 类型单独放一个文件，是为了让生成物只 `import type` 它：
 * 加一种 DocBlock 不用改生成器，生成器也不会把手写的类型覆盖掉。
 *
 * 生成物反过来只 import 本文件的**类型**，类型在编译后会被擦掉，
 * 所以运行时不存在循环依赖。别把这里的 import 改成运行时导入。
 */
import { DOC_PAGES } from './docs.generated';

export type DocBlock =
  | { t: 'p'; text: string }
  | { t: 'h2'; text: string }
  | { t: 'h3'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'code'; lang: string; code: string; head?: boolean }
  | { t: 'callout'; tone: 'info' | 'warning' | 'danger' | 'success'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] };

export interface DocPage {
  slug: string;
  group: string;
  nav: string;
  title: string;
  lead: string;
  body: DocBlock[];
}

export function docBySlug(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}
