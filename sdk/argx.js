/*
 * ARGX 网页 SDK —— 让网页作品操控现实物件
 *
 * 给谁用：写 ARG 的人。他们大多不懂硬件，作品是 AI 生成出来的单文件 HTML。
 * 所以这个文件有三条硬要求：
 *   1. 零依赖、无构建、不搞模块化——<script src="argx.js"> 直接就能用
 *   2. 对外只有几行：ARGX.init(...) / ARGX.fire('reveal') / ARGX.on('input', fn)
 *   3. 出任何问题都静默降级：不抛错、不弹窗、不阻塞剧情
 *
 * 内部分三层（和阶段一、二同一套架构，只是换成了纯 JS）：
 *   传输层  connect / send / onMessage / onClose / close
 *           —— 收发的是**对象**，序列化与帧定界（补 \n、切行、丢非 { 开头的噪音）都在这一层
 *   会话层  握手、心跳、ACK、掉线判定
 *           —— 与 console/src/core/session.ts 逐条对应，抢占/TTL/幂等/看门狗的行为两端一致
 *   应用层  事件词表与门面 —— 作者只看见这一层
 *
 * 一条贯穿全项目的规矩：**只发语义 cue**（light.main），绝不发引脚电平（GPIO4 HIGH）。
 * 哪个 GPIO 上挂了什么，由装置端决定。
 *
 * 协议权威是 protocol/PROTOCOL.md，改协议先改那里。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ARGX = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =========================================================================
  // 常量：与 protocol/PROTOCOL.md §13 常量总表一一对应
  // =========================================================================
  var P = {
    VERSION: 1,
    HEARTBEAT_MS: 3000,   // 网页端 3 秒发一次 ping
    LINK_LOST_MS: 10000,  // 10 秒没收到任何有效帧就判定掉线
    HELLO_RETRY_MS: 1500  // 1.5 秒没等到能力声明，重发一次 hello
  };

  var PRI = { critical: 0, high: 1, normal: 2, ambient: 3 };

  // 单个能力在设备端有 30 秒 TTL 上限，这里只用来给"缺省 dur"一个说法
  var DEFAULT_DUR = 30000;

  var PREFIX = '[ARGX] ';

  // =========================================================================
  // 小工具
  // =========================================================================

  function now() {
    return typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  }

  function clamp01(v) {
    v = Number(v);
    if (!isFinite(v)) return 0;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function isObj(v) {
    return v !== null && typeof v === 'object';
  }

  function getSerial() {
    try {
      return typeof navigator !== 'undefined' ? navigator.serial : undefined;
    } catch (e) {
      return undefined; // 某些浏览器访问 navigator.serial 本身就会抛
    }
  }

  function onFileProtocol() {
    try {
      return typeof location !== 'undefined' && location.protocol === 'file:';
    } catch (e) {
      return false;
    }
  }

  // =========================================================================
  // 传输层
  //
  // 统一契约（与阶段一、二一致）：
  //   connect() / send(frame:object) / onMessage(cb:(frame:object)=>void) / onClose(cb) / close()
  //
  // 注意 send 收的是**对象**、onMessage 回的是**对象**：
  // 文本编码、补换行、切行、丢噪音，都是传输层的活。
  // 这样将来加 WebSocket、蓝牙，只要再写一个实现，会话层一行都不用改。
  // =========================================================================

  /**
   * 模拟传输：什么都不连，也什么都不回。
   *
   * 存在的意义是「没有装置时网页也得能跑」：作者不接硬件也能验证埋点位置对不对，
   * 打出来的 cue 就是他要检查的东西。它绝不假装有装置——
   * 没有 ready、没有 pong、没有 state，所以"查状态"这条路会明确地查不到东西，
   * 不会给作者一个假的绿灯。
   */
  function MockTransport(reason) {
    this.kind = 'mock';           // 传输层种类：mock | serial | host
    this.sink = true;             // 单向水槽：发得出去，收不回来
    this.label = '模拟模式（不驱动硬件）';
    this.reason = reason || '';
    this._open = false;
    this._msgCbs = [];
    this._closeCbs = [];
  }

  MockTransport.prototype.connect = function () {
    this._open = true;
  };

  MockTransport.prototype.send = function (frame) {
    // 这里故意什么都不做：打印由应用层负责，传输层只管"送出去"。
    // 写在这的话，换成自定义传输（宿主提供的通道）时打印就没了，行为会不一致。
    void frame;
  };

  MockTransport.prototype.onMessage = function (cb) {
    this._msgCbs.push(cb);
  };

  MockTransport.prototype.onClose = function (cb) {
    this._closeCbs.push(cb);
  };

  MockTransport.prototype.close = function () {
    this._open = false;
  };

  /**
   * Web Serial 传输：连真实的 ESP32。
   *
   * 三条约束是浏览器定的，不是我们选的（见 sdk/README.md）：
   *   1. 必须在 https:// 或 localhost 下，否则 navigator.serial 根本不存在
   *   2. 首次连接必须由用户的真实点击触发，不能自动连
   *   3. 只有桌面版 Chrome/Edge 支持
   */
  function SerialTransport() {
    this.kind = 'serial';
    this.sink = false;
    this.label = '真实装置（USB 串口）';
    this.reason = '';
    this._port = null;
    this._writer = null;
    this._reader = null;
    this._decoder = new TextDecoder();
    this._encoder = new TextEncoder();
    this._buf = '';
    this._msgCbs = [];
    this._closeCbs = [];
    var self = this;
    this._onDeviceGone = function () {
      self._fireClose('串口设备已断开（线被拔了？）');
    };
    this.available = !!getSerial();
    if (!this.available) this.reason = environmentHint();
  }

  SerialTransport.prototype.connect = function () {
    var serial = getSerial();
    if (!serial) throw new Error(this.reason || '当前浏览器没有 Web Serial');
    var self = this;
    return serial
      .requestPort() // 必须由用户点击触发，浏览器会弹端口选择框
      .then(function (port) {
        self._port = port;
        return port.open({ baudRate: 115200 });
      })
      .then(function () {
        self._writer = self._port.writable.getWriter();
        self._reader = self._port.readable.getReader();
        serial.addEventListener('disconnect', self._onDeviceGone);
        self._readLoop();
      });
  };

  SerialTransport.prototype._readLoop = function () {
    var self = this;
    function pump() {
      self._reader.read().then(function (r) {
        if (r.done) {
          self._fireClose('串口读取结束，装置可能已拔出');
          return;
        }
        // stream: true —— 一个多字节字符可能被切成两个 chunk，
        // 不带这个参数，日志里的中文会随机变成乱码
        if (r.value) self._feed(self._decoder.decode(r.value, { stream: true }));
        pump();
      }).catch(function (e) {
        self._fireClose('串口读取出错：' + (e && e.message ? e.message : e));
      });
    }
    pump();
  };

  /** 帧定界在这里：按 \n 切行、丢非 { 开头的噪音（ESP32 上电会吐 ROM 日志）、解析成对象 */
  SerialTransport.prototype._feed = function (chunk) {
    this._buf += chunk;
    var idx;
    while ((idx = this._buf.indexOf('\n')) >= 0) {
      var line = this._buf.slice(0, idx).replace(/\r$/, '');
      this._buf = this._buf.slice(idx + 1);
      if (!line || line.charAt(0) !== '{') continue; // 噪音，静默丢
      var frame;
      try {
        frame = JSON.parse(line);
      } catch (e) {
        continue; // 坏 JSON 静默丢，跟设备端对垃圾行的处理一致
      }
      if (!isObj(frame)) continue;
      for (var i = 0; i < this._msgCbs.length; i++) this._msgCbs[i](frame);
    }
  };

  SerialTransport.prototype.send = function (frame) {
    if (!this._writer) throw new Error('串口还没连上');
    var text = JSON.stringify(frame) + '\n';
    this._writer.write(this._encoder.encode(text));
  };

  SerialTransport.prototype.onMessage = function (cb) {
    this._msgCbs.push(cb);
  };

  SerialTransport.prototype.onClose = function (cb) {
    this._closeCbs.push(cb);
  };

  SerialTransport.prototype.close = function () {
    var serial = getSerial();
    if (serial) serial.removeEventListener('disconnect', this._onDeviceGone);
    try {
      if (this._reader) this._reader.cancel();
    } catch (e) {
      /* 已经断了就算了 */
    }
    try {
      if (this._writer) this._writer.releaseLock();
    } catch (e) {
      /* 同上 */
    }
    var port = this._port;
    this._reader = null;
    this._writer = null;
    this._port = null;
    this._buf = '';
    if (port) {
      try {
        return port.close();
      } catch (e) {
        /* 同上 */
      }
    }
  };

  SerialTransport.prototype._fireClose = function (reason) {
    for (var i = 0; i < this._closeCbs.length; i++) this._closeCbs[i](reason);
  };

  /**
   * 自定义传输：宿主页面把一条现成的通道交给 SDK。
   *
   * 控制台就是这么把「当前连的是哪台装置」交给作品页面的——
   * 作品不用自己再连一次，跟着宿主的连接走即可。
   * 宿主只要提供 connect / send / onMessage / onClose / close 五个方法。
   */
  function HostTransport(obj) {
    this.kind = 'host';
    this.sink = false;
    this.label = obj.label || '宿主提供的通道';
    this.reason = '';
    this._t = obj;
  }

  HostTransport.prototype.connect = function () {
    return this._t.connect ? this._t.connect() : undefined;
  };
  HostTransport.prototype.send = function (frame) {
    return this._t.send(frame);
  };
  HostTransport.prototype.onMessage = function (cb) {
    this._t.onMessage(cb);
  };
  HostTransport.prototype.onClose = function (cb) {
    this._t.onClose(cb);
  };
  HostTransport.prototype.close = function () {
    return this._t.close ? this._t.close() : undefined;
  };

  // =========================================================================
  // 会话层
  //
  // 这是 console/src/core/session.ts 的逐条翻译（阶段二那份已经不依赖框架了，
  // 所以搬过来只换语法，逻辑一条没动）。两边的差异只有一处，见 _isSink。
  //
  // 与装置端是**对等**的：同一套握手、心跳、掉线判定、序号规则，只是注册的处理器不同。
  // =========================================================================

  function Session(hooks) {
    this.hooks = hooks;
    this.transport = null;
    this._seq = 1;
    this._status = 'disconnected';
    this._caps = null;
    this._dev = null;
    this._lastPongAt = 0;
    this._pendingPings = {};   // seq → 发出时刻
    this._pendingState = [];   // 等 state 应答的回调（先到先得）
    this._pingTimer = null;
    this._watchTimer = null;
    this._helloTimer = null;
    this._closingByUs = false;
    this._gotCaps = false;
  }

  /** 模拟模式没有链路可谈：不心跳、不掉线判定。其余状态与真链路一致 */
  Session.prototype._isSink = function () {
    return !!(this.transport && this.transport.sink);
  };

  Session.prototype.connect = function (transport) {
    var self = this;
    this.transport = transport;
    this._lastPongAt = now();
    this._gotCaps = false;
    this._pendingPings = {};
    this._setStatus('connecting', '正在连接 ' + transport.label);

    transport.onMessage(function (frame) {
      self._onFrame(frame);
    });
    transport.onClose(function (reason) {
      self._stopTimers();
      self._setStatus('disconnected', reason);
      // 被动的断开（拔线、对端自己断了）必须让上层知道
      if (!self._closingByUs) self.hooks.onLost(reason);
    });

    var started;
    try {
      started = transport.connect();
    } catch (e) {
      // 连不上不是错误，是一种正常结局（没插线、用户点了取消、环境不支持）
      this._setStatus('disconnected', e && e.message ? e.message : String(e));
      this.hooks.onLost(e && e.message ? e.message : String(e));
      return Promise.resolve(false);
    }

    return Promise.resolve(started).then(function () {
      if (self._isSink()) {
        self._setStatus('mock', transport.reason || '模拟模式：指令只打印，不驱动硬件');
        return true;
      }
      // 装置连上时会自己发 ready，但那一帧有可能丢，所以主动 hello 一次把它要回来
      self._send({ c: 'hello', seq: self._nextSeq() });
      self._helloTimer = setTimeout(function () {
        if (!self._gotCaps) {
          self.hooks.onLog('info', '1.5 秒没等到能力声明，重发一次 hello');
          self._send({ c: 'hello', seq: self._nextSeq() });
        }
      }, P.HELLO_RETRY_MS);
      self._pingTimer = setInterval(function () {
        self.ping();
      }, P.HEARTBEAT_MS);
      self._watchTimer = setInterval(function () {
        self._checkLink();
      }, 1000);
      return true;
    }).catch(function (e) {
      self._setStatus('disconnected', e && e.message ? e.message : String(e));
      self.hooks.onLost(e && e.message ? e.message : String(e));
      return false;
    });
  };

  Session.prototype.disconnect = function () {
    this._stopTimers();
    var t = this.transport;
    this.transport = null;
    this._closingByUs = true;
    var self = this;
    return Promise.resolve()
      .then(function () {
        return t ? t.close() : undefined;
      })
      .catch(function () {
        /* 关不掉也不该影响剧情 */
      })
      .then(function () {
        self._closingByUs = false;
        self._setStatus('disconnected', '已断开');
      });
  };

  Session.prototype._nextSeq = function () {
    return this._seq++;
  };

  Session.prototype.isConnected = function () {
    return (
      this.transport !== null &&
      this._status !== 'disconnected' &&
      this._status !== 'lost'
    );
  };

  /** 发一帧。发不出去就打 console —— 这是「未接硬件时静默成功」的落点 */
  Session.prototype._send = function (frame) {
    var full = { v: P.VERSION };
    for (var k in frame) if (frame.hasOwnProperty(k)) full[k] = frame[k];
    // 没有链路、或者链路是个只出不进的水槽（模拟模式），都只往 console 打一行。
    // 这一条就是「作者不接硬件也能验证埋点」的全部实现。
    if (!this.transport || this.transport.sink) {
      this.hooks.onUndeliverable(full);
      return;
    }
    try {
      this.transport.send(full);
      this.hooks.onFrame('out', full);
    } catch (e) {
      // 写失败（串口拔了、流被取消）也只当这一帧没发出去，绝不打断剧情
      this._stopTimers();
      this._setStatus('disconnected', e && e.message ? e.message : String(e));
      this.hooks.onUndeliverable(full);
    }
  };

  Session.prototype.cue = function (id, p) {
    this._send({ c: 'cue', id: id, p: p || {}, seq: this._nextSeq() });
  };

  Session.prototype.batch = function (cues) {
    this._send({ c: 'batch', p: { cues: cues }, seq: this._nextSeq() });
  };

  Session.prototype.reset = function () {
    this._send({ c: 'reset', seq: this._nextSeq() });
  };

  Session.prototype.ping = function () {
    if (!this.transport || this._isSink()) return;
    var seq = this._nextSeq();
    this._pendingPings[seq] = now();
    this._send({ c: 'ping', seq: seq });
  };

  /** 查一次状态。cb 收到 null 表示"没人应答"——这正是自检要的那条信息 */
  Session.prototype.queryState = function (cb, timeoutMs) {
    if (!this.transport || this._isSink()) {
      cb(null);
      return;
    }
    var self = this;
    var timer = setTimeout(function () {
      for (var i = 0; i < self._pendingState.length; i++) {
        if (self._pendingState[i].timer === timer) {
          self._pendingState.splice(i, 1);
          break;
        }
      }
      cb(null);
    }, timeoutMs || 900);
    this._pendingState.push({ cb: cb, timer: timer });
    this._send({ c: 'query', seq: this._nextSeq() });
  };

  Session.prototype._onFrame = function (msg) {
    if (!isObj(msg)) return;
    if (msg.v !== undefined && msg.v !== P.VERSION) return;

    var seq = typeof msg.seq === 'number' ? msg.seq : -1;
    var t = now();
    this._lastPongAt = t; // 任何有效帧都算对端还活着
    if (this._status === 'stale' || this._status === 'ready') {
      this._setStatus('active', '收到有效帧');
    }
    this.hooks.onFrame('in', msg);

    switch (msg.c) {
      case 'ready':
        this._gotCaps = true;
        this._caps = msg.caps || { out: [], in: [] };
        this._dev = msg.dev ? String(msg.dev) : '未知装置';
        if (this._status !== 'active') this._setStatus('ready', '握手完成');
        this.hooks.onReady(this._caps, this._dev);
        break;
      case 'pong': {
        var sent = this._pendingPings[seq];
        if (sent !== undefined) {
          delete this._pendingPings[seq];
          this.hooks.onPong(t - sent);
        }
        break;
      }
      case 'ack':
        this.hooks.onAck(seq, String(msg.r || ''), msg.res);
        break;
      case 'state': {
        var p = this._pendingState.shift();
        if (p) {
          clearTimeout(p.timer);
          p.cb(msg);
        }
        this.hooks.onState(msg);
        break;
      }
      case 'input':
        this.hooks.onInput(msg);
        break;
      case 'err':
        this.hooks.onErr(msg);
        break;
      default:
        break; // 未知命令静默忽略，绝不因为一帧看不懂就把剧情打断
    }
  };

  Session.prototype._checkLink = function () {
    if (!this.transport || this._isSink()) return;
    var silent = now() - this._lastPongAt;
    if (silent > P.LINK_LOST_MS) {
      var reason = P.LINK_LOST_MS / 1000 + ' 秒没收到回应，判定掉线';
      this._stopTimers();
      var t = this.transport;
      this.transport = null;
      try {
        t.close();
      } catch (e) {
        /* 忽略 */
      }
      this._setStatus('lost', reason);
      this.hooks.onLost(reason);
    } else if (silent > P.HEARTBEAT_MS * 2 && this._status === 'active') {
      this._setStatus('stale', '心跳变慢，可能不稳');
    }
  };

  Session.prototype._stopTimers = function () {
    if (this._pingTimer !== null) clearInterval(this._pingTimer);
    if (this._watchTimer !== null) clearInterval(this._watchTimer);
    if (this._helloTimer !== null) clearTimeout(this._helloTimer);
    this._pingTimer = null;
    this._watchTimer = null;
    this._helloTimer = null;
  };

  Session.prototype._setStatus = function (status, detail) {
    if (this._status === status) return;
    this._status = status;
    this.hooks.onStatus(status, detail);
  };

  // =========================================================================
  // 事件词表
  //
  // 作者埋点写的是**事件名**（reveal / danger），不是能力 id（light.main）。
  // 理由：让创作者记住哪一路灯该配多大亮度是不现实的，而且每个作者各起一套名字，
  // 硬件端的清单很快就变成垃圾场。词表固定下来，故事层面的人话才有地方落。
  //
  // 表里的优先级是**故意**给好的，作者不需要知道"优先级"这回事：
  //   氛围类给 ambient（谁都能把它打断），剧情节点给 high（该抢就抢）。
  // =========================================================================
  var EVENTS = {
    calm: {
      label: '平静',
      desc: '灯光慢慢亮回来一点，配安静的段落',
      cues: [{ id: 'light.main', p: { i: 0.25, ramp: 4000, pri: PRI.ambient } }]
    },
    tension: {
      label: '紧张',
      desc: '灯光缓缓压暗，配"有东西不对劲"的段落',
      // ramp 给足 1.5 秒：250ms 那种是"闪一下"，读起来像故障而不是气氛
      cues: [{ id: 'light.main', p: { i: 0.1, ramp: 1500, pri: PRI.ambient } }]
    },
    reveal: {
      label: '揭示',
      desc: '灯猛地一亮加一声短响，解答揭晓时用',
      cues: [
        { id: 'light.main', p: { i: 1, ramp: 120, dur: 1500, pri: PRI.high } },
        { id: 'sound.beeper', p: { i: 1, dur: 250, pri: PRI.high } }
      ]
    },
    danger: {
      label: '危险',
      desc: '灯急闪、蜂鸣、振动一起上，惊吓点用',
      cues: [
        { id: 'light.main', p: { i: 0.75, ramp: 60, dur: 1200, pri: PRI.high } },
        { id: 'sound.beeper', p: { i: 1, dur: 600, pri: PRI.high } },
        { id: 'motion.vibrate', p: { i: 0.9, dur: 600, pri: PRI.high } }
      ]
    },
    relief: {
      label: '松一口气',
      desc: '灯光柔和回暖，配"安全了"的段落',
      cues: [{ id: 'light.main', p: { i: 0.5, ramp: 1500, pri: PRI.normal } }]
    },
    ending: {
      label: '终局',
      desc: '灯常亮不灭，配通关画面',
      cues: [
        { id: 'light.main', p: { i: 0.9, ramp: 800, pri: PRI.high, hold: true } },
        { id: 'sound.beeper', p: { i: 1, dur: 1200, pri: PRI.high } }
      ]
    }
  };

  // =========================================================================
  // 应用层：作者看到的全部
  // =========================================================================
  function environmentHint() {
    if (onFileProtocol()) {
      return (
        '检测到 file:// 协议，浏览器禁用了串口功能。' +
        '请用本地服务器打开，例如在本目录执行 `npx serve` 或 `python -m http.server 8000`，' +
        '然后访问 http://localhost:8000'
      );
    }
    if (!getSerial()) {
      return (
        '当前浏览器没有 Web Serial，装置连不上（网页本身照常运行）。' +
        '请用桌面版 Chrome 或 Edge，通过 https:// 或 http://localhost 打开本页。'
      );
    }
    return '';
  }

  var state = {
    inited: false,
    quiet: false,
    transportKind: 'mock',
    transport: null, // 已建好的传输实例。串口要等用户的点击才 connect()
    hint: environmentHint(),
    session: null,
    events: {},      // 作者自定义的事件
    handlers: {},    // 事件名 → 回调数组
    caps: null,
    dev: null
  };

  function log(level, msg) {
    if (state.quiet) return;
    var fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (fn) fn(PREFIX + msg);
  }

  function emit(type, a, b) {
    var list = state.handlers[type];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](a, b);
      } catch (e) {
        // 作者的回调炸了不该影响别人
        log('error', '回调出错：' + (e && e.message ? e.message : e));
      }
    }
  }

  function describeCue(c) {
    return c.id + ' ' + JSON.stringify(c.p || {});
  }

  /** 发不出去时的落脚点：打 console。作者靠这一行确认埋点位置对不对 */
  function reportUndeliverable(frame) {
    if (frame.c === 'cue') {
      log('info', 'cue: ' + frame.id + ' ' + JSON.stringify(frame.p || {}));
    } else if (frame.c === 'batch') {
      var cues = (frame.p && frame.p.cues) || [];
      var bits = [];
      for (var i = 0; i < cues.length; i++) bits.push(describeCue(cues[i]));
      log('info', 'batch: ' + bits.join(' + '));
    }
    // ping / hello / query / reset 是协议内部的事，不往作者的 console 里塞
  }

  function makeHooks() {
    return {
      onFrame: function (dir, msg) {
        // 默认什么都不做，只在有人监听时才转出去
        if (state.handlers.frame) emit('frame', msg, dir);
      },
      onLog: function (level, msg) {
        log(level, msg);
      },
      onUndeliverable: function (frame) {
        reportUndeliverable(frame);
        emit('frame', frame, 'undelivered');
      },
      onReady: function (caps, dev) {
        state.caps = caps;
        state.dev = dev;
        log('info', '装置已就绪：' + dev + '（输出 ' + (caps.out || []).join(', ') + '）');
        emit('ready', caps, dev);
      },
      onAck: function (seq, r, res) {
        emit('ack', { seq: seq, r: r, res: res });
      },
      onState: function (frame) {
        emit('state', frame);
      },
      onInput: function (frame) {
        emit('input', frame.id, frame);
      },
      onErr: function (frame) {
        emit('err', frame);
      },
      onPong: function (ms) {
        emit('pong', ms);
      },
      onStatus: function (status, detail) {
        emit('status', status, detail);
      },
      onLost: function (reason) {
        log('warn', '装置断开：' + reason);
        emit('lost', reason);
      }
    };
  }

  function resolveTransport(opts) {
    var t = opts.transport;
    if (isObj(t)) return new HostTransport(t); // 宿主给的通道
    if (t === 'mock') return new MockTransport(opts.reason || '');
    if (t === 'serial') return new SerialTransport();
    // 'auto'（缺省）：能连真装置就真装置，连不了就模拟模式，两条路都不报错
    var serial = new SerialTransport();
    return serial.available ? serial : new MockTransport(environmentHint());
  }

  var ARGX = {
    /** 协议版本，和帧里那个 v 是同一个数 */
    version: P.VERSION,

    /**
     * 初始化。
     *
     *   ARGX.init()                       // 自动：有串口就用串口，没有就模拟模式
     *   ARGX.init({ transport: 'serial' })// 只连真装置（connect() 要放在点击事件里）
     *   ARGX.init({ transport: 'mock' })  // 只打印，不碰硬件
     *   ARGX.init({ transport: hostObj }) // 用宿主页面给的通道
     *
     * 只想改配置、不想重连时传 { keep: true }——初始化重复调用不会连出第二条链路。
     */
    init: function (opts) {
      try {
        opts = opts || {};
        if (state.inited && opts.keep) {
          if (opts.quiet !== undefined) state.quiet = !!opts.quiet;
          return ARGX;
        }
        if (state.session) {
          state.session.disconnect();
        }
        state.quiet = !!opts.quiet;
        state.caps = null;
        state.dev = null;
        state.hint = environmentHint();

        var t = resolveTransport(opts);
        state.transportKind = t.kind;
        state.transport = t;
        var session = new Session(makeHooks());
        state.session = session;
        state.inited = true;

        if (state.hint) log('warn', state.hint);
        log('info', '传输方式：' + t.label);

        if (t.kind === 'serial' && t.available) {
          // 串口必须由用户的真实点击打开，所以这里只准备好，不自动连。
          // 没连上之前发出去的 cue 一律打到 console。
          log('info', '在用户的点击里调用 ARGX.connect() 才会真正打开串口');
        } else {
          // 模拟模式和宿主通道都没有可等的异步，直接建立会话
          if (t.reason) log('warn', t.reason);
          session.connect(t);
        }
        return ARGX;
      } catch (e) {
        // 初始化失败也必须静默：页面照常跑，只是没有装置
        state.session = null;
        log('error', 'init 失败（页面会照常运行）：' + (e && e.message ? e.message : e));
        return ARGX;
      }
    },

    /**
     * 真正连上装置。**必须放在用户的点击事件里调用**——
     * 浏览器只允许用户的真实点击打开串口，页面加载时自动调用会被拒。
     */
    connect: function () {
      try {
        if (!state.session) ARGX.init();
        var session = state.session;
        if (!session) return Promise.resolve(false);
        if (session.isConnected()) return Promise.resolve(true);
        // 复用 init 建好的那个传输实例：串口的 requestPort 每次连接都要重新弹窗，
        // 但实例本身可以一直用（close 时内部端口已经清干净了）
        var t = state.transport || resolveTransport({ transport: state.transportKind });
        state.transport = t;
        state.transportKind = t.kind;
        return Promise.resolve(session.connect(t));
      } catch (e) {
        log('error', '连接失败：' + (e && e.message ? e.message : e));
        return Promise.resolve(false);
      }
    },

    /** 断开 */
    close: function () {
      try {
        if (state.session) return state.session.disconnect();
      } catch (e) {
        /* 忽略 */
      }
      return Promise.resolve();
    },

    /**
     * 触发一个事件（推荐用法）。事件名见 ARGX.events()，也可以自己定义。
     *
     * 装置没有的能力会被自动跳过——所以「灯 + 蜂鸣 + 振动」这样的事件
     * 在没有振动马达的装置上也能正常演，不会整条被丢掉。
     */
    fire: function (name) {
      try {
        var ev = state.events[name] || EVENTS[name];
        if (!ev) {
          log('warn', '没有这个事件：' + name + '（可用：' + Object.keys(ARGX.events()).join(', ') + '）');
          return false;
        }
        var cues = ev.cues.slice();
        var caps = state.caps;
        if (caps && caps.out && caps.out.length) {
          var kept = [];
          for (var i = 0; i < cues.length; i++) {
            if (caps.out.indexOf(cues[i].id) >= 0) kept.push(cues[i]);
          }
          if (kept.length === 0) {
            log('info', '事件 ' + name + ' 需要 ' + cues.map(function (c) { return c.id; }).join('、') +
              '，当前装置都没有，已跳过');
            return false;
          }
          cues = kept;
        }
        var session = state.session;
        if (!session) ARGX.init();
        session = state.session;
        if (!session) return false;

        if (cues.length === 1) session.cue(cues[0].id, cues[0].p);
        else session.batch(cues); // 多条一个 batch 发出去，灯和声音才是真的同时动
        emit('fire', name, cues);
        return true;
      } catch (e) {
        log('error', 'fire 失败：' + (e && e.message ? e.message : e));
        return false;
      }
    },

    /** 直接指定能力发一条 cue。要精确控制参数时用这个，其余场合用 fire */
    cue: function (id, p) {
      try {
        if (!state.session) ARGX.init();
        if (state.session) state.session.cue(id, p || {});
        return true;
      } catch (e) {
        log('error', 'cue 失败：' + (e && e.message ? e.message : e));
        return false;
      }
    },

    /** 一帧同时触发多个能力（同时起，不是先后） */
    batch: function (cues) {
      try {
        if (!state.session) ARGX.init();
        if (state.session) state.session.batch(cues || []);
        return true;
      } catch (e) {
        log('error', 'batch 失败：' + (e && e.message ? e.message : e));
        return false;
      }
    },

    /** 全部熄灭、回到待机 */
    reset: function () {
      try {
        if (state.session) state.session.reset();
      } catch (e) {
        /* 忽略 */
      }
    },

    /** 自定义事件。求同时仍然建议用「场景.动作」这种可读的名字 */
    defineEvent: function (name, cues, meta) {
      if (!name || !cues) return false;
      state.events[name] = {
        label: (meta && meta.label) || name,
        desc: (meta && meta.desc) || '',
        cues: cues
      };
      return true;
    },

    /** 全部可用事件（内置词表 + 自定义），给文档和界面用 */
    events: function () {
      var all = {};
      var k;
      for (k in EVENTS) if (EVENTS.hasOwnProperty(k)) all[k] = EVENTS[k];
      for (k in state.events) if (state.events.hasOwnProperty(k)) all[k] = state.events[k];
      return all;
    },

    /**
     * 问装置「你现在的输出是多少」。基于协议里的 query / state。
     *
     * 返回 Promise：拿到的是 { out: { 'light.main': { i, ttl, pri } } }；
     * 没有人应答时给 null —— 这正是「自检」要的那条信息（"回了说明通，不回就是没接上"）。
     * 永远不会 reject。
     */
    state: function (opts) {
      return new Promise(function (resolve) {
        try {
          if (!state.session) return resolve(null);
          state.session.queryState(function (frame) {
            if (!frame || !frame.out) return resolve(null);
            resolve({ dev: frame.dev, uptime: frame.uptime, out: frame.out, in: frame.in || {} });
          }, (opts && opts.timeout) || 900);
        } catch (e) {
          resolve(null);
        }
      });
    },

    /** 监听：ready / ack / state / input / err / status / lost / fire / frame / pong */
    on: function (type, fn) {
      if (!type || typeof fn !== 'function') return ARGX;
      if (!state.handlers[type]) state.handlers[type] = [];
      state.handlers[type].push(fn);
      return ARGX;
    },

    off: function (type, fn) {
      var list = state.handlers[type];
      if (!list) return ARGX;
      if (!fn) {
        state.handlers[type] = [];
        return ARGX;
      }
      for (var i = 0; i < list.length; i++) {
        if (list[i] === fn) {
          list.splice(i, 1);
          return ARGX;
        }
      }
      return ARGX;
    },

    /** 'disconnected' | 'connecting' | 'ready' | 'active' | 'stale' | 'lost' | 'mock' */
    status: function () {
      return state.session ? state.session._status : 'disconnected';
    },

    /** 传输种类：'serial'（真装置）| 'mock'（打印模式）| 'host'（宿主给的通道） */
    mode: function () {
      return state.transportKind;
    },

    /** 装置声明了哪些能力；还没握手时是 null */
    caps: function () {
      return state.caps;
    },

    /** 装置自己的名字，如 ARGX-0001 */
    device: function () {
      return state.dev;
    },

    /**
     * 环境提示：file:// 协议、浏览器不支持串口等。
     * 返回空串表示没问题；非空时建议在页面角落把这句话显示出来——
     * 只说"不支持"没用，得告诉人下一步做什么。
     */
    hint: function () {
      return environmentHint();
    }
  };

  return ARGX;
});
