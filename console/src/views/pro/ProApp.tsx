import { useEffect, useState } from 'react';
import { store, useStore } from '../../core/store';
import { ConnectControls } from '../../ui/ConnectControls';
import Overview from '../../panels/Overview';
import Devices from '../../panels/Devices';
import WorksPanel from '../../panels/WorksPanel';
import SimulatorPanel from '../../panels/SimulatorPanel';
import TimelinePanel from '../../panels/TimelinePanel';
import DocsPanel from '../../panels/DocsPanel';
import CreatorPanel from '../../panels/CreatorPanel';
import { SECTIONS, type SectionId } from '../../sections';

/*
 * 专业控制台（阶段二产物）。
 *
 * 这里只是把原来 App.tsx 的内容整体搬了个位置——为了给"小白控制台"腾出
 * 顶层的位置做视图切换（阶段三要求两套界面并存）。
 * 里面的每一行都没动：布局、分区、组件、样式全部保持原样。
 */

function sectionFromHash(): SectionId {
  const h = window.location.hash.replace(/^#/, '');
  return SECTIONS.some((s) => s.id === h) ? (h as SectionId) : 'overview';
}

export default function ProApp() {
  // 分区写进 hash：可以直接把 #simulator 发给别人，他打开就是模拟器。
  // 想给别人看效果又不想让他装硬件时，这一条很省事。
  const [section, setSection] = useState<SectionId>(sectionFromHash);
  const conn = useStore((s) => s.conn);
  const current = SECTIONS.find((s) => s.id === section)!;

  useEffect(() => {
    if (window.location.hash.replace(/^#/, '') !== section) window.location.hash = section;
  }, [section]);

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="flex h-full min-h-0">
      {/* 左侧导航 */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-ink-800 bg-ink-900">
        <div className="border-b border-ink-800 px-4 py-3">
          <div className="text-base font-semibold tracking-wide text-argx-400">ARGX 控制台</div>
          <div className="mt-0.5 text-[11px] text-ink-600">让虚拟故事能操控现实物件</div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 thin-scroll">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`mb-0.5 block w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                section === s.id
                  ? 'bg-ink-800 text-argx-400'
                  : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
              }`}
            >
              {s.label}
              {s.id === 'creator' && (
                <span className="ml-1.5 text-[10px] text-ink-600">占位</span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-ink-800 p-3">
          <ConnectControls size="sm" />
          <p className="mt-2 text-[11px] leading-relaxed text-ink-600">{conn.detail}</p>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-ink-800 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold text-ink-200">{current.label}</h1>
            <p className="text-[11px] text-ink-600">{current.hint}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-400">
            <span>
              装置 <span className="text-ink-200">{conn.dev ?? '—'}</span>
            </span>
            <span>
              传输 <span className="text-ink-200">{conn.label || '—'}</span>
            </span>
            <span>
              心跳{' '}
              <span className="text-ink-200">
                {conn.latency === null ? '—' : `${conn.latency} ms`}
              </span>
            </span>
          </div>
        </header>

        {conn.notice && (
          <div className="flex items-start justify-between gap-4 border-b border-danger-400/40 bg-danger-400/10 px-4 py-2 text-xs text-danger-400">
            <span>{conn.notice}</span>
            <button
              type="button"
              className="shrink-0 underline"
              onClick={() => store.patchConn({ notice: null })}
            >
              知道了
            </button>
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto p-4 thin-scroll">
          {section === 'overview' && <Overview onGo={setSection} />}
          {section === 'devices' && <Devices />}
          {section === 'works' && <WorksPanel />}
          {section === 'simulator' && <SimulatorPanel />}
          {section === 'timeline' && <TimelinePanel />}
          {section === 'docs' && <DocsPanel />}
          {section === 'creator' && <CreatorPanel />}
        </main>
      </div>
    </div>
  );
}
