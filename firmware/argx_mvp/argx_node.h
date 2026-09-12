// ARGX 会话层（对等节点实现）
//
// 本文件只实现 protocol/PROTOCOL.md 定义的东西：帧解析、命令分发、心跳、
// 看门狗、优先级仲裁、TTL。
//
// 它**不知道任何具体能力**——light.main 是什么、接在哪个引脚上，
// 全部由 capabilities.cpp 通过 onCue()/onInput() 注册进来。
// 加新能力不需要动这个文件。
//
// 权威来源：protocol/PROTOCOL.md。这里与文档冲突时，以文档为准并改这里。

#ifndef ARGX_NODE_H
#define ARGX_NODE_H

#include <Arduino.h>

// ---------------------------------------------------------------------------
// 协议常量 —— 与 protocol/PROTOCOL.md §13 常量总表一一对应
// 改这些值之前先改文档。
// ---------------------------------------------------------------------------
#define ARGX_PROTO_VERSION 1
#define ARGX_HEARTBEAT_MS 3000   // 网页端发 ping 的间隔（本端仅存储，见 cfg）
#define ARGX_LINK_LOST_MS 10000  // 10 秒无 pong 判定掉线（判定权在发起方）
#define ARGX_WATCHDOG_MS 15000   // 15 秒无有效帧 → 强制回 idle
#define ARGX_MAX_EFFECT_MS 30000 // 单效果 TTL 上限
#define ARGX_MAX_LINE 512        // 单行上限，超限丢弃
#define ARGX_MAX_CAPS 12         // 注册表容量（定长，不用动态内存）
#define ARGX_MAX_BATCH 8         // batch 单帧最多几条（PROTOCOL §4.3）
#define ARGX_MAX_FRAME 512       // 发帧缓冲

// 效果优先级（PROTOCOL §10）。数值越小越强势。
enum ArgxPriority {
  ARGX_PRI_CRITICAL = 0, // reset / 看门狗：永远抢占，执行前清空所有输出
  ARGX_PRI_HIGH = 1,     // 剧情关键节点
  ARGX_PRI_NORMAL = 2,   // 默认
  ARGX_PRI_AMBIENT = 3   // 背景氛围，可被任何东西打断
};

// 能力方向（PROTOCOL §5）
enum ArgxKind { ARGX_KIND_OUT = 0, ARGX_KIND_IN = 1 };

// 会话状态机（PROTOCOL §9.3）
enum ArgxState {
  ARGX_ST_DISCONNECTED = 0,
  ARGX_ST_READY = 1,   // 已上报 ready，等首个有效帧
  ARGX_ST_ACTIVE = 2,  // 会话中
  ARGX_ST_STALE = 3,   // >10s 无 ping，仅置标志
  ARGX_ST_IDLE = 4     // 看门狗触发的安全态
};

// 交给能力回调的参数。
//
// 关键约定：回调会被**多次**调用，而不是只在收到 cue 时调一次。
// 渐变期间会话层按 tick 算出当前该输出的强度并回调，
// 所以回调只需要写「把 level 输出到硬件」这一件事，不用自己管定时。
struct ArgxParams {
  const char *id;
  float level;      // 本次应输出的强度（渐变期间是插值，不是目标值）
  float levelTarget;// 目标强度
  uint32_t dur;     // 已钳制的持续毫秒
  uint32_t ramp;    // 已钳制的渐变毫秒
  uint8_t pri;      // 优先级
  bool hold;        // true = 常驻（无 TTL），见 PROTOCOL §7.1
  long seq;         // 源帧序号，-1 表示非 cue 触发
  bool start;       // true = 本次效果的首帧
  bool release;     // true = 释放（TTL 到期 / reset / 看门狗）
};

typedef void (*ArgxCueHandler)(const ArgxParams &p);
typedef void (*ArgxInputHandler)(const char *event, float value);

class ArgxNode {
public:
  ArgxNode();

  // io 通常是 Serial（USB CDC）。devId 形如 "ARGX-0001"。
  void begin(Stream &io, const char *devId);

  // 每个 loop() 调一次。所有计时、收发、仲裁都在这里推进。
  void tick();

