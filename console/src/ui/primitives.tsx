import type { ReactNode } from 'react';

/* 一点点共用的展示件。信息密度优先，不做花哨效果。 */

export function Card(props: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={
        'rounded-lg border border-ink-700 bg-ink-900 p-4 ' + (props.className ?? '')
      }
    >
      {(props.title || props.right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {props.title && <h2 className="text-[15px] font-semibold text-ink-200">{props.title}</h2>}
            {props.subtitle && <p className="mt-0.5 text-xs text-ink-400">{props.subtitle}</p>}
          </div>
          {props.right}
        </header>
      )}
      {props.children}
    </section>
  );
}

export function Btn(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'ghost' | 'danger' | 'warn';
  size?: 'sm' | 'md';
  title?: string;
}) {
  const tone = props.tone ?? 'ghost';
  const tones: Record<string, string> = {
    primary: 'bg-argx-500 text-ink-950 hover:bg-argx-400 border-argx-500',
    ghost: 'bg-ink-800 text-ink-200 hover:bg-ink-700 border-ink-600',
    danger: 'bg-ink-800 text-danger-400 hover:bg-ink-700 border-danger-400/50',
    warn: 'bg-ink-800 text-warn-400 hover:bg-ink-700 border-warn-400/50'
  };
  const size = props.size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  return (
    <button
      type="button"
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${size}`}
    >
      {props.children}
    </button>
  );
}

export function Field(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-400">{props.label}</span>
      {props.children}
      {props.hint && <span className="text-[11px] text-ink-600">{props.hint}</span>}
    </label>
  );
}

export function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      className={
        'rounded border border-ink-600 bg-ink-950 px-2 py-1 text-sm text-ink-200 outline-none focus:border-argx-500 ' +
        (props.className ?? '')
      }
    />
  );
}

export function NumberInput(props: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(props.value) ? props.value : ''}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      onChange={(e) => props.onChange(Number(e.target.value))}
      className="w-full rounded border border-ink-600 bg-ink-950 px-2 py-1 text-sm text-ink-200 outline-none focus:border-argx-500"
    />
  );
}

export function Select(props: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      className={
        'rounded border border-ink-600 bg-ink-950 px-2 py-1 text-sm text-ink-200 outline-none focus:border-argx-500 ' +
        (props.className ?? '')
      }
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="mt-0.5 accent-argx-500"
      />
      <span>
        <span className="text-sm text-ink-200">{props.label}</span>
        {props.hint && <span className="block text-[11px] text-ink-600">{props.hint}</span>}
      </span>
    </label>
  );
}

export function Badge(props: { children: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'mute' }) {
  const tones: Record<string, string> = {
    ok: 'border-argx-500/50 text-argx-400',
    warn: 'border-warn-400/50 text-warn-400',
    bad: 'border-danger-400/50 text-danger-400',
    mute: 'border-ink-600 text-ink-400'
  };
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[11px] whitespace-nowrap ${tones[props.tone ?? 'mute']}`}
    >
      {props.children}
    </span>
  );
}

export function KV(props: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-800 py-1.5 last:border-0">
      <span className="text-xs text-ink-400">{props.k}</span>
      <span className="text-right text-sm text-ink-200">{props.v}</span>
    </div>
  );
}

export function Empty(props: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-600">{props.children}</p>;
}
