import { useEffect, useRef, useState } from 'react';
import { device, useDevice } from '../core/device';
import { CHANNELS } from '../core/channels';
import type { DeviceFaults } from '../core/virtualDevice';
import { isConnectedStatus } from '../ui/StatusBar';
import { ChannelCard } from '../ui/ChannelCard';
import { Btn, Callout, CardHead, Panel, Pill } from '../ui/primitives';
import { PageHead } from '../ui/Chrome';
import { FaultPanel } from '../ui/FaultPanel';

/*
 * 模拟器：不接硬件也能看到四路效果。
 *
 * 两件事是阶段二验证过、这里必须沿用的做法：
 *   1. **直接复用 device/virtual_device.js**，不复制不重写
 *   2. 可视化在 rAF 循环里读 device.getState()，**不进全局 store**，
 *      并按量化签名比较避免 60fps 全树重渲染
 *
 * ★ 这里读的是 device.getState()（虚拟装置的内部状态），而右侧状态栏读的是
 *   ARGX.state() 回查（协议帧）。两者在中途会不一致：渐变期间装置内部每帧都在变，
 *   而回查 800ms 才一次。这不是 bug，是两条不同精度的观测口径。
 *   所以卡片里的数字按整数显示，冒烟测试也只断言"变了"，不断言具体数值。
 */

const QUANT = 50; // 签名里 ttl / i 的量化粒度

interface Sig { [id: string]: string }

/** 把装置状态压成一个短签名：只有它变了才 setState */
function signature(out: Record<string, { i: number; ttl: number; pri: number }> | undefined): Sig {
  const sig: Sig = {};
  if (!out) return sig;
  for (const id of Object.keys(out)) {
    const o = out[id];
    // i 决定"亮没亮"，ttl 只做倒计时。
    // **不能拿 ttl 判活**：关掉一条正在跑的效果时 i 归零而 ttl 仍是剩余毫秒。
    sig[id] = `${Math.round(o.i * QUANT)}|${Math.round(o.ttl / QUANT)}|${o.pri}`;
  }
  return sig;
}

function sameSig(a: Sig, b: Sig): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

export function Simulator() {
  const d = useDevice();
  const live = isConnectedStatus(d.status);

  // 每路的滑杆值，初始取渠道定义的默认
  const [values, setValues] = useState<Record<string, Record<string, number>>>(() => {
    const v: Record<string, Record<string, number>> = {};
    for (const c of CHANNELS) {
      v[c.id] = {};
      for (const p of c.params) v[c.id][p.key] = p.def;
    }
    return v;
  });
  const [firing, setFiring] = useState<Record<string, boolean>>({});
  const [out, setOut] = useState<Record<string, { i: number; ttl: number; pri: number }>>({});
  const sigRef = useRef<Sig>({});

  // 进模拟器自动连虚拟装置 —— 不该要求用户先去做一次"连接"动作
  useEffect(() => { device.ensure(); }, []);

  /*
   * rAF 循环。
   * ★ 每帧重新取 device.virtualDevice：重连会换一个新的实例，
   *   闭包里捕获老实例的话，会永远画一台已经没了的装置。
   * ★ 循环放在这个 effect 里（cleanup 取消），不放进 store：
   *   StrictMode 会把 effect 跑两遍，起停两次是无害的；放进 store 就得自己引用计数。
   * ★ 只在**量化签名**变了才 setState。装置内部按帧推进（渐变期间每帧都变），
   *   直接 setState 就是 60fps 全树重渲染。
   */
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      // 页面不可见时不做读取（浏览器本来也会把 rAF 降到 ~1fps）
      if (!document.hidden) {
        const dev = device.virtualDevice;
        if (dev) {
          const st = dev.getState();
          const next = signature(st.out);
          if (!sameSig(sigRef.current, next)) {
            sigRef.current = next;
            const copy: typeof out = {};
            for (const k of Object.keys(st.out)) {
              copy[k] = { i: st.out[k].i, ttl: st.out[k].ttl, pri: st.out[k].pri };
            }
            setOut(copy);
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // 只依赖会话号：换装置才需要重开循环
  }, [d.sessionNo]);

  const fire = (id: string) => {
    const ch = CHANNELS.find((c) => c.id === id);
    if (!ch) return;
    setFiring((f) => ({ ...f, [id]: true }));
    setTimeout(() => setFiring((f) => ({ ...f, [id]: false })), 700);

    if (ch.kind === 'binary') {
      // 开关量：没有强度，只有开与关。取反当前值
      const cur = out[id]?.i ?? 0;
      device.cue(id, { i: cur >= ch.threshold ? 0 : 1, pri: 2 });
      return;
    }
    const v = values[id] ?? {};
    device.cue(id, {
      i: v.i ?? ch.params[0]?.def ?? 1,
      dur: v.dur ?? 3000,
      ...(v.ramp > 0 ? { ramp: v.ramp } : {}),
      pri: 2
    });
  };

  /** 四路一起触发。**走一条 batch**：协议保证同一帧内同时起，单独发四条做不到 */
  const fireAll = () => {
    const cues = CHANNELS.map((ch) => {
      if (ch.kind === 'binary') return { id: ch.id, p: { i: 1, pri: 2 } };
      const v = values[ch.id] ?? {};
      return {
        id: ch.id,
        p: { i: v.i ?? 1, dur: Math.min(v.dur ?? 3000, 3000), ...(v.ramp > 0 ? { ramp: v.ramp } : {}), pri: 2 }
      };
    });
    cues.forEach((c) => setFiring((f) => ({ ...f, [c.id]: true })));
    setTimeout(() => setFiring({}), 700);
    device.batch(cues);
  };

  return (
    <>
      <PageHead
        title="模拟器"
        sub="不接硬件也能预览四路输出效果"
        actions={
          <>
            <Btn tone="ghost" disabled={!live} onClick={() => device.reset()}>重置全部</Btn>
            <Btn tone="primary" disabled={!live} onClick={fireAll}>全部触发</Btn>
          </>
        }
      />

      {!live ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Callout tone="warning">
            还没有装置。点「连虚拟装置」就能让下面四张卡动起来。
            模拟器与真机跑同一套会话层，只是装置换成了虚拟的。
            <span style={{ marginLeft: 'var(--space-3)' }}>
              <Btn size="sm" tone="primary" onClick={() => device.useSimulator()}>连虚拟装置</Btn>
            </span>
          </Callout>
        </div>
      ) : null}

      <div className="ch-grid" style={{ marginBottom: 'var(--space-6)' }}>
        {CHANNELS.map((ch) => (
          <ChannelCard
            key={ch.id}
            channel={ch}
            values={values[ch.id] ?? {}}
            onValue={(k, v) => setValues((s) => ({ ...s, [ch.id]: { ...s[ch.id], [k]: v } }))}
            live={out[ch.id]?.i ?? 0}
            ttl={out[ch.id]?.ttl ?? 0}
            firing={!!firing[ch.id]}
            relayOn={(out[ch.id]?.i ?? 0) >= ch.threshold}
            onRelay={(on) => device.cue(ch.id, { i: on ? 1 : 0, pri: 2 })}
            onFire={() => fire(ch.id)}
            disabled={!live}
          />
        ))}
      </div>

      <div className="cols-2">
        <Presets />
        <Faults />
      </div>
    </>
  );
}

