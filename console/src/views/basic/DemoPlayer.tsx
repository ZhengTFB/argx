import { useEffect, useRef } from 'react';
import { basicDevice, useBasicDevice } from '../../core/basicDevice';
import { SCRIPT } from '../../data/script';

/*
 * 作品播放器。
 *
 * 里面装的是**真正的那个作品页面**（demo/index.html），不是这里重写的一份。
 * 理由：Demo 是给别人抄的样板，一旦控制台里有一份"长得差不多"的副本，
 * 两份就一定会有对不上的那一天，而样板最怕的就是对不上。
 *
 * 装置怎么交进去：宿主（也就是这一页）把已经连好的通道挂在 window.ARGX_HOST_TRANSPORT 上，
 * iframe 里的作品读到它就直接用，不用自己再连一次、也不用观众点两次"连接"。
 * 这个约定写在 sdk/README.md 里，任何作品都能这么用。
 *
 * 顺序很关键：**先挂通道，再给 iframe 设 src**。反过来的话作品会先按
 * "没有宿主通道"初始化（自己找串口），再想换就来不及了。
 */

export default function DemoPlayer({
  workId,
  onBack
}: {
  workId: string;
  onBack: () => void;
}) {
  const dev = useBasicDevice();
  const ref = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 没有连装置就先默认连模拟器——点进来应该直接看到东西在动
    basicDevice.ensure();
    if (!basicDevice.hostTransport) return;
    el.src = 'demo/index.html'; // 通道已经挂好，这一下才真正开始加载作品
  }, [dev.sessionNo]);

  const title = workId === SCRIPT.workId ? SCRIPT.title : workId;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-[12px] text-fg-400 underline hover:text-fg-600"
          >
            ← 回到 ARG 库
          </button>
          <h2 className="text-[15px] font-semibold text-fg-900">{title}</h2>
        </div>
        <span className="text-[11px] text-fg-400">
          这是个真实的网页作品，正在用你选的那台装置
        </span>
      </header>

      <iframe
        ref={ref}
        title={title}
        className="min-h-0 w-full flex-1 rounded-xl border border-line-300 bg-white"
      />
    </section>
  );
}
