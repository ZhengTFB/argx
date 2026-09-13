#!/usr/bin/env node
/*
 * 把 guide/*.md 编译进 console/src/data/docs.generated.ts。
 *
 *   node tools/build-guide.mjs           # 生成
 *   node tools/build-guide.mjs --check   # 不写文件，比对生成物；不一致就非零退出
 *
 * 为什么要有它：文档页的正文以前是手写的 TS，等于把 protocol/PROTOCOL.md 抄了第二遍。
 * 这个项目已经吃过一次「同一件事两处不一致」的亏，所以正文只在 guide/ 下写一份。
 *
 * 零依赖：markdown 子集是自控的，一个受限解析器就够，
 * 不引 marked / remark / markdown-it 之类的解析库（项目硬约束）。
 *
 * 支持的语法 —— **只有下面这些**，多了一律报错退出，不静默跳过：
 *
 *   ## 标题 / ### 标题                          → h2 / h3
 *   普通段落（一行一段，不许软换行）              → p
 *   - 项  /  * 项                              → ul
 *   | a | b | 表格（第二行必须是分隔行）          → table
 *   ```lang ... ``` 代码块，首行 `// [head]`      → code（head 表示带标题栏）
 *   > [!NOTE] / [!WARNING] / [!DANGER] / [!TIP] → callout
 *
 * 不支持有序列表：DocBlock 里没有 ol，需要顺序语义就用 - 并在文字里写数字。
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const GUIDE = resolve(ROOT, 'guide');
const OUT = resolve(ROOT, 'console', 'src', 'data', 'docs.generated.ts');

const HEAD = [
  '// ⚠️ 本文件由 tools/build-guide.mjs 从 guide/*.md 自动生成，不要手改。',
  '//    改文档请改 guide/ 下的 md，然后跑 node tools/build-guide.mjs',
  ''
].join('\n');

/* ------------------------------------------------------------------ *
 * 报错：一律带上文件名与行号，不然改了 10 页之后根本找不到是哪儿
 * ------------------------------------------------------------------ */
class GuideError extends Error {}

const die = (file, line, msg) => {
  throw new GuideError(`${file}:${line}  ${msg}`);
};

/* ------------------------------------------------------------------ *
 * frontmatter
 * ------------------------------------------------------------------ */
const FIELDS = ['slug', 'group', 'nav', 'title', 'lead', 'order'];

function parseFrontmatter(file, text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') die(file, 1, '开头缺少 frontmatter 的 ---');

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) die(file, 1, 'frontmatter 没有收尾的 ---');

  const fm = {};
  for (let i = 1; i < end; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const at = raw.indexOf(':');
    if (at <= 0) die(file, i + 1, `frontmatter 这一行不是 key: value —— ${raw.trim()}`);
    fm[raw.slice(0, at).trim()] = raw.slice(at + 1).trim();
  }

  for (const f of FIELDS) {
    if (!fm[f]) die(file, 1, `frontmatter 少一个字段：${f}`);
  }
  for (const k of Object.keys(fm)) {
    if (!FIELDS.includes(k)) die(file, 1, `frontmatter 里有个不认识的字段：${k}`);
  }
  const order = Number(fm.order);
  if (!Number.isInteger(order)) die(file, 1, `order 必须是整数，现在是 "${fm.order}"`);

  return { fm: { ...fm, order }, body: lines.slice(end + 1), bodyOffset: end + 2 };
}

/* ------------------------------------------------------------------ *
 * 正文解析
 * ------------------------------------------------------------------ */
const CALLOUT_TONE = { NOTE: 'info', WARNING: 'warning', DANGER: 'danger', TIP: 'success' };

/** 认得出「这是一个新块的开头」的行 —— 段落遇到它们就该收尾了 */
const startsBlock = (l) =>
  /^#{1,6} /.test(l) || /^[-*] /.test(l) || /^\|/.test(l) || /^```/.test(l) || /^>/.test(l);

