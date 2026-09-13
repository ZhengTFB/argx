import { useMemo, useState } from 'react';
import { device, useDevice } from '../core/device';
import { latencyCeiling, SLOW_MS, useStreams } from '../core/streams';
import { CHANNELS, channelOf } from '../core/channels';
import { CAPABILITIES } from '../core/capabilities';
import { useSelfCheck } from '../core/selfCheck';
import { isConnectedStatus } from '../ui/StatusBar';
import { Btn, Callout, CardHead, CheckDot, EmptyState, IcoBox, Panel, Pill } from '../ui/primitives';
import { PageHead } from '../ui/Chrome';
import { ChannelIcon } from '../ui/ChannelIcon';
import {
  IcoChip, IcoClock, IcoPlug, IcoPulse, IcoRefresh, IcoStop
} from '../ui/icons';

/*
 * 设备页。
 *
 * ★ 原型在这里画了四张 KPI：端口 / 固件版本 / 供电电压 / 心跳延迟，其中
 *   「固件版本 1.4.2」「供电电压 5.02V」在协议、固件、SDK 里**都没有出处**
 *  （ready 只有 dev/proto/caps，state 只有 i/pri/ttl/uptime+dev）。
 *   所以四张卡换成真实可用的数据：设备 ID / 传输通道 / 心跳延迟 / 在线时长。
 *
 * ★ 原型那张「可用设备（CU-8821 / CU-1033，每行一个连接按钮）」也做不出来：
 *   Web Serial 没有端口枚举 —— requestPort() 弹的是操作系统的框，网页拿不到列表；
 *   getPorts() 只返回用户以前授权过的端口，而 transports/serial.ts 的接口是冻结的。
 *   所以这里只有一个连接卡：选哪种装置 → 点连接 → 在浏览器弹出的框里选端口。
 */

