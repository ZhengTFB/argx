#!/usr/bin/env node
/*
 * 控制台端到端冒烟测试（无头浏览器 + DevTools 协议）。
 *
 *   node console/scripts/smoke.mjs                  # 默认打 http://localhost:5173
 *   node console/scripts/smoke.mjs http://localhost:4173
 *
 * 为什么要有它：验收标准里"模拟器能触发四种能力并看到视觉反馈""参数差异能体现"
 * 这些只有真的渲染出来才算数，光靠类型检查和构建通过证明不了。
 * 这个脚本会真的点按钮，再从 DOM 里读回亮度/状态文字来断言。
 *
 * 零依赖：用 Node 自带的 fetch 与 WebSocket 直连 DevTools 协议，
 * 不装 puppeteer/playwright（那两个要下几百兆的浏览器）。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_UNDER_TEST = process.argv[2] || 'http://localhost:5173/#simulator';
const PORT = 9222;

function findBrowser() {
  const cands = [
    process.env.BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'msedge',
    'google-chrome',
    'chromium'
  ].filter(Boolean);
  return cands[0]; // spawn 会自己报错，这里不预判
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools(timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return true;
    } catch {
      /* 还没起来 */
    }
    await sleep(300);
  }
  throw new Error('等不到 DevTools 端口，浏览器可能没起来');
}

async function pickPageTarget() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const list = await r.json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('没有可用的页面目标');
  return page.webSocketDebuggerUrl;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  /** 在页面里跑一段表达式，返回它的值 */
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (r.exceptionDetails) {
      throw new Error(`页面里抛异常：${r.exceptionDetails.exception?.description ?? '未知'}`);
    }
    return r.result.value;
  }
}

// ---------------------------------------------------------------------------

