// ARGX 设备端入口（ESP32-S3-DevKitC-1-N8R8，兼容 ESP32-WROOM-32E 编译）
//
// 这个文件只做三件事：开串口、注册能力、把控制权交给会话层。
// 所有业务逻辑在 argx_node.cpp（会话层）与 capabilities.cpp（能力层）里。
//
// 接线见 WIRING.md。协议见 protocol/PROTOCOL.md。

#include "capabilities.h" // 引脚定义也在这里

#define ARGX_DEV_ID "ARGX-0001"
#define ARGX_SERIAL_BAUD 115200

ArgxNode node;

void setup() {
  Serial.begin(ARGX_SERIAL_BAUD);
  delay(300); // 等 USB CDC 枚举完，否则开头几帧会丢

  // 必须在 begin() 之前注册：ready 帧里的 caps 就是从这里生成的
  argxRegisterBuiltins(node);

  node.begin(Serial, ARGX_DEV_ID);
  ArgxNode::log("boot %s proto %d", ARGX_DEV_ID, ARGX_PROTO_VERSION);
}

void loop() {
  node.tick();
  delay(2); // tick 内部就是非阻塞轮询，这里只是让出 CPU 给 USB 中断
}
