import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DOC_GROUPS, DOC_PAGES, type DocBlock, type DocPage } from '../data/docs';
import { Callout, CodeBlock } from '../ui/primitives';
import { PageHead } from '../ui/Chrome';
import { IcoArrowLeft, IcoArrowRight, IcoChevronRight, IcoSearch } from '../ui/icons';

/*
 * 文档页：三栏（左树 / 中内容 / 右本页目录）。
 *
 * 正文是**真的**，不是占位：快速开始、连接方法、指令表、参数说明、
 * 错误码、故障排查、给创作者的埋点规范，全部从 protocol/PROTOCOL.md、
 * firmware/WIRING.md、sdk/AGENTS.md 提取重写而来。
 *
 * 搜索是纯客户端的（在已经加载的正文里找），所以它是真的能用，不是摆设。
 */

export function Docs() {
  const [slug, setSlug] = useState(DOC_PAGES[0].slug);
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const page = DOC_PAGES.find((p) => p.slug === slug) ?? DOC_PAGES[0];
  const index = DOC_PAGES.indexOf(page);

  // ⌘K / Ctrl+K 聚焦搜索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const needle = q.trim().toLowerCase();
  const matched = useMemo(() => {
    if (!needle) return null;
    return new Set(
      DOC_PAGES.filter((p) => {
        const hay = `${p.title} ${p.nav} ${p.lead} ${plainText(p.body)}`.toLowerCase();
        return hay.includes(needle);
      }).map((p) => p.slug)
    );
  }, [needle]);

  const heads = useMemo(() => headingsOf(page), [page]);

  const go = (next: string) => {
    setSlug(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageHead
        title="文档"
        sub="从连上装置，到把效果写进你的作品"
        actions={
          <span className="search">
            <IcoSearch />
            <input
              ref={searchRef}
              className="input"
              placeholder="搜索文档"
              aria-label="搜索文档"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <kbd className="mono" style={{ position: 'absolute', right: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>⌘K</kbd>
          </span>
        }
      />

      <div className="doc-layout">
        {/* ---------- 左：树形导航 ---------- */}
        <nav className="doc-tree" aria-label="文档目录">
          {DOC_GROUPS.map((g) => {
            const pages = DOC_PAGES.filter((p) => p.group === g && (!matched || matched.has(p.slug)));
            if (pages.length === 0) return null;
            return (
              <div key={g}>
                <div className="doc-group">{g}</div>
                {pages.map((p) => (
                  <button
                    key={p.slug}
                    type="button"
                    className={`doc-link${p.slug === slug ? ' act' : ''}`}
                    aria-current={p.slug === slug ? 'page' : undefined}
                    onClick={() => go(p.slug)}
                  >
                    {p.nav}
                  </button>
                ))}
              </div>
            );
          })}
          {matched && matched.size === 0 ? (
            <div className="page-sub" style={{ padding: 'var(--space-4) var(--space-2)' }}>
              没有匹配的页面
            </div>
          ) : null}
        </nav>

        {/* ---------- 中：内容 ---------- */}
        <article className="grow" id="argx-doc-article">
          <nav className="crumbs" aria-label="面包屑">
            <span>{page.group}</span>
            <IcoChevronRight />
            <span className="cur">{page.nav}</span>
          </nav>

          <h1 className="doc-h1">{page.title}</h1>
          <p className="doc-lead">{page.lead}</p>

          {page.body.map((b, i) => (
            <Block key={i} b={b} />
          ))}

          <div className="pager" style={{ marginTop: 'var(--space-8)' }}>
            {index > 0 ? (
              <button type="button" className="pager-link" onClick={() => go(DOC_PAGES[index - 1].slug)}>
                <span className="pg-dir"><IcoArrowLeft />上一篇</span>
                <span className="pg-name">{DOC_PAGES[index - 1].nav}</span>
              </button>
            ) : <span />}
            {index < DOC_PAGES.length - 1 ? (
              <button
                type="button"
                className="pager-link pager-link--next"
                onClick={() => go(DOC_PAGES[index + 1].slug)}
              >
                <span className="pg-dir">下一篇<IcoArrowRight /></span>
                <span className="pg-name">{DOC_PAGES[index + 1].nav}</span>
              </button>
            ) : null}
          </div>
        </article>

        {/* ---------- 右：本页目录 ---------- */}
        <nav className="toc" aria-label="本页目录">
          <Toc heads={heads} slug={slug} />
        </nav>
      </div>
    </>
  );
}

/* ============================================================ */
function Block({ b }: { b: DocBlock }) {
  switch (b.t) {
    case 'h2':
      return (
        <div className="doc-sec">
          <span className="doc-sec-mark h2" />
          <h2 className="doc-h2" id={anchorOf(b.text)}>{b.text}</h2>
        </div>
      );
    case 'h3':
      return <h3 className="doc-h3" id={anchorOf(b.text)}>{b.text}</h3>;
    case 'p':
      return <p className="doc-p"><Inline text={b.text} /></p>;
    case 'ul':
      return (
        <ul className="doc-ul">
          {b.items.map((it, i) => <li className="doc-li" key={i}><Inline text={it} /></li>)}
        </ul>
      );
    case 'code':
      return (
        <div className="doc-block">
          <CodeBlock code={b.code} lang={b.lang} head={b.head} />
        </div>
      );
    case 'callout':
      return (
        <div className="doc-block">
          <Callout tone={b.tone}><Inline text={b.text} /></Callout>
        </div>
      );
    case 'table':
      return (
        <div className="doc-block" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>{b.head.map((h, i) => <th key={i}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

/**
 * 极简行内标记：`**粗体**` 和 `` `代码` ``。
 * 只支持这两样 —— 文档是给人读的，不是 Markdown 渲染器。
 */
function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) parts.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else parts.push(<code key={k++}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/* ============================================================ */
interface Head { id: string; text: string; level: 2 | 3 }

function headingsOf(page: DocPage): Head[] {
  const out: Head[] = [];
  for (const b of page.body) {
    if (b.t === 'h2') out.push({ id: anchorOf(b.text), text: b.text, level: 2 });
    else if (b.t === 'h3') out.push({ id: anchorOf(b.text), text: b.text, level: 3 });
  }
  return out;
}

function anchorOf(text: string): string {
  return `doc-${text.replace(/[^\w一-龥]+/g, '-')}`;
}

function plainText(body: DocBlock[]): string {
  return body.map((b) => {
    switch (b.t) {
      case 'p': case 'h2': case 'h3': return b.text;
      case 'ul': return b.items.join(' ');
      case 'code': return b.code;
      case 'callout': return b.text;
      case 'table': return [...b.head, ...b.rows.flat()].join(' ');
      default: return '';
    }
  }).join(' ');
}

/**
 * 本页目录 + 阅读进度条。
 *
 * 当前章节靠**滚动位置**算（不是点击时记的），所以手动滚动也会跟着高亮。
 * 进度条只用 transform: scaleX —— 白名单里允许动的属性。
 */
function Toc({ heads, slug }: { heads: Head[]; slug: string }) {
  const [active, setActive] = useState<string | null>(heads[0]?.id ?? null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (heads.length === 0) return;
    const onScroll = () => {
      const marks = heads
        .map((h) => {
          const el = document.getElementById(h.id);
          return el ? { id: h.id, top: el.getBoundingClientRect().top } : null;
        })
        .filter((x): x is { id: string; top: number } => x !== null);

      // 当前章节 = 最后一个已经滚过视口上沿 1/3 的标题
      const passed = marks.filter((m) => m.top <= window.innerHeight / 3);
      setActive(passed.length ? passed[passed.length - 1].id : marks[0]?.id ?? null);

      const article = document.getElementById('argx-doc-article');
      if (article) {
        const rect = article.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const done = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
        setProgress(total > 40 ? done / total : 1);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [heads, slug]);

  return (
    <>
      <div className="toc-head">
        <span className="toc-title">本页目录</span>
        <span className="toc-prog" aria-hidden="true">
          <i style={{ transform: `scaleX(${progress.toFixed(3)})` }} />
        </span>
      </div>
      {heads.length === 0 ? (
        <div className="page-sub" style={{ padding: '0 var(--space-3)' }}>本页没有小节</div>
      ) : (
        heads.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`toc-link${h.level === 3 ? ' toc-link--h3' : ''}${active === h.id ? ' act' : ''}`}
            onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {h.text}
          </button>
        ))
      )}
    </>
  );
}
