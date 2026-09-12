#!/usr/bin/env node
/*
 * 小白控制台端到端冒烟测试（无头浏览器 + DevTools 协议）。
 *
 *   npm run dev                    # 另开一个终端
 *   node scripts/smoke-basic.mjs   # 默认打 http://localhost:5173
 *
 * 为什么要有它：这一版有三件事**只有真的渲染出来才能证明**——
 *   1. 自检那四个绿勾是"回查到了"才亮的，不是画上去的
 *   2. 右侧那一栏显示的是设备报回来的状态（拿 Demo 触发的效果去对）
 *   3. 作品是嵌进来的真页面而不是重写的一份（要在 iframe 里真的点得动）
 *
 * 零依赖：Node 自带的 fetch 与 WebSocket 直连 DevTools 协议。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_UNDER_TEST = process.argv[2] || 'http://localhost:5173/';
const PORT = 9224;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  return (
    process.env.BROWSER ||
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  );
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
        }
        return;
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.errors.push(d.exception?.description || d.text);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  async eval(expression, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise
    });
    if (r.exceptionDetails) {
      throw new Error(`页面里抛异常：${r.exceptionDetails.exception?.description ?? '未知'}`);
    }
    return r.result.value;
  }
}

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
  throw new Error('等不到 DevTools 端口');
}

const results = [];
function check(ok, desc, detail = '') {
  results.push({ ok, desc });
  console.log(`${ok ? '  ✓' : '  ✗'} ${desc}${ok || !detail ? '' : `\n      ${detail}`}`);
}

const text = 'document.body.innerText';
const clickByText = (t, scope = 'document') => `
  (() => {
    const b = [...${scope}.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(t)});
    if (!b) return 'not-found';
    if (b.disabled) return 'disabled';
    b.click();
    return 'ok';
  })()`;

const watchFor = (t, ms, scope = 'document') => `
  new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      if (${scope}.body.innerText.includes(${JSON.stringify(t)})) return resolve(true);
      if (performance.now() - t0 > ${ms}) return resolve(false);
      requestAnimationFrame(tick);
    };
    tick();
  })`;

/** 页面上有几个"通了"的绿勾 */
const OK_BADGES = `[...document.querySelectorAll('span[title="这一路通了"]')].length`;

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'argx-basic-'));
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
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    cdp = new Cdp(ws);
    await cdp.send('Runtime.enable');

    console.log(`\n小白控制台冒烟测试  ${URL_UNDER_TEST}\n`);

    // 1. 默认进的就是小白版
    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      up = await cdp.eval(`document.body.innerText.includes('先选一个装置')`);
      if (!up) await sleep(250);
    }
    check(up, '不带 hash 打开，默认就是小白控制台');
    if (!up) throw new Error('小白控制台没渲染出来');
    check(await cdp.eval(`${text}.includes('这是干什么用的')`), '首次打开显示引导');
    check(await cdp.eval(`${text}.includes('专业控制台')`), '右上角有切到专业版的入口');
    check(
      (await cdp.eval(`getComputedStyle(document.querySelector('main')).backgroundColor`)) ===
        'rgba(0, 0, 0, 0)' ||
        (await cdp.eval(`getComputedStyle(document.querySelector('div')).backgroundColor`)).includes('247'),
      '是浅色配色'
    );
    check(await cdp.eval(`!document.querySelector('input[type=range]')`), '界面上没有滑块（参数都预设好了）');

    // 2. 引导可以收掉
    check((await cdp.eval(clickByText('知道了，不再显示'))) === 'ok', '引导能关掉');
    await sleep(150);
    check(!(await cdp.eval(`${text}.includes('这是干什么用的')`)), '关掉之后引导不再占地方');

    // 3. 模拟器自动连上
    await sleep(700);
    check(await cdp.eval(`${text}.includes('正在用')`), '「模拟器」被标成正在用');
    check(await cdp.eval(`${text}.includes('已连上 ARGX-0001')`), '模拟装置自动连上了');

    // 4. 右侧状态栏是设备报回来的
    for (const label of ['灯光', '声音', '振动', '环境']) {
      check(await cdp.eval(`${text}.includes(${JSON.stringify(label)})`), `状态栏里有「${label}」`);
    }
    check(
      await cdp.eval(`${text}.includes('没亮') || ${text}.includes('亮着')`),
      '状态栏显示的是具体状态而不是占位符'
    );

    // 5. 自检：四路依次跑一遍，绿勾是"回查到了"才亮的
    const t0 = Date.now();
    check((await cdp.eval(clickByText('开始自检'))) === 'ok', '点「开始自检」');
    check(
      await cdp.eval(`!!document.querySelector('span[title="正在测"]')`),
      '自检过程中出现转圈（三态之一）'
    );
    // 等"结论"出现才算整轮走完（绿勾会在最后一路熄灭之前就全亮）
    const done = await cdp.eval(watchFor('四路都对上了', 12000), true);
    const took = Date.now() - t0;
    const okCount = await cdp.eval(OK_BADGES);
    check(okCount === 4, `四路都回查到了（绿勾 ${okCount}/4）`);
    check(done, '给了一句人话结论');
    check(
      took > 2500 && took < 6500,
      `整轮自检 4 秒上下（实测 ${(took / 1000).toFixed(1)} 秒）`,
      '要求是每路不到 1 秒、走完约 4 秒'
    );

    // 6. ARG 库：示例作品在那儿，能打开
    check(await cdp.eval(`${text}.includes('深夜自习室')`), 'ARG 库里有示例作品');
    check(await cdp.eval(`${text}.includes('要用的东西')`), '作品写着需要什么硬件');
    check(await cdp.eval(`${text}.includes('没有也能玩')`), '区分了"必需"与"有了更好"');
    check((await cdp.eval(clickByText('打开'))) === 'ok', '点「打开」');

    // 7. 作品是真的嵌进来的那一页，不是重写的一份
    await sleep(1500);
    check(
      await cdp.eval(`!!document.querySelector('iframe')`),
      '作品以 iframe 形式嵌进来'
    );
    const inner = 'document.querySelector("iframe").contentDocument';
    check(
      await cdp.eval(`${inner} && ${inner}.body.innerText.includes('夜里十一点四十')`),
      'iframe 里跑到的是真作品（第一幕文字在）'
    );
    check(
      await cdp.eval(`${inner} && ${inner}.body.innerText.includes('已完成') === false`),
      '作品是被宿主带着跑的，没有自己再要一次连接'
    );

    // 8. 关键一条：作品触发的效果，右侧状态栏看得见
    const clicked = await cdp.eval(`
      (() => {
        const d = ${inner};
        if (!d) return 'no-iframe';
        const b = [...d.querySelectorAll('button')].find(x => x.textContent.trim() === '看扉页');
        if (!b) return 'not-found';
        b.click();
        return 'ok';
      })()`);
    check(clicked === 'ok', '在嵌入的作品里点一下（第一幕的埋点）', clicked);
    await sleep(1800); // 渐变 1.5 秒 + 一次回查
    const colText = await cdp.eval(text);
    const lit = /亮着 \d+%/.test(colText);
    check(lit, '作品触发的效果出现在右侧状态栏（设备真的照做了）', colText.match(/灯光[\s\S]{0,24}/)?.[0] ?? '');
    check(cdp.errors.length === 0, '整个过程没有未捕获异常', cdp.errors.join(' / '));

    // 9. 专业版还在，一个字节没动
    check((await cdp.eval(clickByText('专业控制台'))) === 'ok', '点「专业控制台」');
    await sleep(600);
    check(await cdp.eval(`${text}.includes('时间线')`), '专业版导航还在（时间线）');
    check(await cdp.eval(`${text}.includes('模拟器')`), '专业版分区还在（模拟器）');
    const bg = await cdp.eval(`getComputedStyle(document.body).backgroundColor`);
    check(bg.includes('11, 14, 20'), '专业版还是深色底（没被浅色主题污染）', bg);

    // 10. 老链接照旧
    await cdp.eval(`window.location.hash = 'simulator'`);
    await sleep(700);
    check(await cdp.eval(`${text}.includes('虚拟装置')`), '#simulator 这种老链接直接打开仍然是专业版');
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
      /* Windows 上偶尔删不掉 */
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