  // ---- 注册接口：加新能力 = 加一行调用，不需要改本文件 ----
  bool onCue(const char *id, ArgxCueHandler fn);
  bool onInput(const char *id, ArgxInputHandler fn);

  // 设备侧主动上报输入事件（反向通道，PROTOCOL §8）
  bool emitInput(const char *id, const char *event, float value);

  // 状态查询接口，供上层/调试读取
  ArgxState state() const { return _state; }
  const char *stateName() const;
  uint8_t capabilityCount(ArgxKind kind) const;
  const char *capabilityId(ArgxKind kind, uint8_t index) const;
  float currentLevel(const char *id) const;

  // 调试日志：'#' 前缀，与协议帧区分（PROTOCOL §2）
  static void log(const char *fmt, ...);

private:
  // 一个能力槽：注册信息 + 仲裁状态
  struct Cap {
    const char *id;
    ArgxKind kind;
    ArgxCueHandler cueFn;
    ArgxInputHandler inFn;
    // 仲裁状态
    bool active;        // 当前有生效中的效果
    bool hold;          // 当前效果是否常驻（无 TTL）
    uint8_t pri;
    float level;        // 当前瞬时强度
    float target;       // 目标强度
    float rampStart;    // 本次渐变的起点强度
    uint32_t startedAt; // 效果起点
    uint32_t expiresAt; // TTL 到点时间
    uint32_t dur;
    uint32_t ramp;
    long seq;      // 当前效果的源序号
    long lastSeq;  // 幂等用：上一次处理过的序号
    bool hasLastSeq;
    uint32_t lastAt; // 该槽最后被接受的时间
  };

  // --- 收发 ---
  void pollSerial();
  void processLine(char *line);
  void handleFrame(const char *json, const char *cmd, long seq);

  // 一条 cue 的解析结果。独立 cue 与 batch 里的每一条共用这个结构，
  // 所以两者的字段语义不可能漂移。
  struct ArgxCueSpec {
    char id[32];
    float level;
    uint32_t dur;
    uint32_t ramp;
    uint8_t pri;
    bool hold;
  };

  // --- 命令处理（PROTOCOL §4.1）---
  void cmdCue(const char *json, long seq);
  void cmdBatch(const char *json, long seq);
  void cmdHello();
  void cmdQuery();
  void cmdCfg(const char *json);
  void cmdPing(long seq);
  void cmdReset();

  // --- 仲裁（PROTOCOL §10）---
  Cap *findCap(const char *id, ArgxKind kind);
  bool parseCueSpec(const char *begin, const char *end, ArgxCueSpec &spec);
  static bool sameEffect(const Cap &c, const ArgxCueSpec &s);
  const char *applyCue(const ArgxCueSpec &s, uint32_t now, long seq);
  void applyCap(Cap &c, float level, bool start, bool release, long seq);
  void releaseCap(Cap &c, bool notify);
  void forceIdle(); // 看门狗/reset 的复位路径

  // --- 发帧 ---
  void sendReady();
  void sendAck(long seq, const char *result);
  void sendBatchAck(long seq, const char *agg, const ArgxCueSpec *specs,
                    const char *const *results, uint8_t n);
  void sendPong(long seq);
  void sendState();
  void sendErr(const char *code, const char *msg, long seq);
  void sendRaw(const char *frame);

  Stream *_io;
  const char *_devId;
  char _line[ARGX_MAX_LINE];
  uint16_t _lineLen;
  bool _lineOverflow;

  Cap _caps[ARGX_MAX_CAPS];
  uint8_t _capCount;

  ArgxState _state;
  uint32_t _lastFrameAt; // 最后一个有效帧的时间戳（看门狗依据）
  uint32_t _lastPingAt;
  uint32_t _bootAt;
  bool _resetting;      // 复位中：普通 cue 一律丢弃
  long _seqCounter;     // 本端发帧序号
  uint16_t _pingIntervalMs; // cfg 下发的建议心跳间隔
  uint8_t _staleMarks;  // 统计用
};

#endif // ARGX_NODE_H
