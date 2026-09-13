#!/usr/bin/env node
/*
 * GitHub Pages 站点的组装 / 预览 / 校验。
 *
 *   node tools/site.mjs              # 组装出 site/
 *   node tools/site.mjs --serve      # 组装后挂在 http://localhost:4173/argx/ 上
 *   node tools/site.mjs --check      # 组装 + 起服务 + 无头浏览器扫 404（发布前跑这个）
 *
 * 为什么要有它：Pages 的站点**不是现成的任何一个目录**，而是两件东西拼出来的 ——
 * 首页在根、控制台在 /console/。拼法写在下面 assemble() 里，本地能复现，
 * 所以「部署后才发现路径错了」这件事不会发生。
 *
 * 唯一的坑：`landing/` 在仓库里是**同级目录**，它按 `../design/tokens.css` 与
 * `../index.html#docs` 写死（因为 dev server 与 console/dist 都把它挂在 /landing/）。
 * 搬到站点根之后深度少了一层，这两处必须改写。改动只发生在 site/ 这份拷贝里，
 * 仓库里的 landing/ 一个字不动。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SITE = resolve(ROOT, 'site');
const DIST = resolve(ROOT, 'console', 'dist');

/* Pages 站点挂在 /argx/ 下，本地预览必须还原这一层子路径 */
const BASE = '/argx';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
};

/**
 * 把仓库拼成 Pages 站点：
 *
 *   site/
 *   ├── index.html      ← landing/ 的内容（引导页在根）
 *   ├── landing.css / landing.js
 *   ├── design/         ← 设计 token（landing 运行时引用它）
 *   └── console/        ← console/dist/ 的全部内容
 */
function assemble() {
  if (!existsSync(DIST)) {
    throw new Error(`找不到 ${DIST} —— 先跑 cd console && npm run build`);
  }
  rmSync(SITE, { recursive: true, force: true });
  mkdirSync(SITE, { recursive: true });

  // 首页三个文件平铺到站点根（landing/ 里只有这三个文件）
  for (const f of ['index.html', 'landing.css', 'landing.js']) {
    cpSync(resolve(ROOT, 'landing', f), join(SITE, f));
  }
  cpSync(resolve(ROOT, 'design'), join(SITE, 'design'), { recursive: true });
  cpSync(DIST, join(SITE, 'console'), { recursive: true });

  // 首页从 /landing/ 挪到 / —— 相对路径少一层，两处前缀要跟着改。
  // ../design/      → ./design/     （站点根上有 design/）
  // ../index.html   → ./console/    （站点根上的 index.html 是首页自己，不是控制台）
  const idx = join(SITE, 'index.html');
  const before = readFileSync(idx, 'utf8');
  const after = before
    .replaceAll('../design/', './design/')
    .replaceAll('../index.html', './console/');
  writeFileSync(idx, after);

  // 组装出来的路径必须是干净的：还有 ../ 就说明改写漏了一处
  const leftovers = [...after.matchAll(/(?:href|src)="(\.\.\/[^"]*)"/g)].map((m) => m[1]);
  if (leftovers.length) {
    throw new Error(`首页里还有没改写的相对路径：${leftovers.join(', ')}`);
  }

  // 不上 Jekyll：站点全是构建产物，让 Pages 原样发出去就行
  writeFileSync(join(SITE, '.nojekyll'), '');

  const need = [
    'index.html',
    'design/tokens.css',
    'console/index.html',
    'console/demo/index.html',
    'console/sdk/argx.js'
  ];
  for (const rel of need) {
    if (!existsSync(join(SITE, rel))) throw new Error(`站点缺文件：${rel}`);
  }

  console.log(`✓ 站点组装完成 → ${SITE}`);
  for (const rel of need) console.log(`    ${rel}`);
}