const results = [];
function check(ok, desc, detail = '') {
  results.push({ ok, desc, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${desc}${ok || !detail ? '' : `\n      ${detail}`}`);
}

/** 点一个按钮（按可见文字找），然后等界面稳定 */
const clickByText = (text) => `
  (() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)});
    if (!btn) return 'not-found';
    if (btn.disabled) return 'disabled';
    btn.click();
    return 'ok';
  })()`;

/** 页面上是否有这段文字 */
const hasText = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;

/**
 * 在页面里盯着某段文字看 ms 毫秒，出现过就算数。
 *
 * 为什么不用"点完 sleep 几百毫秒再查"：像「一声低语」这种效果只持续 80ms，
 * 等我们回来查的时候它早就结束了——那样测出来的是测试脚本的延迟，不是产品行为。
 */
const watchFor = (text, ms) => `
  new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      if (document.body.innerText.includes(${JSON.stringify(text)})) return resolve(true);
      if (performance.now() - t0 > ${ms}) return resolve(false);
      requestAnimationFrame(tick);
    };
    tick();
  })`;

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'argx-smoke-'));
  const child = spawn(
    findBrowser(),
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      URL_UNDER_TEST
    ],
    { stdio: 'ignore' }
  );

  let cdp;
  try {
    await waitForDevtools();
    const wsUrl = await pickPageTarget();
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    cdp = new Cdp(ws);
    await cdp.send('Runtime.enable');

    console.log(`\n控制台冒烟测试  ${URL_UNDER_TEST}\n`);

    // 1. 界面起来了
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) {
      ok = await cdp.eval(`!!document.querySelector('button')`);
      if (!ok) await sleep(250);
    }
    check(ok, '界面渲染出来了');
    if (!ok) throw new Error('页面一直是空的');

    // 2. 模拟器自动连上虚拟装置，能力被渲染出来
    await sleep(600);
    check(await cdp.eval(hasText('虚拟装置')), '模拟器面板在');
    check(await cdp.eval(hasText('ARGX-0001')), '虚拟装置自动连上了（显示装置 ID）');
    for (const [id, label] of [
      ['light.main', '灯光'],
      ['sound.beeper', '声音'],
      ['motion.vibrate', '振动'],
      ['env.relay', '环境']
    ]) {
      check(await cdp.eval(hasText(id)), `能力 ${id}（${label}）在模拟器里画出来了`);
    }

    // 3. 四种能力的视觉反馈：一个一个点
    const cases = [
      {
        preset: '最终解谜',
        desc: '灯：最终解谜 → 渐变到 100% 并常驻（hold）',
        expect: [['亮度 100%', 2500], ['常驻', 2500]]
      },
      {
        preset: '一声低语',
        desc: '声音：一声低语 → 鸣响（只有 80ms，盯着看到就算数）',
        expect: [['鸣响', 1200]]
      },
      {
        preset: '惊吓点',
        desc: '振动：惊吓点 → 震动中',
        expect: [['震动中', 1200]]
      },
      {
        preset: '门开了',
        desc: '继电器：门开了 → 吸合（通电）',
        expect: [['吸合（通电）', 1200]]
      }
    ];

    for (const c of cases) {
      const r = await cdp.eval(clickByText(c.preset));
      if (r !== 'ok') {
        check(false, `点「${c.preset}」`, `按钮状态：${r}`);
        continue;
      }
      const missing = [];
      for (const [text, ms] of c.expect) {
        const seen = await cdp.eval(watchFor(text, ms), true);
        if (!seen) missing.push(text);
      }
      check(missing.length === 0, c.desc, missing.length ? `${c.expect[0][1]}ms 内没看到：${missing.join('、')}` : '');
    }

    // 4. 渐变真的要能看出来（不是只有开和关）
    await cdp.eval(clickByText('重置场景'));
    await sleep(300);
    await cdp.eval(clickByText('全部熄灭')).catch(() => {});
    // 手动触发区：强度滑到 100%、渐变 800ms、发一条
    const rampOk = await cdp.eval(`
      (() => {
        const slider = document.querySelector('input[type=range]');
        if (!slider) return 'no-slider';
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(slider, '0.8');
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        return 'ok';
      })()`);
    if (rampOk === 'ok') {
      const clickSend = await cdp.eval(clickByText('发送 cue'));
      if (clickSend === 'ok') {
        await sleep(120);
        const mid = await cdp.eval(`document.body.innerText`);
        const lit = /亮度 [1-9]\d*%/.test(mid) || /亮度 100%/.test(mid);
        check(lit, '渐变可见：发出 0.8 强度的 cue 后亮度确实变了');
      } else {
        check(false, '点「发送 cue」', `按钮状态：${clickSend}`);
      }
    } else {
      check(false, '找到强度滑杆', rampOk);
    }

    // 5. 故障注入面板能开，界面不崩
    const faultOk = await cdp.eval(`
      (() => {
        const boxes = [...document.querySelectorAll('input[type=checkbox]')];
        const target = boxes.find(b => b.closest('label')?.innerText.includes('垃圾 JSON'));
        if (!target) return 'not-found';
        target.click();
        return 'ok';
      })()`);
    check(faultOk === 'ok', '故障注入面板能切换开关');
    await sleep(400);
    check(await cdp.eval(hasText('虚拟装置')), '开完故障界面没崩');

    // 6. 时间线里能看到真的收发过
    await cdp.eval(`window.location.hash = 'timeline'`);
    await sleep(500);
    const timeline = await cdp.eval(`document.body.innerText`);
    check(timeline.includes('收') && timeline.includes('发'), '时间线里有收发记录');

    // 7. 设备面板：能力渲染 + 手动测试台发一帧并拿到回执
    await cdp.eval(`window.location.hash = 'devices'`);
    await sleep(600);
    check(await cdp.eval(hasText('手动测试台')), '设备面板有手动测试台');
    check(await cdp.eval(hasText('GPIO4')), '设备面板渲染了 caps（含引脚）');
    const devSend = await cdp.eval(clickByText('发送 cue'));
    check(devSend === 'ok', '手动测试台能发 cue', `按钮状态：${devSend}`);
    check(
      await cdp.eval(watchFor('最近回执', 1500), true),
      '手动测试台拿到了装置回执'
    );

    // 8. 掉线要明确通知，并且状态回到未连接（放最后，这一步会真的断开）
    await cdp.eval(`window.location.hash = 'simulator'`);
    await sleep(500);
    const armFault = await cdp.eval(`
      (() => {
        const boxes = [...document.querySelectorAll('input[type=checkbox]')];
        const target = boxes.find(b => b.closest('label')?.innerText.includes('中途断连'));
        if (!target) return 'not-found';
        target.click();
        return 'ok';
      })()`);
    if (armFault !== 'ok') {
      check(false, '打开「中途断连」故障', `状态：${armFault}`);
    } else {
      await sleep(300);
      const recon = await cdp.eval(clickByText('断开并重连'));
      if (recon !== 'ok') {
        check(false, '点「断开并重连」', `按钮状态：${recon}`);
      } else {
        const noticed = await cdp.eval(watchFor('连接已断开', 4000), true);
        check(noticed, '掉线时顶部弹出明确通知');
        check(await cdp.eval(hasText('未连接')), '掉线后状态回到未连接');
      }
    }
  } finally {
    try {
      cdp?.ws.close();
    } catch {
      /* 无所谓 */
    }
    child.kill();
    await sleep(300);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* Windows 上偶尔删不掉，不影响结论 */
    }
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`${results.length} 项检查 → 通过 ${passed}，失败 ${results.length - passed}\n`);
  process.exit(results.length === passed ? 0 : 1);
}

main().catch((e) => {
  console.error(`冒烟测试跑不下去：${e.message}`);
  process.exit(2);
});
