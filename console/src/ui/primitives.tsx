import {
  useEffect, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode
} from 'react';
import { IcoCheckCircle, IcoInfo, IcoAlert, IcoX } from './icons';
import { formatParam, type ChannelParam } from '../core/channels';

/* ============================================================
   按钮
   ============================================================ */
type Tone = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export function Btn({
  tone = 'secondary', size = 'md', children, className = '', ...rest
}: {
  tone?: Tone; size?: Size; children?: ReactNode; className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`btn btn--${size} btn--${tone} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/* ============================================================
   状态胶囊
   ============================================================ */
export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'idle';

export function Pill({
  tone, children, small = false, soft = false
}: { tone: PillTone; children: ReactNode; small?: boolean; soft?: boolean }) {
  return (
    <span className={`pill pill--${tone}${small ? ' pill--sm' : ''}${soft ? ' pill--soft' : ''}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

/* ============================================================
   图标容器 / 卡片 / 面板
   ============================================================ */
export function IcoBox({ children, tone, ch }: { children: ReactNode; tone?: PillTone; ch?: string }) {
  const cls = `ico-box${tone ? ` ico-box--${tone}` : ''}`;
  return <span className={cls} data-ch={ch} aria-hidden="true">{children}</span>;
}

export function Card({ children, pad = true, className = '' }: { children: ReactNode; pad?: boolean; className?: string }) {
  return <div className={`card${pad ? ' card--pad' : ''} ${className}`}>{children}</div>;
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function CardHead({
  title, sub, right, icon
}: { title: ReactNode; sub?: ReactNode; right?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card-head">
      <div className="card-head-l">
        {icon}
        <div>
          <div className="card-title">{title}</div>
          {sub ? <div className="page-sub" style={{ marginTop: 2 }}>{sub}</div> : null}
        </div>
      </div>
      {right ? <div className="toolbar">{right}</div> : null}
    </div>
  );
}

/* ============================================================
   表单
   ============================================================ */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="f-hint">{hint}</span> : null}
    </label>
  );
}

export function Switch({
  checked, onChange, label, hard = false, disabled = false, ch
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
  /** 继电器那一路用：切换无过渡（物理量语义） */
  hard?: boolean; disabled?: boolean; ch?: string;
}) {
  return (
    <span className={`switch${hard ? ' switch--hard' : ''}`} data-ch={ch}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="track"><span className="knob" /></span>
    </span>
  );
}

/**
 * 滑杆。
 * 已填充段用 `--fill` 百分比画出来 —— 原生 range 不给"填充到哪"的样式钩子，
 * 所以背景用 linear-gradient 手画（值一定在 0~1 之间，不用考虑对数刻度）。
 */
export function Slider({
  param, value, onChange, ch, disabled = false
}: {
  param: ChannelParam & { max: number; min: number };
  value: number;
  onChange: (v: number) => void;
  ch?: string;
  disabled?: boolean;
}) {
  const pct = param.max === param.min ? 0 : ((value - param.min) / (param.max - param.min)) * 100;
  return (
    <div className="slider-row" data-ch={ch}>
      <span className="s-lbl">{param.label}</span>
      <input
        className="slider"
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        disabled={disabled}
        aria-label={param.label}
        style={{ '--fill': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="s-val">{formatParam(param, value)}</span>
    </div>
  );
}

/* ============================================================
   空状态：图形 + 一句主文案 + 明确出路（不许只放一行灰字）
   ============================================================ */
export function EmptyState({
  icon, title, desc, actions
}: { icon: ReactNode; title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="empty">
      <span aria-hidden="true">{icon}</span>
      <h4>{title}</h4>
      {desc ? <p>{desc}</p> : null}
      {actions ? <div className="acts">{actions}</div> : null}
    </div>
  );
}

/* ============================================================
   提示块
   ============================================================ */
export function Callout({
  tone = 'info', children
}: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode }) {
  const Icon = tone === 'warning' || tone === 'danger' ? IcoAlert : tone === 'success' ? IcoCheckCircle : IcoInfo;
  return (
    <div className={`callout${tone === 'info' ? '' : ` callout--${tone}`}`}>
      <Icon />
      <div className="grow">{children}</div>
    </div>
  );
}

/* ============================================================
   代码块（右上角复制，hover 才显形）
   ============================================================ */
export function CodeBlock({
  code, lang, head
}: { code: string; lang?: string; head?: boolean }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = () => {
    // 剪贴板在无权限环境下会失败 —— 失败就静默，绝不弹窗
    try {
      void navigator.clipboard?.writeText(code).then(
        () => {
          setDone(true);
          timer.current = setTimeout(() => setDone(false), 1400);
        },
        () => { /* 忽略 */ }
      );
    } catch {
      /* 忽略 */
    }
  };

  return (
    <div className="code-block">
      {head ? (
        <div className="cb-head">
          <span className="cb-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="cb-lang">{lang ?? 'text'}</span>
        </div>
      ) : null}
      <button type="button" className="btn btn--sm btn--secondary copy" onClick={copy}>
        {done ? '已复制' : '复制'}
      </button>
      {code}
    </div>
  );
}

/* ============================================================
   Toast
   ============================================================ */
export interface ToastItem { id: number; text: string; tone: 'success' | 'warning' | 'danger' }

let toastSeq = 1;
const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];

function emit() {
  for (const cb of listeners) cb(items);
}

export function toast(text: string, tone: ToastItem['tone'] = 'success') {
  const id = toastSeq++;
  items = [...items, { id, text, tone }].slice(-3);
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, tone === 'danger' ? 6000 : 4000);
}

export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    const cb = (next: ToastItem[]) => setList([...next]);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  if (!list.length) return null;
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          <span className="t-dot" />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   连接测试的四种状态徽标（灰圈＝还没测）
   ============================================================ */
export type CheckState = 'idle' | 'testing' | 'ok' | 'warn';

export function CheckDot({ state, label }: { state: CheckState; label: string }) {
  const Icon = state === 'ok' ? IcoCheckCircle : state === 'warn' ? IcoAlert : state === 'testing' ? IcoX : IcoInfo;
  const title = state === 'idle' ? '还没测' : state === 'testing' ? '正在测' : state === 'ok' ? '这一路通了' : '这一路没回应';
  return (
    <span className="check-state">
      <span className={`check-dot check-dot--${state}`} title={title} aria-label={title}>
        {state === 'testing' ? <IcoRefreshSpin /> : <Icon />}
      </span>
      {label}
    </span>
  );
}

function IcoRefreshSpin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M20 12a8 8 0 11-2.34-5.66" />
    </svg>
  );
}
