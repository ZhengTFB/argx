---
slug: constants
group: 参考
nav: 常量总表
title: 常量参考
lead: 协议里所有定死的数字。改其中任何一个都属于改协议。
order: 90
---

## 全部常量

| 项 | 值 | 说明 |
|---|---|---|
| 帧定界 | \n | \r\n 也容忍 |
| 有效帧 | 以 { 开头 | 其余静默丢弃 |
| 单帧上限 | 512 字节 | 超了丢弃并回 bad_frame |
| 心跳周期 | 3000 ms | 网页发起 |
| 判掉线 | 10000 ms | 这么久没有 pong 就断 |
| 看门狗 | 15000 ms | 装置这么久没有有效帧就全部清空 |
| 单条效果上限 | 30000 ms | hold 例外 |
| batch 上限 | 8 条 | 整帧 512 字节 |
| 协议版本 | 1 |  |
| 主输出引脚 | GPIO4 | 灯光 |
| 调试日志前缀 | # | 与帧混在同一条通道上 |

## 四路与引脚

| 能力 | 中文 | 引脚 | 驱动方式 |
|---|---|---|---|
| light.main | 灯光 | GPIO4 | PWM，5kHz，8 位 |
| sound.beeper | 声音 | GPIO18 | PWM，2.7kHz，实际只有开/关 |
| motion.vibrate | 振动 | GPIO17 | PWM，5kHz，必须经三极管 |
| env.relay | 继电器 | GPIO16 | 数字输出，高电平吸合 |

> [!WARNING]
> 引脚固定，不要随意更改。GPIO5 是经典 ESP32 的 strapping 脚，GPIO6/7 在那块板上接内部 flash，接负载直接起不来；26–32 在 S3 上接 PSRAM。要改引脚，四处一起改：capabilities.h、WIRING.md、网页端的元件表，以及这里的表。
