import { toWireParams, PRIORITY_OPTIONS, type CueParams } from '../core/cue';
import { Field, NumberInput, Select, Toggle } from './primitives';

/*
 * cue 参数编辑器。手动测试台与模拟器共用。
 *
 * 强度用滑杆而不是输入框：这个值是要"调"的，不是要"填"的。
 */
export default function CueParamsForm(props: {
  value: CueParams;
  onChange: (v: CueParams) => void;
  /** 预设强度快捷位，点一下就到位 */
  quickIntensity?: number[];
}) {
  const v = props.value;
  const set = (patch: Partial<CueParams>) => props.onChange({ ...v, ...patch });
  const quick = props.quickIntensity ?? [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label={`强度 i = ${v.i.toFixed(2)}`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={v.i}
            onChange={(e) => set({ i: Number(e.target.value) })}
            className="w-full accent-argx-500"
          />
          <div className="mt-1 flex gap-1">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => set({ i: q })}
                className={`rounded border px-1.5 py-0.5 text-[11px] ${
                  Math.abs(v.i - q) < 0.001
                    ? 'border-argx-500 text-argx-400'
                    : 'border-ink-600 text-ink-400 hover:text-ink-200'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="持续 dur（毫秒）" hint={v.hold ? '常驻时这个值会被忽略' : '上限 30 秒'}>
        <NumberInput value={v.dur} min={0} max={30000} step={100} onChange={(x) => set({ dur: x })} />
      </Field>

      <Field label="渐变 ramp（毫秒）" hint="从当前亮度平滑过渡到目标值">
        <NumberInput value={v.ramp} min={0} max={30000} step={100} onChange={(x) => set({ ramp: x })} />
      </Field>

      <Field label="优先级 pri">
        <Select
          value={String(v.pri)}
          onChange={(x) => set({ pri: Number(x) })}
          options={PRIORITY_OPTIONS}
        />
      </Field>

      <div className="flex items-end">
        <Toggle
          checked={v.hold}
          onChange={(x) => set({ hold: x })}
          label="常驻（hold）"
          hint="一直保持，直到被抢占或装置复位"
        />
      </div>

      <div className="sm:col-span-2">
        <div className="rounded border border-ink-800 bg-ink-950 p-2 font-mono text-[11px] text-ink-400">
          实际发出：{JSON.stringify(toWireParams(v))}
        </div>
      </div>
    </div>
  );
}
