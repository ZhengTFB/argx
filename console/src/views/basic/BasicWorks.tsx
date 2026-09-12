import { CAPABILITIES } from '../../core/capabilities';
import { useBasicDevice } from '../../core/basicDevice';
import { WORKS, type Work } from '../../works';
import { cueCount, scriptFor } from '../../data/script';

/*
 * ARG 库（小白版）。
 *
 * 和专业版那个是同一份数据（src/works.ts），区别只在怎么说话：
 * 那边讲"硬件需求是把关项"，这边讲"你手上这台能不能跑、缺的要去买什么"。
 * 状态也照这个来：可用 / 内测 / 规划中 在小白眼里分别是
 * "现在就能玩 / 还在测试 / 还没做"。
 */

const STATUS_TEXT: Record<Work['status'], string> = {
  可用: '现在就能玩',
  内测: '还在测试',
  规划中: '还没做'
};

function needLine(id: string): string {
  const c = CAPABILITIES[id];
  if (!c) return id;
  return `${c.label}（${c.buy}）`;
}

export default function BasicWorks({
  onPlay
}: {
  onPlay: (workId: string) => void;
}) {
  const dev = useBasicDevice();
  const have = dev.caps?.out ?? [];
  const hasDevice = have.length > 0;

  return (
    <section>
      <header className="mb-3">
        <h2 className="text-[15px] font-semibold text-fg-900">ARG 库</h2>
        <p className="mt-0.5 text-xs text-fg-400">
          这里放的是能接这套装置玩的故事。第一个是示例，点开就能玩。
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        {WORKS.map((w) => {
          const script = scriptFor(w.id);
          const missing = w.needs.filter((n) => !have.includes(n));
          const playable = !!script;
          return (
            <article
              key={w.id}
              className="flex flex-col rounded-xl border border-line-300 bg-paper-0 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-fg-900">{w.title}</h3>
                <span className="shrink-0 rounded-full bg-paper-100 px-2 py-0.5 text-[10px] text-fg-600">
                  {STATUS_TEXT[w.status]} · {w.duration}
                </span>
              </div>

              <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-600">{w.summary}</p>

              <div className="mt-3 rounded-lg bg-paper-100 px-3 py-2.5">
                <div className="text-[11px] font-medium text-fg-700">要用的东西</div>
                <ul className="mt-1 grid gap-0.5">
                  {w.needs.map((id) => (
                    <li key={id} className="flex items-start gap-1.5 text-[11.5px] text-fg-600">
                      <span className={hasDevice && !have.includes(id) ? 'text-warn-600' : 'text-fg-400'}>
                        {hasDevice && !have.includes(id) ? '缺' : '·'}
                      </span>
                      <span>{needLine(id)}</span>
                    </li>
                  ))}
                  {(w.optional ?? []).map((id) => (
                    <li key={id} className="flex items-start gap-1.5 text-[11.5px] text-fg-400">
                      <span>·</span>
                      <span>{needLine(id)}（有的话效果更足，没有也能玩）</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {playable ? (
                  <button
                    type="button"
                    onClick={() => onPlay(w.id)}
                    className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-brand-700"
                  >
                    打开
                  </button>
                ) : (
                  <span className="rounded-lg border border-line-400 px-3 py-1.5 text-[12px] text-fg-400">
                    还没做好
                  </span>
                )}
                {script && (
                  <span className="text-[11px] text-fg-400">
                    一共会让装置动 {cueCount(script)} 次
                  </span>
                )}
                {hasDevice && missing.length > 0 && playable && (
                  <span className="text-[11px] text-warn-600">
                    缺的几样不影响玩，只是那几段少一个效果
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-fg-400">
        这份清单是数据驱动的：加一个作品，只要在{' '}
        <span className="font-mono">console/src/works.ts</span> 里加一条。
        剧本本身在 <span className="font-mono">demo/script.json</span>，改剧情不用碰代码。
      </p>
    </section>
  );
}