/** 把 site/ 挂在 ${BASE}/ 下，模拟 Pages 的子路径 */
function serve(port) {
  const server = createServer((req, res) => {
    let url = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0]);

    if (!url.startsWith(BASE + '/') && url !== BASE) {
      res.writeHead(302, { Location: BASE + '/' });
      return res.end();
    }
    // 去掉前缀后**必须重新拼到 SITE 下**再做存在性判断，
    // 否则 ../ 能爬出站点根目录（真实 Pages 不会给这个机会，本地预览也别给）
    let rel = url.slice(BASE.length).replace(/^\/+/, '');
    let file = resolve(SITE, rel);
    if (!file.startsWith(SITE)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 ' + url);
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

/**
 * 用普通 HTTP 客户端直接取一个文件，证明「不是只有浏览器才拿得到」。
 *
 * 线上这几条要过 CDN。实测本机到 Pages CDN 的连接会偶尔超时（同一条 URL
 * 用 curl 取却是 200），所以重试三次 —— 这条要是红了，得是真的红了才有意义。
 */
async function probe(url) {
  let detail = '';
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url);
      // 拿到了 HTTP 应答：好就是好，坏就是站点真的没有这个文件
      return r.ok ? { ok: true, detail: `${r.status}` } : { ok: false, detail: `${r.status}` };
    } catch (e) {
      detail = e.message;
    }
    await new Promise((ok) => setTimeout(ok, 500));
  }
  // 一次都没连上 —— 这是本机网络的问题，不是站点的问题。
  // 记成失败会变成假阴性，而假阴性会让这个校验失去意义。
  return { ok: null, detail };
}

/**
 * 无头浏览器把站点真的走一遍，收集所有 4xx / 5xx。
 *
 * 这一条不能靠推理：控制台是 `base: './'` + hash 路由，子路径下资源会不会 404
 * 只有真加载一次才知道。验收标准里「Network 面板筛选 404，应为 0」就是它。
 */
