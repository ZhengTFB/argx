import type { DeviceState } from '../core/virtualDevice';
import { CAPABILITIES } from '../core/capabilities';
import { Badge } from '../ui/primitives';

/*
 * 虚拟装置的可视化。
 *
 * 数据全部来自阶段一虚拟设备的 getState()——这里不自己算协议状态，
 * 只负责把"装置内部现在是什么样"画出来。
 * 所以屏幕上看到的东西，和真实装置上会发生的事情是同一份逻辑推出来的。
 */

function capState(state: DeviceState | null, id: string) {
  return state?.out?.[id] ?? { i: 0, active: false, pri: 2, hold: false, ttl: 0 };
}

function ttlText(c: { hold: boolean; ttl: number; active: boolean }): string {
  if (!c.active) return '空闲';
  if (c.hold) return '常驻';
  return `${Math.round(c.ttl)} ms 后结束`;
}

export default function VirtualDeviceView(props: { state: DeviceState | null }) {
  const s = props.state;
  const light = capState(s, 'light.main');
  const beeper = capState(s, 'sound.beeper');
  const vibrate = capState(s, 'motion.vibrate');
  const relay = capState(s, 'env.relay');

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* 灯 */}
      <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
        <Header id="light.main" state={light} />
        <div className="mt-3 flex h-32 items-center justify-center rounded border border-ink-800 bg-ink-950">
          <div
            className="h-16 w-16 rounded-full transition-[background-color,box-shadow] duration-100"
            style={{
              backgroundColor: `rgba(245, 205, 100, ${0.06 + 0.94 * light.i})`,
              boxShadow: `0 0 ${6 + light.i * 46}px rgba(245, 205, 100, ${0.15 + 0.7 * light.i})`
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-600">
          <span>亮度 {(light.i * 100).toFixed(0)}%</span>
          <span>{ttlText(light)}</span>
        </div>
        <Bar value={light.i} />
      </div>

      {/* 声音 */}
      <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
        <Header id="sound.beeper" state={beeper} />
        <div className="mt-3 flex h-32 items-center justify-center rounded border border-ink-800 bg-ink-950">
          <div className="relative flex h-20 w-20 items-center justify-center">
            {beeper.i > 0 && (
              <>
                <span className="argx-ripple absolute h-16 w-16 rounded-full border border-argx-400/70" />
                <span
                  className="argx-ripple absolute h-16 w-16 rounded-full border border-argx-400/50"
                  style={{ animationDelay: '0.35s' }}
                />
              </>
            )}
            <span
              className="z-10 rounded-full px-2 py-1 text-[11px]"
              style={{
                color: beeper.i > 0 ? 'var(--color-argx-400)' : 'var(--color-ink-600)',
                border: `1px solid ${beeper.i > 0 ? 'var(--color-argx-500)' : 'var(--color-ink-700)'}`
              }}
            >
              {beeper.i > 0 ? '鸣响' : '静音'}
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-600">
          <span>音量不可调，只有响与不响</span>
          <span>{ttlText(beeper)}</span>
        </div>
      </div>

      {/* 振动 */}
      <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
        <Header id="motion.vibrate" state={vibrate} />
        <div className="mt-3 flex h-32 items-center justify-center rounded border border-ink-800 bg-ink-950">
          <div
            className={vibrate.i > 0 ? 'argx-shake' : ''}
            style={{ ['--argx-shake' as string]: `${(vibrate.i * 5).toFixed(2)}px` }}
          >
            <div
              className="flex h-14 w-20 items-center justify-center rounded border text-[11px]"
              style={{
                borderColor: vibrate.i > 0 ? 'var(--color-argx-500)' : 'var(--color-ink-700)',
                color: vibrate.i > 0 ? 'var(--color-argx-400)' : 'var(--color-ink-600)'
              }}
            >
              {vibrate.i > 0 ? '震动中' : '静止'}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-600">
          <span>强度 {(vibrate.i * 100).toFixed(0)}%</span>
          <span>{ttlText(vibrate)}</span>
        </div>
        <Bar value={vibrate.i} />
      </div>

      {/* 继电器 */}
      <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
        <Header id="env.relay" state={relay} />
        <div className="mt-3 flex h-32 items-center justify-center gap-4 rounded border border-ink-800 bg-ink-950">
          <span
            className="h-4 w-4 rounded-full"
            style={{
              backgroundColor: relay.i >= 0.5 ? '#5ce0cc' : '#2a3441',
              boxShadow: relay.i >= 0.5 ? '0 0 12px rgba(92,224,204,0.8)' : 'none'
            }}
          />
          <span className="text-sm" style={{ color: relay.i >= 0.5 ? 'var(--color-argx-400)' : 'var(--color-ink-600)' }}>
            {relay.i >= 0.5 ? '吸合（通电）' : '断开'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-600">
          <span>开关量，i ≥ 0.5 视为吸合</span>
          <span>{ttlText(relay)}</span>
        </div>
      </div>
    </div>
  );
}

function Header(props: {
  id: string;
  state: { i: number; active: boolean; pri: number; hold: boolean };
}) {
  const info = CAPABILITIES[props.id];
  const st = props.state;
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="text-sm text-ink-200">{info?.label ?? props.id}</div>
        <div className="font-mono text-[11px] text-ink-600">{props.id}</div>
      </div>
      <div className="flex shrink-0 gap-1">
        {st.hold && <Badge tone="warn">常驻</Badge>}
        <Badge tone={st.active ? 'ok' : 'mute'}>{st.active ? `pri ${st.pri}` : '空闲'}</Badge>
      </div>
    </div>
  );
}

function Bar(props: { value: number }) {
  return (
    <div className="mt-2 h-1 overflow-hidden rounded bg-ink-800">
      <div
        className="h-full bg-argx-500 transition-[width] duration-100"
        style={{ width: `${Math.max(0, Math.min(1, props.value)) * 100}%` }}
      />
    </div>
  );
}
