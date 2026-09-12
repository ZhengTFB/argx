import { useBasicDevice } from '../../core/basicDevice';
import type { SelfCheck as SelfCheckState } from './useSelfCheck';

/*
 * 自检按钮。
 *
 * 三态结果画在右边那一栏、每一路旁边（绿勾 / 黄叹号 / 转圈），
 * 这里只放按钮和一句结论——按需求不做术语解释，看一眼就够。
 */

export default function SelfCheck({ check }: { check: SelfCheckState }) {
  const dev = useBasicDevice();
  const live = dev.status === 'ready' || dev.status === 'active' || dev.status === 'stale';

  return (
    <section className="rounded-xl border border-line-300 bg-paper-0 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-fg-900">自检</h2>
          <p className="mt-0.5 text-xs text-fg-400">
            四路依次各动一下（亮→灭、响→停……），大约 4 秒。
            右边每一路会显示结果：绿勾是通了，黄叹号是装置没回应——多半那一路没接线。
          </p>
        </div>
        <button
          type="button"
          disabled={check.running}
          onClick={() => void check.run()}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {check.running ? '正在自检……' : '开始自检'}
        </button>
      </div>

      {!live && !check.running && (
        <p className="mt-3 text-[11px] text-fg-400">
          现在没连上装置，跑出来会是四路都没回应——这也是有用的结果，说明线没接好。
        </p>
      )}

      {check.summary && (
        <p className="mt-3 rounded-lg bg-paper-100 px-3 py-2 text-xs text-fg-700">{check.summary}</p>
      )}
    </section>
  );
}
