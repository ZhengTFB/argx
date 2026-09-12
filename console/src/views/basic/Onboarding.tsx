import { CAPABILITIES } from '../../core/capabilities';

/*
 * 引导。首次打开时显示，之后点右上角的「帮助」还能调出来。
 *
 * 三件事按使用顺序排：这是什么 → 怎么接线 → 怎么接到自己的网页里。
 * 文案标准是"给一个只会写故事的人看"：不出现协议、引脚号以外的术语，
 * 每一句都要能直接照做。
 */

export default function Onboarding({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <section className="rounded-xl border border-line-300 bg-paper-0 p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-fg-900">这是干什么用的</h2>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-md border border-line-400 px-2.5 py-1 text-[11px] text-fg-600 hover:bg-paper-100"
          >
            知道了，不再显示
          </button>
        )}
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-fg-700">
        让网页里的故事操控现实里的东西。剧情走到"灯灭了"那一段，
        玩家桌上的灯就真的暗下去——不是动画，是实物。
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-fg-600">
        <span className="rounded-md bg-paper-100 px-2.5 py-1.5">你的网页作品</span>
        <span className="text-fg-400">—USB 线→</span>
        <span className="rounded-md bg-paper-100 px-2.5 py-1.5">一个小盒子（ESP32）</span>
        <span className="text-fg-400">—→</span>
        <span className="rounded-md bg-paper-100 px-2.5 py-1.5">灯 / 蜂鸣器 / 振动马达 / 继电器</span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-[13px] font-semibold text-fg-900">① 要买什么、怎么接</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-fg-600">
            四路全配齐大概一百块出头。也可以先只买一盏灯——下面是每种东西接在小盒子的哪一脚。
          </p>
          <ul className="mt-2.5 grid gap-2">
            {Object.values(CAPABILITIES).map((c) => (
              <li key={c.id} className="rounded-lg bg-paper-100 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-fg-900">{c.label}</span>
                  <span className="font-mono text-[11px] text-fg-400">{c.pin}</span>
                </div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-fg-600">买：{c.buy}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-fg-400">{c.parts}</div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] leading-relaxed text-warn-600">
            两条最容易出事的地方：灯和灯带要串电阻；灯带、继电器、振动马达都要单独供电，
            不能从小盒子取电。
          </p>
        </div>

        <div>
          <h3 className="text-[13px] font-semibold text-fg-900">② 怎么接进你自己的网页</h3>
          <ol className="mt-2 ml-4 list-decimal space-y-1.5 text-[12px] leading-relaxed text-fg-600">
            <li>
              把 <span className="font-mono text-fg-900">sdk/argx.js</span> 和{' '}
              <span className="font-mono text-fg-900">sdk/AGENTS.md</span> 一起丢给你的 AI，
              说一句"用 ARGX 给这个场景加上装置反馈"。
            </li>
            <li>
              关键剧情处写一行 <span className="font-mono text-fg-900">ARGX.fire('reveal')</span>。
              一个故事写三到八行就够，多了等于没有。
            </li>
            <li>
              把页面用本地服务器打开（在目录里跑 <span className="font-mono text-fg-900">npx serve</span>），
              不要双击文件——双击打开的时候浏览器不给用串口。
            </li>
          </ol>

          <h3 className="mt-4 text-[13px] font-semibold text-fg-900">③ 想看看长什么样</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-fg-600">
            下面 ARG 库里第一个作品就是这个项目自己做的示例。点「打开」，右边那一栏会跟着动——
            那一栏显示的永远是装置实际报回来的状态。
          </p>
        </div>
      </div>
    </section>
  );
}
