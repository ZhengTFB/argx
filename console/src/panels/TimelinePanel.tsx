import { useEffect, useMemo, useRef, useState } from 'react';
import { store, useStore } from '../core/store';
import { Badge, Btn, Card } from '../ui/primitives';

/*
 * 时间线：所有收发事件实时滚动。
 * 调试时最有用的东西，也方便回溯某一局触发了什么。
 */

type Filter = 'all' | 'frames' | 'errors';

export default function TimelinePanel() {
  const log = useStore((s) => s.log);
  const [filter, setFilter] = useState<Filter>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    if (filter === 'frames') return log.filter((e) => e.dir === 'in' || e.dir === 'out');
    if (filter === 'errors') return log.filter((e) => e.dir === 'error');
    return log;
  }, [log, filter]);

  useEffect(() => {
    const el = boxRef.current;
    if (el && autoScroll) el.scrollTop = el.scrollHeight;
  }, [shown.length, autoScroll]);

  const inCount = log.filter((e) => e.dir === 'in').length;
  const outCount = log.filter((e) => e.dir === 'out').length;
  const errCount = log.filter((e) => e.dir === 'error').length;

  return (
    <Card
      title="时间线"
      subtitle={`共 ${log.length} 条 · 收 ${inCount} · 发 ${outCount} · 错误 ${errCount}（最多保留 400 条）`}
      right={
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(
              [
                ['all', '全部'],
                ['frames', '只看帧'],
                ['errors', '只看错误']
              ] as [Filter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded border px-2 py-0.5 text-[11px] ${
                  filter === id
                    ? 'border-argx-500 text-argx-400'
                    : 'border-ink-600 text-ink-400 hover:text-ink-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-1 text-[11px] text-ink-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-argx-500"
            />
            自动滚动
          </label>
          <Btn size="sm" onClick={() => store.clearLog()}>
            清空
          </Btn>
        </div>
      }
    >
      <div
        ref={boxRef}
        className="thin-scroll h-[calc(100vh-220px)] min-h-64 overflow-y-auto rounded border border-ink-800 bg-ink-950 p-2 font-mono text-[12px] leading-relaxed"
      >
        {shown.length === 0 && (
          <p className="py-8 text-center text-ink-600">还没有记录。连上装置，或去模拟器点两下。</p>
        )}
        {shown.map((e) => (
          <div key={e.id} className="flex gap-2 border-b border-ink-900 py-0.5 last:border-0">
            <span className="shrink-0 text-ink-600">
              {new Date(e.t).toLocaleTimeString('zh-CN', { hour12: false })}
            </span>
            <span className="shrink-0">
              {e.dir === 'in' && <Badge tone="ok">收</Badge>}
              {e.dir === 'out' && <Badge tone="mute">发</Badge>}
              {e.dir === 'error' && <Badge tone="bad">错</Badge>}
              {e.dir === 'info' && <Badge tone="mute">记</Badge>}
            </span>
            <span
              className={`min-w-0 break-all ${
                e.dir === 'in'
                  ? 'text-argx-400'
                  : e.dir === 'out'
                    ? 'text-ink-200'
                    : e.dir === 'error'
                      ? 'text-danger-400'
                      : 'text-ink-400'
              }`}
            >
              {e.text}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
