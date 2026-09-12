/*
 * SDK 冒烟测试：把 sdk/argx.js 接到阶段一的虚拟设备上真跑一遍。
 *
 *   node tests/sdk_smoke.js
 *
 * 为什么要这一步：SDK 是"给外人用的"，它的失败方式全是**静默的**——
 * 不抛错、不弹窗、打一行 console 就过去了。也就是说，一旦哪条链路接错，
 * 界面上看不出来，作者只会以为自己的埋点没生效然后删掉 SDK。
 * 静默降级必须靠测试证明它真的把帧发出去了，而不是"看起来没报错"。
 *
 * 零依赖，不需要装任何东西。
 */

const path = require('path');
const { VirtualDevice } = require(path.join(__dirname, '..', 'device', 'virtual_device.js'));
const ARGX = require(path.join(__dirname, '..', 'sdk', 'argx.js'));

// ---------------------------------------------------------------- 小工具

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

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function section(title) {
  console.log(`\n${title}`);
}

const VERBOSE = process.argv.includes('-v');

// ---------------------------------------------------------------- 测试用宿主

/*
 * 扮演"宿主页面"：SDK 只认 connect / send / onMessage / onClose / close 五个方法，
 * 谁提供这条通道都行——这里是虚拟设备，真项目里可能是别人的 WebSocket。
 * 帧的序列化、定界、解析全部在这一侧，SDK 只收发对象（这是本阶段的架构要求）。
 */
function hostOverDevice(dev) {
  const sent = []; // 记下 SDK 真正发出去的每一帧（对象的 JSON 原文）
  let ticker = null;
  let lineCb = null;
  let lastTick = 0;

  return {
    label: '虚拟设备（测试用宿主通道）',
    sent,
    connect() {
      dev.onLine((line) => {
        if (lineCb) lineCb(line);
      });
      dev.connect();
      lastTick = Date.now();
      ticker = setInterval(() => {
        const now = Date.now();
        dev.advance(now - lastTick);
        lastTick = now;
      }, 16);
    },
    send(frame) {
      const text = JSON.stringify(frame) + '\n';
      sent.push(text);
      dev.send(text);
    },
    onMessage(cb) {
      // 宿主通道自己负责定界与解析：非 { 开头的行是噪音，直接丢
      lineCb = (line) => {
        const clean = line.replace(/\r$/, '');
        if (!clean || clean[0] !== '{') return;
        try {
          cb(JSON.parse(clean));
        } catch (e) {
          /* 坏 JSON 丢掉 */
        }
      };
    },
    onClose() {},
    close() {
      if (ticker) clearInterval(ticker);
      ticker = null;
      dev.close();
    }
  };
}

/** 取最后一帧里指定命令的那条 */
function lastOf(sent, cmd) {
  for (let i = sent.length - 1; i >= 0; i--) {
    const f = JSON.parse(sent[i]);
    if (f.c === cmd) return f;
  }
  return null;
}

// ---------------------------------------------------------------- 开跑

