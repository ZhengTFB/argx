/*
 * 无头浏览器 + DevTools 协议的最小封装。
 *
 * 零依赖：只用 Node 自带的 fetch 与 WebSocket，不装 puppeteer/playwright
 *（那两个要下几百兆的浏览器，而本机已经装了 Edge）。
 *
 * 为什么要有这个文件：冒烟测试要断言的东西——"四路真的渲染出来了""右栏显示的是
 * 装置报回来的状态""故障注入开了之后界面不崩"——类型检查和构建通过都证明不了，
 * 只有真的把页面跑起来点一遍才算数。两个冒烟脚本共用这一份，别再抄一遍。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 找浏览器。按候选列表逐个试，不预判 —— spawn 会自己报错。
 * （旧版把 x86 路径写死成一个字符串，在很多机器上直接打不开。
 *   换成候选列表，顺便让环境变量 BROWSER 优先。）
 */
export function findBrowser() {
  return [
    process.env.BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'msedge',
    'google-chrome',
    'chromium'
  ].filter(Boolean);
}

/** DevTools 协议的极简客户端：一个 send/eval，外加把页面异常收集起来 */
export class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    /** 页面里抛过的异常 / console.error。**这就是"没崩"的判据** */
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

  /**
   * 等某个表达式变成真值（SPA 内部切换后不要刷新页面，靠这个等）。
   *
   * ★ 表达式被包在 try/catch 里：轮询期间页面可能正在导航，
   *   这时候 `document.body` 是 null，`document.body.innerText` 直接抛。
   *   那是"还没好"，不是"出错"—— 让它返回 false 继续等，别把整轮测试炸掉。
   */
  async waitFor(expression, timeoutMs = 8000, stepMs = 120) {
    const safe = `(() => { try { return !!(${expression}); } catch (e) { return false; } })()`;
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await this.eval(safe)) return true;
      await sleep(stepMs);
    }
    return false;
  }

  /** 等页面上出现某段文字 */
  waitForText(text, timeoutMs = 8000) {
    return this.waitFor(`document.body && document.body.innerText.includes(${JSON.stringify(text)})`, timeoutMs);
  }
}

export async function connect(port, timeoutMs = 25000) {
  const t0 = Date.now();
  let lastErr;
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (r.ok) {
        const list = await r.json();
        const page = list.find((t) => t.type === 'page');
        if (page) {
          const ws = new WebSocket(page.webSocketDebuggerUrl);
          await new Promise((res, rej) => {
            ws.addEventListener('open', res, { once: true });
            ws.addEventListener('error', rej, { once: true });
          });
          const cdp = new Cdp(ws);
          await cdp.send('Runtime.enable');
          return cdp;
        }
      }
    } catch (e) {
      lastErr = e;
    }
    await sleep(300);
  }
  throw new Error(`等不到 DevTools 端口 ${port}${lastErr ? `：${lastErr.message}` : ''}`);
}

/**
 * 起一个无头浏览器并连上 DevTools。
 *
 * windowSize 一定要给：headless 默认 800×600，而控制台是
 * 56px 侧栏 + 内容区 + 76px 右栏，窄了会挤爆，断言全都会变成假阴性。
 */
export async function launch({ port, url, windowSize = '1440,900' }) {
  const profile = mkdtempSync(join(tmpdir(), 'argx-smoke-'));
  const child = spawn(
    findBrowser()[0],
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--window-size=${windowSize}`,
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      url
    ],
    { stdio: 'ignore' }
  );

  const cdp = await connect(port);

  return {
    cdp,
    async close() {
      try { child.kill(); } catch { /* 已经退了 */ }
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* Windows 上偶尔删不掉 */ }
    }
  };
}

/* ---------- 断言收集 ---------- */
export function makeChecker() {
  const results = [];
  const check = (ok, desc, detail = '') => {
    results.push({ ok, desc });
    console.log(`${ok ? '  ✓' : '  ✗'} ${desc}${ok || !detail ? '' : `\n      ${detail}`}`);
    return ok;
  };
  const section = (title) => console.log(`\n${title}`);
  const summary = (label) => {
    const failed = results.filter((r) => !r.ok);
    console.log('\n' + '─'.repeat(56));
    console.log(`${label} → 通过 ${results.length - failed.length}，失败 ${failed.length}（共 ${results.length} 项）`);
    if (failed.length) {
      console.log('\n失败项：');
      for (const f of failed) console.log(`  ✗ ${f.desc}`);
    }
    return failed.length === 0;
  };
  return { check, section, summary, results };
}

/* ---------- 常用页面动作 ---------- */
export const BODY_TEXT = 'document.body.innerText';

/** 按可见文字点 button */
export const clickByText = (t, scope = 'document') => `
  (() => {
    const b = [...${scope}.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(t)});
    if (!b) return 'not-found';
    if (b.disabled) return 'disabled';
    b.click();
    return 'ok';
  })()`;

/** 点某个选择器命中的元素 */
export const clickBySelector = (sel) => `
  (() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return 'not-found';
    if (el.disabled) return 'disabled';
    el.click();
    return 'ok';
  })()`;

/** 等页面上出现某段文字 */
export const watchFor = (t, ms, scope = 'document') => `
  new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      if (${scope}.body.innerText.includes(${JSON.stringify(t)})) return resolve(true);
      if (performance.now() - t0 > ${ms}) return resolve(false);
      requestAnimationFrame(tick);
    };
    tick();
  })`;
