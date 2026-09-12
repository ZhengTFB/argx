// ARGX 会话层实现。见 argx_node.h 顶部的说明与 protocol/PROTOCOL.md。

#include "argx_node.h"

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ===========================================================================
// 极简 JSON 取值工具
//
// 不引入 ArduinoJson：本项目的帧都是扁平的、字段固定的，
// 手写几百字节的取值器就够，还能省掉一个第三方依赖。
// 所有函数都只做「找得到就取值，找不到就返回 false」，绝不抛错、绝不越界。
// ===========================================================================
namespace {

Stream *g_logStream = nullptr;

const char *skipWs(const char *p, const char *end) {
  while (p < end && (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r'))
    p++;
  return p;
}

// p 指向开引号，返回闭引号之后的位置
const char *skipString(const char *p, const char *end) {
  p++;
  while (p < end && *p != '"') {
    if (*p == '\\' && p + 1 < end)
      p++;
    p++;
  }
  return (p < end) ? p + 1 : end;
}

// 定位 "key" 之后的值。只在 [src,end) 内找，用于把顶层字段和 p 对象分开。
const char *findKey(const char *src, const char *end, const char *key) {
  const size_t klen = strlen(key);
  const char *p = src;
  while (p < end && *p) {
    if (*p != '"') {
      p++;
      continue;
    }
    const char *s = p + 1;
    if (s + klen + 1 <= end && strncmp(s, key, klen) == 0 && s[klen] == '"') {
      const char *q = skipWs(s + klen + 1, end);
      if (q < end && *q == ':')
        return skipWs(q + 1, end);
    }
    p = skipString(p, end);
  }
  return nullptr;
}

bool readString(const char *v, const char *end, char *out, size_t outLen) {
  if (!v || v >= end || *v != '"' || outLen == 0)
    return false;
  v++;
  size_t n = 0;
  while (v < end && *v != '"') {
    if (*v == '\\' && v + 1 < end)
      v++;
    if (n + 1 < outLen)
      out[n++] = *v;
    v++;
  }
  out[n] = 0;
  return v < end;
}

bool readNumber(const char *v, const char *end, double *out) {
  if (!v || v >= end)
    return false;
  char tmp[24];
  size_t n = 0;
  const char *p = v;
  while (p < end && n + 1 < sizeof(tmp) &&
         (*p == '-' || *p == '+' || *p == '.' || (*p >= '0' && *p <= '9'))) {
    tmp[n++] = *p++;
  }
  tmp[n] = 0;
  if (n == 0)
    return false;
  char *stop = nullptr;
  const double d = strtod(tmp, &stop);
  if (stop == tmp)
    return false;
  *out = d;
  return true;
}

bool readBool(const char *v, const char *end, bool *out) {
  if (!v || v >= end)
    return false;
  if (strncmp(v, "true", 4) == 0) {
    *out = true;
    return true;
  }
  if (strncmp(v, "false", 5) == 0) {
    *out = false;
    return true;
  }
  double d = 0;
  if (readNumber(v, end, &d)) { // 容忍把 1 / 0 写成数字
    *out = (d != 0);
    return true;
  }
  return false;
}

double clampd(double v, double lo, double hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

// 取一个 JSON 对象的跨度（含花括号），用于把 p 的内容圈出来单独找键
bool readObjectSpan(const char *v, const char *end, const char **begin,
                    const char **stop) {
  if (!v || v >= end || *v != '{')
    return false;
  int depth = 0;
  const char *p = v;
  while (p < end) {
    if (*p == '"') {
      p = skipString(p, end);
      continue;
    }
    if (*p == '{')
      depth++;
    else if (*p == '}') {
      depth--;
      if (depth == 0) {
        *begin = v + 1;
        *stop = p;
        return true;
      }
    }
    p++;
  }
  return false;
}

// 往缓冲区追加，永不越界。返回新的写入位置。
int appendf(char *buf, size_t cap, int n, const char *fmt, ...) {
  if (n < 0)
    return 0;
  if ((size_t)n >= cap - 1)
    return (int)cap - 1;
  va_list ap;
  va_start(ap, fmt);
  const int r = vsnprintf(buf + n, cap - (size_t)n, fmt, ap);
  va_end(ap);
  if (r < 0)
    return n;
  n += r;
  if ((size_t)n > cap - 1)
    n = (int)cap - 1;
  return n;
}

const char *priName(uint8_t pri) {
  switch (pri) {
  case ARGX_PRI_CRITICAL:
    return "critical";
  case ARGX_PRI_HIGH:
    return "high";
  case ARGX_PRI_NORMAL:
    return "normal";
  default:
    return "ambient";
  }
}

} // namespace

// ===========================================================================
// 构造 / 初始化
// ===========================================================================

ArgxNode::ArgxNode()
    : _io(nullptr), _devId("ARGX-0000"), _lineLen(0), _lineOverflow(false),
      _capCount(0), _state(ARGX_ST_DISCONNECTED), _lastFrameAt(0),
      _lastPingAt(0), _bootAt(0), _resetting(false), _seqCounter(0),
      _pingIntervalMs(ARGX_HEARTBEAT_MS), _staleMarks(0) {
  memset(_caps, 0, sizeof(_caps));
  _line[0] = 0;
}

void ArgxNode::begin(Stream &io, const char *devId) {
  _io = &io;
  if (devId && *devId)
    _devId = devId;
  g_logStream = &io;

  _lineLen = 0;
  _lineOverflow = false;
  _resetting = false;
  _seqCounter = 0;
  _pingIntervalMs = ARGX_HEARTBEAT_MS;
  for (uint8_t i = 0; i < _capCount; i++) {
    _caps[i].active = false;
    _caps[i].level = 0;
    _caps[i].target = 0;
    _caps[i].rampStart = 0;
    _caps[i].hasLastSeq = false;
  }

  const uint32_t now = millis();
  _bootAt = now;
  _lastFrameAt = now;
  _lastPingAt = now;

  // 连接即上报（PROTOCOL §4.2）
  sendReady();
  _state = ARGX_ST_READY;
}

// ===========================================================================
// 注册接口
// ===========================================================================

bool ArgxNode::onCue(const char *id, ArgxCueHandler fn) {
  if (!id || !*id || !fn)
    return false;
  Cap *exist = findCap(id, ARGX_KIND_OUT);
  if (exist) { // 重复注册视为覆盖，方便热改
    exist->cueFn = fn;
    return true;
  }
  if (_capCount >= ARGX_MAX_CAPS)
    return false;
  Cap &c = _caps[_capCount++];
  memset(&c, 0, sizeof(c));
  c.id = id;
  c.kind = ARGX_KIND_OUT;
  c.cueFn = fn;
  return true;
}

bool ArgxNode::onInput(const char *id, ArgxInputHandler fn) {
  if (!id || !*id || !fn)
    return false;
  Cap *exist = findCap(id, ARGX_KIND_IN);
  if (exist) {
    exist->inFn = fn;
    return true;
  }
  if (_capCount >= ARGX_MAX_CAPS)
    return false;
  Cap &c = _caps[_capCount++];
  memset(&c, 0, sizeof(c));
  c.id = id;
  c.kind = ARGX_KIND_IN;
  c.inFn = fn;
  return true;
}

ArgxNode::Cap *ArgxNode::findCap(const char *id, ArgxKind kind) {
  if (!id)
    return nullptr;
  for (uint8_t i = 0; i < _capCount; i++) {
    if (_caps[i].kind == kind && strcmp(_caps[i].id, id) == 0)
      return &_caps[i];
  }
  return nullptr;
}

uint8_t ArgxNode::capabilityCount(ArgxKind kind) const {
  uint8_t n = 0;
  for (uint8_t i = 0; i < _capCount; i++)
    if (_caps[i].kind == kind)
      n++;
  return n;
}

const char *ArgxNode::capabilityId(ArgxKind kind, uint8_t index) const {
  uint8_t n = 0;
  for (uint8_t i = 0; i < _capCount; i++) {
    if (_caps[i].kind != kind)
      continue;
    if (n == index)
      return _caps[i].id;
    n++;
  }
  return nullptr;
}

float ArgxNode::currentLevel(const char *id) const {
  for (uint8_t i = 0; i < _capCount; i++) {
    if (_caps[i].kind == ARGX_KIND_OUT && strcmp(_caps[i].id, id) == 0)
      return _caps[i].level;
  }
  return 0.0f;
}

const char *ArgxNode::stateName() const {
  switch (_state) {
  case ARGX_ST_DISCONNECTED:
    return "disconnected";
  case ARGX_ST_READY:
    return "ready";
  case ARGX_ST_ACTIVE:
    return "active";
  case ARGX_ST_STALE:
    return "stale";
  default:
    return "idle";
  }
}

// ===========================================================================
// 主循环
// ===========================================================================

void ArgxNode::tick() {
  const uint32_t now = millis();

  pollSerial();

  // 看门狗：15 秒没有任何有效帧 → 强制回 idle（PROTOCOL §9.3）
  // 这条路径不可被抢占：forceIdle() 内部一次性把所有输出清干净。
  if (_state != ARGX_ST_IDLE && (now - _lastFrameAt) > ARGX_WATCHDOG_MS) {
    log("watchdog: %lu ms without a valid frame, forcing idle",
        (unsigned long)(now - _lastFrameAt));
    forceIdle();
  }

  // 掉线只是标记，不灭自己的输出（PROTOCOL §9.3）
  if (_state == ARGX_ST_ACTIVE && (now - _lastPingAt) > ARGX_LINK_LOST_MS) {
    _state = ARGX_ST_STALE;
    _staleMarks++;
    log("stale: no ping for %lu ms", (unsigned long)(now - _lastPingAt));
  }

  // 推进渐变与 TTL
  for (uint8_t i = 0; i < _capCount; i++) {
    Cap &c = _caps[i];
    if (c.kind != ARGX_KIND_OUT || !c.active)
      continue;
    // hold 的效果没有 TTL，只能被抢占/reset/看门狗/断连结束（PROTOCOL §7.1）
    if (!c.hold && (int32_t)(now - c.expiresAt) >= 0) {
      releaseCap(c, true); // TTL 到点自动释放，不需要任何人再发帧
      continue;
    }
    const uint32_t elapsed = now - c.startedAt;
    float level = c.target;
    if (c.ramp > 0 && elapsed < c.ramp) {
      const float t = (float)elapsed / (float)c.ramp;
      level = c.rampStart + (c.target - c.rampStart) * t;
    }
    if (level != c.level)
      applyCap(c, level, false, false, c.seq);
  }
}

// ===========================================================================
// 接收
// ===========================================================================

void ArgxNode::pollSerial() {
  if (!_io)
    return;
  while (_io->available() > 0) {
    const int ch = _io->read();
    if (ch < 0)
      break;
    if (ch == '\r')
      continue;
    if (ch == '\n') {
      if (_lineOverflow) {
        _lineOverflow = false;
        _lineLen = 0;
        sendErr("bad_frame", "line too long", -1);
        continue;
      }
      if (_lineLen == 0)
        continue;
      _line[_lineLen] = 0;
      processLine(_line);
      _lineLen = 0;
      continue;
    }
    if (_lineLen >= ARGX_MAX_LINE - 1) {
      _lineOverflow = true;
      continue;
    }
    _line[_lineLen++] = (char)ch;
  }
}

void ArgxNode::processLine(char *line) {
  // PROTOCOL §2：只处理以 { 开头的行。
  // 上电 ROM 日志、垃圾串扰都走这条路被丢掉，而且**不回 err**——
  // 对垃圾回 err 会变成刷屏，反而把真正的错误淹掉。
  if (line[0] != '{')
    return;

  const char *end = line + strlen(line);
  double d = 0;

  const char *pv = findKey(line, end, "v");
  if (pv && readNumber(pv, end, &d) && (int)d != ARGX_PROTO_VERSION) {
    sendErr("bad_version", "unsupported protocol version", -1);
    return; // 不刷新看门狗：版本不兼容的帧不算有效帧
  }

  long seq = -1;
  const char *ps = findKey(line, end, "seq");
  if (ps && readNumber(ps, end, &d))
    seq = (long)d;

  char cmd[16];
  const char *pc = findKey(line, end, "c");
  if (!pc || !readString(pc, end, cmd, sizeof(cmd))) {
    sendErr("bad_frame", "missing c", seq);
    return;
  }

  // 到这里才算有效帧。有效帧恢复会话（idle 只是看门狗刚触发时的标记，不是
  // 「设备死了」）；但复位窗口还没走完时不算数——那时候会话仍是 idle。
  const uint32_t now = millis();
  _lastFrameAt = now;
  _lastPingAt = now; // 任何有效帧都算「对端还活着」，不只看 ping
  if (!_resetting)
    _state = ARGX_ST_ACTIVE;

  handleFrame(line, cmd, seq);
}

void ArgxNode::handleFrame(const char *json, const char *cmd, long seq) {
  if (strcmp(cmd, "hello") == 0) {
    cmdHello();
  } else if (strcmp(cmd, "cue") == 0) {
    cmdCue(json, seq);
  } else if (strcmp(cmd, "batch") == 0) {
    cmdBatch(json, seq);
  } else if (strcmp(cmd, "query") == 0) {
    cmdQuery();
  } else if (strcmp(cmd, "cfg") == 0) {
    cmdCfg(json);
  } else if (strcmp(cmd, "ping") == 0) {
    cmdPing(seq);
  } else if (strcmp(cmd, "reset") == 0) {
    cmdReset();
    sendAck(seq, "applied");
  } else {
    sendErr("unknown_cmd", cmd, seq);
  }
}

// ===========================================================================
// 命令实现
// ===========================================================================

void ArgxNode::cmdHello() { sendReady(); }

void ArgxNode::cmdQuery() { sendState(); }

void ArgxNode::cmdCfg(const char *json) {
  const char *end = json + strlen(json);
  const char *pp = findKey(json, end, "p");
  const char *pb = nullptr, *pe = nullptr;
  if (pp && readObjectSpan(pp, end, &pb, &pe)) {
    const char *pk = findKey(pb, pe, "ping");
    double d = 0;
    if (pk && readNumber(pk, pe, &d) && d > 0)
      _pingIntervalMs = (uint16_t)d;
  }
  log("cfg: ping interval = %u ms", (unsigned)_pingIntervalMs);
}

void ArgxNode::cmdPing(long seq) { sendPong(seq); }

void ArgxNode::cmdReset() {
  log("reset: forced idle");
  forceIdle();
}

// 解析一条 cue。独立 cue 的帧本身就是这个形状（顶层 id + p 对象），
// batch 里的每个元素也是这个形状，所以两者共用这一个函数——
// 字段语义不可能漂移。
bool ArgxNode::parseCueSpec(const char *b, const char *e, ArgxCueSpec &s) {
  memset(&s, 0, sizeof(s));
  const char *pid = findKey(b, e, "id");
  if (!pid || !readString(pid, e, s.id, sizeof(s.id)))
    return false;

  // 缺省值。越界只钳制不报错（降级优于报错）。
  s.level = 1.0f;
  s.dur = ARGX_MAX_EFFECT_MS;
  s.ramp = 0;
  s.pri = ARGX_PRI_NORMAL;
  s.hold = false;

  const char *pp = findKey(b, e, "p");
  const char *pb = nullptr, *pe = nullptr;
  if (pp && readObjectSpan(pp, e, &pb, &pe)) {
    double d = 0;
    const char *k;
    if ((k = findKey(pb, pe, "i")) && readNumber(k, pe, &d))
      s.level = (float)clampd(d, 0.0, 1.0);
    if ((k = findKey(pb, pe, "dur")) && readNumber(k, pe, &d) && d >= 0)
      s.dur = (uint32_t)clampd(d, 0.0, (double)ARGX_MAX_EFFECT_MS);
    if ((k = findKey(pb, pe, "ramp")) && readNumber(k, pe, &d) && d >= 0)
      s.ramp = (uint32_t)clampd(d, 0.0, (double)ARGX_MAX_EFFECT_MS);
    if ((k = findKey(pb, pe, "pri")) && readNumber(k, pe, &d))
      s.pri = (uint8_t)clampd(d, 0.0, (double)ARGX_PRI_AMBIENT);
    k = findKey(pb, pe, "hold");
    if (k)
      readBool(k, pe, &s.hold);
  }
  // ramp 先按 dur 钳；常驻时 dur 仍是缺省的 30000，所以渐变的头上限也就有了
  if (s.ramp > s.dur)
    s.ramp = s.dur;
  if (s.hold)
    s.dur = 0; // 常驻：dur 不再有任何意义（PROTOCOL §7.1）
  return true;
}

void ArgxNode::cmdCue(const char *json, long seq) {
  const char *end = json + strlen(json);
  ArgxCueSpec s;
  if (!parseCueSpec(json, end, s)) {
    sendErr("bad_frame", "cue without id", seq);
    return;
  }
  if (!findCap(s.id, ARGX_KIND_OUT)) {
    sendErr("unknown_id", s.id, seq);
    return;
  }
  sendAck(seq, applyCue(s, millis(), seq));
}

// batch：一帧触发多个效果。校验是原子的（任一不合法整批不执行），
// 执行阶段各自走正常仲裁，所有条目共用同一个 now（PROTOCOL §4.3）。
void ArgxNode::cmdBatch(const char *json, long seq) {
  const char *end = json + strlen(json);
  const char *pp = findKey(json, end, "p");
  const char *pb = nullptr, *pe = nullptr;
  if (!pp || !readObjectSpan(pp, end, &pb, &pe)) {
    sendErr("bad_frame", "batch without p", seq);
    return;
  }
  const char *pa = findKey(pb, pe, "cues");
  if (!pa || pa >= pe || *pa != '[') {
    sendErr("bad_frame", "batch without p.cues", seq);
    return;
  }

  ArgxCueSpec specs[ARGX_MAX_BATCH];
  uint8_t n = 0;
  const char *p = pa + 1;
  while (p < pe) {
    p = skipWs(p, pe);
    if (p >= pe || *p == ']')
      break;
    if (*p == ',') {
      p++;
      continue;
    }
    if (*p != '{') {
      sendErr("bad_frame", "batch item is not an object", seq);
      return;
    }
    const char *eo = nullptr, *ec = nullptr;
    if (!readObjectSpan(p, pe, &eo, &ec)) {
      sendErr("bad_frame", "batch item not closed", seq);
      return;
    }
    if (n >= ARGX_MAX_BATCH) {
      sendErr("bad_frame", "batch too large", seq);
      return;
    }
    if (!parseCueSpec(eo, ec, specs[n])) {
      sendErr("bad_frame", "batch item without id", seq);
      return;
    }
    if (!findCap(specs[n].id, ARGX_KIND_OUT)) {
      sendErr("unknown_id", specs[n].id, seq); // 整批拒绝，一条都不执行
      return;
    }
    n++;
    p = ec + 1;
  }
  if (n == 0) {
    sendErr("bad_frame", "batch is empty", seq);
    return;
  }

  const uint32_t now = millis(); // 同一帧共用一个时间戳
  const char *results[ARGX_MAX_BATCH];
  bool anyApplied = false, anyPreempted = false, anyDropped = false, anyDup = false;
  for (uint8_t i = 0; i < n; i++) {
    results[i] = applyCue(specs[i], now, seq);
    if (strcmp(results[i], "applied") == 0)
      anyApplied = true;
    else if (strcmp(results[i], "preempted") == 0)
      anyPreempted = true;
    else if (strcmp(results[i], "dropped") == 0)
      anyDropped = true;
    else if (strcmp(results[i], "dup") == 0)
      anyDup = true;
  }
  const int kinds = (anyApplied ? 1 : 0) + (anyPreempted ? 1 : 0) +
                    (anyDropped ? 1 : 0) + (anyDup ? 1 : 0);
  const char *agg;
  if (kinds > 1)
    agg = "partial";
  else if (anyApplied)
    agg = "applied";
  else if (anyPreempted)
    agg = "preempted";
  else if (anyDropped)
    agg = "dropped";
  else
    agg = "dup";
  sendBatchAck(seq, agg, specs, results, n);
}

// ===========================================================================
// 仲裁辅助
// ===========================================================================

// 执行一条已通过前置校验的 cue，返回结果字符串（与 ack 的 r 取值一致）
const char *ArgxNode::applyCue(const ArgxCueSpec &s, uint32_t now, long seq) {
  Cap *c = findCap(s.id, ARGX_KIND_OUT);
  if (!c)
    return "unknown_id";

  // --- 仲裁（PROTOCOL §10，顺序不可调换）---
  if (_resetting)
    return "dropped";
  if (c->hasLastSeq && c->lastSeq == seq)
    return "dup"; // 幂等：同 id 同 seq 不重复执行
  if (c->active && c->pri == s.pri && sameEffect(*c, s)) {
    c->lastSeq = seq;
    c->hasLastSeq = true;
    return "dup"; // 连点：同 id 同优先级同参数，忽略
  }

  bool wasActive = c->active;
  if (s.pri == ARGX_PRI_CRITICAL) {
    // critical 执行前清空所有输出（含自己），保证「一定是当前唯一在演的东西」
    for (uint8_t i = 0; i < _capCount; i++) {
      if (_caps[i].kind == ARGX_KIND_OUT && _caps[i].active) {
        releaseCap(_caps[i], true);
        wasActive = true;
      }
    }
  } else if (c->active && s.pri > c->pri) {
    return "dropped"; // 低优先级不许打断高优先级
  }

  c->rampStart = c->level; // 从当前亮度开始渐变，不跳变
  c->pri = s.pri;
  c->target = s.level;
  c->dur = s.dur;
  c->ramp = s.ramp;
  c->hold = s.hold;
  c->active = true;
  c->startedAt = now;
  c->expiresAt = now + s.dur; // hold 时不检查这个字段，见 tick()
  c->seq = seq;
  c->lastSeq = seq;
  c->hasLastSeq = true;

  applyCap(*c, s.ramp > 0 ? c->rampStart : c->target, true, false, seq);
  log("cue %s i=%.2f dur=%lu ramp=%lu pri=%s%s -> %s", s.id, (double)c->target,
      (unsigned long)c->dur, (unsigned long)c->ramp, priName(s.pri),
      s.hold ? " hold" : "", wasActive ? "preempted" : "applied");
  return wasActive ? "preempted" : "applied";
}

bool ArgxNode::sameEffect(const Cap &c, const ArgxCueSpec &s) {
  if (c.ramp != s.ramp || c.dur != s.dur || c.hold != s.hold)
    return false;
  const float diff = c.target - s.level;
  return diff < 0.0001f && diff > -0.0001f;
}

void ArgxNode::applyCap(Cap &c, float level, bool start, bool release, long seq) {
  c.level = level;
  if (!c.cueFn)
    return;
  ArgxParams p;
  memset(&p, 0, sizeof(p));
  p.id = c.id;
  p.level = level;
  p.levelTarget = c.target;
  p.dur = c.dur;
  p.ramp = c.ramp;
  p.pri = c.pri;
  p.hold = c.hold;
  p.seq = seq;
  p.start = start;
  p.release = release;
  c.cueFn(p);
}

void ArgxNode::releaseCap(Cap &c, bool notify) {
  if (notify)
    applyCap(c, 0.0f, false, true, c.seq);
  c.active = false;
  c.hold = false;
  c.level = 0.0f;
  c.target = 0.0f;
  c.rampStart = 0.0f;
  c.ramp = 0;
  c.dur = 0;
}

void ArgxNode::forceIdle() {
  // 复位路径：一次性清干净，期间到达的 cue 全部丢弃（_resetting）
  _resetting = true;
  for (uint8_t i = 0; i < _capCount; i++) {
    if (_caps[i].kind == ARGX_KIND_OUT && _caps[i].active)
      releaseCap(_caps[i], true);
  }
  _resetting = false;
  _state = ARGX_ST_IDLE;
}

// ===========================================================================
// 发帧
// ===========================================================================

void ArgxNode::sendRaw(const char *frame) {
  if (!_io)
    return;
  _io->print(frame);
  _io->print('\n');
}

void ArgxNode::sendReady() {
  // caps 由注册表遍历生成——这是「加新能力不改上层」的那条硬保证
  char buf[ARGX_MAX_FRAME];
  int n = appendf(buf, sizeof(buf), 0,
                  "{\"v\":%d,\"c\":\"ready\",\"dev\":\"%s\",\"proto\":%d,"
                  "\"caps\":{\"out\":[",
                  ARGX_PROTO_VERSION, _devId, ARGX_PROTO_VERSION);
  bool first = true;
  for (uint8_t i = 0; i < _capCount; i++) {
    if (_caps[i].kind != ARGX_KIND_OUT)
      continue;
    n = appendf(buf, sizeof(buf), n, "%s\"%s\"", first ? "" : ",",
                _caps[i].id);
    first = false;
  }
  n = appendf(buf, sizeof(buf), n, "],\"in\":[");
  first = true;
  for (uint8_t i = 0; i < _capCount; i++) {
    if (_caps[i].kind != ARGX_KIND_IN)
      continue;
    n = appendf(buf, sizeof(buf), n, "%s\"%s\"", first ? "" : ",",
                _caps[i].id);
    first = false;
  }
  appendf(buf, sizeof(buf), n, "]}}");
  sendRaw(buf);
}

void ArgxNode::sendAck(long seq, const char *result) {
  char buf[96];
  snprintf(buf, sizeof(buf), "{\"v\":%d,\"c\":\"ack\",\"seq\":%ld,\"r\":\"%s\"}",
           ARGX_PROTO_VERSION, seq, result ? result : "applied");
  sendRaw(buf);
}

void ArgxNode::sendBatchAck(long seq, const char *agg, const ArgxCueSpec *specs,
                            const char *const *results, uint8_t n) {
  char buf[ARGX_MAX_FRAME];
  int len = appendf(buf, sizeof(buf), 0,
                    "{\"v\":%d,\"c\":\"ack\",\"seq\":%ld,\"r\":\"%s\",\"res\":{",
                    ARGX_PROTO_VERSION, seq, agg);
  for (uint8_t i = 0; i < n; i++) {
    len = appendf(buf, sizeof(buf), len, "%s\"%s\":\"%s\"", i ? "," : "",
                  specs[i].id, results[i]);
  }
  appendf(buf, sizeof(buf), len, "}}");
  sendRaw(buf);
}

void ArgxNode::sendPong(long seq) {
  char buf[80];
  snprintf(buf, sizeof(buf), "{\"v\":%d,\"c\":\"pong\",\"seq\":%ld}",
           ARGX_PROTO_VERSION, seq);
  sendRaw(buf);
}

void ArgxNode::sendState() {
  char buf[ARGX_MAX_FRAME];
  const uint32_t now = millis();
  int n = appendf(buf, sizeof(buf), 0,
                  "{\"v\":%d,\"c\":\"state\",\"dev\":\"%s\",\"uptime\":%lu,"
                  "\"out\":{",
                  ARGX_PROTO_VERSION, _devId, (unsigned long)(now - _bootAt));
  bool first = true;
  for (uint8_t i = 0; i < _capCount; i++) {
    Cap &c = _caps[i];
    if (c.kind != ARGX_KIND_OUT)
      continue;
    // ttl = -1 表示常驻（正常效果的 TTL 恒 >= 0，所以没有歧义）
    const long ttl =
        c.hold ? -1L : (c.active ? (long)(c.expiresAt - now) : 0L);
    n = appendf(buf, sizeof(buf), n,
                "%s\"%s\":{\"i\":%.2f,\"pri\":%u,\"ttl\":%ld}", first ? "" : ",",
                c.id, (double)c.level, (unsigned)c.pri, ttl);
    first = false;
  }
  appendf(buf, sizeof(buf), n, "},\"in\":{}}");
  sendRaw(buf);
}

void ArgxNode::sendErr(const char *code, const char *msg, long seq) {
  char buf[192];
  snprintf(buf, sizeof(buf),
           "{\"v\":%d,\"c\":\"err\",\"code\":\"%s\",\"msg\":\"%s\",\"seq\":%ld}",
           ARGX_PROTO_VERSION, code ? code : "unknown", msg ? msg : "", seq);
  sendRaw(buf);
}

bool ArgxNode::emitInput(const char *id, const char *event, float value) {
  Cap *c = findCap(id, ARGX_KIND_IN);
  if (!c) {
    sendErr("unknown_input", id, -1);
    return false;
  }
  char buf[160];
  snprintf(buf, sizeof(buf),
           "{\"v\":%d,\"c\":\"input\",\"id\":\"%s\",\"e\":\"%s\",\"v\":%.2f,"
           "\"seq\":%ld}",
           ARGX_PROTO_VERSION, id, event ? event : "change", (double)value,
           _seqCounter++);
  sendRaw(buf);
  if (c->inFn)
    c->inFn(event, value);
  return true;
}

void ArgxNode::log(const char *fmt, ...) {
  if (!g_logStream)
    return;
  char buf[160];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(buf, sizeof(buf), fmt, ap);
  va_end(ap);
  g_logStream->print("# ");
  g_logStream->println(buf);
}
