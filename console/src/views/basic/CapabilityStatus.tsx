import { basicDevice, useBasicDevice } from '../../core/basicDevice';
import { BASIC_CAPS, levelOf } from './caps';
import type { CheckState } from './useSelfCheck';

/*
 * 右侧那一栏：装置现在是什么样。
 *
 * 全部只读，而且**只显示设备报回来的东西**（走协议里的 query/state 回查，
 * 见 core/basicDevice.ts 的轮询）——不是"我们发过什么所以大概是这样"。
 * 这两者的差别平时看不出来，但装置拔了线的那一秒就是全部差别。
 *
 * 每一路旁边那个小圆点是自检的三态：绿勾 / 黄叹号 / 转圈。
 * 按需求不放文字说明——灯有没有亮，看一眼就够了。
 */

function CapIcon({ id }: { id: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };
  switch (id) {
    case 'light.main': // 灯泡
      return (
        <svg {...common}>
          <path d="M9 18h6M10 21h4" />
          <path d="M12 3a6 6 0 0 1 3.6 10.8c-.4.3-.6.8-.6 1.2H9c0-.4-.2-.9-.6-1.2A6 6 0 0 1 12 3Z" />
        </svg>
      );
    case 'sound.beeper': // 喇叭
      return (
        <svg {...common}>
          <path d="M4 9v6h3l4 3V6L7 9H4Z" />
          <path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />
        </svg>
      );
    case 'motion.vibrate': // 振动
      return (
        <svg {...common}>
          <rect x="9" y="5" width="6" height="14" rx="1.5" />
          <path d="M5.5 9.5v5M3 11v2M18.5 9.5v5M21 11v2" />
        </svg>
      );
    default: // 电源（继电器）
      return (
        <svg {...common}>
          <path d="M12 3v9" />
          <path d="M6.5 7a8 8 0 1 0 11 0" />
        </svg>
      );
  }
}

function CheckBadge({ state }: { state: CheckState }) {
  if (state === 'testing') {
    return (
      <span
        title="正在测"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-100 border-t-brand-500"
      />
    );
  }
  if (state === 'ok') {
    return (
      <span
        title="这一路通了"
        className="flex h-4 w-4 items-center justify-center rounded-full bg-good-600 text-[10px] font-bold text-white"
      >
        ✓
      </span>
    );
  }
  if (state === 'warn') {
    return (
      <span
        title="发了指令，装置没回应（多半没接线）"
        className="flex h-4 w-4 items-center justify-center rounded-full bg-warn-600 text-[10px] font-bold text-white"
      >
        !
      </span>
    );
  }
  return <span title="还没测" className="h-4 w-4 rounded-full border-2 border-line-400" />;
}

export default function CapabilityStatus({
  check
}: {
  check: Record<string, CheckState>;
}) {
  const dev = useBasicDevice();
  const live = dev.status === 'ready' || dev.status === 'active' || dev.status === 'stale';

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3">
        <div className="text-sm font-semibold text-fg-900">装置现在是什么样</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-fg-400">
          {live
            ? `${dev.dev ?? '装置'} 报回来的实时状态`
            : dev.kind === 'simulator'
              ? '模拟器还没连上'
              : '还没有连上装置'}
        </div>
      </div>

      <ul className="grid gap-2">
        {BASIC_CAPS.map((cap) => {
          const i = levelOf(dev.out, cap.id);
          const on = cap.active(i);
          // 装置没报过这一路就画成灰的：没数据不等于"它是关的"
          const known = live && dev.outAt > 0;
          return (
            <li
              key={cap.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                on && known ? 'border-brand-500 bg-brand-50' : 'border-line-300 bg-paper-0'
              }`}
            >
              <span className={on && known ? 'text-brand-600' : 'text-fg-400'}>
                <CapIcon id={cap.id} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-fg-900">{cap.label}</span>
                <span className={`block text-[11px] ${on && known ? 'text-brand-700' : 'text-fg-400'}`}>
                  {known ? cap.status(i) : '—'}
                </span>
              </span>
              <CheckBadge state={check[cap.id] ?? 'idle'} />
            </li>
          );
        })}
      </ul>

      {dev.note && (
        <p className="mt-3 rounded-md bg-warn-50 px-3 py-2 text-[11px] leading-relaxed text-warn-600">
          {dev.note}
        </p>
      )}

      <p className="mt-auto pt-4 text-[11px] leading-relaxed text-fg-400">
        这一栏只是"看"。想看每一帧收发的细节、想手动改参数，去右上角的专业控制台。
      </p>

      <button
        type="button"
        onClick={() => {
          basicDevice.disconnect();
          basicDevice.ensure();
        }}
        className="mt-2 text-left text-[11px] text-fg-400 underline hover:text-fg-600"
      >
        重新连接一次
      </button>
    </div>
  );
}