/* ============================================================
   剧情预设：直接用 SDK 的事件词表，作者写什么这里就能点什么
   ============================================================ */
function Presets() {
  const d = useDevice();
  const live = isConnectedStatus(d.status);
  const events = device.events();

  return (
    <Panel>
      <CardHead
        title="剧情预设"
        sub="这些就是作品里写的那些事件名（ARGX.fire('…')）"
        right={<Pill tone={live ? 'success' : 'idle'} small>{live ? '可触发' : '没连装置'}</Pill>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
        {Object.entries(events).map(([name, meta]) => (
          <Btn
            key={name}
            tone="secondary"
            disabled={!live}
            title={`${meta.desc || meta.label}\n${meta.cues.map((c) => c.id).join(' + ')}`}
            style={{ justifyContent: 'flex-start' }}
            onClick={() => device.fire(name)}
          >
            {meta.label || name}
          </Btn>
        ))}
      </div>
      <p className="page-sub" style={{ marginTop: 'var(--space-4)' }}>
        「全部触发」走的是 <code>batch</code>：一帧里同时起四路。
        单独发四条会隔着串口往返，做不到同时。
      </p>
    </Panel>
  );
}

/* ============================================================
   故障注入
   ============================================================ */
function Faults() {
  const d = useDevice();
  const faults = d.faults as DeviceFaults;

  return (
    <Panel>
      <CardHead
        title="故障注入"
        sub="把装置弄坏，看界面还撑不撑得住"
        right={<Btn size="sm" tone="ghost" onClick={() => device.clearFaults()}>全部关闭</Btn>}
      />
      <FaultPanel
        faults={faults}
        onChange={(k, v, restart) => device.setFault(k, v, restart)}
        disabled={d.kind !== 'simulator'}
      />
      {d.kind !== 'simulator' ? (
        <p className="page-sub" style={{ marginTop: 'var(--space-3)' }}>
          故障注入只对虚拟装置有效。真机上无法伪造丢包。
          现在连的是<strong>{d.transportLabel ?? '别的通道'}</strong>，这些开关不会生效。
        </p>
      ) : null}
    </Panel>
  );
}