function parseBody(file, lines, offset) {
  const out = [];
  let i = 0;
  const at = (k) => offset + k; // 行号（1 起）

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // 一级标题由 frontmatter 的 title 决定，正文里不许再写一个
    if (/^# /.test(line)) die(file, at(i), '正文里不要写 # 一级标题 —— 标题来自 frontmatter 的 title');
    if (/^#{4,} /.test(line)) die(file, at(i), '只支持 ## 与 ###，没有再深的标题');
    if (/^\d+[.)] /.test(line)) die(file, at(i), '不支持有序列表 —— DocBlock 里没有 ol。用 - 并在文字里写数字');

    if (/^## /.test(line)) { out.push({ t: 'h2', text: line.slice(3).trim() }); i++; continue; }
    if (/^### /.test(line)) { out.push({ t: 'h3', text: line.slice(4).trim() }); i++; continue; }

    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].slice(2).trim());
        i++;
      }
      out.push({ t: 'ul', items });
      continue;
    }

    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i]); i++; }
      if (rows.length < 2) die(file, at(i - rows.length), '表格至少要表头 + 分隔行 + 一行数据');
      if (!/^\|[\s:|-]+\|$/.test(rows[1].trim())) {
        die(file, at(i - rows.length + 1), '表格第二行必须是 |---|---| 这样的分隔行');
      }
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      out.push({ t: 'table', head: cells(rows[0]), rows: rows.slice(2).map(cells) });
      continue;
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      if (!lang) die(file, at(i), '代码块必须写明语言（```json / ```js / ```html / ```text）');
      const start = i;
      i++;
      const code = [];
      let closed = false;
      while (i < lines.length) {
        if (lines[i].trim() === '```') { closed = true; i++; break; }
        code.push(lines[i]);
        i++;
      }
      if (!closed) die(file, at(start), '代码块没有收尾的 ```');
      let head = false;
      if (code[0]?.trim() === '// [head]') { head = true; code.shift(); }
      out.push(head
        ? { t: 'code', lang, code: code.join('\n'), head: true }
        : { t: 'code', lang, code: code.join('\n') });
      continue;
    }

    if (line.startsWith('>')) {
      const start = i;
      const m = /^>\s*\[!(\w+)\]\s*$/.exec(line.trim());
      if (!m) die(file, at(i), '引用块只支持 > [!NOTE] / [!WARNING] / [!DANGER] / [!TIP] 四种');
      const tone = CALLOUT_TONE[m[1]];
      if (!tone) die(file, at(i), `不认识的引用类型 [!${m[1]}]，只能是 NOTE / WARNING / DANGER / TIP`);
      i++;
      const text = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        text.push(lines[i].replace(/^>\s?/, '').trim());
        i++;
      }
      const joined = text.filter(Boolean).join(' ');
      if (!joined) die(file, at(start), '引用块是空的');
      out.push({ t: 'callout', tone, text: joined });
      continue;
    }

    // 段落：一行一段。软换行会让渲染结果与作者预期不同，所以直接报错，
    // 不静默合并 —— 静默合并出来的东西没人会回头查。
    if (i + 1 < lines.length && lines[i + 1].trim() && !startsBlock(lines[i + 1])) {
      die(file, at(i + 1), '段落请写在一行里，行与行之间用空行隔开（软换行不支持）');
    }
    out.push({ t: 'p', text: line.trim() });
    i++;
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * 渲染成 TS
 * ------------------------------------------------------------------ */
