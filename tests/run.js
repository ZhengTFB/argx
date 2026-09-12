#!/usr/bin/env node
/*
 * ARGX 标准帧序列测试
 *
 *   node tests/run.js                 跑全部场景
 *   node tests/run.js -v              额外打印每一步收到的帧
 *   node tests/run.js --scenario=05   只跑名字里含 "05" 的场景
 *
 * 零依赖。设备端用的是 device/virtual_device.js，也就是阶段二模拟器要复用的那一个。
 * 帧序列在 tests/frames.json。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { VirtualDevice } = require('../device/virtual_device.js');

// ---------------------------------------------------------------------------
// 参数
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const verbose = argv.includes('-v') || argv.includes('--verbose');
const scenarioArg = (argv.find((a) => a.startsWith('--scenario=')) || '').split('=')[1] || '';
const framesPath = argv.find((a) => !a.startsWith('-')) || path.join(__dirname, 'frames.json');

// ---------------------------------------------------------------------------
// 断言小工具
// ---------------------------------------------------------------------------
const EPS = 0.01;

// 部分匹配：模式里写出来的字段必须一致，没写的不管。
// 数组要求长度一致且逐项匹配（caps.out 这种列表顺序也算契约）。
function matches(pattern, actual) {
  if (Array.isArray(pattern)) {
    if (!Array.isArray(actual) || pattern.length !== actual.length) return false;
    return pattern.every((p, i) => matches(p, actual[i]));
  }
  if (pattern && typeof pattern === 'object') {
    if (!actual || typeof actual !== 'object') return false;
    return Object.keys(pattern).every((k) => matches(pattern[k], actual[k]));
  }
  if (typeof pattern === 'number' && typeof actual === 'number') {
    return Math.abs(pattern - actual) < 1e-9;
  }
  return pattern === actual;
}

function isGarbage(line) {
  return line.length > 0 && line.charAt(0) !== '{';
}

function j(v) {
  return JSON.stringify(v);
}

// ---------------------------------------------------------------------------
// 跑一个场景
// ---------------------------------------------------------------------------
function runScenario(scn, report) {
  const setup = scn.setup || {};
  const dev = new VirtualDevice({
    dev: setup.dev || 'ARGX-0001',
    faults: setup.faults || {},
    inputs: setup.inputs || [],
    rngSeed: scn.rngSeed || setup.rngSeed || 12345
  });

  // 观测点 1：设备发出的所有帧
  const collected = [];
  dev.onMessage((f) => collected.push(f));

  // 观测点 2：指定能力的回调（用注册接口覆盖内置的空实现）
  const spies = {};
  (setup.spy || []).forEach((id) => {
    const levels = [];
    spies[id] = levels;
    dev.registerCue(id, (p) => levels.push(p.level));
  });

  scn.steps.forEach((step, idx) => {
    const label = step.note || `步骤 ${idx + 1}`;
    const before = { garbage: dev.lines().filter(isGarbage).length };
    collected.length = 0;

    // ---- 动作 ----
    // 顺序固定：先改故障开关 → 再连接/断开 → 再推进时间 → 最后才发帧。
    // 「推进时间」在「发帧」之前是刻意的：同一格里写 advance + send，
    // 意思是「先过了这么久，然后才发这一帧」。
    if (step.faults) dev.setFaults(step.faults);
    if (step.clearFaults) dev.clearFaults();
    if (step.connect) dev.connect();
    if (step.close) dev.close();
    if (step.advance) dev.advance(step.advance);
    if (step.send !== undefined) dev.send(step.send);
    if (step.sendRepeat) {
      const r = step.sendRepeat;
      dev.send((r.prefix || '') + r.ch.repeat(r.n) + (r.suffix || ''));
    }
    if (step.injectInput) {
      dev.injectInput(step.injectInput.id, step.injectInput.e, step.injectInput.v);
    }

    if (verbose && collected.length) {
      collected.forEach((f) => console.log(`        ← ${j(f)}`));
    }

    const checks = [];
    const add = (ok, desc, detail) => checks.push({ ok, desc, detail });

    // ---- 断言：帧 ----
    if (step.expectNone) {
      add(collected.length === 0, '本步不应发出任何帧',
        collected.length ? `实际收到 ${collected.length} 帧: ${collected.map(j).join(' ')}` : '');
    }
    if (step.expectExactly) {
      const pats = step.expectExactly;
      let ok = pats.length === collected.length;
      let failedAt = -1;
      if (ok) {
        for (let i = 0; i < pats.length; i++) {
          if (!matches(pats[i], collected[i])) { ok = false; failedAt = i; break; }
        }
      }
      add(ok, `本步帧序列完全一致（${pats.length} 帧）`,
        ok ? '' : (failedAt >= 0
          ? `第 ${failedAt + 1} 帧不符\n          期望: ${j(pats[failedAt])}\n          实际: ${j(collected[failedAt])}`
          : `帧数不符：期望 ${pats.length}，实际 ${collected.length}\n          实际: ${collected.map(j).join(' ')}`));
    }
    if (step.expect) {
      let cursor = 0;
      let allOk = true;
      let detail = '';
      step.expect.forEach((pat) => {
        let found = -1;
        for (let i = cursor; i < collected.length; i++) {
          if (matches(pat, collected[i])) { found = i; break; }
        }
        if (found < 0 && allOk) {
          allOk = false;
          detail = `没等到期望帧 ${j(pat)}\n          实际: ${collected.map(j).join(' ') || '（无）'}`;
        }
        if (found >= 0) cursor = found + 1;
      });
      add(allOk, `按顺序收到期望的 ${step.expect.length} 帧`, detail);
    }

    // ---- 断言：设备状态 ----
    if (step.expectState) {
      const st = dev.getState().state;
      add(st === step.expectState, `会话状态为 ${step.expectState}`, `实际 ${st}`);
    }
    if (step.expectLevel) {
      Object.keys(step.expectLevel).forEach((id) => {
        const want = step.expectLevel[id];
        const got = dev.level(id);
        add(Math.abs(got - want) < EPS, `${id} 强度 = ${want}`, `实际 ${got}`);
      });
    }
    if (step.expectLevels) {
      Object.keys(step.expectLevels).forEach((id) => {
        const want = step.expectLevels[id];
        const got = spies[id] || [];
        const ok = got.length === want.length && want.every((v, i) => Math.abs(v - got[i]) < EPS);
        add(ok, `${id} 回调收到的强度序列 = [${want.join(', ')}]`, `实际 [${got.join(', ')}]`);
      });
    }
    if (step.expectCalls) {
      Object.keys(step.expectCalls).forEach((id) => {
        const want = step.expectCalls[id];
        const got = (spies[id] || []).length;
        add(got === want, `${id} 回调次数 = ${want}`, `实际 ${got}`);
      });
    }
    if (step.expectTtl) {
      Object.keys(step.expectTtl).forEach((id) => {
        const [lo, hi] = step.expectTtl[id];
        const cap = dev.getState().out[id];
        const got = cap ? cap.ttl : -1;
        add(got >= lo && got <= hi, `${id} 剩余 TTL 落在 [${lo}, ${hi}]`, `实际 ${got}`);
      });
    }
    if (step.expectGarbage) {
      const now = dev.lines().filter(isGarbage).length;
      add(now > before.garbage, '本步掺进了非 { 开头的垃圾行', `数量未增加（${before.garbage} → ${now}）`);
    }

    report.checks.push(...checks);
    report.onStep(label, checks);
  });

  return dev;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function main() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(framesPath, 'utf8'));
  } catch (e) {
    console.error(`读不了帧序列 ${framesPath}: ${e.message}`);
    process.exit(2);
  }

  const scenarios = (data.scenarios || []).filter(
    (s) => !scenarioArg || s.name.includes(scenarioArg)
  );

  console.log('');
  console.log(`ARGX 标准帧序列  ${framesPath}`);
  console.log(`协议 v${data.protocol}     ${scenarios.length} 个场景`);
  console.log('');

  const report = {
    checks: [],
    onStep(label, checks) {
      const failed = checks.filter((c) => !c.ok).length;
      console.log(`  ${failed ? '✗' : '✓'} ${label}`);
      checks.forEach((c) => {
        console.log(`      ${c.ok ? '·' : '!'} ${c.desc}`);
        if (!c.ok && c.detail) {
          c.detail.split('\n').forEach((l) => console.log(`          ${l.trim()}`));
        }
      });
    }
  };

  let crashed = 0;
  scenarios.forEach((scn) => {
    console.log(`[${scn.name}]`);
    try {
      runScenario(scn, report);
    } catch (e) {
      crashed++;
      report.checks.push({ ok: false, desc: scn.name, detail: e.stack });
      console.log(`  ✗ 场景抛异常（说明设备端崩了，这是最严重的失败）`);
      console.log(`      ${e.message}`);
    }
    console.log('');
  });

  const passed = report.checks.filter((c) => c.ok).length;
  const failed = report.checks.length - passed;

  console.log('─'.repeat(60));
  console.log(
    `${scenarios.length} 个场景 / ${report.checks.length} 项检查 → ` +
    `通过 ${passed}，失败 ${failed}${crashed ? `，抛异常 ${crashed} 个场景` : ''}`
  );
  console.log('');

  process.exit(failed === 0 && crashed === 0 ? 0 : 1);
}

main();