async function check(origin) {
  const { launch, sleep, makeChecker } = await import('../console/scripts/lib/browser.mjs');
  const { check: ck, section, summary } = makeChecker();

  const { cdp, close } = await launch({ port: 9333, url: origin + '/', windowSize: '1440,900' });

  const bad = [];
  const seen = new Set();
  cdp.ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Network.responseReceived') {
      const { response } = msg.params;
      if (response.status >= 400 && !seen.has(response.url)) {
        seen.add(response.url);
        bad.push(`${response.status} ${response.url}`);
      }
    } else if (msg.method === 'Network.loadingFailed') {
      // 切栏目 / 换页面时在飞的请求会被主动取消，那是正常的，
      // 记进来的话这一条就会随机变红（假阴性比漏报更坏：没人再信它）
      if (msg.params.errorText === 'net::ERR_ABORTED') return;
      const k = 'FAIL ' + msg.params.errorText;
      if (!seen.has(k)) {
        seen.add(k);
        bad.push(`${k} (${msg.params.type})`);
      }
    }
  });
  await cdp.send('Network.enable');

  try {
    section('1. 引导页（站点根 /argx/）');
    await cdp.send('Page.navigate', { url: origin + '/' });
    const landed = await cdp.waitForText('把网页变成', 15000);
    ck(landed, '首页渲染出来了');

    // token 是从 ../design/ 改写成 ./design/ 之后加载的，取到值即证明改写对。
    // 必须**等**它到位：Pages 的 CDN 上 tokens.css 实测要好几秒，
    // 读完 HTML 就立刻读计算样式会拿到空值（那是慢，不是坏）。
    await cdp.waitFor(
      `getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim().length > 0`,
      20000
    );
    const bg = await cdp.eval(
      `getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim()`
    );
    ck(!!bg, `首页拿到了设计 token（--bg-app=${bg}）`);

    // 首页从仓库里的 /landing/ 挪到了站点根，凡是指向控制台或 design 的链接
    // 都必须已经被改写。留一个 ../ 就是一条 404。
    const hrefs = JSON.parse(
      await cdp.eval(
        `JSON.stringify([...document.querySelectorAll('a[href],link[href],script[src]')].map(e => e.getAttribute('href') || e.getAttribute('src')))`
      )
    ).filter((h) => h && (h.includes('console') || h.includes('design') || h.startsWith('../')));
    ck(!hrefs.some((h) => h.startsWith('../')), '首页没有残留的 ../ 相对路径');
    ck(hrefs.includes('./console/#onboarding'), '首页的「进入控制台」指向 ./console/#onboarding');

    section('2. 控制台（/argx/console/）六个栏目 + 播放页');
    await cdp.send('Page.navigate', { url: origin + '/console/' });
    ck(await cdp.waitForText('开始使用', 20000), '控制台渲染出来了');
    for (const [hash, marker] of [
      ['#onboarding', '开始使用'],
      ['#library', 'ARG 库'],
      ['#device', '设备'],
      ['#simulator', '模拟器'],
      ['#docs', '文档'],
      ['#debug', '调试'],
      ['#play:work-study', '深夜自习室']
    ]) {
      await cdp.eval(`location.hash = ${JSON.stringify(hash)}`);
      const ok = await cdp.waitForText(marker, 10000);
      ck(ok, `${hash} 渲染出来了`);
      await sleep(600); // 给这一栏自己的资源（iframe / sdk / script.json）留出发请求的时间
    }

    section('3. 发布物完整可达（直接当文件取）');
    for (const rel of [
      '/console/demo/index.html',
      '/console/sdk/argx.js',
      '/console/design/tokens.css',
      '/design/tokens.css'
    ]) {
      const p = await probe(origin + rel);
      if (p.ok === null) {
        console.log(`  … ${rel} 本机连不上 CDN，跳过（第 4 节用的是真浏览器，那边更能说明问题）`);
      } else {
        ck(p.ok, `${rel} → ${p.detail}`);
      }
    }

    section('4. 没有 404 / 加载失败');
    ck(bad.length === 0, `资源全部可达（失败 ${bad.length} 项）`, bad.join('\n      '));

    section('5. 页面无未捕获异常');
    ck(cdp.errors.length === 0, `无异常（${cdp.errors.length}）`, cdp.errors.join('\n      '));
  } finally {
    await close();
  }

  return summary('Pages 站点校验');
}

/* ---------------- CLI ---------------- */
const args = process.argv.slice(2);
const urlArg = args.find((a) => /^https?:\/\//.test(a));
const portArg = args.find((a) => /^\d+$/.test(a));
const port = portArg ? Number(portArg) : 4173;

/** 浏览器子进程刚被 kill，Windows 上立刻 exit 会撞出一句 libuv 断言噪音 */
async function exitClean(code) {
  await new Promise((ok) => setTimeout(ok, 300));
  process.exit(code);
}

if (args.includes('--check-live')) {
  // 校验已经部署上去的那一份，本地不组装、不起服务
  if (!urlArg) {
    console.error('--check-live 要给网址，例如：node tools/site.mjs --check-live https://zhengtfb.github.io/argx');
    process.exit(2);
  }
  await exitClean((await check(urlArg.replace(/\/+$/, ''))) ? 0 : 1);
} else {
  assemble();

  if (args.includes('--check')) {
    const server = await serve(port);
    const local = `http://localhost:${port}${BASE}`;
    console.log(`\n站点挂在 ${local}/ （Ctrl-C 退出）\n`);
    const pass = await check(local);
    await new Promise((ok) => server.close(ok));
    await exitClean(pass ? 0 : 1);
  } else if (args.includes('--serve')) {
    await serve(port);
    console.log(`\n站点挂在 http://localhost:${port}${BASE}/ （Ctrl-C 退出）`);
  } else {
    console.log('（只组装。挂起来看用 --serve，本地校验用 --check，线上校验用 --check-live <网址>）');
  }
}
