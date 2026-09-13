import { Btn, Pill, Slider } from './primitives';
import { ChannelIcon } from './ChannelIcon';
import { isActive, type Channel } from '../core/channels';

/*
 * 通道卡：连续量（灯 / 声 / 振）与开关量（继电器）是同组件不同变体。
 *
 * 「形态即语义」这条设计在三个层面同时体现，改任一处都要一起改：
 *   控件   前三路是滑杆 + 时长；继电器**没有滑杆**，只有一个开关
 *   可视化 渐变环 / 声波脉冲 / 高频抖动条 vs 两态块
 *   动效   前三路有过渡（渐变 260ms）；继电器切换是 0ms 硬切
 */

export interface ChannelCardProps {
  channel: Channel;
  /** 当前参数值（i / dur / ramp），开关量用不到 */
  values: Record<string, number>;
  onValue: (key: 'i' | 'dur' | 'ramp', v: number) => void;
  /** 装置此刻这一路的瞬时电平 0~1 —— 可视化的唯一数据源 */
  live: number;
  /** 剩余毫秒；-1 = 常驻；0 = 没在跑 */
  ttl: number;
  onFire: () => void;
  firing?: boolean;
  /** 继电器那一路的开关（它是开关量，没有"强度"） */
  relayOn?: boolean;
  onRelay?: (on: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  /** 卡片右上角的一句话（模拟器里不需要，设备页会写"开关量 · 无渐变量"） */
  note?: string;
}

export function ChannelCard(props: ChannelCardProps) {
  const { channel, values, onValue, live, ttl, onFire, firing, disabled, compact, note } = props;
  const active = isActive(channel.id, live);

  return (
    <div
      className={`ch${firing ? ' fire' : ''}${compact ? ' ch--compact' : ''}`}
      data-ch={channel.key}
    >
      <div className="ch-head">
        <span className="ch-badge"><ChannelIcon ch={channel.key} /></span>
        <span className="ch-name">{channel.label}</span>
        <span className="ch-code">{channel.id}</span>
      </div>

      <div className="ch-viz">
        <Viz channel={channel} live={live} active={active} />
      </div>

      {channel.kind === 'binary' ? (
        <>
          <div className="slider-row" style={{ justifyContent: 'space-between' }}>
            <span className="row">
              <span className="s-lbl s-lbl--auto">通路</span>
              <label className="switch switch--hard" data-ch={channel.key}>
                <input
                  type="checkbox"
                  checked={!!props.relayOn}
                  disabled={disabled}
                  aria-label="继电器开关"
                  onChange={(e) => props.onRelay?.(e.target.checked)}
                />
                <span className="track"><span className="knob" /></span>
              </label>
            </span>
            <span className="s-val s-val--auto mono" style={{ color: props.relayOn ? 'var(--ch)' : 'var(--text-tertiary)' }}>
              {props.relayOn ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="ch-note">开关量 · 只有开与关两态</div>
        </>
      ) : (
        <>
          {channel.params.map((p) => (
            <Slider
              key={p.key}
              param={p}
              value={values[p.key] ?? p.def}
              onChange={(v) => onValue(p.key, v)}
              ch={channel.key}
              disabled={disabled}
            />
          ))}
          <div className="ch-note">{note ?? ''}</div>
        </>
      )}

      <div className="ch-foot">
        <span className="row" style={{ marginRight: 'auto' }}>
          <StatePill channel={channel} live={live} ttl={ttl} />
        </span>
        <Btn tone="primary" size={compact ? 'sm' : 'md'} onClick={onFire} disabled={disabled}>
          触发
        </Btn>
      </div>
    </div>
  );
}

function StatePill({ channel, live, ttl }: { channel: Channel; live: number; ttl: number }) {
  if (!isActive(channel.id, live)) return <Pill tone="idle">{channel.states.idle}</Pill>;
  if (ttl === -1) return <Pill tone="info">{channel.states.resident}</Pill>;
  return (
    <Pill tone="info">
      {channel.states.active}
      {ttl > 0 ? ` · ${(ttl / 1000).toFixed(1)}s` : ''}
    </Pill>
  );
}

/* ============================================================
   四种可视化形态
   ============================================================ */
function Viz({ channel, live, active }: { channel: Channel; live: number; active: boolean }) {
  switch (channel.key) {
    case 'light': {
      // 渐变环：连续量，环的填充跟随瞬时电平（协议里的 ramp 就是走这个环）
      const C = 176; // 2π × 28
      return (
        <svg className="light-ring" viewBox="0 0 64 64" role="img" aria-label={`灯光 ${Math.round(live * 100)}%`}>
          <circle className="bg" cx="32" cy="32" r="28" />
          <circle className="fg" cx="32" cy="32" r="28" style={{ strokeDashoffset: C * (1 - live) }} />
        </svg>
      );
    }
    case 'sound':
      return (
        <div className={`wave${active ? ' on' : ''}`} role="img" aria-label={active ? '正在发声' : '安静'}>
          {Array.from({ length: 7 }, (_, i) => <i key={i} />)}
        </div>
      );
    case 'motion':
      return (
        <div className={`buzz${active ? ' on' : ''}`} role="img" aria-label={active ? '正在振动' : '停着'}>
          {Array.from({ length: 16 }, (_, i) => <i key={i} />)}
        </div>
      );
    default: {
      // 继电器：两态块，硬切。没有中间态 —— 因为物理上就是吸合与断开
      const on = live >= channel.threshold;
      return (
        <div className="relay" role="img" aria-label={on ? '通路' : '断开'}>
          <span className={`state${on ? ' on' : ''}`}>ON</span>
          <span className={`state${on ? '' : ' on'}`}>OFF</span>
        </div>
      );
    }
  }
}
