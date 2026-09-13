#!/usr/bin/env node
/*
 * 控制台端到端冒烟测试（无头浏览器 + DevTools 协议）。
 *
 *   cd console
 *   npm run dev                    # 另开一个终端
 *   node scripts/smoke.mjs         # 默认打 http://localhost:5173
 *   node scripts/smoke.mjs http://localhost:4173
 *
 * 为什么要有它：验收清单里这几条**只有真的渲染出来才能证明** ——
 *   · 六个栏目都渲染得出来
 *   · 右侧状态栏四槽位齐全，而且第四路是**两态灯块**不是轨道
 *   · 模拟器触发一路之后，右栏**数字真的变了**（证明两处读的是同一条链路的同一次回查）
 *   · 六个故障开关每一个都不把界面搞崩
 *   · 掉线有通知、状态回退
 *   · 旧 hash 不只是跳到合理位置，**地址栏也要被改写**（否则"不留死链"没法验证）
 * 类型检查和构建通过都证明不了上面任何一条。
 *
 * 零依赖：用 Node 自带的 fetch 与 WebSocket 直连 DevTools 协议，不装 puppeteer。
 *
 * 注意（CLAUDE.md 已知坑 16）：dev server 端口被占时 Vite 会自己换一个，
 * 而这里默认打 5173。跑之前先确认端口，别对着一个空端口跑出一片假绿。
 */
import { launch, makeChecker, sleep, BODY_TEXT, clickBySelector } from './lib/browser.mjs';

const URL_UNDER_TEST = process.argv[2] || 'http://localhost:5173/';
const PORT = 9225; // 9222/9223/9224 被其它脚本占了，别复用

const { check, section, summary } = makeChecker();

/** 切栏目：**改 hash，不刷新页面**（这是 SPA，刷新会把状态全丢掉） */
async function go(cdp, hash, marker, timeout = 6000) {
  await cdp.eval(`location.hash = ${JSON.stringify(hash)}`);
  return cdp.waitForText(marker, timeout);
}

/** 右栏某个槽位现在的样子 */
const SLOT = (ch) => `(() => {
  const el = document.querySelector('.sb-slot[data-ch="${ch}"]');
  if (!el) return null;
  const fill = el.querySelector('.sb-fill');
  const bin = el.querySelector('.sb-binary');
  return {
    state: el.querySelector('.sb-state').textContent.trim(),
    fill: fill ? getComputedStyle(fill).height : null,
    binaryOn: bin ? bin.classList.contains('on') : null,
    on: el.classList.contains('is-on')
  };
})()`;

const snapshot = async (cdp) => ({
  light: await cdp.eval(SLOT('light')),
  sound: await cdp.eval(SLOT('sound')),
  motion: await cdp.eval(SLOT('motion')),
  relay: await cdp.eval(SLOT('relay'))
});

const { cdp, close } = await launch({ port: PORT, url: URL_UNDER_TEST, windowSize: '1440,900' });

