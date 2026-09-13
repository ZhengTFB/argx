import { useState } from 'react';
import { device, useDevice } from '../core/device';
import { isConnectedStatus } from '../ui/StatusBar';
import { Btn, Callout, Card, Panel, Pill } from '../ui/primitives';
import { PageHead } from '../ui/Chrome';
import { IcoArrowRight, IcoChip, IcoDebug } from '../ui/icons';
import type { SectionKey } from '../routes';

/*
 * 引导页：两条路径分叉。
 *
 * 这是两个**目标不同**的引导，不是一套流程的两种措辞：
 *   路径一（内容创作者）连上装置 → 开始玩，每一步只做一件事，每步都有成功反馈
 *   路径二（开发者）接入 SDK / 看协议 / 进调试台，允许信息密度高
 *
 * ★ 步骤 2、3 与原型画的不一样，这是**被迫**的：
 *   Web Serial 没有"扫描设备列表"这件事 —— 浏览器只提供 requestPort()
 *  （弹一个由操作系统画的端口选择框，网页拿不到列表内容），
 *   以及 getPorts()（只返回用户以前授权过的端口）。
 *   所以原型里那个"正在扫描设备… + 端口列表 + 每行一个连接按钮"做不出来。
 *   这里改成"选哪种装置 → 点连接 → 在浏览器弹出的框里选端口"，
 *   把真实发生的三件事说清楚。
 */

type Path = 'guide' | 'dev';

