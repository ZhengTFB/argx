---
slug: commands
group: 参考
nav: 指令表
title: 命令参考
lead: 一帧一行 JSON，换行定界。所有命令两端对等，谁都能发。
order: 60
---

## 网页 → 装置

| 命令 | 要带 id？ | 做什么 | 装置回什么 |
|---|---|---|---|
| hello | 否 | 让装置报一下自己是谁、有什么能力 | ready |
| cue | 是 | 触发一路效果 | ack / err |
| batch | 否 | 一帧里同时触发多路（≤8 条） | 一个 ack（带 res） / err |
| query | 否 | 问现在什么状态 | state |
| cfg | 否 | 配置（目前只有心跳间隔） | ack |
| ping | 否 | 心跳 | pong |
| reset | 否 | 强制回空闲。critical，先清空全部输出 | ack |

## 装置 → 网页

| 帧 | 什么时候发 |
|---|---|
| ready | 连上时、以及每次收到 hello |
| ack | 每条被正常处理的命令 |
| state | 收到 query |
| input | 装置上的物理输入被触发了（按键、开关） |
| pong | 收到 ping |
| err | 收到不能理解的命令或参数 |

## 公共字段

| 字段 | 含义 |
|---|---|
| v | 协议版本，目前恒为 1 |
| c | 命令名 |
| id | 能力 id，形如 light.main（只有 cue 用） |
| p | 参数对象 —— 所有行为都在这里面，顶层只做路由 |
| seq | 本条指令的序号，用于配对回执 |
| dev | 装置 id |

## 有效帧的判定

- 只处理以 { 开头的行，其余**静默丢弃**，不回 err。对垃圾回 err 会变成刷屏，把其他错误淹掉
- 以 # 开头的是调试日志，可以和帧混在同一条通道上，接收方直接忽略
- 一帧最长 512 字节，超了丢弃并回 err:bad_frame
- 换行用 \n，\r\n 也容忍

## 能力声明帧

```json
// [head]
{"v":1,"c":"ready","dev":"ARGX-0001","proto":1,
 "caps":{"out":["light.main","sound.beeper","motion.vibrate","env.relay"],
         "in":[]}}
```

caps 里的 out / in 是**一串 id 字符串**，不带中文名、引脚与参数范围。那三项是协议的固定约定，由网页端查表补上：控制台里显示的"灯光 / GPIO4 / 亮度·渐变·时长"来自网页端，不是装置上报的。

## 状态帧

```json
// [head]
{"v":1,"c":"state","dev":"ARGX-0001","uptime":123456,
 "out":{"light.main":{"i":0.8,"pri":2,"ttl":2400},
        "sound.beeper":{"i":0,"pri":2,"ttl":0}},
 "in":{}}
```

- out 里**每一路都会列出**，没在跑的那路也在，i 为 0、ttl 为 0
- ttl 是剩余毫秒：0 表示没在跑，-1 表示常驻
- state 帧不带 seq，也不回 ack
