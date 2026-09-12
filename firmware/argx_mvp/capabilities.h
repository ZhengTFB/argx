// ARGX 能力层接口。
//
// 加一个新能力要做的事，全在这个文件加 .cpp 里：
//   1. 在 capabilities.cpp 里写一个回调函数
//   2. 在 argxRegisterBuiltins() 里加一行 node.onCue("域.对象", 回调)
// 会话层（argx_node.*）不需要动，协议版本不变。

#ifndef ARGX_CAPABILITIES_H
#define ARGX_CAPABILITIES_H

#include "argx_node.h"

// ---------------------------------------------------------------------------
// 引脚定义 —— 接线只认这一处
//
// 任务书希望引脚写在 .ino 顶部，但 .ino 与 .cpp 是两个编译单元，
// #define 传不过去，所以统一放在这里，.ino 第一行就 include 本文件。
// 改接线 = 只改这里。详细接线见 WIRING.md。
// ---------------------------------------------------------------------------
#ifndef ARGX_PIN_LIGHT
#define ARGX_PIN_LIGHT 4 // 主输出：LED / LED 灯带（PWM）
#endif
#ifndef ARGX_PIN_SOUND
#define ARGX_PIN_SOUND 5 // 有源或无源蜂鸣器（PWM，2.7kHz）
#endif
#ifndef ARGX_PIN_VIBRATE
#define ARGX_PIN_VIBRATE 6 // 振动马达（PWM，经三极管）
#endif
#ifndef ARGX_PIN_RELAY
#define ARGX_PIN_RELAY 7 // 继电器模块（数字，高电平吸合）
#endif

// 把四种内置能力注册进 node。
// 注意：必须在 node.begin() **之前**调用，否则首个 ready 帧里的 caps 是空的。
void argxRegisterBuiltins(ArgxNode &node);

#endif // ARGX_CAPABILITIES_H