async function main() {
  const dev = new VirtualDevice({ dev: 'ARGX-0001', inputs: ['switch.a'] });
  const host = hostOverDevice(dev);

  const events = { input: null, err: null, status: [] };
  ARGX.on('input', (id, frame) => {
    events.input = { id, e: frame.e, v: frame.v };
  });
  ARGX.on('err', (frame) => {
    events.err = frame;
  });
  ARGX.on('status', (s) => events.status.push(s));
  ARGX.on('frame', (msg, dir) => {
    if (VERBOSE) console.log(`      [${dir}] ${JSON.stringify(msg)}`);
  });

  section('1. 握手（连上虚拟设备，拿到能力声明）');
  ARGX.init({ transport: host, quiet: !VERBOSE });
  await wait(300);
  ok(['ready', 'active'].includes(ARGX.status()), '握手完成，会话进入 ready/active', ARGX.status());
  ok((ARGX.caps() || {}).out && ARGX.caps().out.length === 4, '拿到 4 路输出能力');
  ok(ARGX.device() === 'ARGX-0001', '拿到了装置自己的名字');

  section('2. fire 事件：多条 cue 走同一个 batch（灯和声音才是真的同时动）');
  host.sent.length = 0;
  const fired = ARGX.fire('reveal');
  // reveal 的蜂鸣只有 250ms，查得太晚它已经按 TTL 自己停了
  await wait(180);
  const batch = lastOf(host.sent, 'batch');
  ok(fired === true, 'fire 返回 true');
  ok(batch && batch.p.cues.length === 2, '一帧 batch 里带 2 条 cue（灯 + 声音）');
  ok(
    batch && batch.p.cues.some((c) => c.id === 'light.main') && batch.p.cues.some((c) => c.id === 'sound.beeper'),
    'batch 里确实有 light.main 与 sound.beeper'
  );
  ok(dev.level('light.main') > 0.9, '装置上灯已经亮到接近满值', String(dev.level('light.main')));
  ok(dev.level('sound.beeper') > 0.9, '装置上蜂鸣器同时在响');

  section('3. state：问装置"你现在的输出是多少"');
  const st = await ARGX.state();
  ok(!!st, '拿到了 state 应答');
  ok(st && st.out['light.main'] && st.out['light.main'].i > 0.9, 'state 里灯的强度对得上');
  ok(st && st.out['sound.beeper'] && st.out['sound.beeper'].ttl >= 0, 'state 里带 TTL');

  section('4. 没有的能力自动跳过（cap 过滤，不整批丢）');
  // 模拟一台只接了灯的装置：重新宣告一次能力声明
  dev._emit({ v: 1, c: 'ready', dev: 'ARGX-LIGHT-ONLY', caps: { out: ['light.main'], in: [] } });
  await wait(60);
  host.sent.length = 0;
  ARGX.fire('danger');
  await wait(150);
  const filtered = lastOf(host.sent, 'cue') || lastOf(host.sent, 'batch');
  const ids = filtered
    ? filtered.c === 'batch'
      ? filtered.p.cues.map((c) => c.id)
      : [filtered.id]
    : [];
  ok(ids.length > 0 && ids.every((id) => id === 'light.main'), '只发了装置有的 light.main', ids.join(','));
  ok(dev.level('light.main') > 0.5, '灯照样演，没被缺振动马达拖累');

  // 复原成完整装置
  dev._emit({
    v: 1,
    c: 'ready',
    dev: 'ARGX-0001',
    caps: { out: ['light.main', 'sound.beeper', 'motion.vibrate', 'env.relay'], in: ['switch.a'] }
  });
  await wait(60);

  section('5. 反向通道：装置上的输入事件能被网页收到');
  dev.injectInput('switch.a', 'press', 1);
  await wait(60);
  ok(events.input && events.input.id === 'switch.a' && events.input.e === 'press', '收到 input 事件');

  section('6. reset 与非法输入');
  ARGX.reset();
  await wait(200);
  ok(dev.level('light.main') === 0, 'reset 后灯灭了', String(dev.level('light.main')));
  ok(ARGX.fire('不存在的名字') === false, '触发不存在的事件返回 false，不抛错');
  events.err = null;
  ARGX.cue('不存在的能力', { i: 1 });
  await wait(150);
  ok(!!events.err, '装置对未知能力回了 err，网页端能收到');
  ok(ARGX.state !== undefined && typeof ARGX.state === 'function', 'state 是 Promise 接口');

  section('7. 模拟模式（不接硬件）');
  const logs = [];
  const realLog = console.log;
  const realWarn = console.warn;
  console.log = (...a) => logs.push(a.join(' '));
  console.warn = (...a) => logs.push(a.join(' '));
  ARGX.init({ transport: 'mock', quiet: false });
  await wait(50);
  ok(ARGX.status() === 'mock', '模拟模式有自己的状态，不假装握过手', ARGX.status());
  ARGX.fire('reveal');
  ARGX.fire('ending');
  await wait(50);
  console.log = realLog;
  console.warn = realWarn;
  const printed = logs.join('\n');
  ok(/\[ARGX\].*batch:.*light\.main.*sound\.beeper/.test(printed), '模拟模式把 cue 打到了 console');
  const st2 = await ARGX.state();
  ok(st2 === null, '模拟模式下查状态明确地给 null（不给假绿灯）');
  ok(ARGX.hint() !== undefined, 'hint() 可用，返回环境提示');

  section('8. 静默降级：什么都没连也不许抛错');
  ARGX.init({ transport: 'mock', quiet: true });
  let threw = null;
  try {
    ARGX.cue('light.main', { i: 1 });
    ARGX.fire('danger');
    ARGX.batch([{ id: 'light.main', p: { i: 1 } }]);
    ARGX.reset();
    ARGX.on('input', () => {});
    await ARGX.state();
    await ARGX.close();
  } catch (e) {
    threw = e;
  }
  ok(threw === null, '所有调用都没抛错', threw && threw.message);

  host.close();

  console.log(`\n${failed() === 0 ? '全部通过' : '有失败项'}：${passed} 项通过，${failed()} 项失败`);
  process.exit(failed() === 0 ? 0 : 1);

  function failed() {
    return failures.length;
  }
}

main().catch((e) => {
  console.error('测试脚本自己出错了：', e);
  process.exit(1);
});