export function Onboarding({ onGo }: { onGo: (k: SectionKey) => void }) {
  const [path, setPath] = useState<Path>('guide');

  return (
    <>
      <PageHead title="开始使用" sub="大概 2 分钟就能让你的设备动起来" />

      <div className="cols-2--even" style={{ display: 'grid', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <button
          type="button"
          className="start-card"
          aria-pressed={path === 'guide'}
          onClick={() => setPath('guide')}
        >
          <span className="sc-art">
            <span className="sc-halo" />
            <span className="sc-svg"><IcoChip /></span>
            <span className="sc-pins" />
          </span>
          <span className="sc-body">
            <span className="sc-kicker">路径一</span>
            <span className="sc-title" style={{ display: 'block' }}>我第一次用 ARGX</span>
            <span className="sc-desc" style={{ display: 'block' }}>插上开发板，五步就能开始玩</span>
            <span className="sc-cta">开始引导 <IcoArrowRight /></span>
          </span>
        </button>

        <button
          type="button"
          className="start-card start-card--alt"
          aria-pressed={path === 'dev'}
          onClick={() => setPath('dev')}
        >
          <span className="sc-art">
            <span className="sc-halo" />
            <span className="sc-svg"><IcoDebug /></span>
            <span className="sc-pins" />
          </span>
          <span className="sc-body">
            <span className="sc-kicker">路径二</span>
            <span className="sc-title" style={{ display: 'block' }}>我要接入项目</span>
            <span className="sc-desc" style={{ display: 'block' }}>复制 SDK 片段，查看协议与调试台</span>
            <span className="sc-cta sc-cta--ghost">进入文档 <IcoArrowRight /></span>
          </span>
        </button>
      </div>

      {path === 'guide'
        ? <GuidePath onGo={onGo} />
        : <DevPath onGo={onGo} />}
    </>
  );
}

/* ============================================================
   路径一：新手连通（五步）
   ============================================================ */
function GuidePath({ onGo }: { onGo: (k: SectionKey) => void }) {
  const d = useDevice();
  const [tried, setTried] = useState(false);
  const live = isConnectedStatus(d.status);

  // 步骤状态完全由真实连接状态推出来，不是自己记的进度
  const done = [true, d.kind !== null, live, tried, tried && live];

  // 当前步 = 第一个没完成的
  const current = Math.max(0, done.findIndex((v) => !v));

  const steps: Array<{ title: string; desc: string; body: React.ReactNode }> = [
    {
      title: '插上开发板',
      desc: '用 USB 数据线把 ARGX 接到电脑。线要能传数据，纯充电线不行。',
      body: <Callout>板子上标着 <code>USB</code> 的那个口是原生 USB，控制台认的是它；另一个口只供电。</Callout>
    },
    {
      title: '选一种装置',
      desc: '没有硬件也能走完这条路 —— 虚拟装置和真装置跑的是同一套会话层。',
      body: (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Btn tone="primary" onClick={() => device.useSimulator()}>连虚拟装置</Btn>
          <Btn onClick={() => void device.useHardware()}>连真实装置（USB 串口）</Btn>
        </div>
      )
    },
    {
      title: '连接',
      desc: '真实装置会弹出一个端口选择框 —— 那是操作系统画的，网页看不到里面有什么。',
      body: (
        <div className="row">
          {d.connecting ? <Pill tone="info">正在连接…</Pill>
            : live ? <Pill tone="success">已连上 {d.dev ?? '装置'}</Pill>
              : <Pill tone="idle">还没连上</Pill>}
          {d.note ? <span className="page-sub" style={{ marginTop: 0 }}>{d.note}</span> : null}
        </div>
      )
    },
    {
      title: '试一下',
      desc: '点一下，装置真的动 —— 这一下走的是完整链路：cue → 装置 → ack。',
      body: (
        <div className="row">
          <Btn
            tone="primary"
            disabled={!live}
            onClick={() => { device.fire('reveal'); setTried(true); }}
          >
            点亮灯光
          </Btn>
          <span className="page-sub" style={{ marginTop: 0 }}>
            看右边那一栏：灯光会跳到「渐亮中」
          </span>
        </div>
      )
    },
    {
      title: '完成',
      desc: '装置通了。接下来去作品目录，挑一个能在你这台装置上跑的作品。',
      body: (
        <div className="row">
          <Btn tone="primary" disabled={!live} onClick={() => onGo('library')}>
            去 ARG 库选作品 <IcoArrowRight />
          </Btn>
          <Btn tone="ghost" onClick={() => onGo('device')}>打开设备页</Btn>
        </div>
      )
    }
  ];

  const step = steps[current];

  return (
    <Panel>
      <div className="card-head">
        <div className="card-title">新手路径 · 五步连通</div>
        <div className="toolbar">
          <Pill tone={live ? 'success' : 'idle'} small>{live ? '装置已就绪' : '还没连装置'}</Pill>
        </div>
      </div>

      <div className="steps">
        {steps.map((s, i) => (
          <span key={s.title} style={{ display: 'contents' }}>
            <span className={`step${done[i] ? ' done' : ''}${i === current ? ' act' : ''}`}>
              <span className="sdot">{i + 1}</span>
              <span className="stxt">{s.title}</span>
            </span>
            {i < steps.length - 1 ? <span className="sline" /> : null}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', alignItems: 'center' }}>
        <div className="stage">
          <svg width="140" height="140" viewBox="0 0 24 24" fill="none"
               stroke="var(--text-tertiary)" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2.5" /><rect x="8" y="8" width="8" height="8" rx="1" />
            <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
          </svg>
        </div>
        <div>
          <span className="sc-kicker">第 {current + 1} 步 / 共 5 步</span>
          <div style={{ margin: '6px 0 var(--space-2)', fontSize: 18, fontWeight: 650, letterSpacing: '-.018em' }}>
            {step.title}
          </div>
          <div className="page-sub" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            {step.desc}
          </div>
          {step.body}
        </div>
      </div>
    </Panel>
  );
}

/* ============================================================
   路径二：开发者（信息密度高，不做过场动效）
   ============================================================ */
function DevPath({ onGo }: { onGo: (k: SectionKey) => void }) {
  return (
    <div className="cols-2--even" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <Card>
        <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>接入方式</div>

        <div className="well" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="row" style={{ marginBottom: 'var(--space-3)' }}>
            <IcoDebug />
            <strong style={{ fontSize: 'var(--text-sm)' }}>SDK 片段（推荐）</strong>
          </div>
          <div className="code-block" style={{ borderLeftColor: 'var(--accent-400)' }}>{`<script src="argx.js"></script>
<script>
  ARGX.init();
  ARGX.fire('reveal');
</script>`}</div>
          <p className="page-sub" style={{ marginTop: 'var(--space-3)' }}>
            零依赖单文件，整段复制进你已经做好的页面就行。没连装置时它静默降级，
            在 console 里打印一行 cue，不会打断你的剧情。
          </p>
        </div>

        <div className="well">
          <div className="row" style={{ marginBottom: 'var(--space-3)' }}>
            <IcoChip />
            <strong style={{ fontSize: 'var(--text-sm)' }}>裸协议</strong>
          </div>
          <div className="code-block">{`{"v":1,"c":"cue","id":"light.main",
 "p":{"i":0.8,"dur":2000,"ramp":200}}`}</div>
          <p className="page-sub" style={{ marginTop: 'var(--space-3)' }}>
            一行一个 JSON，换行定界。想自己写驱动、或者用别的语言，看指令表就够了。
          </p>
        </div>
      </Card>

      <div className="stack">
        <Card>
          <div className="card-title" style={{ marginBottom: 'var(--space-3)' }}>从零跑通</div>
          <ol className="doc-ul" style={{ paddingLeft: 'var(--space-5)' }}>
            <li className="doc-li">把 <code>sdk/argx.js</code> 放到你的项目里</li>
            <li className="doc-li">页面加载后调一次 <code>ARGX.init()</code></li>
            <li className="doc-li">在剧情节点上写 <code>ARGX.fire('reveal')</code></li>
            <li className="doc-li">用 <code>ARGX.state()</code> 回查装置有没有照做</li>
          </ol>
          <div className="row" style={{ marginTop: 'var(--space-4)' }}>
            <Btn tone="primary" onClick={() => onGo('docs')}>查看完整文档 <IcoArrowRight /></Btn>
            <Btn onClick={() => onGo('debug')}>打开调试台</Btn>
          </div>
        </Card>

        <Card>
          <div className="card-title" style={{ marginBottom: 'var(--space-3)' }}>调试从哪开始</div>
          <div className="kv"><span className="k">指令台</span><span className="v">手动发 cue，看装置回执</span></div>
          <div className="kv"><span className="k">时间线</span><span className="v">每一帧收发都在这儿</span></div>
          <div className="kv"><span className="k">故障注入</span><span className="v">不发 ready / 丢包 / 垃圾串扰</span></div>
          <div className="kv"><span className="k">input 注入</span><span className="v">验证反向通道（装置 → 网页）</span></div>
        </Card>
      </div>
    </div>
  );
}
