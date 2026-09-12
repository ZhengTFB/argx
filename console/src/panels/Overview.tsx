import { connection } from '../core/connection';
import { useStore } from '../core/store';
import { capLabel } from '../core/capabilities';
import { Badge, Btn, Card, Empty, KV } from '../ui/primitives';
import type { SectionId } from '../sections';

/* 总览：打开控制台的第一眼。一屏看完连着什么、在不在线、刚才发生了什么。 */

export default function Overview(props: { onGo: (s: SectionId) => void }) {
  const conn = useStore((s) => s.conn);
  const log = useStore((s) => s.log);

  const connected = conn.status !== 'disconnected' && conn.status !== 'lost';
  const recent = log.slice(-6).reverse();

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card
        title="当前状态"
        right={
          <Badge tone={connected ? (conn.status === 'stale' ? 'warn' : 'ok') : 'mute'}>
            {connected ? '在线' : '离线'}
          </Badge>
        }
      >
        <KV k="传输方式" v={conn.label || '未连接'} />
        <KV k="装置" v={conn.dev ?? '—'} />
        <KV k="会话状态" v={conn.status} />
        <KV k="心跳延迟" v={conn.latency === null ? '—' : `${conn.latency} ms`} />
        <KV
          k="能力"
          v={
            conn.caps
              ? `${conn.caps.out.length} 路输出 / ${conn.caps.in.length} 路输入`
              : '—'
          }
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {!connected && (
            <Btn tone="primary" onClick={() => void connection.connectMock()}>
              连接虚拟装置
            </Btn>
          )}
          <Btn onClick={() => props.onGo('simulator')}>去模拟器</Btn>
          <Btn onClick={() => props.onGo('devices')}>去设备面板</Btn>
        </div>
      </Card>

      <Card title="能力一览" subtitle="装置自己报上来的，不是我们猜的">
        {conn.caps && conn.caps.out.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {conn.caps.out.map((id) => (
              <Badge key={id} tone="ok">
                {capLabel(id)} · {id}
              </Badge>
            ))}
            {conn.caps.in.map((id) => (
              <Badge key={id} tone="warn">
                输入 · {id}
              </Badge>
            ))}
          </div>
        ) : (
          <Empty>还没连上装置。连上之后这里会列出它能做什么。</Empty>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-ink-600">
          加新硬件不需要改协议、不需要改这个页面：装置端注册一个新能力，
          这里的列表就会自己多一项。
        </p>
      </Card>

      <Card
        title="刚才触发了什么"
        subtitle="最近 6 条收发"
        className="xl:col-span-2"
        right={<Btn size="sm" onClick={() => props.onGo('timeline')}>完整时间线</Btn>}
      >
        {recent.length === 0 ? (
          <Empty>还没有收发记录。连上装置或去模拟器点两下就有了。</Empty>
        ) : (
          <ul className="font-mono text-[12px] leading-relaxed">
            {recent.map((e) => (
              <li key={e.id} className="truncate border-b border-ink-800 py-1 last:border-0">
                <span className="mr-2 text-ink-600">
                  {new Date(e.t).toLocaleTimeString('zh-CN', { hour12: false })}
                </span>
                <span
                  className={
                    e.dir === 'in'
                      ? 'text-argx-400'
                      : e.dir === 'out'
                        ? 'text-ink-400'
                        : e.dir === 'error'
                          ? 'text-danger-400'
                          : 'text-ink-600'
                  }
                >
                  {e.dir === 'in' ? '← 收' : e.dir === 'out' ? '→ 发' : '· 记'}
                </span>{' '}
                <span className="text-ink-200">{e.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
