import { useDevice } from '../core/device';
import { useStreams } from '../core/streams';
import { CHANNELS, isActive, levelOf, stateWord, type Channel } from '../core/channels';
import { ChannelIcon } from './ChannelIcon';
import { IcoCheck, IcoPulse } from './icons';

/*
 * 右侧常驻状态栏。
 *
 * 设计目标（用户原话）：以最简单的方式告诉用户现在各个东西处在什么状态，
 * 不需要显示具体参数，一看到就知道这是在显示什么东西。
 *
 * 所以每个槽位固定四段：图标 → 中文名（常显）→ 电平轨道 / 两态灯块 → 状态词。
 * **形态即语义**：前三路是连续量，用竖直轨道（有刻度、有零点参考线，像仪表）；
 * 第四路是开关量，用上下刻 ON/OFF 的灯块。两者形态不同，不是靠颜色区分。
 *
 * 数据全部来自 ARGX.state() 回查（device 快照里的 out），**界面不本地记账**：
 * 装置拔了线，这里就该回到"待机"，而不是继续显示上一次的亮度。
 */

export function StatusBar() {
  const d = useDevice();
  const s = useStreams();
  const connected = isConnectedStatus(d.status);

  return (
    <aside className="statusbar" role="status" aria-label="四路输出实时状态">
      <div className="sb-head">
        <span
          className={`sb-conn${connected ? '' : ' off'}`}
          title={connected ? `${d.transportLabel ?? '装置'}已连接` : '未连接'}
        >
          <IcoCheck />
        </span>
      </div>

      {CHANNELS.map((ch) => (
        <Slot key={ch.id} channel={ch} out={d.out} />
      ))}

      <div className="sb-foot">
        <span className={`sb-heart${connected ? ' beat' : ''}`} title="心跳（ping / pong 往返）">
          <IcoPulse />
        </span>
        <span className="sb-hb-val">{s.lastLatency === null ? '—' : `${s.lastLatency}ms`}</span>
        <span className="sb-foot-lbl">心跳</span>
      </div>
    </aside>
  );
}

function Slot({ channel, out }: { channel: Channel; out: Record<string, { i: number; ttl: number; pri: number }> }) {
  const i = levelOf(out, channel.id);
  const ttl = out[channel.id]?.ttl ?? 0;
  const on = isActive(channel.id, i);
  const word = stateWord(channel.id, i, ttl);

  return (
    <div className={`sb-slot${on ? ' is-on' : ''}`} data-ch={channel.key}>
      <span className="sb-ico"><ChannelIcon ch={channel.key} /></span>
      <span className="sb-name">{channel.label}</span>

      {channel.kind === 'binary' ? (
        // 开关量：ON/OFF 两态灯块。切换是硬切（0ms），由 CSS 的 transition:none 保证
        <div className={`sb-binary${on ? ' on' : ''}`} data-state={word}>
          <span className="lamp" />
        </div>
      ) : (
        // 连续量：电平轨道。填充高度就是装置报回来的 i
        <div className="sb-track" data-state={word}>
          <div className="sb-fill" style={{ height: `${Math.max(4, i * 100)}%` }} />
        </div>
      )}

      <span className="sb-state">{word}</span>
      <span className="sb-tip">
        {channel.label} · {channel.id} · {channel.kind === 'binary' ? '仅开/关两态' : tipParams(channel)}
      </span>
    </div>
  );
}

function tipParams(channel: Channel): string {
  const names = channel.params.map((p) => p.label);
  return names.length ? names.join('/') : '—';
}

/** 'lost' / 'disconnected' 之外都算"链路还在" */
export function isConnectedStatus(status: string): boolean {
  return status === 'ready' || status === 'active' || status === 'stale';
}