export function Device() {
  const d = useDevice();
  const s = useStreams();
  const check = useSelfCheck();
  const [firmware, setFirmware] = useState<string | null>(null);

  const live = isConnectedStatus(d.status);

  return (
    <>
      <PageHead
        title="设备"
        sub="连接、测试、能力、心跳"
        actions={
          <>
            <Btn tone="ghost" onClick={() => device.reset()}>停止全部</Btn>
            <Btn tone="danger" disabled={d.kind === null} onClick={() => device.disconnect()}>
              断开连接
            </Btn>
          </>
        }
      />

      {/* ---------- 四张 KPI：全部来自装置自报或本地可观测的链路数据 ---------- */}
      <div className="metrics">
        <Metric
          icon={<IcoChip />} tone={live ? 'success' : undefined} label="设备 ID"
          value={d.dev ?? '—'} text
          foot={live ? <Pill tone="success" small>已连接</Pill> : <Pill tone="idle" small>未连接</Pill>}
        />
        <Metric
          icon={<IcoPlug />} label="传输通道"
          value={d.kind === 'simulator' ? '虚拟装置' : d.kind === 'hardware' ? 'USB 串口' : '—'}
          text
          foot={<span className="delta delta--flat">{d.kind ? '115200 baud' : '还没选装置'}</span>}
        />
        <Metric
          icon={<IcoPulse />} tone={s.lastLatency === null ? undefined : s.lastLatency > SLOW_MS ? 'warning' : 'success'}
          label="心跳延迟"
          value={s.lastLatency === null ? '—' : String(s.lastLatency)}
          unit={s.lastLatency === null ? undefined : 'ms'}
          foot={<>{s.pongCount} 次往返</>}
          spark={<Sparkline data={s.latency} />}
        />
        <Metric
          icon={<IcoClock />} label="在线时长"
          value={d.uptime === null ? '—' : fmtUptime(d.uptime)}
          text
          foot={<>{s.errCount} 个错误</>}
        />
      </div>

      {d.hint ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Callout tone="warning">{d.hint}</Callout>
        </div>
      ) : null}

      {d.note ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Callout tone="warning">{d.note}</Callout>
        </div>
      ) : null}

      <div className="cols-2" style={{ marginBottom: 'var(--space-6)' }}>
        {/* ---------- 连接 ---------- */}
        <Panel>
          <CardHead title="连接" sub={live ? '链路是活的' : '还没连上任何装置'} />
          <div className="row" style={{ flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
            <Btn
              tone={d.kind === 'simulator' ? 'primary' : 'secondary'}
              onClick={() => device.useSimulator()}
            >
              连虚拟装置
            </Btn>
            <Btn
              tone={d.kind === 'hardware' ? 'primary' : 'secondary'}
              disabled={d.connecting}
              onClick={() => void device.useHardware()}
            >
              连真实装置（USB 串口）
            </Btn>
            <Btn tone="ghost" disabled={d.kind === null} onClick={() => device.disconnect()}>
              <IcoStop /> 断开
            </Btn>
          </div>

          <div className="kv"><span className="k">通道</span><span className="v">{d.transportLabel ?? '—'}</span></div>
          <div className="kv"><span className="k">会话状态</span><span className="v">{d.status}</span></div>
          <div className="kv"><span className="k">能力声明</span><span className="v">{d.caps ? `${d.caps.out.length} 路输出 / ${d.caps.in.length} 路输入` : '—'}</span></div>
          <div className="kv"><span className="k">固件版本</span><span className="v">{firmware ?? '协议里没有这一项'}</span></div>

          <div style={{ marginTop: 'var(--space-4)' }}>
            <Callout>
              真实装置的端口选择框由<strong>操作系统</strong>弹出，网页读不到里面的内容，
              所以这里没有"扫描到的设备列表"。
            </Callout>
          </div>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Btn size="sm" tone="ghost" onClick={() => setFirmware(ARGX_PROBE)}>
              为什么没有固件版本？
            </Btn>
          </div>
        </Panel>

        {/* ---------- 能力列表 ---------- */}
        <Panel>
          <CardHead
            title="能力列表"
            sub={d.caps ? `装置自报 ${d.caps.out.length} 路输出` : '还没收到装置的能力声明'}
            right={<Btn size="sm" tone="ghost" onClick={() => device.queryNow()}>回查一次</Btn>}
          />
          {d.caps ? (
            <>
              {d.caps.out.map((id) => {
                const ch = channelOf(id);
                const info = CAPABILITIES[id];
                return (
                  <div className="cap-row" key={id} data-ch={ch?.key}>
                    <span className="ch-badge" style={{ width: 22, height: 22 }}>
                      {ch ? <ChannelIcon ch={ch.key} /> : null}
                    </span>
                    <span>
                      <span className="c-name">{ch?.label ?? id}</span>
                      <span className="c-id" style={{ marginLeft: 8 }}>{id}</span>
                    </span>
                    <span className="c-params">
                      {ch?.kind === 'binary'
                        ? '开 / 关（开关量）'
                        : ch?.params.map((p) => p.label).join(' · ')}
                      {info ? ` · ${info.pin}` : ''}
                    </span>
                  </div>
                );
              })}
              {d.caps.in.length === 0 ? (
                <p className="page-sub" style={{ marginTop: 'var(--space-3)' }}>
                  这台装置没有注册任何<strong>输入</strong>（caps.in 为空）。
                  反向通道能不能通，可以在调试页手动注入一帧看。
                </p>
              ) : (
                d.caps.in.map((id) => (
                  <div className="cap-row" key={id}>
                    <span className="c-name">{id}</span>
                    <span className="c-params">输入 · 装置 → 网页</span>
                  </div>
                ))
              )}
            </>
          ) : (
            <EmptyState
              icon={<IcoChip />}
              title={d.kind ? '还没收到能力声明' : '没有连接设备'}
              desc={d.kind
                ? '装置还没回 ready，或者这一帧在路上丢了。可以重新连一次，或者去调试页发一帧 hello。'
                : '连一台装置（虚拟的也算），这里会列出它自报的四路输出。'}
              actions={
                <>
                  <Btn tone="primary" onClick={() => device.useSimulator()}>连虚拟装置</Btn>
                  <Btn onClick={() => void device.useHardware()}>连真实装置</Btn>
                </>
              }
            />
          )}
        </Panel>
      </div>

      {/* ---------- 连接测试（自检） ---------- */}
      <Panel className="stack" >
        <CardHead
          title="连接测试"
          sub="四路依次各跑一遍，判断依据只有一条：发完指令回查状态"
          right={
            <>
              {check.running ? <Btn size="sm" tone="ghost" onClick={check.stop}>停止</Btn> : null}
              <Btn size="sm" tone="primary" disabled={!live || check.running} onClick={() => void check.run()}>
                {check.running ? '正在测…' : '运行全测'}
              </Btn>
            </>
          }
        />
        <div>
          {CHANNELS.map((c) => {
            const info = CAPABILITIES[c.id];
            return (
              <div className="cap-row" key={c.id} data-ch={c.key}>
                <CheckDot state={check.state[c.id] ?? 'idle'} label={c.label} />
                <span className="c-id">{c.id}</span>
                <span className="c-params">{info?.pin ?? ''}</span>
                <Btn size="sm" tone="ghost" disabled={!live || check.running}
                     onClick={() => device.cue(c.id, { i: 1, dur: 900, pri: 2 })}>
                  试一下
                </Btn>
              </div>
            );
          })}
        </div>
        {check.summary ? (
          <Callout tone={check.summary.startsWith('四路') ? 'success' : 'warning'}>{check.summary}</Callout>
        ) : (
          <Callout>
            每一路都要等装置把状态回查回来才判定通过，不是网页发过就算数。
          </Callout>
        )}
      </Panel>

      {/* ---------- 心跳 ---------- */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <Panel>
          <CardHead
            title="心跳记录"
            sub="网页每 3 秒发一次 ping，装置回 pong；10 秒没有应答就判掉线"
            right={<Btn size="sm" tone="ghost" onClick={() => device.queryNow()}><IcoRefresh /> 刷新</Btn>}
          />
          <HeartbeatChart data={s.latency} />
          {s.hb.length === 0 ? (
            <p className="page-sub">还没有心跳记录。连上装置之后，每 3 秒会有一行。</p>
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>时间</th><th>状态</th><th>延迟</th><th>设备</th><th>响应</th></tr>
              </thead>
              <tbody>
                {[...s.hb].reverse().slice(0, 12).map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{fmtTime(row.t)}</td>
                    <td>
                      {row.ok
                        ? <Pill tone={row.ms !== null && row.ms > SLOW_MS ? 'warning' : 'success'} small>
                          {row.ms !== null && row.ms > SLOW_MS ? '延迟' : '正常'}
                        </Pill>
                        : <Pill tone="danger" small>超时</Pill>}
                    </td>
                    <td className="mono">{row.ms === null ? '—' : `${row.ms} ms`}</td>
                    <td className="mono" style={{ color: 'var(--text-tertiary)' }}>{d.dev ?? '—'}</td>
                    <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                      {row.ok ? 'pong' : 'no response'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}

/* ============================================================ */
function Metric({
  icon, label, value, unit, text, foot, tone, spark
}: {
  icon: React.ReactNode; label: string; value: string; unit?: string;
  text?: boolean; foot?: React.ReactNode; tone?: 'success' | 'warning' | 'danger'; spark?: React.ReactNode;
}) {
  return (
    <div className="metric">
      <div className="m-top">
        <IcoBox tone={tone}>{icon}</IcoBox>
        <span className="m-lbl">{label}</span>
      </div>
      <div className={`m-val${text ? ' m-val--text' : ''}`}>
        {value}
        {unit ? <span className="m-unit">{unit}</span> : null}
      </div>
      <div className="m-foot">{foot}</div>
      {spark}
    </div>
  );
}

/** KPI 卡里的迷你折线。数据不够两个点就不画 —— 不画假的 */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 76;
    const y = 26 - (v / max) * 22;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return (
    <svg className="spark" viewBox="0 0 76 30" preserveAspectRatio="none" aria-hidden="true">
      <path d={`M${pts.join(' L')}`} fill="none" stroke="var(--accent-600)" strokeWidth="1.6"
            strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="76" cy={Number(pts[pts.length - 1].split(' ')[1])} r="2.6"
              fill="var(--accent-600)" stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * 心跳折线图。
 * 纵轴上限按**观测到的最大值**取（虚拟装置是同步应答，往返常在 0~2ms；
 * 写死 0~60ms 的话曲线会一直贴在底线上，等于什么都没画）。
 */
function HeartbeatChart({ data }: { data: number[] }) {
  const ceiling = useMemo(() => latencyCeiling(data), [data]);

  if (data.length < 2) {
    return (
      <div className="hb-plot" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="hb-empty">还没攒够数据，至少要有两次心跳才画得出线</div>
      </div>
    );
  }

  const W = 600;
  const H = 112;
  const TOP = 8;
  const BOTTOM = 20;
  const toY = (v: number) => TOP + (1 - Math.min(v, ceiling) / ceiling) * (H - TOP - BOTTOM);
  const toX = (i: number) => (i / (data.length - 1)) * W;

  const line = data.map((v, i) => `M${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const peakIdx = data.indexOf(Math.max(...data));

  return (
    <div className="hb-chart">
      <div className="hb-yaxis">
        <span>{ceiling}ms</span>
        <span>{Math.round(ceiling / 2)}ms</span>
        <span>0</span>
      </div>
      <div className="hb-plot">
        <div className="hb-grid" aria-hidden="true" />
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
             role="img" aria-label={`最近 ${data.length} 次心跳往返`}>
          <defs>
            <linearGradient id="hbFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-600)" stopOpacity=".18" />
              <stop offset="100%" stopColor="var(--accent-600)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#hbFill)" stroke="none" />
          <path d={line} fill="none" stroke="var(--accent-600)" strokeWidth="1.7"
                strokeLinejoin="round" strokeLinecap="round" />
          {data.length > 2 && Math.max(...data) > 0 ? (
            <circle cx={toX(peakIdx)} cy={toY(data[peakIdx])} r="3.4"
                    fill="var(--warning)" stroke="#fff" strokeWidth="1.6" />
          ) : null}
          <circle cx={toX(data.length - 1)} cy={toY(data[data.length - 1])} r="3.4"
                  fill="var(--accent-600)" stroke="#fff" strokeWidth="1.6" />
        </svg>
        {Math.max(...data) > 0 ? (
          <span className="hb-flag" style={{ left: `${(toX(peakIdx) / W) * 100}%` }}>
            峰值 {Math.max(...data)}ms
          </span>
        ) : null}
        <div className="hb-xaxis">
          <span>最早</span><span>最近 {data.length} 次</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
function fmtUptime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

function fmtTime(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 点「为什么没有固件版本？」之后显示的解释 */
const ARGX_PROBE =
  '协议里没有这一项。ready 帧只带 dev / proto / caps，state 帧只有 i / pri / ttl / uptime。' +
  '要加固件版本，得先往协议里加字段。';
