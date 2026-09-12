import { useEffect, useState } from 'react';
import ProApp from './views/pro/ProApp';
import BasicApp from './views/basic/BasicApp';
import { SECTIONS } from './sections';
import { BASIC_SECTIONS, type BasicSection } from './views/basic/routes';

/*
 * 顶层：两套界面二选一。
 *
 *   小白控制台（默认）—— 给不懂硬件的人。选装置、看状态、点开一个剧本就能玩
 *   专业控制台        —— 阶段二那套，调试协议用。一个字节都没改，只是搬了个家
 *
 * 选哪套由地址栏的 hash 决定，两套各有自己的 hash 空间，互不重叠：
 *   #home / #device / #library / #help / #play:<id>  → 小白版
 *   #overview / #devices / #works / #simulator / …   → 专业版
 * 所以老链接（#simulator 之类）照旧能用，直接发给别人也不用改。
 *
 * 空 hash 和老链接之外的都进小白版——"打开就是小白控制台"是这一阶段的要求。
 */

type Route = { view: 'pro' } | { view: 'basic'; section: BasicSection; play?: string };

const PLAY_PREFIX = 'play:';

function routeFromHash(): Route {
  const h = window.location.hash.replace(/^#/, '');
  if (SECTIONS.some((s) => s.id === h)) return { view: 'pro' };
  // 播放页也属于小白版（section 只是给它一个"从哪来"的落点）
  if (h.startsWith(PLAY_PREFIX)) {
    return { view: 'basic', section: 'home', play: h.slice(PLAY_PREFIX.length) };
  }
  if (BASIC_SECTIONS.includes(h as BasicSection)) {
    return { view: 'basic', section: h as BasicSection };
  }
  return { view: 'basic', section: 'home' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route.view === 'pro') return <ProApp />;
  return <BasicApp section={route.section} play={route.play} />;
}
