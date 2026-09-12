import { useState } from 'react';
import { connection } from '../core/connection';
import { store, useStore } from '../core/store';
import { CAPABILITIES, capLabel } from '../core/capabilities';
import { DEFAULT_CUE, describeParams, toWireParams, type CueParams } from '../core/cue';
import { ConnectControls } from '../ui/ConnectControls';
import CueParamsForm from '../ui/CueParamsForm';
import { Badge, Btn, Card, Empty, KV } from '../ui/primitives';

/*
 * 设备面板：连接、能力可视化、手动测试台、连接测试。
 * 检测与调试能力集中在这里，不放进 SDK——这是总纲定的归属原则。
 */

const PING_ROUNDS = 20;
const PING_GAP_MS = 250;

export default function Devices() {
  const conn = useStore((s) => s.conn);
  const [params, setParams] = useState<CueParams>(DEFAULT_CUE);
  const [targets, setTargets] = useState<string[]>(['light.main']);
  const [pingTest, setPingTest] = useState<{
    running: boolean;
    sent: number;
    result: { received: number; lost: number; avg: number | null; min: number | null; max: number | null } | null;
  }>({ running: false, sent: 0, result: null });

  const caps = conn.caps;
  const connected = conn.status !== 'disconnected' && conn.status !== 'lost';

  const toggleTarget = (id: string) => {
    setTargets((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const sendCue = () => {
    if (targets.length === 0) return;
    const p = toWireParams(params);
    if (targets.length === 1) {
      connection.session.cue(targets[0], p);
    } else {
      // 多于一个目标就发 batch：同一帧内生效，灯和声音才是真的同时动
      connection.session.batch(targets.map((id) => ({ id, p })));
    }
  };

  const runPingTest = async () => {
    const before = store.get().conn;
    const pongBase = before.pongCount;
    const latBase = before.latencies.length;
    setPingTest({ running: true, sent: 0, result: null });

    for (let i = 0; i < PING_ROUNDS; i++) {
      if (!connection.session.isConnected()) break;
      connection.session.ping();
      setPingTest((t) => ({ ...t, sent: i + 1 }));
      await new Promise((r) => setTimeout(r, PING_GAP_MS));
    }
    // 留一点时间给最后的 pong 回来，否则丢包率永远偏高
    await new Promise((r) => setTimeout(r, 1500));

    const after = store.get().conn;
    const received = after.pongCount - pongBase;
    const lats = after.latencies.slice(latBase);
    setPingTest({
      running: false,
      sent: PING_ROUNDS,
      result: {
        received,
        lost: Math.max(0, PING_ROUNDS - received),
        avg: lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : null,
        min: lats.length ? Math.min(...lats) : null,
        max: lats.length ? Math.max(...lats) : null
      }
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* 连接 */}
      <Card title="连接" subtitle="Mock 连的是阶段一的虚拟装置；Serial 连真实 ESP32">
        <ConnectControls />
        <div className="mt-3">
          <KV k="当前传输" v={conn.label || '未连接'} />
          <KV k="会话状态" v={conn.status} />
          <KV k="装置" v={conn.dev ?? '—'} />
          <KV k="心脏" v={conn.latency === null ? '—' : `${conn.latency} ms`} />
          <KV k="累计 pong / err" v={`${conn.pongCount} / ${conn.errCount}`} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-600">
          真实串口要在 <span className="text-ink-400">https://</span> 或{' '}
          <span className="text-ink-400">localhost</span> 下才能用，而且必须由你点一下才能连；
          手机浏览器不行。用局域网 IP 打开时串口会整个消失，但模拟器照常能用。
        </p>
      </Card>

      {/* 连接测试 */}
      <Card title="连接测试" subtitle={`连发 ${PING_ROUNDS} 次 ping，看心跳稳不稳`}>
        <div className="flex items-center gap-2">
          <Btn tone="primary" disabled={!connected || pingTest.running} onClick={() => void runPingTest()}>
            {pingTest.running ? `发送中 ${pingTest.sent}/${PING_ROUNDS}` : '开始测试'}
          </Btn>
          {pingTest.running && <Badge tone="warn">进行中</Badge>}
        </div>

        {pingTest.result && (
          <div className="mt-3">
            <KV k="发出 / 收到" v={`${PING_ROUNDS} / ${pingTest.result.received}`} />
            <KV
              k="丢包"
              v={
                <span className={pingTest.result.lost > 0 ? 'text-warn-400' : ''}>
                  {pingTest.result.lost} 次
                </span>
              }
            />
            <KV
              k="延迟 最小/平均/最大"
              v={
                pingTest.result.avg === null
                  ? '—'
                  : `${pingTest.result.min} / ${pingTest.result.avg} / ${pingTest.result.max} ms`
              }
            />
          </div>
        )}

        <div className="mt-3">
          <div className="mb-1 text-xs text-ink-400">最近 40 次心跳</div>
          <div className="flex h-10 items-end gap-0.5">
            {conn.latencies.length === 0 && <span className="text-[11px] text-ink-600">暂无数据</span>}
            {conn.latencies.map((ms, i) => (
              <div
                key={i}
                title={`${ms} ms`}
                className="w-1.5 rounded-t bg-argx-500/70"
                style={{ height: `${Math.min(100, (ms / 60) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* 能力可视化 */}
      <Card title="能力" subtitle="装置连上时自己报的，不是这里写死的">
        {caps && caps.out.length > 0 ? (
          <div className="grid gap-2">
            {caps.out.map((id) => {
              const info = CAPABILITIES[id];
              return (
                <div key={id} className="rounded border border-ink-800 bg-ink-950 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-ink-200">
                      {info?.label ?? id} <span className="font-mono text-xs text-ink-600">{id}</span>
                    </span>
                    <Badge tone="ok">{info?.pin ?? '未知引脚'}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
                    {info?.what ?? '这个能力没有登记说明，加一条 CAPABILITIES 就能显示出来'}
                  </p>
                </div>
              );
            })}
            {caps.in.map((id) => (
              <div key={id} className="rounded border border-ink-800 bg-ink-950 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink-200">输入 {id}</span>
                  <Badge tone="warn">in</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>未连接，或装置还没有注册任何能力。</Empty>
        )}
      </Card>

      {/* 手动测试台 */}
      <Card
        title="手动测试台"
        subtitle="选一个能力、调参数、发出去——用来回答「灯到底能不能亮」"
        right={conn.lastAck ? <Badge tone={conn.lastAck.r === 'applied' ? 'ok' : 'warn'}>
          最近回执 {conn.lastAck.r}
        </Badge> : undefined}
      >
        <div className="mb-3">
          <div className="mb-1 text-xs text-ink-400">
            目标能力（选多个就用 batch 一帧同时发）
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(caps?.out ?? Object.keys(CAPABILITIES)).map((id) => {
              const on = targets.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleTarget(id)}
                  className={`rounded border px-2 py-1 text-xs ${
                    on ? 'border-argx-500 text-argx-400' : 'border-ink-600 text-ink-400 hover:text-ink-200'
                  }`}
                >
                  {capLabel(id)} <span className="font-mono text-[10px]">{id}</span>
                </button>
              );
            })}
          </div>
        </div>

        <CueParamsForm value={params} onChange={setParams} />

        <div className="mt-3 flex items-center gap-2">
          <Btn tone="primary" disabled={!connected || targets.length === 0} onClick={sendCue}>
            {targets.length > 1 ? `发送 batch（${targets.length} 路）` : '发送 cue'}
          </Btn>
          <Btn disabled={!connected} onClick={() => connection.session.query()}>
            查询状态
          </Btn>
          <Btn
            tone="danger"
            disabled={!connected}
            title="强制回 idle，清空所有输出"
            onClick={() => connection.session.reset()}
          >
            reset
          </Btn>
        </div>

        <p className="mt-2 text-[11px] text-ink-600">{describeParams(params)}</p>

        {conn.lastAck?.res && (
          <div className="mt-2 rounded border border-ink-800 bg-ink-950 p-2 font-mono text-[11px] text-ink-400">
            batch 逐条结果：{JSON.stringify(conn.lastAck.res)}
          </div>
        )}
      </Card>
    </div>
  );
}
