// ARGX 能力层：四种内置能力 + 自定义注册接口。
//
// 约定：回调会被会话层反复调用，而不是只在收到 cue 时调一次。
//   start=true   本次效果的首帧，用来初始化硬件（开引脚、设频率）
//   渐变期间      会话层按 tick 算出当前该输出的 p.level 再来回调
//   release=true  释放（TTL 到期 / reset / 看门狗），必须把输出归零
// 所以回调只需要做「把 p.level 输出到硬件」这一件事。
//
// 这里不接任何真实传感器：caps.in 保持为空数组。
// 加输入能力的方法见文件末尾的示例。

#include "capabilities.h"

// ---------------------------------------------------------------------------
// PWM 兼容层
//
// arduino-esp32 3.x 换了 ledc API，2.x 用通道号。
// 两种都写上，避免换核就编不过。
// ---------------------------------------------------------------------------
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
#define ARGX_LEDC_NEW_API 1
#endif

namespace {

const uint32_t ARGX_PWM_FREQ = 5000; // 灯光/振动 5kHz，肉眼与马达都不抖
const uint8_t ARGX_PWM_BITS = 8;
const uint32_t ARGX_BUZZER_FREQ = 2700; // 蜂鸣器谐振点附近，够响

bool g_pwmReady = false;

void pwmSetup(uint8_t pin, uint32_t freq) {
#ifdef ARGX_LEDC_NEW_API
  ledcAttach(pin, freq, ARGX_PWM_BITS);
#else
  // 2.x：通道号与引脚一一对应（0/1/2 分别给灯、蜂鸣器、马达）
  uint8_t channel = 0;
  if (pin == ARGX_PIN_SOUND)
    channel = 1;
  else if (pin == ARGX_PIN_VIBRATE)
    channel = 2;
  ledcSetup(channel, freq, ARGX_PWM_BITS);
  ledcAttachPin(pin, channel);
#endif
}

void pwmWrite(uint8_t pin, float level) {
  if (level < 0)
    level = 0;
  if (level > 1)
    level = 1;
  const uint32_t duty = (uint32_t)(level * 255.0f + 0.5f);
#ifdef ARGX_LEDC_NEW_API
  ledcWrite(pin, duty);
#else
  uint8_t channel = 0;
  if (pin == ARGX_PIN_SOUND)
    channel = 1;
  else if (pin == ARGX_PIN_VIBRATE)
    channel = 2;
  ledcWrite(channel, duty);
#endif
}

void hardwareInit() {
  if (g_pwmReady)
    return;
  pwmSetup(ARGX_PIN_LIGHT, ARGX_PWM_FREQ);
  pwmSetup(ARGX_PIN_SOUND, ARGX_BUZZER_FREQ);
  pwmSetup(ARGX_PIN_VIBRATE, ARGX_PWM_FREQ);
  pinMode(ARGX_PIN_RELAY, OUTPUT);
  digitalWrite(ARGX_PIN_RELAY, LOW);
  pwmWrite(ARGX_PIN_LIGHT, 0);
  pwmWrite(ARGX_PIN_SOUND, 0);
  pwmWrite(ARGX_PIN_VIBRATE, 0);
  g_pwmReady = true;
}

float effective(const ArgxParams &p) { return p.release ? 0.0f : p.level; }

// ---------------------------------------------------------------------------
// 四种内置能力
// ---------------------------------------------------------------------------

// light.main —— 按 i 调亮度，ramp 由会话层插值后逐帧喂进来
void handleLight(const ArgxParams &p) {
  hardwareInit();
  pwmWrite(ARGX_PIN_LIGHT, effective(p));
}

// sound.beeper —— 有源/无源蜂鸣器都吃 PWM：
// 有源蜂鸣器只要有方波就响，无源蜂鸣器在 2700Hz 附近最响。
void handleBeeper(const ArgxParams &p) {
  hardwareInit();
  const float lvl = effective(p);
  pwmWrite(ARGX_PIN_SOUND, lvl > 0.02f ? 0.5f : 0.0f); // 音量用占空比调不出来，只做开关
}

// motion.vibrate —— 振动马达必须经三极管/MOS 驱动，不能直连 GPIO
void handleVibrate(const ArgxParams &p) {
  hardwareInit();
  pwmWrite(ARGX_PIN_VIBRATE, effective(p));
}

// env.relay —— 继电器是开关量，i >= 0.5 视为吸合
void handleRelay(const ArgxParams &p) {
  hardwareInit();
  const bool on = effective(p) >= 0.5f;
  digitalWrite(ARGX_PIN_RELAY, on ? HIGH : LOW);
}

} // namespace

// ---------------------------------------------------------------------------
// 注册
// ---------------------------------------------------------------------------
void argxRegisterBuiltins(ArgxNode &node) {
  node.onCue("light.main", handleLight);
  node.onCue("sound.beeper", handleBeeper);
  node.onCue("motion.vibrate", handleVibrate);
  node.onCue("env.relay", handleRelay);

  // ↓↓↓ 加一个新能力就这么两行（caps.out 会自动多一项，协议不改）：
  //     上面写 void handleOled(const ArgxParams& p){ ... }
  //     这里 node.onCue("display.oled", handleOled);

  // 输入能力本期不接硬件，所以一个都不注册，caps.in 为空数组。
  // 将来接物理开关时加：
  //     void onSwitchA(const char* e, float v) { ... }
  //     node.onInput("switch.a", onSwitchA);
  //     事件发生时调 node.emitInput("switch.a", "press", 1);
}
