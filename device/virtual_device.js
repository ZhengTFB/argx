/*
 * ARGX 虚拟设备
 *
 * 阶段一的验证主力：完整实现 protocol/PROTOCOL.md，不驱动任何真实硬件。
 * 阶段二的控制台模拟器会直接复用它来画虚拟灯。
 *
 * 三件必须清楚的事：
 *   1. 这是**设备端**，不是网页端。它跑的是设备侧的会话层与能力层。
 *   2. 仲裁逻辑（优先级、TTL、幂等、看门狗）与固件 argx_node.cpp 逐条对应，
 *      两边行为不一致就是 bug，先改 protocol/PROTOCOL.md 再改这两处。
 *   3. 时间是自己推进的（advance），不依赖系统时钟——
 *      否则测「15 秒看门狗」要真等 15 秒。
 *
 * 零依赖，浏览器里 <script src> 直接用（挂全局 ArgxVirtualDevice），
 * Node 里 require 也能用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArgxVirtualDevice = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 常量：与 protocol/PROTOCOL.md §13 常量总表一一对应 ----
  var P = {
    VERSION: 1,
    HEARTBEAT_MS: 3000,
    LINK_LOST_MS: 10000,
    WATCHDOG_MS: 15000,
    MAX_EFFECT_MS: 30000,
    MAX_LINE: 512,
    MAX_BATCH: 8
  };

  var PRI = { critical: 0, high: 1, normal: 2, ambient: 3 };
  var PRI_NAME = ['critical', 'high', 'normal', 'ambient'];

  var DEFAULT_OUT = ['light.main', 'sound.beeper', 'motion.vibrate', 'env.relay'];

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function VirtualDevice(opts) {
    opts = opts || {};
    this.dev = opts.dev || 'ARGX-0001';

    // 虚拟时钟：毫秒，从 0 开始。测试用 advance() 快进，模拟器用真实帧间隔喂。
    this._t = 0;
    this._bootAt = 0;

    this._connected = false;
    this._state = 'disconnected'; // disconnected | ready | active | stale | idle
    this._caps = [];

    this._inBuf = ''; // 入站行缓冲（模拟串口的字节流）
    this._outbox = []; // 被 delayMs 压住的出站帧
    this._transcript = []; // 本设备发出的所有原始行（含垃圾行）
    this._listeners = [];
    this._lineListeners = [];

    this._lastFrameAt = 0;
    this._lastPingAt = 0;
    this._seqCounter = 0;
    this._resetting = false;
    this._resettingUntil = 0;
    this._pingIntervalMs = P.HEARTBEAT_MS;

    // 故障注入开关。默认全关——默认状态必须是一台正常设备。
    this.faults = {
      noReady: false, // 连接后不发 ready
      delayMs: 0, // 出站帧延迟这么多毫秒才发
      dropRate: 0, // 出站帧随机丢弃比例
      dropSeqs: [], // 出站帧按 seq 精确丢弃（测试用，可复现）
      garbage: false, // 每帧前后夹带非 { 开头的垃圾行（模拟 ROM 日志/串扰）
      autoDisconnectMs: 0, // 连接后这么多毫秒自动断连
      resetHoldMs: 0 // 看门狗复位的「不可抢占窗口」拉长，供测试观察
    };
    if (opts.faults) this._applyFaults(opts.faults);

    this._rngState = (opts.rngSeed || 12345) >>> 0;

    var self = this;
    DEFAULT_OUT.forEach(function (id) {
      self.registerCue(id, function () {}); // 内置能力：只记状态，不驱动硬件
    });
    if (opts.inputs) opts.inputs.forEach(function (id) { self.registerInput(id, function () {}); });
  }

  // =========================================================================
  // 注册接口 —— 与固件同形。加新能力就是在这里加一条。
  // =========================================================================
  VirtualDevice.prototype.registerCue = function (id, fn) {
    var c = this._find(id, 'out');
    if (c) { c.handler = fn; return c; }
    c = this._newCap(id, 'out');
    c.handler = fn;
    this._caps.push(c);
    return c;
  };

  VirtualDevice.prototype.registerInput = function (id, fn) {
    var c = this._find(id, 'in');
    if (c) { c.handler = fn; return c; }
    c = this._newCap(id, 'in');
    c.handler = fn;
    this._caps.push(c);
    return c;
  };

  VirtualDevice.prototype._newCap = function (id, kind) {
    return {
      id: id, kind: kind, handler: null,
      active: false, hold: false, pri: PRI.normal, level: 0, target: 0, rampStart: 0,
      startedAt: 0, expiresAt: 0, dur: 0, ramp: 0,
      seq: null, lastSeq: null, hasLastSeq: false
    };
  };

  VirtualDevice.prototype._find = function (id, kind) {
    for (var i = 0; i < this._caps.length; i++) {
      if (this._caps[i].id === id && this._caps[i].kind === kind) return this._caps[i];
    }
    return null;
  };

  // =========================================================================
  // 传输层接口：connect / send / onMessage / close
  // =========================================================================
  VirtualDevice.prototype.connect = function () {
    if (this._connected) return;
    this._connected = true;
    this._bootAt = this._t;
    this._lastFrameAt = this._t;
    this._lastPingAt = this._t;
    this._autoCloseAt = this.faults.autoDisconnectMs > 0
      ? this._t + this.faults.autoDisconnectMs : Infinity;
    // 连接即上报。noReady 故障只压掉这一次——模拟「ready 这一帧在路上丢了」，
    // 上层发 hello 还能救回来（这正是该故障要验的东西）。
    if (!this.faults.noReady) this.sendReady();
    this._state = 'ready';
    this._log('connected');
  };

  VirtualDevice.prototype.close = function () {
    if (!this._connected) return;
    this._connected = false;
    // 断连必须把所有输出归零：物理上线拔了，灯不能还亮着
    for (var i = 0; i < this._caps.length; i++) this._release(this._caps[i], true);
    this._outbox.length = 0;
    this._state = 'disconnected';
    this._log('disconnected');
  };

  VirtualDevice.prototype.isConnected = function () { return this._connected; };

  // 网页端 → 设备。
  //   传对象 = 发一条完整帧，自动补 \n（帧定界规则由这里兜住）
  //   传字符串 = 按原始字节灌进去，不补 \n
  //     （测试垃圾串扰、半行分片、缺换行都走这条）
  VirtualDevice.prototype.send = function (frame) {
    if (!this._connected) return; // 断连后入站一律丢弃，物理上本来也到不了
    var text = typeof frame === 'string' ? frame : JSON.stringify(frame) + '\n';
    this._inBuf += text;
    var idx;
    while ((idx = this._inBuf.indexOf('\n')) >= 0) {
      var line = this._inBuf.slice(0, idx);
      this._inBuf = this._inBuf.slice(idx + 1);
      this._feedLine(line.replace(/\r$/, ''));
    }
  };

  VirtualDevice.prototype.onMessage = function (cb) {
    this._listeners.push(cb);
    return this;
  };

  VirtualDevice.prototype.onLine = function (cb) {
    this._lineListeners.push(cb);
    return this;
  };

  // =========================================================================
  // 时间推进
  // =========================================================================
  VirtualDevice.prototype.advance = function (ms) {
    this._t += ms;
    this._tick();
  };

  VirtualDevice.prototype._tick = function () {
    if (this._connected && this.faults.autoDisconnectMs > 0 &&
        this._t >= this._autoCloseAt) {
      this.close();
      return;
    }

    // 延迟发送的帧到期
    if (this._outbox.length) {
      var rest = [];
      for (var i = 0; i < this._outbox.length; i++) {
        if (this._outbox[i].due <= this._t) this._deliver(this._outbox[i].line);
        else rest.push(this._outbox[i]);
      }
      this._outbox = rest;
    }

    if (!this._connected) return;

    // 看门狗：15 秒没有任何有效帧 → 强制回 idle（不可被抢占）
    if (this._state !== 'idle' && (this._t - this._lastFrameAt) > P.WATCHDOG_MS) {
      this._log('watchdog: ' + (this._t - this._lastFrameAt) + 'ms 无有效帧，强制回 idle');
      this._forceIdle();
    }

    // 复位保持窗口（故障注入 used by tests）
    if (this._resetting && this._t >= this._resettingUntil) this._resetting = false;

    // 掉线只是标记，不灭自己的输出
    if (this._state === 'active' && (this._t - this._lastPingAt) > P.LINK_LOST_MS) {
      this._state = 'stale';
      this._log('stale: ' + (this._t - this._lastPingAt) + 'ms 无 ping');
    }

    // 推进渐变与 TTL
    for (var k = 0; k < this._caps.length; k++) {
      var c = this._caps[k];
      if (c.kind !== 'out' || !c.active) continue;
      // hold 的效果没有 TTL，只能被抢占/reset/看门狗/断连结束（PROTOCOL §7.1）
      if (!c.hold && this._t >= c.expiresAt) { this._release(c, true); continue; }
      var elapsed = this._t - c.startedAt;
      var level = c.target;
      if (c.ramp > 0 && elapsed < c.ramp) {
        level = c.rampStart + (c.target - c.rampStart) * (elapsed / c.ramp);
      }
      if (level !== c.level) this._apply(c, level, false, false, c.seq);
    }
  };

  // =========================================================================
  // 入站处理
  // =========================================================================
  VirtualDevice.prototype._feedLine = function (line) {
    // PROTOCOL §2：只处理以 { 开头的行，其余静默丢弃，而且不回 err——
    // 对垃圾回 err 会变成刷屏，把真正的错误淹掉。
    if (line.length === 0 || line.charAt(0) !== '{') return;
    if (line.length > P.MAX_LINE) { this._sendErr('bad_frame', 'line too long', -1); return; }

    var msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      this._sendErr('bad_frame', 'invalid json', -1);
      return;
    }
    if (!msg || typeof msg !== 'object') { this._sendErr('bad_frame', 'not an object', -1); return; }
    if (msg.v !== undefined && msg.v !== P.VERSION) {
      this._sendErr('bad_version', 'unsupported protocol version', -1);
      return;
    }
    var seq = typeof msg.seq === 'number' ? msg.seq : -1;
    if (typeof msg.c !== 'string' || !msg.c) { this._sendErr('bad_frame', 'missing c', seq); return; }

    // 到这里才算有效帧。有效帧恢复会话（idle 只是看门狗刚触发时的标记，不是
    // 「设备死了」）；但复位窗口还没走完时不算数——那时候会话仍是 idle。
    this._lastFrameAt = this._t;
    this._lastPingAt = this._t;
    if (!this._resetting) this._state = 'active';

    switch (msg.c) {
      case 'hello': this.sendReady(); break;
      case 'cue': this._cmdCue(msg, seq); break;
      case 'batch': this._cmdBatch(msg, seq); break;
      case 'query': this._sendState(); break;
      case 'cfg': this._cmdCfg(msg); this._sendAck(seq, 'applied'); break;
      case 'ping': this._sendPong(seq); break;
      case 'reset': this._forceIdle(); this._sendAck(seq, 'applied'); break;
      default: this._sendErr('unknown_cmd', msg.c, seq);
    }
  };

  VirtualDevice.prototype._cmdCfg = function (msg) {
    var p = msg.p || {};
    if (typeof p.ping === 'number' && p.ping > 0) this._pingIntervalMs = p.ping;
    this._log('cfg: ping interval = ' + this._pingIntervalMs + 'ms');
  };

  // =========================================================================
  // cue 仲裁 —— 顺序与固件 cmdCue() 逐条对应，不可调换
  // =========================================================================
  // 解析一条 cue。独立 cue 与 batch 里的每一条共用这个函数，
  // 字段语义不可能漂移（与固件 parseCueSpec 对应）。
  VirtualDevice.prototype._parseCueSpec = function (obj) {
    var p = obj.p || {};
    var hold = p.hold === true || p.hold === 1;
    var dur = typeof p.dur === 'number' ? clamp(p.dur, 0, P.MAX_EFFECT_MS) : P.MAX_EFFECT_MS;
    var ramp = typeof p.ramp === 'number' ? clamp(p.ramp, 0, P.MAX_EFFECT_MS) : 0;
    if (ramp > dur) ramp = dur; // 常驻时 dur 仍是缺省的 30000，渐变的头上限也就有了
    return {
      id: obj.id,
      level: typeof p.i === 'number' ? clamp(p.i, 0, 1) : 1.0,
      dur: hold ? 0 : dur, // 常驻：dur 不再有任何意义
      ramp: ramp,
      pri: typeof p.pri === 'number' ? clamp(p.pri | 0, 0, PRI.ambient) : PRI.normal,
      hold: hold
    };
  };

  VirtualDevice.prototype._sameEffect = function (c, s) {
    return c.ramp === s.ramp && c.dur === s.dur && c.hold === s.hold &&
           Math.abs(c.target - s.level) < 0.0001;
  };

  VirtualDevice.prototype._cmdCue = function (msg, seq) {
    if (typeof msg.id !== 'string' || !msg.id) {
      this._sendErr('bad_frame', 'cue without id', seq);
      return;
    }
    var s = this._parseCueSpec(msg);
    if (!this._find(s.id, 'out')) { this._sendErr('unknown_id', s.id, seq); return; }
    this._sendAck(seq, this._applyCue(s, seq));
  };

  // batch：一帧触发多个效果。校验是原子的（任一不合法整批不执行），
  // 执行阶段各自走正常仲裁，所有条目共用 this._t（PROTOCOL §4.3）。
  VirtualDevice.prototype._cmdBatch = function (msg, seq) {
    var cues = msg.p && msg.p.cues;
    if (!Array.isArray(cues)) { this._sendErr('bad_frame', 'batch without p.cues', seq); return; }
    if (cues.length === 0) { this._sendErr('bad_frame', 'batch is empty', seq); return; }
    if (cues.length > P.MAX_BATCH) { this._sendErr('bad_frame', 'batch too large', seq); return; }

    var specs = [];
    for (var i = 0; i < cues.length; i++) {
      var it = cues[i];
      if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !it.id) {
        this._sendErr('bad_frame', 'batch item without id', seq);
        return;
      }
      if (!this._find(it.id, 'out')) {
        this._sendErr('unknown_id', it.id, seq); // 整批拒绝，一条都不执行
        return;
      }
      specs.push(this._parseCueSpec(it));
    }

    var res = {};
    var seen = {};
    for (var k = 0; k < specs.length; k++) {
      var r = this._applyCue(specs[k], seq); // 同一帧共用一个时间戳
      res[specs[k].id] = r;
      seen[r] = true;
    }
    var kinds = Object.keys(seen).length;
    var agg = kinds > 1 ? 'partial' : Object.keys(seen)[0];
    this._sendAck(seq, agg, res);
  };

  // 执行一条已通过前置校验的 cue，返回结果字符串（与 ack 的 r 取值一致）
  VirtualDevice.prototype._applyCue = function (s, seq) {
    var c = this._find(s.id, 'out');
    if (!c) return 'unknown_id';

    // --- 仲裁（PROTOCOL §10，顺序不可调换）---
    if (this._resetting) return 'dropped'; // 1. 复位中
    if (c.hasLastSeq && c.lastSeq === seq) return 'dup'; // 2. 同 id 同 seq 幂等
    if (c.active && c.pri === s.pri && this._sameEffect(c, s)) {
      c.lastSeq = seq; c.hasLastSeq = true; // 3. 连点
      return 'dup';
    }

    var wasActive = c.active;
    if (s.pri === PRI.critical) {
      // critical 执行前清空所有输出（含自己）
      for (var i = 0; i < this._caps.length; i++) {
        if (this._caps[i].kind === 'out' && this._caps[i].active) {
          this._release(this._caps[i], true);
          wasActive = true;
        }
      }
    } else if (c.active && s.pri > c.pri) {
      return 'dropped'; // 4. 低优先级不许打断高优先级
    }

    c.rampStart = c.level; // 从当前强度开始渐变，不跳变
    c.pri = s.pri;
    c.target = s.level;
    c.dur = s.dur;
    c.ramp = s.ramp;
    c.hold = s.hold;
    c.active = true;
    c.startedAt = this._t;
    c.expiresAt = this._t + s.dur; // hold 时不检查这个字段，见 _tick
    c.seq = seq;
    c.lastSeq = seq;
    c.hasLastSeq = true;

    this._apply(c, s.ramp > 0 ? c.rampStart : s.level, true, false, seq);
    this._log('cue ' + s.id + ' i=' + s.level.toFixed(2) + ' dur=' + s.dur +
              ' ramp=' + s.ramp + ' pri=' + PRI_NAME[s.pri] + (s.hold ? ' hold' : '') +
              ' -> ' + (wasActive ? 'preempted' : 'applied'));
    return wasActive ? 'preempted' : 'applied';
  };

  VirtualDevice.prototype._apply = function (c, level, start, release, seq) {
    c.level = level;
    if (!c.handler) return;
    c.handler({
      id: c.id, level: level, levelTarget: c.target,
      dur: c.dur, ramp: c.ramp, pri: c.pri, seq: seq,
      start: start, release: release
    });
  };

  VirtualDevice.prototype._release = function (c, notify) {
    if (notify && c.active) this._apply(c, 0, false, true, c.seq);
    c.active = false;
    c.hold = false;
    c.level = 0; c.target = 0; c.rampStart = 0; c.ramp = 0; c.dur = 0;
  };

  VirtualDevice.prototype._forceIdle = function () {
    // 复位路径：一次性清干净。窗口内到达的 cue 全部丢弃，保证这条路径不可被抢占。
    this._resetting = true;
    this._resettingUntil = this._t + (this.faults.resetHoldMs || 0);
    for (var i = 0; i < this._caps.length; i++) {
      if (this._caps[i].kind === 'out' && this._caps[i].active) this._release(this._caps[i], true);
    }
    if (this._resettingUntil <= this._t) this._resetting = false;
    this._state = 'idle';
  };

  // =========================================================================
  // 出站
  // =========================================================================
  VirtualDevice.prototype.sendReady = function () {
    var out = [], inp = [];
    for (var i = 0; i < this._caps.length; i++) {
      (this._caps[i].kind === 'out' ? out : inp).push(this._caps[i].id);
    }
    this._emit({
      v: P.VERSION, c: 'ready', dev: this.dev, proto: P.VERSION,
      caps: { out: out, in: inp }
    });
  };

  // res 只在 batch 的 ack 上出现（逐条结果），普通 cue 不带
  VirtualDevice.prototype._sendAck = function (seq, result, res) {
    var f = { v: P.VERSION, c: 'ack', seq: seq, r: result };
    if (res) f.res = res;
    this._emit(f);
  };

  VirtualDevice.prototype._sendPong = function (seq) {
    this._emit({ v: P.VERSION, c: 'pong', seq: seq });
  };

  VirtualDevice.prototype._sendErr = function (code, msg, seq) {
    this._emit({ v: P.VERSION, c: 'err', code: code, msg: msg, seq: seq });
  };

  VirtualDevice.prototype._sendState = function () {
    var out = {};
    for (var i = 0; i < this._caps.length; i++) {
      var c = this._caps[i];
      if (c.kind !== 'out') continue;
      out[c.id] = {
        i: Math.round(c.level * 100) / 100,
        pri: c.pri,
        // ttl = -1 表示常驻（正常效果的 TTL 恒 >= 0，所以没有歧义）
        ttl: c.hold ? -1 : (c.active ? Math.max(0, c.expiresAt - this._t) : 0)
      };
    }
    this._emit({
      v: P.VERSION, c: 'state', dev: this.dev,
      uptime: Math.round(this._t - this._bootAt), out: out, in: {}
    });
  };

  // 设备侧主动上报输入事件（反向通道）。返回是否成功。
  VirtualDevice.prototype.injectInput = function (id, event, value) {
    var c = this._find(id, 'in');
    if (!c) { this._sendErr('unknown_input', id, -1); return false; }
    this._emit({
      v: P.VERSION, c: 'input', id: id, e: event || 'change',
      v: value === undefined ? 1 : value, seq: this._seqCounter++
    });
    if (c.handler) c.handler(event, value);
    return true;
  };

  VirtualDevice.prototype._emit = function (obj) {
    var line = JSON.stringify(obj);
    if (this.faults.garbage) this._deliver('ets Jul 29 2019 12:21:46\r\nrst:0x1 (POWERON_RESET)');
    var drop = false;
    if (this.faults.dropSeqs && obj.seq !== undefined &&
        this.faults.dropSeqs.indexOf(obj.seq) >= 0) drop = true;
    if (!drop && this.faults.dropRate > 0 && this._rand() < this.faults.dropRate) drop = true;
    if (drop) { this._log('fault: 丢弃出站帧 ' + line); return; }

    if (this.faults.delayMs > 0) {
      this._outbox.push({ due: this._t + this.faults.delayMs, line: line });
      return;
    }
    this._deliver(line);
  };

  VirtualDevice.prototype._deliver = function (line) {
    this._transcript.push(line);
    if (this._transcript.length > 200) this._transcript.shift(); // 只留最近 200 行
    for (var i = 0; i < this._lineListeners.length; i++) this._lineListeners[i](line);
    var obj;
    try { obj = JSON.parse(line); } catch (e) { return; } // 垃圾行不走 onMessage
    for (var j = 0; j < this._listeners.length; j++) this._listeners[j](obj);
  };

  // =========================================================================
  // 故障注入
  // =========================================================================
  VirtualDevice.prototype._applyFaults = function (f) {
    for (var k in f) if (Object.prototype.hasOwnProperty.call(f, k)) this.faults[k] = f[k];
  };

  VirtualDevice.prototype.setFaults = function (f) { this._applyFaults(f || {}); };

  VirtualDevice.prototype.clearFaults = function () {
    this.faults.noReady = false;
    this.faults.delayMs = 0;
    this.faults.dropRate = 0;
    this.faults.dropSeqs = [];
    this.faults.garbage = false;
    this.faults.autoDisconnectMs = 0;
    this.faults.resetHoldMs = 0;
  };

  // xorshift：要可复现的「随机丢包」
  VirtualDevice.prototype._rand = function () {
    var x = this._rngState;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    this._rngState = x;
    return x / 4294967296;
  };

  // =========================================================================
  // 状态查询接口 —— 阶段二模拟器 UI 用这个画虚拟灯
  // =========================================================================
  VirtualDevice.prototype.getState = function () {
    var out = {}, inp = {}, outIds = [], inIds = [];
    for (var i = 0; i < this._caps.length; i++) {
      var c = this._caps[i];
      if (c.kind === 'out') {
        outIds.push(c.id);
        out[c.id] = {
          i: c.level, active: c.active, pri: c.pri, hold: c.hold,
          ttl: c.hold ? -1 : (c.active ? Math.max(0, c.expiresAt - this._t) : 0)
        };
      } else {
        inIds.push(c.id);
        inp[c.id] = { active: false };
      }
    }
    return {
      dev: this.dev,
      connected: this._connected,
      state: this._state,
      resetting: this._resetting,
      t: this._t,
      uptime: Math.round(this._t - this._bootAt),
      caps: { out: outIds, in: inIds },
      out: out,
      in: inp,
      lastFrameAt: this._lastFrameAt,
      transcript: this._transcript.slice()
    };
  };

  // 便捷读取：某个输出的当前强度（模拟器每帧调这个画灯）
  VirtualDevice.prototype.level = function (id) {
    var c = this._find(id, 'out');
    return c ? c.level : 0;
  };

  // 本设备发出的所有原始行（含被丢弃的垃圾行），测试脚本用它断言串扰
  VirtualDevice.prototype.lines = function () {
    return this._transcript.slice();
  };

  VirtualDevice.prototype._log = function (msg) {
    var line = '# ' + msg;
    for (var i = 0; i < this._lineListeners.length; i++) this._lineListeners[i](line);
  };

  return {
    VirtualDevice: VirtualDevice,
    PROTOCOL: P,
    PRIORITY: PRI,
    PRIORITY_NAME: PRI_NAME,
    DEFAULT_OUTPUTS: DEFAULT_OUT
  };
});
