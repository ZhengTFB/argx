import { SECTIONS, type SectionKey } from '../routes';
import { useDevice } from '../core/device';
import { isConnectedStatus } from './StatusBar';
import { Btn, Pill } from './primitives';
import { IcoHelp } from './icons';

/* ============================================================
   左侧图标栏（56px，只有图标，hover 出 tooltip）
   ============================================================ */
export function Sidebar({
  active, onGo
}: { active: SectionKey; onGo: (k: SectionKey) => void }) {
  return (
    <aside className="sidebar">
      <button
        type="button"
        className="side-logo"
        aria-label="回到引导"
        title="ARGX"
        onClick={() => onGo('onboarding')}
      >
        <span>A</span>
      </button>

      {SECTIONS.map((s) => (
        <button
          key={s.key}
          type="button"
          className={`side-item${active === s.key ? ' act' : ''}`}
          aria-label={s.tip}
          aria-current={active === s.key ? 'page' : undefined}
          onClick={() => onGo(s.key)}
        >
          {s.Icon ? <s.Icon /> : null}
          <span className="tip">{s.tip}</span>
        </button>
      ))}

      <span className="side-spacer" />

      <button
        type="button"
        className="side-item"
        aria-label="帮助 · 回到引导"
        title="帮助"
        onClick={() => onGo('onboarding')}
      >
        <IcoHelp />
        <span className="tip">帮助</span>
      </button>
    </aside>
  );
}

/* ============================================================
   顶部 tab 条 + 连接徽标
   ============================================================ */
export function TopBar({
  active, onGo
}: { active: SectionKey; onGo: (k: SectionKey) => void }) {
  const d = useDevice();

  return (
    <header className="topbar">
      <nav className="tabs" aria-label="栏目">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`tab${active === s.key ? ' act' : ''}`}
            aria-current={active === s.key ? 'page' : undefined}
            onClick={() => onGo(s.key)}
          >
            {s.Icon ? <s.Icon /> : null}
            {s.label}
          </button>
        ))}
      </nav>

      <div className="topbar-right">
        <ConnBadge />
        {d.connecting ? <Pill tone="info" small>正在连接…</Pill> : null}
      </div>
    </header>
  );
}

/**
 * 连接徽标：传输类型 + 连没连上。
 *
 * 传输类型读 device 自己记的 kind —— **不能读 ARGX.mode()**：
 * 只要往 SDK 传的是 Transport 对象，它一律包成 HostTransport，
 * mode() 恒为 'host'，虚拟装置和真串口分不出来。
 */
function ConnBadge() {
  const d = useDevice();
  const live = isConnectedStatus(d.status);
  const warn = d.status === 'connecting' || d.connecting || d.status === 'stale';

  const kindText =
    d.kind === 'simulator' ? '虚拟装置'
      : d.kind === 'hardware' ? 'USB 串口'
        : '未选装置';

  const stateText = live
    ? (d.status === 'stale' ? '信号弱' : '已连接')
    : warn ? '连接中…' : '未连接';

  const tone = live ? ' is-on' : warn ? ' is-warn' : ' is-off';

  return (
    <span className={`conn-badge${tone}`} data-kind={d.kind ?? 'none'} data-status={d.status}>
      <span className="cb-dot" />
      <span className="cb-kind">{kindText}</span>
      <span className="cb-state">{stateText}</span>
    </span>
  );
}

/* ============================================================
   页面标题（栏头去掉标题之后，页面标题就承担导航作用）
   ============================================================ */
export function PageHead({
  title, sub, actions
}: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub ? <div className="page-sub">{sub}</div> : null}
      </div>
      {actions ? <div className="head-actions">{actions}</div> : null}
    </div>
  );
}

export { Btn };
