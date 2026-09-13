import { useCallback, useEffect, useState } from 'react';
import { parseHash, SECTION_KEYS, type Route, type SectionKey } from './routes';
import { useDevice } from './core/device';
import { Sidebar, TopBar } from './ui/Chrome';
import { StatusBar } from './ui/StatusBar';
import { toast, ToastHost } from './ui/primitives';
import { Onboarding } from './sections/Onboarding';
import { Library } from './sections/Library';
import { Play } from './sections/Play';
import { Device } from './sections/Device';
import { Simulator } from './sections/Simulator';
import { Docs } from './sections/Docs';
import { Debug } from './sections/Debug';

/*
 * 控制台外壳。
 *
 * 只有**一套**界面（阶段二三的小白版 / 专业版两套已全部作废），
 * 只有**一条**连接（core/device.ts），只有一套 hash 空间（routes.ts）。
 *
 * 布局照 02-页面线框 §2.1：
 *   56px 侧栏 ｜ 1fr 内容区 ｜ 76px 右侧常驻状态栏
 * 顶栏是胶囊 tab + 连接徽标（栏头不再有竖排标题 —— 那在 76px 窄栏里是纯噪声）。
 */

function readRoute(): Route {
  return parseHash(window.location.hash);
}

/**
 * 旧 hash 重定向 + 改写地址栏。
 *
 * ★ 必须**改写地址栏**，不能只在内部跳一下 ——
 *   否则"旧链接不留死链"这件事没法被验证，用户也会看到地址栏里躺着一个
 *   已经不存在的页面名（比如 #timeline）。
 * ★ 改写必须发生在**读到 hash 的那一刻**，不能放进 useEffect 里靠 route 变化触发：
 *   `#overview` 和 `#devices` 都映射到 `#device`，第二次进来时 rewrite 的字符串
 *   和上一次一模一样，effect 的依赖没变就不会再跑，地址栏会停在旧值上。
 *   用 replaceState 而不是赋值 hash，免得在历史里多插一条。
 */
function syncHash(): Route {
  const r = readRoute();
  if (r.rewrite && window.location.hash !== r.rewrite) {
    window.history.replaceState(
      null, '',
      `${window.location.pathname}${window.location.search}${r.rewrite}`
    );
  }
  return r;
}

export default function App() {
  const [route, setRoute] = useState<Route>(syncHash);

  /* 地址栏是路由的真相。hashchange 驱动一切，不改写就不渲染 */
  useEffect(() => {
    const onHash = () => setRoute(syncHash());
    window.addEventListener('hashchange', onHash);
    // 首次挂载也走一遍：用户可能直接带着一个旧 hash 打开
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /* 掉线通知：noticeSeq 单调递增，只消费一次，不会每次重渲染都弹 */
  const d = useDevice();
  useEffect(() => {
    if (d.noticeSeq === 0 || !d.notice) return;
    toast(d.notice, 'danger');
  }, [d.noticeSeq, d.notice]);

  const go = useCallback((k: SectionKey) => {
    if (window.location.hash === `#${k}`) return;
    window.location.hash = k;
  }, []);

  const section = route.section;
  const active: SectionKey = SECTION_KEYS.includes(section) ? section : 'onboarding';

  return (
    <div className="shell">
      <Sidebar active={active} onGo={go} />

      <div className="main">
        <TopBar active={active} onGo={go} />
        <main className="content">
          <div className="page" key={`${active}:${route.play ?? ''}`}>
            {active === 'onboarding' ? <Onboarding onGo={go} /> : null}
            {active === 'library' ? (route.play ? <Play workId={route.play} onGo={go} /> : <Library />) : null}
            {active === 'device' ? <Device /> : null}
            {active === 'simulator' ? <Simulator /> : null}
            {active === 'docs' ? <Docs /> : null}
            {active === 'debug' ? <Debug /> : null}
          </div>
        </main>
      </div>

      <StatusBar />
      <ToastHost />
    </div>
  );
}
