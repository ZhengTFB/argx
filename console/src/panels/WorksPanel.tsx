import { useState } from 'react';
import { useStore } from '../core/store';
import { CAPABILITIES, capLabel, hardwareNeedsText } from '../core/capabilities';
import { WORKS, type Work } from '../works';
import { Badge, Btn, Card, Empty } from '../ui/primitives';

/*
 * ARG 库。列表完全由 src/works.ts 驱动——加作品只加一条数据，不动组件。
 */

function missingFor(work: Work, have: string[]): string[] {
  return work.needs.filter((n) => !have.includes(n));
}

export default function WorksPanel() {
  const conn = useStore((s) => s.conn);
  const [onlyRunnable, setOnlyRunnable] = useState(false);
  const have = conn.caps?.out ?? [];

  const works = onlyRunnable
    ? WORKS.filter((w) => missingFor(w, have).length === 0)
    : WORKS;

  return (
    <div className="grid gap-4">
      <Card
        title="ARG 库"
        subtitle={`${WORKS.length} 个作品。硬件需求是把关项，不是建议`}
        right={
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-400">
            <input
              type="checkbox"
              checked={onlyRunnable}
              onChange={(e) => setOnlyRunnable(e.target.checked)}
              className="accent-argx-500"
            />
            只看当前装置能跑的
          </label>
        }
      >
        <p className="text-[11px] leading-relaxed text-ink-600">
          列表是数据驱动的：加作品只需在 <span className="font-mono">src/works.ts</span>{' '}
          里加一条。硬件需求是人工标注的——一个作品要用到哪些装置，创作者自己最清楚，
          自动猜反而会误导玩家。
        </p>
      </Card>

      {works.length === 0 ? (
        <Card>
          <Empty>当前装置还跑不了任何一个作品。往下看需要买什么。</Empty>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {works.map((w) => {
            const missing = missingFor(w, have);
            const runnable = missing.length === 0;
            return (
              <Card
                key={w.id}
                title={w.title}
                subtitle={`${w.author} · ${w.duration}`}
                right={
                  <div className="flex shrink-0 gap-1.5">
                    <Badge tone={w.status === '可用' ? 'ok' : w.status === '内测' ? 'warn' : 'mute'}>
                      {w.status}
                    </Badge>
                    {have.length > 0 && (
                      <Badge tone={runnable ? 'ok' : 'bad'}>
                        {runnable ? '装置能跑' : `缺 ${missing.length} 项`}
                      </Badge>
                    )}
                  </div>
                }
              >
                <p className="text-sm leading-relaxed text-ink-400">{w.summary}</p>

                <div className="mt-3 rounded border border-ink-800 bg-ink-950 p-2.5">
                  <div className="mb-1.5 text-[11px] font-medium text-ink-400">硬件需求备注</div>
                  {w.needs.length === 0 ? (
                    <span className="text-xs text-ink-400">不需要任何装置</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {w.needs.map((id) => (
                        <Badge key={id} tone={have.includes(id) ? 'ok' : 'mute'}>
                          {capLabel(id)} · {id}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {missing.length > 0 && have.length > 0 && (
                    <p className="mt-2 text-[11px] leading-relaxed text-warn-400">
                      你还缺：{missing.map((m) => capLabel(m)).join('、')}。
                      这些都能单独买到——{hardwareNeedsText(missing)}。
                    </p>
                  )}
                  {have.length === 0 && (
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-600">
                      还没有连上装置，所以看不出你能跑哪些。先去「设备」连一个虚拟装置试试，
                      或者照着「文档」里的清单把硬件买齐。
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Btn
                    tone="primary"
                    size="sm"
                    disabled={!w.link || w.link === '#'}
                    title={!w.link || w.link === '#' ? '作品入口在阶段三接入' : undefined}
                    onClick={() => {
                      if (w.link && w.link !== '#') window.open(w.link, '_blank', 'noopener');
                    }}
                  >
                    打开作品
                  </Btn>
                  {(!w.link || w.link === '#') && <Badge tone="mute">阶段三接入</Badge>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card title="缺硬件怎么办" subtitle="这三条按顺序来，最省事">
        <ol className="ml-4 list-decimal space-y-1.5 text-sm text-ink-400">
          <li>
            先别买。去<span className="text-ink-200">「模拟器」</span>跑一遍——
            没有硬件也能看到整套东西怎么运作，确认这个作品你真的想玩。
          </li>
          <li>
            想买就一次买齐。所有作品的硬件需求都列在上面，四路全配齐大概一百块出头
            （灯带、蜂鸣器、振动马达+驱动、继电器模块各一）。
          </li>
          <li>
            买回来照着 <span className="text-ink-200">「文档」</span> 接线，
            接好插上电脑，在「设备」里连真实串口。
          </li>
        </ol>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {Object.values(CAPABILITIES).map((c) => (
            <div key={c.id} className="rounded border border-ink-800 bg-ink-950 p-2 text-[11px]">
              <span className="text-ink-200">{c.label}</span>
              <span className="ml-2 text-ink-600">{c.pin}</span>
              <div className="mt-0.5 text-ink-400">买：{c.buy}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