/** 短字符串用单引号（读起来和手写的 TS 一样），带引号或换行的退回 JSON.stringify */
const q = (s) => (!/[\\'\n]/.test(s) ? `'${s}'` : JSON.stringify(s));

function renderBlock(b) {
  switch (b.t) {
    case 'h2': return `      { t: 'h2', text: ${q(b.text)} },`;
    case 'h3': return `      { t: 'h3', text: ${q(b.text)} },`;
    case 'p': return `      { t: 'p', text: ${q(b.text)} },`;
    case 'ul':
      return [
        '      {',
        "        t: 'ul',",
        '        items: [',
        ...b.items.map((x) => `          ${q(x)},`),
        '        ]',
        '      },'
      ].join('\n');
    case 'callout':
      return `      { t: 'callout', tone: ${q(b.tone)}, text: ${q(b.text)} },`;
    case 'table':
      return [
        '      {',
        "        t: 'table',",
        `        head: [${b.head.map(q).join(', ')}],`,
        '        rows: [',
        ...b.rows.map((r) => `          [${r.map(q).join(', ')}],`),
        '        ]',
        '      },'
      ].join('\n');
    case 'code':
      return [
        '      {',
        "        t: 'code',",
        `        lang: ${q(b.lang)},`,
        ...(b.head ? ['        head: true,'] : []),
        `        code: ${q(b.code)}`,
        '      },'
      ].join('\n');
    default:
      throw new GuideError(`生成器不认识这种块：${b.t}`);
  }
}

function renderPage(p) {
  return [
    '  {',
    `    slug: ${q(p.slug)},`,
    `    group: ${q(p.group)},`,
    `    nav: ${q(p.nav)},`,
    `    title: ${q(p.title)},`,
    `    lead: ${q(p.lead)},`,
    '    body: [',
    ...p.body.map(renderBlock),
    '    ]',
    '  },'
  ].join('\n');
}

function render(groups, pages) {
  return [
    HEAD,
    "import type { DocPage } from './docs.types';",
    '',
    `export const DOC_GROUPS = [${groups.map(q).join(', ')}] as const;`,
    '',
    'export const DOC_PAGES: DocPage[] = [',
    ...pages.map(renderPage),
    '];',
    ''
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * 装配
 * ------------------------------------------------------------------ */
function build() {
  if (!existsSync(GUIDE)) throw new GuideError(`找不到 ${GUIDE}`);

  const metaPath = join(GUIDE, '_meta.json');
  if (!existsSync(metaPath)) throw new GuideError('guide/_meta.json 不存在（它定义分组顺序）');
  let groups;
  try {
    groups = JSON.parse(readFileSync(metaPath, 'utf8')).groups;
  } catch (e) {
    throw new GuideError(`guide/_meta.json 不是合法 JSON：${e.message}`);
  }
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new GuideError('guide/_meta.json 的 groups 必须是非空数组');
  }

  const files = readdirSync(GUIDE).filter((f) => f.endsWith('.md')).sort();
  if (files.length === 0) throw new GuideError('guide/ 下一个 .md 都没有');

  const seenSlug = new Map();
  const pages = files.map((f) => {
    const text = readFileSync(join(GUIDE, f), 'utf8').replace(/\r\n/g, '\n');
    const { fm, body, bodyOffset } = parseFrontmatter(f, text);
    if (!groups.includes(fm.group)) {
      die(f, 1, `group "${fm.group}" 不在 _meta.json 的 groups 里`);
    }
    if (seenSlug.has(fm.slug)) die(f, 1, `slug "${fm.slug}" 与 ${seenSlug.get(fm.slug)} 重复`);
    seenSlug.set(fm.slug, f);
    return { ...fm, file: f, body: parseBody(f, body, bodyOffset) };
  });

  // 排序：先按 _meta.json 的分组顺序，再按 order。左树、翻页、默认页都吃这个顺序
  pages.sort((a, b) =>
    groups.indexOf(a.group) - groups.indexOf(b.group) || a.order - b.order);

  return { groups, pages, text: render(groups, pages) };
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */
const check = process.argv.includes('--check');

let built;
try {
  built = build();
} catch (e) {
  if (e instanceof GuideError) { console.error(`✗ ${e.message}`); process.exit(1); }
  throw e;
}

const summary = `guide/ ${built.pages.length} 页 / ${built.groups.length} 组`;

if (!check) {
  writeFileSync(OUT, built.text);
  console.log(`✓ ${summary} → console/src/data/docs.generated.ts`);
  for (const p of built.pages) console.log(`    ${p.group} / ${p.nav}  (${p.file})`);
  process.exit(0);
}

/* --check：只比对，不写文件 */
if (!existsSync(OUT)) {
  console.error(`✗ 生成物不存在：${OUT}\n  跑 node tools/build-guide.mjs 生成它`);
  process.exit(1);
}
const onDisk = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n');
if (onDisk === built.text) {
  console.log(`✓ ${summary}，生成物与 md 一致`);
  process.exit(0);
}

console.error('✗ 生成物与 guide/*.md 不一致。');
const header = HEAD.trimEnd();
if (!onDisk.includes('本文件由 tools/build-guide.mjs')) {
  console.error('  · 生成物头部的「勿手改」注释不见了');
}
const missing = [];
const extra = [];
for (const p of built.pages) {
  if (!onDisk.includes(renderPage(p))) missing.push(p.slug);
}
for (const m of onDisk.matchAll(/^\s{4}slug: "([^"]+)",$/gm)) {
  if (!built.pages.some((p) => p.slug === m[1])) extra.push(m[1]);
}
if (missing.length) console.error(`  · 这几页与 md 对不上：${missing.join(', ')}`);
if (extra.length) console.error(`  · 生成物里有 md 中已不存在的页：${extra.join(', ')}`);
if (!missing.length && !extra.length && onDisk.includes(header)) {
  console.error('  · 差异只在头部或分组行（DOC_GROUPS 与 _meta.json 不同步？）');
}
console.error('  跑 node tools/build-guide.mjs 重新生成。');
process.exit(1);
