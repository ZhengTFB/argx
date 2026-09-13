import { useEffect, useMemo, useRef, useState } from 'react';
import { device, useDevice } from '../core/device';
import { streams, useStreams, type LogDir } from '../core/streams';
import { CHANNELS } from '../core/channels';
import { DEFAULT_CUE, PRIORITY_OPTIONS, toWireParams, type CueParams } from '../core/cue';
import { isConnectedStatus } from '../ui/StatusBar';
import { Btn, Callout, CardHead, Panel, Pill, Switch } from '../ui/primitives';
import { PageHead } from '../ui/Chrome';
import { FaultPanel } from '../ui/FaultPanel';
import { EXAMPLE_INPUT_ID } from '../core/device';
import { IcoStop, IcoX } from '../ui/icons';

/*
 * 功能调试页。
 *
 * ★ 和原型有两处结构性差别，都是被底层能力逼出来的：
 *   ① 原型画的是「裸帧输入框 + 发送」。SDK **没有 raw send** ——
 *      它的对外接口只有 init/connect/close/fire/cue/batch/reset/defineEvent/
 *      state/on/off/status/mode/caps/device/hint。发不了任意字符串。
 *      所以这一格改成 **cue 构造器**（选能力 id + 填参数 + 发送），
 *      这本来也正是任务书对它的要求。
 *   ② 原型画的是「参数组 A/B + 应用/重置」。协议里 `cfg` 在 SDK 层没有入口
 *      （core/session.ts 有 configure，但 SDK 没实现），所以那个面板没有对应能力。
 *      它改成 cue 的参数表单 —— 参数是真实存在的五个：i / dur / ramp / pri / hold。
 *
 * 四块能力，各自对应底层真的有的东西：
 *   收发时间线  ← ARGX.on('frame')，每一帧收发都在这里
 *   手动发 cue  ← ARGX.cue / ARGX.batch，回执来自 ARGX.on('ack')
 *   故障注入    ← virtual_device 的开关（同一个组件，模拟器那边也在用）
 *   input 注入  ← virtual_device.injectInput，验证反向通道
 */

type LogFilter = 'all' | 'frames' | 'errors';