try {
  console.log(`\nARGX 控制台冒烟测试  ${URL_UNDER_TEST}\n`);

  /* ============================================================
     0. 起来了没有 —— 先确认页面真的渲染了，否则后面全是假绿
     ============================================================ */
  section('0. 起得来');
  const up = await cdp.waitForText('开始使用', 20000);
  check(up, '页面渲染出来了（无 hash 默认进引导页）');
  if (!up) throw new Error('页面没渲染出来 —— 先确认 dev server 在 5173 上（npm run dev）');
  check(cdp.errors.length === 0, `加载即无异常（${cdp.errors.length}）`, cdp.errors.join('\n      '));

  /* ============================================================
     1. 六个栏目
     ============================================================ */
  section('1. 六个栏目都能渲染');
  const SECTIONS = [
    ['#onboarding', '开始使用', '引导'],
    ['#library', 'ARG 库', 'ARG 库'],
    ['#device', '设备', '设备'],
    ['#simulator', '模拟器', '模拟器'],
    ['#docs', '文档', '文档'],
    ['#debug', '功能调试', '调试']
  ];
  for (const [hash, marker, label] of SECTIONS) {
    const ok = await go(cdp, hash, marker);
    const tab = await cdp.eval(
      `document.querySelector('.tab.act')?.textContent?.trim() ?? ''`
    );
    check(ok && tab === label, `${label}：渲染出来了且顶部 tab 高亮正确（${tab || '无'}）`);
  }

  /* ============================================================
     2. 右侧常驻状态栏
     ============================================================ */
  section('2. 右侧常驻状态栏');
  const shape = await cdp.eval(`(() => ({
    w: document.querySelector('.statusbar').getBoundingClientRect().width,
    slots: document.querySelectorAll('.sb-slot').length,
    tracks: document.querySelectorAll('.sb-track').length,
    binary: document.querySelectorAll('.sb-binary').length,
    names: [...document.querySelectorAll('.sb-name')].map(e => e.textContent.trim()),
    conn: !!document.querySelector('.sb-conn'),
    heart: !!document.querySelector('.sb-heart')
  }))()`);
  check(shape.w === 76, `状态栏宽 76px（实际 ${shape.w}）`);
  check(shape.slots === 4, `四个槽位（实际 ${shape.slots}）`);
  // 「连续量 vs 开关量」是硬要求，所以结构性地断言：3 个轨道 + 1 个两态灯块
  check(shape.tracks === 3 && shape.binary === 1,
    `前三路电平轨道 / 第四路两态灯块（轨道 ${shape.tracks}、灯块 ${shape.binary}）`);
  check(shape.names.join(',') === '灯光,声音,振动,继电器',
    `通道名常显且用「继电器」这个叫法（${shape.names.join(' ')}）`);
  check(shape.conn && shape.heart, '栏头有连接徽标、栏底有心跳');

  /* ============================================================
     3. 模拟器：进页面自动连虚拟装置
     ============================================================ */
  section('3. 模拟器连上虚拟装置');
  await go(cdp, '#simulator', '模拟器');
  const connected = await cdp.waitFor(
    `document.querySelector('.conn-badge')?.dataset.status === 'ready' ||
     document.querySelector('.conn-badge')?.dataset.status === 'active'`, 10000);
  check(connected, '进模拟器自动连上虚拟装置（不用先点一次「连接」）');
  const badge = await cdp.eval(`(() => {
    const b = document.querySelector('.conn-badge');
    return { kind: b.dataset.kind, text: b.textContent.trim() };
  })()`);
  check(badge.kind === 'simulator', `顶部徽标认得出是虚拟装置（kind=${badge.kind}）`);
  check(/已连接/.test(badge.text), `徽标写着「已连接」（${badge.text}）`);

  /* ============================================================
     4. 逐路触发 → 右栏跟着变
     ============================================================ */
  section('4. 触发一路，右栏跟着变');
  // 先把故障全关掉，否则丢包/延迟会让这一节随机失败。
  // ★ 要按「全部关闭」按钮，不能去点那两个开关 —— 默认全关，点一下反而是打开。
  const cleared = await cdp.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '全部关闭');
    if (!b) return 'not-found';
    b.click();
    return 'ok';
  })()`);
  check(cleared === 'ok', '先把故障注入全部关闭（否则丢包会让下面的断言随机失败）');
  await sleep(600);

  for (const [ch, label] of [['light', '灯光'], ['sound', '声音'], ['motion', '振动']]) {
    const before = await cdp.eval(SLOT(ch));
    await cdp.eval(clickBySelector(`.ch[data-ch="${ch}"] .ch-foot button`));
    // 等右栏真的变了（回查是 800ms 一次，所以给它 4 秒）
    const changed = await cdp.waitFor(`(() => {
      const el = document.querySelector('.sb-slot[data-ch="${ch}"] .sb-state');
      return el && el.textContent.trim() !== ${JSON.stringify(before.state)};
    })()`, 4000);
    const after = await cdp.eval(SLOT(ch));
    check(changed, `${label}：触发后右栏状态词从「${before.state}」变成「${after.state}」`);
    // 不断言具体数值 —— 渐变 + 800ms 轮询有偏差，只断言"变了"
    check(after.on === true || after.fill !== before.fill,
      `${label}：右栏槽位进入了激活态（on=${after.on} fill ${before.fill} → ${after.fill}）`);
    await sleep(300);
  }

  // 继电器：两态，硬切
  const relayBefore = await cdp.eval(SLOT('relay'));
  await cdp.eval(clickBySelector('.ch[data-ch="relay"] .ch-foot button'));
  const relayChanged = await cdp.waitFor(
    `document.querySelector('.sb-slot[data-ch="relay"] .sb-binary').classList.contains('on') !== ${relayBefore.binaryOn}`,
    4000
  );
  const relayAfter = await cdp.eval(SLOT('relay'));
  check(relayChanged, `继电器：右栏灯块 ${relayBefore.binaryOn ? 'ON' : 'OFF'} → ${relayAfter.binaryOn ? 'ON' : 'OFF'}`);
  check(relayAfter.state !== relayBefore.state,
    `继电器：状态词从「${relayBefore.state}」变成「${relayAfter.state}」`);
  const hardCut = await cdp.eval(
    `getComputedStyle(document.querySelector('.sb-binary')).transitionDuration`
  );
  check(/^0s|^0ms/.test(hardCut), `继电器是硬切（transition-duration=${hardCut}），不是渐变`);

  /* ============================================================
     5. 全部触发走一条 batch
     ============================================================ */
  section('5. 全部触发');
  await go(cdp, '#simulator', '模拟器');
  await sleep(400);
  await cdp.eval(clickBySelector('.page-head .btn--primary'));
  await sleep(900);
  await go(cdp, '#debug', '收发时间线');
  const sawBatch = await cdp.waitForText('"c":"batch"', 4000);
  check(sawBatch, '「全部触发」在时间线里是一帧 batch（四条 cue 同帧发出）');

  /* ============================================================
     6. 故障注入：六个开关逐个开、逐个关，界面不崩
     ============================================================ */
  section('6. 故障注入');
  const FAULTS = ['noReady', 'delayMs', 'dropRate', 'garbage', 'autoDisconnectMs', 'resetHoldMs'];
  let faultOk = 0;
  for (const key of FAULTS) {
    const sel = `[data-fault="${key}"] .switch input`;
    const onBefore = await cdp.eval(`document.querySelector(${JSON.stringify(sel)})?.checked ?? null`);
    if (onBefore === null) { check(false, `故障开关 ${key} 找得到`); continue; }
    await cdp.eval(clickBySelector(sel));
    await sleep(350);
    const stillThere = await cdp.eval(`!!document.querySelector('.debug-layout')`);
    const onAfter = await cdp.eval(`document.querySelector(${JSON.stringify(sel)}).checked`);
    const flipped = onAfter !== onBefore;
    // 关回去，免得影响后面的断言
    await cdp.eval(clickBySelector(sel));
    await sleep(250);
    if (flipped && stillThere) faultOk++;
    check(flipped && stillThere, `${key}：能切换且界面不崩`);
  }
  check(faultOk === FAULTS.length, `六个故障开关全部可用（${faultOk}/${FAULTS.length}）`);
  check(cdp.errors.length === 0, `整段故障注入期间没有未捕获异常（${cdp.errors.length}）`,
    cdp.errors.join('\n      '));

  /* ============================================================
     7. 掉线：有通知，状态回退
     ============================================================ */
  section('7. 掉线有通知');
  // 这个故障是连上之后 1 秒才断，所以拨开关会**自动重连一次**才有机会发生
  await cdp.eval(clickBySelector('[data-fault="autoDisconnectMs"] .switch input'));
  await sleep(3200);
  const noticed = await cdp.waitFor(`document.querySelector('.toast') !== null`, 5000);
  check(noticed, '掉线时弹出通知');
  const degraded = await cdp.eval(`(() => {
    const b = document.querySelector('.conn-badge');
    const st = [...document.querySelectorAll('.sb-state')].map(e => e.textContent.trim());
    return { status: b.dataset.status, states: st, cls: b.className };
  })()`);
  check(degraded.status === 'lost' || /is-off/.test(degraded.cls),
    `徽标退化到未连接态（status=${degraded.status}）`);
  check(degraded.states.slice(0, 3).every((s) => s === '待机') && degraded.states[3] === '断开',
    `四路回到待机/断开 —— 说明状态是回查来的，不是本地记账（${degraded.states.join(' ')}）`);
  await cdp.eval(clickBySelector('[data-fault="autoDisconnectMs"] .switch input'));
  await sleep(300);

  /* ============================================================
     8. 手动发 cue + 回执
     ============================================================ */
  section('8. 手动发 cue');
  await go(cdp, '#simulator', '模拟器');
  await sleep(600);
  await go(cdp, '#debug', '收发时间线');
  const sent = await cdp.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '发送');
    if (!b) return 'not-found';
    b.click();
    return 'ok';
  })()`);
  check(sent === 'ok', '「发送」按钮点得到');
  const acked = await cdp.waitForText('seq', 4000);
  check(acked, '能看到装置的回执（带 seq）');
  const logged = await cdp.eval(`(() => {
    const t = document.querySelector('.log-stream')?.innerText ?? '';
    return {
      len: t.length,
      hasOut: t.includes('→'),
      hasIn: t.includes('←'),
      hasId: /light\\.main|sound\\.beeper|motion\\.vibrate|env\\.relay/.test(t),
      head: t.slice(0, 160)
    };
  })()`);
  check(logged.hasOut, `时间线里能看到发出（→）的行（日志 ${logged.len} 字符）`);
  check(logged.hasIn, '时间线里能看到收到（←）的行');
  check(logged.hasId, `时间线里有真实的能力 id，不是占位文字（${logged.head.replace(/\n/g, ' / ')}）`);

  /* ============================================================
     9. 旧 hash 重定向 + 改写地址栏
     ============================================================ */
  section('9. 旧 hash 不留死链');
  const REDIRECTS = [
    ['#overview', 'device'],
    ['#devices', 'device'],
    ['#home', 'onboarding'],
    ['#help', 'onboarding'],
    ['#works', 'library'],
    ['#creator', 'library'],
    ['#timeline', 'debug']
  ];
  for (const [old, next] of REDIRECTS) {
    await cdp.eval(`location.hash = ${JSON.stringify(old)}`);
    await sleep(450);
    const got = await cdp.eval(`window.location.hash`);
    const tab = await cdp.eval(`document.querySelector('.tab.act')?.textContent?.trim() ?? ''`);
    check(got === `#${next}`, `${old} → ${got}（期望 #${next}，落到「${tab}」）`);
  }
  // 新 hash 不能被改
  await cdp.eval(`location.hash = '#docs'`);
  await sleep(400);
  check((await cdp.eval(`window.location.hash`)) === '#docs', '新 hash 原样保留（不会被误改）');

  /* ============================================================
     10. 作品播放：站内 demo 与第三方外链
     ============================================================ */
  section('10. ARG 库的两类条目');
  await go(cdp, '#library', 'ARG 库');
  const kinds = await cdp.eval(`(() => {
    const plays = [...document.querySelectorAll('.work .cv-kind--play')].length;
    const exts  = [...document.querySelectorAll('.work .cv-kind--external')].length;
    const soon  = [...document.querySelectorAll('.work .cv-kind--soon')].length;
    const extRole = [...document.querySelectorAll('.work')]
      .filter(w => w.querySelector('.cv-kind--external'))
      .map(w => w.getAttribute('role'))[0];
    return { plays, exts, soon, total: document.querySelectorAll('.work').length, extRole };
  })()`);
  check(kinds.plays >= 1, `有站内试玩条目（${kinds.plays} 个）`);
  check(kinds.exts >= 1, `有第三方外链条目（${kinds.exts} 个）`);
  check(kinds.plays + kinds.exts + kinds.soon === kinds.total,
    `每条作品都有明确的去向标记（试玩 ${kinds.plays} / 外链 ${kinds.exts} / 未上线 ${kinds.soon}）`);
  check(kinds.extRole === 'button', '第三方条目也是可点区域（role=button）');

  const before = await cdp.eval(`document.querySelectorAll('iframe').length`);
  await cdp.eval(`(() => {
    const w = [...document.querySelectorAll('.work')].find(x => x.querySelector('.cv-kind--play'));
    w.click();
  })()`);
  await sleep(2300);
  const after = await cdp.eval(`(() => ({
    hash: location.hash,
    hashRewritten: location.hash,
    frames: document.querySelectorAll('iframe').length,
    src: document.querySelector('iframe')?.getAttribute('src') ?? null
  }))()`);
  check(after.hash.startsWith('#play:'), `点站内作品进播放页（${after.hash}）`);
  check(after.frames > before, `播放页真的嵌了 iframe（${before} → ${after.frames}）`);
  check(after.src === './demo/index.html', `iframe 指向 demo 的真页面（${after.src}）`);

  // 宿主通道必须在 iframe 设 src 之前就挂好，否则作品会自己去找串口
  const hostOk = await cdp.eval(`typeof window.ARGX_HOST_TRANSPORT === 'object' && window.ARGX_HOST_TRANSPORT !== null`);
  check(hostOk, '宿主通道挂在 window.ARGX_HOST_TRANSPORT 上（作品靠它接入）');

  /* ============================================================
     11. 动效与无障碍
     ============================================================ */
  section('11. 动效、focus、自适应');
  await go(cdp, '#simulator', '模拟器');
  await sleep(500);
  const focusables = await cdp.eval(
    `document.querySelectorAll('button:not([disabled]), a[href], input, select').length`
  );
  check(focusables >= 25, `模拟器页可交互元素有 ${focusables} 个，键盘可遍历`);
  // focus 环这一组放在调试页：那一页上七种控件齐全（按钮/滑杆/开关/输入框/下拉都在）
  await go(cdp, '#debug', '收发时间线');
  await sleep(400);
  // 每个可交互元素都要有可见的 focus 环（组件清单 §四的硬性要求）。
  // 逐个真的 focus 一次再读计算样式 —— 只看 CSS 里写没写不算数。
  const rings = await cdp.eval(`(() => {
    const sels = [
      ['顶部 tab', '.tab'],
      ['侧栏项', '.side-item'],
      ['主按钮', '.btn--primary'],
      ['次按钮', '.btn--secondary'],
      ['滑杆', '.slider'],
      ['开关', '.switch input'],
      ['文字输入', '.input'],
      ['下拉', '.select']
    ];
    return sels.map(([name, sel]) => {
      const el = document.querySelector(sel);
      if (!el) return { name, ok: false, why: '没找到' };
      el.focus();
      const cs = getComputedStyle(el);
      // 开关的 focus 环画在内层 .track 上
      const target = sel === '.switch input' ? el.nextElementSibling : el;
      const tcs = getComputedStyle(target);
      const ring = tcs.boxShadow !== 'none' || cs.outlineStyle !== 'none';
      el.blur();
      return { name, ok: ring, why: ring ? '' : tcs.boxShadow };
    });
  })()`);
  for (const r of rings) check(r.ok, `${r.name} 聚焦时有可见的 focus 环${r.ok ? '' : `（${r.why}）`}`);

  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await sleep(300);
  const reduced = await cdp.eval(`(() => {
    const el = document.querySelector('.tab');
    return parseFloat(getComputedStyle(el).transitionDuration);
  })()`);
  check(reduced <= 0.001, `减弱动效下过渡被压到 0（${reduced}s）`);
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });
  await sleep(200);

  for (const [w, label] of [[1440, '1440'], [1100, '1100'], [900, '900']]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: w, height: 900, deviceScaleFactor: 1, mobile: false
    });
    await sleep(350);
    const overflow = await cdp.eval(
      `document.documentElement.scrollWidth - document.documentElement.clientWidth`
    );
    check(overflow <= 0, `${label}px 宽下没有横向滚动条（溢出 ${overflow}px）`);
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  /* ============================================================
     12. 官网首页（landing/，零构建）
     它不归控制台管，但它是同一个仓库的产物、由同一个 dev server 服务，
     所以顺手在这里验一遍 —— 否则「首页与原型一致」只能靠肉眼看。
     ============================================================ */
  section('12. 官网首页');
  const landingUrl = new URL('landing/', URL_UNDER_TEST).href;
  await cdp.send('Page.navigate', { url: landingUrl });
  await sleep(2600);

  // 首访：开场层在播，页面主体藏起来
  const introPlaying = await cdp.waitFor(
    `!!document.querySelector('#intro') && document.body.classList.contains('intro-open')`, 5000);
  check(introPlaying, '首访时开场动画层在播（body.intro-open 在首帧内设上）');
  const introKids = await cdp.eval(
    `[...document.querySelector('#intro').children].map(e => e.className).join('|')`
  );
  check(introKids === 'intro-stage|intro-skip',
    `开场层里只有四拍与跳过按钮，没有别的装饰（实际：${introKids}）`);
  check(await cdp.eval(`document.querySelectorAll('#intro .intro-word').length`) === 4, '四拍都在');
  check(
    (await cdp.eval(`[...document.querySelectorAll('#intro .intro-word')].map(e => e.textContent).join('/')`))
      === '更沉浸/更方便/更易扩展/ARGX',
    '四拍依次是 更沉浸 / 更方便 / 更易扩展 / ARGX 字标'
  );
  check(
    (await cdp.eval(`getComputedStyle(document.querySelector('.page-shell')).visibility`)) === 'hidden',
    '开场期间页面主体不可见'
  );

  // 跳过之后揭屏，并记住
  await cdp.eval(`document.getElementById('introSkip').click()`);
  check(await cdp.waitFor(`!document.querySelector('#intro')`, 4000), '点「跳过」能结束开场');
  await sleep(400);
  check(await cdp.eval(`sessionStorage.getItem('argx.intro.seen') === '1'`), '跳过会写 sessionStorage');
  check(
    (await cdp.eval(`getComputedStyle(document.querySelector('.page-shell')).visibility`)) === 'visible',
    '跳过之后页面主体可见'
  );

  // ★ 非首访：所有元素必须正常显示（原型修过的那个 bug，重点验）
  await cdp.send('Page.navigate', { url: landingUrl });
  await sleep(2600);
  check(!(await cdp.eval(`!!document.querySelector('#intro')`)), '非首访时不再播开场');
  check(await cdp.eval(`document.body.classList.contains('ready')`), '非首访时 body 直接 ready');
  check(
    (await cdp.eval(`getComputedStyle(document.querySelector('.page-shell')).visibility`)) === 'visible',
    '★ 非首访时页面主体可见（原型那个 bug 已修）'
  );
  const heroVisible = await cdp.eval(`(() => {
    const h = document.querySelector('h1');
    if (!h) return false;
    h.scrollIntoView();
    const r = h.getBoundingClientRect();
    return r.width > 100 && r.height > 10 && getComputedStyle(h).opacity === '1';
  })()`);
  check(heroVisible, '主标题真的占了版面且可见');

  // 背景四层 / 无粒子 / token 生效
  const bg = await cdp.eval(`(() => ({
    layers: document.querySelectorAll('.bg > *').length,
    noise: !!document.querySelector('.bg-noise'),
    canvas: !!document.querySelector('canvas'),
    app: getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim(),
    radius: getComputedStyle(document.documentElement).getPropertyValue('--radius-lg').trim()
  }))()`);
  check(bg.layers === 4, `首页背景是四层静态结构（实际 ${bg.layers}）`);
  check(bg.noise && !bg.canvas, '有噪点层、没有 canvas（没有粒子）');
  check(bg.app === '#0A0B0D' && bg.radius === '14px',
    `与控制台共用同一份 token（--bg-app=${bg.app}、--radius-lg=${bg.radius}）`);

  // 进控制台的链接指向真实 hash
  const hrefs = await cdp.eval(
    `[...document.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(h => h && h.includes('index.html')).join(',')`
  );
  check(hrefs.includes('../index.html#onboarding') && hrefs.includes('../index.html#docs'),
    '两个大按钮指向控制台的真实 hash');
  check(
    (await cdp.eval(`document.querySelectorAll('a[href*="github"]').length`)) >= 2,
    '页底有 GitHub 按钮'
  );

  // 价值三卡（件六把原来的技术三卡换成了「三种人，三种用法」）
  const cardNums = await cdp.eval(
    `[...document.querySelectorAll('#capabilities .fcard .num')].map(e => e.textContent.trim()).join('|')`
  );
  check(cardNums === '01 / PLAYERS|02 / CREATORS|03 / MAKERS',
    `价值三卡齐全（实际：${cardNums}）`);

  // 仓库区：三张等大卡片 + 三个真的能点开的仓库地址
  const repoState = await cdp.eval(`(() => {
    const sec = document.querySelector('#repos');
    if (!sec) return { n: 0, links: [], cols: 0 };
    const cards = [...sec.querySelectorAll('.rcard')];
    const cols = getComputedStyle(sec.querySelector('.cards3')).gridTemplateColumns.split(' ').length;
    return {
      n: cards.length,
      cols,
      names: cards.map(c => c.querySelector('.repo-name').textContent.trim()),
      links: cards.map(c => c.querySelector('a').getAttribute('href'))
    };
  })()`);
  check(repoState.n === 3, `仓库区有三张卡片（实际 ${repoState.n}）`);
  check(repoState.cols === 3, `三张卡片等大并列（实际 ${repoState.cols} 列）`);
  check(
    repoState.names.join('|') === 'argx|argx-esp32|argx-skill',
    `仓库依次是 argx / argx-esp32 / argx-skill（实际：${repoState.names.join(' / ')}）`
  );
  check(
    repoState.links.every((h) => h && h.startsWith('https://github.com/ZhengTFB/')),
    `三张卡片指向真实仓库地址（实际：${repoState.links.join(' ')}）`
  );

  // AI 接入入口：hero 按钮、我是开发者卡、页脚各一处，且都指向 #docs:ai-skill
  const aiHrefs = await cdp.eval(
    `[...document.querySelectorAll('a[href*="#docs:ai-skill"]')].length`
  );
  check(aiHrefs >= 3, `AI 接入入口至少三处（hero / 开发者卡 / 页脚，实际 ${aiHrefs}）`);
  const landingOverflow = await cdp.eval(
    `document.documentElement.scrollWidth - document.documentElement.clientWidth`
  );
  check(landingOverflow <= 0, `首页没有横向滚动条（溢出 ${landingOverflow}px）`);

  /* ============================================================
     13. 全程无异常
     ============================================================ */
  section('13. 收尾');
  check(cdp.errors.length === 0, `全程没有未捕获异常（${cdp.errors.length}）`,
    cdp.errors.join('\n      '));
} catch (e) {
  check(false, `冒烟测试中断：${e.message}`);
} finally {
  const ok = summary('控制台冒烟测试');
  await close();
  process.exit(ok ? 0 : 1);
}
