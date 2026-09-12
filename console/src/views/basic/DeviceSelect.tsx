import { basicDevice, useBasicDevice, type DeviceKind } from '../../core/basicDevice';

/*
 * 设备选择：模拟器 / 真实硬件。
 *
 * 两个都是正选，不是"先用模拟器凑合，以后再上真货"——
 * 模拟器本身就是这台控制台的主要使用方式（多数玩家手上没有装置，
 * 而创作者在写完剧本前也不该先花一百块）。
 */

const CARDS: { kind: DeviceKind; title: string; lines: string[] }[] = [
  {
    kind: 'simulator',
    title: '模拟器',
    lines: ['不用买任何硬件', '屏幕上会出现一台虚拟装置，点什么它就有反应']
  },
  {
    kind: 'hardware',
    title: '真实硬件',
    lines: ['用 USB 线把装置插到电脑上', '第一次连接浏览器会弹一个框，让你选是哪个设备']
  }
];

export default function DeviceSelect() {
  const dev = useBasicDevice();
  const live = dev.status === 'ready' || dev.status === 'active' || dev.status === 'stale';

  const statusText = dev.connecting
    ? '正在连接……'
    : live
      ? `已连上 ${dev.dev ?? '装置'}`
      : dev.kind === null
        ? '还没有选装置'
        : '没连上';

  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-fg-900">先选一个装置</h2>
          <p className="mt-0.5 text-xs text-fg-400">
            两种都能玩。选好之后，下面自检和作品都会用这一台。
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
            live ? 'bg-good-50 text-good-600' : 'bg-paper-200 text-fg-400'
          }`}
        >
          {statusText}
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => {
          const selected = dev.kind === c.kind;
          return (
            <button
              key={c.kind}
              type="button"
              disabled={dev.connecting}
              onClick={() => {
                // 连真实硬件必须在这一下点击的调用栈里发起，浏览器才允许弹端口框
                if (c.kind === 'simulator') basicDevice.useSimulator();
                else void basicDevice.useHardware();
              }}
              className={`rounded-xl border-2 p-4 text-left transition-colors disabled:opacity-60 ${
                selected
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-line-300 bg-paper-0 hover:border-line-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-fg-900">{c.title}</span>
                {selected && (
                  <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] text-white">
                    正在用
                  </span>
                )}
              </div>
              {c.lines.map((l) => (
                <span key={l} className="mt-1.5 block text-[12px] leading-relaxed text-fg-600">
                  {l}
                </span>
              ))}
            </button>
          );
        })}
      </div>

      {dev.note && (
        <p className="mt-3 rounded-lg bg-warn-50 px-3 py-2 text-xs leading-relaxed text-warn-600">
          {dev.note}
        </p>
      )}
    </section>
  );
}
