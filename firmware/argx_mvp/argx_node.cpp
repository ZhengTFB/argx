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
    if ((int32_t)(now - c.expiresAt) >= 0) {
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

  // 到这里才算有效帧
  const uint32_t now = millis();
  _lastFrameAt = now;
  _lastPingAt = now; // 任何有效帧都算「对端还活着」，不只看 ping
  if (_state != ARGX_ST_IDLE)
    _state = ARGX_ST_ACTIVE;

  handleFrame(line, cmd, seq);
}

void ArgxNode::handleFrame(const char *json, const char *cmd, long seq) {
  if (strcmp(cmd, "hello") == 0) {
    cmdHello();
  } else if (strcmp(cmd, "cue") == 0) {
    cmdCue(json, seq);
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

void ArgxNode::cmdCue(const char *json, long seq) {
  const char *end = json + strlen(json);

  char id[32];
  const char *pid = findKey(json, end, "id");
  if (!pid || !readString(pid, end, id, sizeof(id))) {
    sendErr("bad_frame", "cue without id", seq);
    return;
  }

  // 参数一律先给缺省值，越界只钳制不报错（降级优于报错）
  ArgxParams p;
  memset(&p, 0, sizeof(p));
  p.id = id;
  p.level = 1.0f;
  p.levelTarget = 1.0f;
  p.dur = ARGX_MAX_EFFECT_MS;
  p.ramp = 0;
  p.pri = ARGX_PRI_NORMAL;
  p.seq = seq;

  const char *pp = findKey(json, end, "p");
  const char *pb = nullptr, *pe = nullptr;
  if (pp && readObjectSpan(pp, end, &pb, &pe)) {
    double d = 0;
    const char *k;
    if ((k = findKey(pb, pe, "i")) && readNumber(k, pe, &d)) {
      if (d < 0)
        d = 0;
      if (d > 1)
        d = 1;
      p.levelTarget = (float)d;
    }
    if ((k = findKey(pb, pe, "dur")) && readNumber(k, pe, &d) && d >= 0) {
      if (d > ARGX_MAX_EFFECT_MS)
        d = ARGX_MAX_EFFECT_MS;
      p.dur = (uint32_t)d;
    }
    if ((k = findKey(pb, pe, "ramp")) && readNumber(k, pe, &d) && d >= 0) {
      if (d > ARGX_MAX_EFFECT_MS)
        d = ARGX_MAX_EFFECT_MS;
      p.ramp = (uint32_t)d;
    }
    if ((k = findKey(pb, pe, "pri")) && readNumber(k, pe, &d)) {
      if (d < ARGX_PRI_CRITICAL)
        d = ARGX_PRI_CRITICAL;
      if (d > ARGX_PRI_AMBIENT)
        d = ARGX_PRI_AMBIENT;
      p.pri = (uint8_t)d;
    }
  }
  if (p.ramp > p.dur)
    p.ramp = p.dur;

  Cap *c = findCap(id, ARGX_KIND_OUT);
  if (!c) {
    sendErr("unknown_id", id, p.seq);
    return;
  }

  // --- 仲裁（PROTOCOL §10，顺序不可调换）---
  if (_resetting) {
    sendAck(p.seq, "dropped");
    return;
  }
  if (c->hasLastSeq && c->lastSeq == p.seq) {
    sendAck(p.seq, "dup"); // 幂等：同 id 同 seq 不重复执行
    return;
  }
  if (c->active && c->pri == p.pri &&
      sameEffect(*c, p.levelTarget, p.dur, p.ramp)) {
    c->lastSeq = p.seq;
    c->hasLastSeq = true;
    sendAck(p.seq, "dup"); // 连点：同 id 同优先级同参数，忽略
    return;
  }

  bool wasActive = c->active;
  if (p.pri == ARGX_PRI_CRITICAL) {
    // critical 执行前清空所有输出（含自己），保证「一定是当前唯一在演的东西」
    for (uint8_t i = 0; i < _capCount; i++) {
      if (_caps[i].kind == ARGX_KIND_OUT && _caps[i].active) {
        releaseCap(_caps[i], true);
        wasActive = true;
      }
    }
  } else if (c->active && p.pri > c->pri) {
    sendAck(p.seq, "dropped"); // 低优先级不许打断高优先级
    return;
  }

  const uint32_t now = millis();
  c->rampStart = c->level; // 从当前亮度开始渐变，不跳变
  c->pri = p.pri;
  c->target = p.levelTarget;
  c->dur = p.dur;
  c->ramp = p.ramp;
  c->active = true;
  c->startedAt = now;
  c->expiresAt = now + p.dur;
  c->seq = p.seq;
  c->lastSeq = p.seq;
  c->hasLastSeq = true;

  const float startLevel = (p.ramp > 0) ? c->rampStart : p.levelTarget;
  applyCap(*c, startLevel, true, false, p.seq);

  log("cue %s i=%.2f dur=%lu ramp=%lu pri=%s -> %s", id, (double)c->target,
      (unsigned long)c->dur, (unsigned long)c->ramp, priName(p.pri),
      wasActive ? "preempted" : "applied");
  sendAck(p.seq, wasActive ? "preempted" : "applied");
}

// ===========================================================================
// 仲裁辅助
// ===========================================================================

bool ArgxNode::sameEffect(const Cap &c, float i, uint32_t dur, uint32_t ramp) {
  if (c.ramp != ramp || c.dur != dur)
    return false;
  const float diff = c.target - i;
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
  p.seq = seq;
  p.start = start;
  p.release = release;
  c.cueFn(p);
}

void ArgxNode::releaseCap(Cap &c, bool notify) {
  if (notify)
    applyCap(c, 0.0f, false, true, c.seq);
  c.active = false;
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
    const unsigned long ttl =
        c.active ? (unsigned long)(c.expiresAt - now) : 0UL;
    n = appendf(buf, sizeof(buf), n,
                "%s\"%s\":{\"i\":%.2f,\"pri\":%u,\"ttl\":%lu}", first ? "" : ",",
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
