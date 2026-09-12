/*
 * AGENTS.md 的示例代码能不能照着跑通。
 *
 *   node tests/agents_guide.js
 *
 * 为什么值得单独测：AGENTS.md 是本阶段最有长期价值的产出，而它最大的风险
 * 是**跟 SDK 脱节**——SDK 改了接口，文档里的示例还是旧的，AI 照着写出来的东西就是错的，
 * 而且错得很安静（静默降级，页面不报错，只是装置不动）。
 *
 * 所以这里不重写一份示例，而是把 AGENTS.md 里那段代码**原样抓出来执行**：
 * 文档里的字跑了，就说明照做的人能跑通；文档被改坏了，这个测试就红。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MD = path.join(__dirname, '..', 'sdk', 'AGENTS.md');

let passed = 0;
const failures = [];
function ok(cond, name, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${extra ? `  ← ${extra}` : ''}`);
  }
}

// ---------------------------------------------------------------- 抽取

const md = fs.readFileSync(MD, 'utf8');

// 抓出所有 html 代码块，取第一段里出现 ARGX.init 的那个——那就是"三十秒接入"
const htmlBlocks = [...md.matchAll(/```html\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
const intro = htmlBlocks.find((b) => b.includes('ARGX.init'));

ok(!!intro, 'AGENTS.md 里有一段「三十秒接入」的示例');
if (!intro) {
  console.log('\n找不到示例代码，后面的检查没法做');
  process.exit(1);
}

// 示例里有两处 <script>：一处引 argx.js（src），一处是内联代码
const scripts = [...intro.matchAll(/<script(?![^>]*\bsrc=)>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const code = scripts.join('\n');

ok(code.includes('ARGX.init()'), '示例里有 ARGX.init()');
ok(code.includes("ARGX.fire("), '示例里有 ARGX.fire(...)');
ok(/<script[^>]*src=/.test(intro), '示例里有引入 argx.js 的那一行');
ok(/ARGX\.connect\(\)/.test(intro), '示例里有连接按钮（首次连接必须由用户点击触发）');

// ---------------------------------------------------------------- 执行

const logs = [];
const logsWarn = [];
const fakeConsole = {
  log: (...a) => logs.push(a.join(' ')),
  warn: (...a) => logsWarn.push(a.join(' ')),
  error: (...a) => logsWarn.push(a.join(' '))
};

// 模拟一个"没有串口的浏览器"：navigator 没有 serial —— 作者最常遇到的处境
const sandbox = {
  console: fakeConsole,
  navigator: {}, // 没有 serial：作者最常遇到的处境
  // 浏览器里天然就有的东西，裸沙箱得自己补上——
  // 少了它们，SDK 里"构造串口传输"那一步会抛（虽然它自己会接住并降级）
  TextDecoder,
  TextEncoder,
  performance,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Promise,
  JSON,
  Object,
  Array,
  Date,
  Math,
  String,
  Number,
  Boolean,
  Error,
  isFinite
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.self = sandbox;

/*
 * 关键：SDK 是**在沙箱里**加载的，不是 require 进来的。
 * 这样才真的证明了"零依赖、可以整段复制"——
 * 一个只有 console 的裸环境里，它自己就能跑起来，不需要模块系统、不需要构建。
 * （也不会有"测试环境的 console 和 SDK 里的 console 不是同一个"这种假阴性。）
 */
const sdkSource = fs.readFileSync(path.join(__dirname, '..', 'sdk', 'argx.js'), 'utf8');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let threw = null;
  try {
    vm.createContext(sandbox);
    vm.runInContext(sdkSource, sandbox, { filename: 'argx.js' });
    vm.runInContext(code, sandbox, { filename: 'AGENTS.md 的示例' });
  } catch (e) {
    threw = e;
  }

  ok(threw === null, '照抄的代码一跑就通，没抛错', threw && threw.message);
  ok(typeof sandbox.ARGX === 'object' && sandbox.ARGX !== null, 'ARGX 这个全局对象照文档说的那样可直接用');

  await sleep(30); // 建立会话是异步的，等一拍再看状态
  ok(sandbox.ARGX.status() === 'mock', '没有串口时自动进模拟模式', String(sandbox.ARGX.status()));

  const printed = logs.join('\n');
  ok(/\[ARGX\]/.test(printed), 'console 里出现了 [ARGX] 开头的行（作者照这个验证埋点）', printed);
  ok(
    /batch:|cue:/.test(printed) && /light\.main/.test(printed),
    '打印里看得出触发的是哪一路输出',
    printed
  );

  // 文档里承诺的另外两件事，这里一并验证不是空话
  ok(typeof sandbox.ARGX.hint() === 'string', 'hint() 可用（文档让作者把它显示出来）');
  ok(sandbox.ARGX.fire('不存在的名字') === false, '触发不存在的事件返回 false，不抛错（静默降级）');

  if (failures.length > 0 && logsWarn.length > 0) {
    console.log('\nSDK 自己报的错（多半就是原因）：');
    for (const line of logsWarn) console.log(`  ${line}`);
  }

  console.log(`\n${failures.length === 0 ? '全部通过' : '有失败项'}：${passed} 项通过，${failures.length} 项失败`);
  process.exit(failures.length === 0 ? 0 : 1);
}

void main();