export function Debug() {
  const d = useDevice();
  const s = useStreams();
  const [filter, setFilter] = useState<LogFilter>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => {
    switch (filter) {
      case 'frames': return s.log.filter((l) => l.dir === 'in' || l.dir === 'out' || l.dir === 'undelivered');
      case 'errors': return s.log.filter((l) => l.dir === 'error');
      default: return s.log;
    }
  }, [s.log, filter]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, autoScroll]);

  const live = isConnectedStatus(d.status);

  return (
    <>
      <PageHead
        title="功能调试"
        sub="每一帧收发、手动指令、故障注入、反向通道"
        actions={
          <>
            <Pill tone={live ? 'success' : 'idle'}>{live ? '已连接' : '未连接'}</Pill>
            {d.dev ? <Pill tone="info">{d.dev}</Pill> : null}
          </>
        }
      />

      {!live ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Callout tone="warning">
            先连一台装置才能调试 —— 没连接时下面的控件是禁用的，
            因为发出去的帧没有人接。
            <span style={{ marginLeft: 'var(--space-3)' }}>
              <Btn size="sm" tone="primary" onClick={() => device.useSimulator()}>连虚拟装置</Btn>
            </span>
          </Callout>
        </div>
      ) : null}

      <div className="debug-layout">
        <div className="stack">
          <CueBuilder disabled={!live} />

          <Panel>
            <CardHead
              title="收发时间线"
              sub={`${s.log.length} 行 · 错误 ${s.errCount}`}
              right={
                <>
                  <div className="chips" style={{ margin: 0 }}>
                    {([['all', '全部'], ['frames', '只看帧'], ['errors', '只看错误']] as const).map(([k, label]) => (
                      <button key={k} type="button" className={`chip${filter === k ? ' act' : ''}`}
                              aria-pressed={filter === k} onClick={() => setFilter(k)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <Btn size="sm" tone="ghost" onClick={() => streams.clearLog()}>清空</Btn>
                </>
              }
            />
            <div className="row row--between" style={{ marginBottom: 'var(--space-2)' }}>
              <label className="check">
                <Switch checked={autoScroll} onChange={setAutoScroll} label="自动滚动" />
                自动滚动
              </label>
              <span className="page-sub" style={{ marginTop: 0 }}>
                → 发出 · ← 收到 · ● 系统 · ! 错误
              </span>
            </div>
            <div className="log-stream thin-scroll" ref={boxRef} role="log" aria-label="收发时间线">
              {lines.length === 0 ? (
                <div className="page-sub" style={{ marginTop: 0 }}>还没有收发记录。</div>
              ) : (
                lines.map((l) => (
                  <div className={`log-line ${l.dir}`} key={l.id}>
                    <span className="t">{fmtTime(l.t)}</span>
                    <span className="a">{MARK[l.dir]}</span>
                    <span className="m">{l.text}</span>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="stack">
          <Presets disabled={!live} />
          <InputInjector />
          <Faults />
        </div>
      </div>
    </>
  );
}

const MARK: Record<LogDir, string> = {
  out: '→',
  in: '←',
  undelivered: '↯',
  info: '●',
  error: '!'
};

/* ============================================================
   手动发 cue
   ============================================================ */
function CueBuilder({ disabled }: { disabled: boolean }) {
  const s = useStreams();
  const [targets, setTargets] = useState<string[]>([CHANNELS[0].id]);
  const [p, setP] = useState<CueParams>({ ...DEFAULT_CUE });

  const toggle = (id: string) => {
    setTargets((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  };

  const send = () => {
    if (targets.length === 0) return;
    const wire = toWireParams(p);
    // 多选时自动走 batch：协议保证同一帧内同时起，单独发 N 条做不到
    if (targets.length === 1) device.cue(targets[0], wire);
    else device.batch(targets.map((id) => ({ id, p: wire })));
  };

  const last = s.lastAck;

  return (
    <Panel>
      <CardHead
        title="手动发 cue"
        sub="选能力、填参数、发出去，然后看装置怎么回"
        right={
          <Btn size="sm" tone="primary" disabled={disabled || targets.length === 0} onClick={send}>
            {targets.length > 1 ? `发送（batch ${targets.length} 条）` : '发送'}
          </Btn>
        }
      />

      <div className="chips" style={{ marginBottom: 'var(--space-4)' }}>
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip${targets.includes(c.id) ? ' act' : ''}`}
            data-ch={c.key}
            aria-pressed={targets.includes(c.id)}
            onClick={() => toggle(c.id)}
          >
            {c.label}<span className="mono" style={{ color: 'var(--text-tertiary)' }}>{c.id}</span>
          </button>
        ))}
      </div>

      <div className="cols-2--even" style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div>
          <SliderField label="强度 i" min={0} max={1} step={0.05} value={p.i}
                       onChange={(v) => setP({ ...p, i: v })} format={(v) => v.toFixed(2)} />
          <SliderField label="渐变 ramp" min={0} max={5000} step={50} value={p.ramp}
                       onChange={(v) => setP({ ...p, ramp: v })} format={(v) => `${v}ms`} />
        </div>
        <div>
          <SliderField label="持续 dur" min={0} max={30000} step={500} value={p.dur}
                       onChange={(v) => setP({ ...p, dur: v })} format={(v) => `${v}ms`}
                       disabled={p.hold} />
          <div className="field" style={{ marginTop: 'var(--space-2)' }}>
            <span className="label">优先级 pri</span>
            <select className="select" value={String(p.pri)} aria-label="优先级"
                    onChange={(e) => setP({ ...p, pri: Number(e.target.value) })}>
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 'var(--space-4)' }}>
        <label className="check">
          <Switch checked={p.hold} onChange={(v) => setP({ ...p, hold: v })} label="常驻" />
          常驻（hold）
        </label>
        <span className="page-sub" style={{ marginTop: 0 }}>
          常驻效果不受 30 秒 TTL 限制，装置回查时 ttl 报 -1；但看门狗照样会清它。
        </span>
      </div>

      <div className="well" style={{ marginTop: 'var(--space-4)' }}>
        <div className="row row--between" style={{ marginBottom: 'var(--space-2)' }}>
          <span className="label">最近回执</span>
          {last ? (
            <Pill tone={last.res ? 'warning' : 'success'} small>seq {last.seq} · {last.r}</Pill>
          ) : <Pill tone="idle" small>还没有回执</Pill>}
        </div>
        {last?.res ? (
          <div className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            {Object.entries(last.res).map(([id, r]) => <div key={id}>{id} → {r}</div>)}
          </div>
        ) : (
          <div className="page-sub" style={{ marginTop: 0 }}>
            单个 cue 的 ack 只有一个结果；多选时走 batch，这里会列出逐条结果
            （applied / preempted / dup / dropped）。
          </div>
        )}
      </div>
    </Panel>
  );
}

function SliderField({
  label, min, max, step, value, onChange, format, disabled
}: {
  label: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; format: (v: number) => string; disabled?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-row">
      <span className="s-lbl s-lbl--auto" style={{ width: 76 }}>{label}</span>
      <input
        className="slider" type="range" min={min} max={max} step={step} value={value}
        disabled={disabled} aria-label={label}
        style={{ '--fill': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="s-val">{format(value)}</span>
    </div>
  );
}

/* ============================================================
   快捷指令：SDK 的事件词表
   ============================================================ */
function Presets({ disabled }: { disabled: boolean }) {
  const events = device.events();
  return (
    <Panel>
      <CardHead title="快捷指令" sub="SDK 的事件词表，点一下就是一次 fire()" />
      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        {Object.entries(events).map(([name, meta]) => (
          <Btn
            key={name}
            tone="secondary"
            disabled={disabled}
            title={meta.desc}
            style={{ justifyContent: 'flex-start' }}
            onClick={() => device.fire(name)}
          >
            {meta.label || name}
            <span className="mono" style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }}>
              {meta.cues.map((c) => c.id.split('.')[0]).join('+')}
            </span>
          </Btn>
        ))}
      </div>
      <div className="row" style={{ marginTop: 'var(--space-4)' }}>
        <Btn size="sm" tone="ghost" disabled={disabled} onClick={() => device.reset()}>
          <IcoStop /> 复位（reset）
        </Btn>
      </div>
    </Panel>
  );
}

/* ============================================================
   反向通道 input 注入
   ============================================================ */
function InputInjector() {
  const d = useDevice();
  const isSim = d.kind === 'simulator';
  const [id, setId] = useState(EXAMPLE_INPUT_ID);
  const [event, setEvent] = useState('press');
  const [value, setValue] = useState(1);
  const [result, setResult] = useState<string | null>(null);

  const capsIn = d.caps?.in ?? [];

  const inject = () => {
    if (!id.trim()) return;
    const ok = device.injectInput(id.trim(), event, value);
    setResult(ok
      ? `装置已经发出 input 帧（${id} ${event}=${value}）—— 看左边的 ← 那一行`
      : `装置回了 err:unknown_input。这恰好证明上行是通的：帧到了装置，装置也回了错误。`);
  };

  return (
    <Panel>
      <CardHead
        title="input 注入"
        sub="反向通道：装置 → 网页。这一侧平时只有真按钮会触发"
        right={<Pill tone={capsIn.length ? 'success' : 'idle'} small>
          {capsIn.length ? `已注册 ${capsIn.length} 个输入` : '没注册输入'}
        </Pill>}
      />

      <Callout>
        真机固件没有接任何物理输入，所以 <code>caps.in</code> 默认是空的 ——
        注入任何 id 都会得到 <code>err:unknown_input</code>。
        那**也是**一次成功的上行验证（帧到了装置，装置也回了话）。
        想看到真正的 input 上报，把下面这个开关打开，虚拟装置会多声明一个示例输入。
      </Callout>

      <div className="row" style={{ margin: 'var(--space-4) 0' }}>
        <label className="check">
          <Switch
            checked={d.inputSample}
            disabled={!isSim}
            label="给虚拟装置注册一个示例输入"
            onChange={(v) => device.setInputSample(v)}
          />
          给虚拟装置注册一个示例输入（会重连一次）
        </label>
      </div>

      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
        <input className="input" style={{ width: 150 }} aria-label="输入 id" value={id}
               onChange={(e) => setId(e.target.value)} placeholder="input.button" />
        <select className="select" aria-label="事件" value={event} onChange={(e) => setEvent(e.target.value)}>
          <option value="press">press</option>
          <option value="release">release</option>
          <option value="hold">hold</option>
          <option value="change">change</option>
        </select>
        <input className="input" type="number" style={{ width: 90 }} aria-label="值"
               value={value} onChange={(e) => setValue(Number(e.target.value))} />
        <Btn tone="primary" disabled={!isSim} onClick={inject}>注入</Btn>
      </div>

      {result ? <div className="page-sub">{result}</div> : null}
      {capsIn.length > 0 ? (
        <div className="row" style={{ marginTop: 'var(--space-2)' }}>
          <span className="label">装置声明的输入：</span>
          <span className="mono" style={{ fontSize: 'var(--text-xs)' }}>{capsIn.join(', ')}</span>
        </div>
      ) : null}
      {!isSim ? (
        <p className="page-sub" style={{ marginTop: 'var(--space-3)' }}>
          <IcoX /> 只有虚拟装置能收注入 —— 协议里没有"网页主动发 input"这种命令，
          这条通道的方向是装置 → 网页。
        </p>
      ) : null}
    </Panel>
  );
}

/* ============================================================
   故障注入（和模拟器页共用同一个组件）
   ============================================================ */
function Faults() {
  const d = useDevice();
  return (
    <Panel>
      <CardHead
        title="故障注入"
        sub="看界面在装置抽风的时候还撑不撑得住"
        right={<Btn size="sm" tone="ghost" onClick={() => device.clearFaults()}>全部关闭</Btn>}
      />
      {d.kind !== 'simulator' ? (
        <Callout tone="warning">
          故障注入只能作用在虚拟装置上。现在连的是 {d.transportLabel ?? '别的通道'}。
        </Callout>
      ) : null}
      <FaultPanel
        faults={d.faults}
        onChange={(k, v, restart) => device.setFault(k, v, restart)}
        disabled={d.kind !== 'simulator'}
      />
    </Panel>
  );
}

/* ============================================================ */
function fmtTime(t: number): string {
  const d = new Date(t);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}
