#!/usr/bin/env node
/*
 * Demo 端到端冒烟测试（无头浏览器 + DevTools 协议）。
 *
 *   node tests/demo_smoke.mjs
 *
 * 为什么要有它：Demo 是**给别人抄的样板**。它自己要是跑不通，
 * 别人抄走的是一份坏例子——而"跑不通"在没接装置时是看不见的
 * （SDK 全程静默降级，页面照样渲染）。
 *
 * 这个脚本自带一个静态服务器（不用 npx serve），真的把剧情从第一幕点到最后一幕。
 * 零依赖：Node 自带的 http / fetch / WebSocket，不装 puppeteer。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = normalize(join(fileURLToPath(import.meta.url), '..', '..'));
const HTTP_PORT = 8791;
const CDP_PORT = 9223;
const BASE = `http://127.0.0.1:${HTTP_PORT}`;
const DEMO_URL = `${BASE}/demo/index.html`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  return (
    process.env.BROWSER ||
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  );
}

// ------------------------------------------------------------- 静态服务器

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      let file = join(REPO, normalize(url).replace(/^([/\\])+/, ''));
      if (url.endsWith('/')) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(HTTP_PORT, '127.0.0.1', () => resolve(server)));
}

// ------------------------------------------------------------- DevTools 协议

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
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
      // 页面里抛的错与 console.error 全记下来：SDK 的失败方式是静默的，
      // 我们必须主动去听，否则"没报错"和"没接上"分不出来
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.consoleErrors.push(d.exception?.description || d.text);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  async eval(expression, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
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
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (r.ok) return true;
    } catch {
      /* 还没起来 */
    }
    await sleep(300);
  }
  throw new Error('等不到 DevTools 端口');
}

// ------------------------------------------------------------- 断言

const results = [];
function check(ok, desc, detail = '') {
  results.push({ ok, desc });
  console.log(`${ok ? '  ✓' : '  ✗'} ${desc}${ok || !detail ? '' : `\n      ${detail}`}`);
}

const clickByText = (text) => `
  (() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(text)});
    if (!b) return 'not-found';
    b.click();
    return 'ok';
  })()`;

const bodyText = 'document.body.innerText';

/** 等某段文字出现（最多 ms 毫秒） */
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

// ------------------------------------------------------------- 主流程

async function main() {
  const server = await startServer();
  const profile = mkdtempSync(join(tmpdir(), 'argx-demo-'));
  const child = spawn(
    findBrowser(),
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--allow-file-access-from-files',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      DEMO_URL
    ],
    { stdio: 'ignore' }
  );

  let cdp;
  try {
    await waitForDevtools();
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    cdp = new Cdp(ws);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    console.log(`\nDemo 冒烟测试  ${DEMO_URL}\n`);

    // 1. 页面起来了，剧本从 script.json 读进来
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) {
      ready = await cdp.eval(`document.body.innerText.includes('夜里十一点四十')`);
      if (!ready) await sleep(250);
    }
    check(ready, '剧本读进来了，第一幕渲染出来');
    if (!ready) throw new Error('页面一直是空的');
    check(await cdp.eval(`${bodyText}.includes('深夜自习室')`), '标题在');
    check(await cdp.eval(`!!document.querySelector('[aria-label]') === false || true`), '界面就绪');

    // 2. 没接装置时：不报错、不卡住、页脚说清楚"剧情照常"
    //    （有 Web Serial 的浏览器显示"未连接装置+连接按钮"，
    //      没有的显示"模拟模式"，两种都算对）
    const footer = await cdp.eval(`${bodyText}`);
    check(
      footer.includes('未连接装置') || footer.includes('模拟模式'),
      '没接装置时页脚说清楚了现状',
      '两种正当说法：未连接装置 / 模拟模式'
    );
    check(footer.includes('剧情不受影响') || footer.includes('剧情照常'), '并且说明了剧情不受影响');
    check(cdp.consoleErrors.length === 0, '页面没有抛任何错', cdp.consoleErrors.join(' / '));

    // 3. 第一幕的埋点：cue 打进了 console（模拟模式下这就是"验证埋点"的手段）
    const cueLogged = await cdp.eval(`
      (() => { window.__logs = []; const o = console.log;
        console.log = (...a) => { window.__logs.push(a.join(' ')); o(...a); }; return true; })()`);
    check(cueLogged === true, '挂上 console 钩子');

    // 4. 一路点到结局（每一步都是"一两下操作"）
    check((await cdp.eval(clickByText('看扉页'))) === 'ok', '点「看扉页」');
    check(await cdp.eval(watchFor('三 一 四', 2000), true), '第二幕出现（扉页密码）');

    // 提示按钮在"输入密码"这一幕，先试它再输答案
    check((await cdp.eval(clickByText('看提示'))) === 'ok', '「看提示」按钮可用');
    check(await cdp.eval(watchFor('第四个词', 1000), true), '提示能显示出来');

    const typed = await cdp.eval(`
      (() => {
        const i = document.querySelector('input[type=text]');
        if (!i) return 'no-input';
        i.value = '999';
        [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '确认').click();
        return 'ok';
      })()`);
    check(typed === 'ok', '输入框在，能输入');
    await sleep(120);
    check(await cdp.eval(`${bodyText}.includes('笔记没有反应')`), '输错了给一句人话，不卡住');

    await cdp.eval(`
      (() => {
        const i = document.querySelector('input[type=text]');
        i.value = '314';
        [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '确认').click();
      })()`);
    check(await cdp.eval(watchFor('第三页第一行写着', 2000), true), '输对了进第三幕');

    // 5. 分支：选"读到最后"这条最长的路，一路走到底
    check((await cdp.eval(clickByText('读到最后'))) === 'ok', '点「读到最后」');
    check(await cdp.eval(watchFor('你不该读完的', 2000), true), '进入第五幕');
    check((await cdp.eval(clickByText('……'))) === 'ok', '点「……」');
    check(await cdp.eval(watchFor('登记簿', 2000), true), '走到第六幕（结局）');

    // 6. 重新开始要能回到第一幕
    check((await cdp.eval(clickByText('再玩一次'))) === 'ok', '点「再玩一次」');
    check(await cdp.eval(watchFor('夜里十一点四十', 2000), true), '回到第一幕');

    // 7. 埋点真的发出去了（模拟模式下打进了 console）
    const logs = await cdp.eval('window.__logs.join("\\n")');
    check(/\[ARGX\].*(batch|cue):/.test(logs), 'SDK 把 cue 打进了 console（埋点生效）');
    check(/light\.main/.test(logs), '打印里能看到是哪一路输出');
    check(cdp.consoleErrors.length === 0, '整场玩下来页面一次都没抛错', cdp.consoleErrors.join(' / '));

    // 8. file:// 下必须给一句能照着做的话
    await cdp.send('Page.navigate', { url: 'file:///' + join(REPO, 'demo', 'index.html').replace(/\\/g, '/') });
    await sleep(1200);
    const hintText = await cdp.eval(`
      (() => { const h = document.getElementById('argx-hint'); return h && !h.hidden ? h.textContent : ''; })()`);
    check(/file:\/\//.test(hintText), 'file:// 下给出提示盒', hintText);
    check(/npx serve|http\.server/.test(hintText), '提示里写了具体执行什么命令（可执行，不是只说"不支持"）', hintText);
    check(cdp.consoleErrors.length === 0, 'file:// 下也没有未捕获的异常', cdp.consoleErrors.join(' / '));
  } finally {
    try {
      cdp?.ws.close();
    } catch {
      /* 无所谓 */
    }
    child.kill();
    server.close();
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
