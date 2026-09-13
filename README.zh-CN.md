<div align="center">

<img src="design/logo.svg" width="320" alt="ARGX">

**把你的房间变成密室**

一套协议与 SDK，让网页通过 USB 串口驱动现实硬件：灯、声音、振动、继电器。

[![tests](https://github.com/ZhengTFB/argx/actions/workflows/test.yml/badge.svg)](https://github.com/ZhengTFB/argx/actions/workflows/test.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![protocol](https://img.shields.io/badge/protocol-v1-blue.svg)](protocol/PROTOCOL.md)
[![website](https://img.shields.io/badge/website-online-brightgreen.svg)](https://zhengtfb.github.io/argx/)
![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/ZhengTFB/argx/issues)

[English](README.md) ｜ **简体中文**

</div>

> 硬件侧（接线、引脚、编译烧录、排障）在另一个仓库 → **[argx-esp32](https://github.com/ZhengTFB/argx-esp32)**
>
> 让 AI 把 ARGX 接进你已经写好的网页 → **[argx-skill](https://github.com/ZhengTFB/argx-skill)**（也可以先看 [`guide/ai-skill.md`](guide/ai-skill.md)）

---

## 这是什么

ARG（替代现实游戏）的成立条件是**故事溢出屏幕**。玩家不只是在读剧情，他觉得故事正发生在自己身边。缺的始终是最后一步：他房间里的灯、声音、抽屉，没有跟着故事动。

常见做法是为一个游戏做一套硬件。剧本和硬件焊死在一起，换一个故事就得重做一遍。

ARGX 补的是中间那一层。它不是装置，也不是游戏，是两者之间的那根线。

> 电影是故事，音响是硬件，本项目做的是那根标准音频线。
> 有了标准线，任何电影都能接任何音响，两边都不用为对方改自己。

它给出三样东西：

- **一份协议**（[`protocol/PROTOCOL.md`](protocol/PROTOCOL.md)）——每行一条 JSON，两端地位对等
- **一个网页 SDK**（[`sdk/`](sdk/)）——零依赖纯原生 JS，整段复制进单文件 HTML 就能用
- **一个控制台**（[`console/`](console/)）——连接、自检、模拟、调试、看文档，都在一个页面里

## 三个角色

| 角色 | 会什么 | 得到什么 |
|---|---|---|
| **创作者** | 会写故事，不懂硬件，大多让 AI 写代码 | 一行 `ARGX.fire('reveal')` 就能让房间跟着剧情动。不碰单片机，不配驱动 |
| **玩家** | 想要更真的体验，不想折腾 | 买一个装置、插上 USB、点一下连接。没有装置时整场戏照常玩得下去 |
| **硬件作者** | 会做装置，不想每个装置都从零写一套通信 | 实现一次协议，全部作品都能用你的装置。加一路能力是注册一行，不是改协议 |

有一条判断贯穿了整个 SDK 的设计：

> **创作者的真实客户接口是他的 AI，不是创作者本人。**
>
> 作者不会来读文档。他的工作流是对 AI 说「给这场景加点氛围」。
> 所以 [`sdk/AGENTS.md`](sdk/AGENTS.md) 是**写给 AI 助手看的**集成规范，
> 教的是 `ARGX.fire('reveal')` 这种词，而不是「哪路灯配多大亮度」。

## 架构

```
        浏览器
  ┌───────────────────────┐
  │  控制台 ／ 第三方作品    │
  └───────────┬───────────┘
              │  SDK：零依赖，可整段复制进单文件 HTML
              │  协议：每行一条 JSON
        ┌─────┴─────┐
        │  传输层    │   Web Serial ／ Mock（虚拟装置）
        └─────┬─────┘
              │
  ┌───────────┴───────────┐
  │   ESP32 装置（固件）     │
  │  灯 / 声音 / 振动 / 继电器 │
  └───────────────────────┘
```

两条决定解释了后面的全部取舍：

**两端地位对等，不是主从。** 网页端与装置端跑的是**同一套会话层**（握手、心跳、回执、重连、看门狗），区别只在各自注册了哪些处理器。多装置、多端的场景因此不需要改结构——协议本来就是对称的。

**协议是唯一权威。** 两端实现都从 `protocol/PROTOCOL.md` 派生。固件、虚拟设备、SDK 会话层是它的三份实现，改协议先改文档。

## 协议速览

一帧就是一行 JSON，以 `\n` 结束。同一条通道上没有别的东西，除了 `#` 开头的调试日志（接收方直接忽略）。

| 字段 | 含义 |
|---|---|
| `v` | 协议版本，目前恒为 `1` |
| `c` | 命令名 |
| `id` | 能力 id，形如 `light.main`（只有 `cue` 用） |
| `p` | 参数对象。所有行为都在这里面，顶层只做路由 |
| `seq` | 序号，用于把一条命令和它的回执配起来 |
| `dev` | 装置 id |

能力是按 id 寻址的输入或输出对象（`light.main`、`sound.beeper`、`motion.vibrate`、`env.relay`）。装置连上时声明自己有哪些：

```json
{"v":1,"c":"ready","dev":"ARGX-0001","proto":1,
 "caps":{"out":["light.main","sound.beeper","motion.vibrate","env.relay"],
         "in":[]}}
```

一次最小的完整往返——网页请灯在 800ms 内渐亮到 80%，装置确认：

```
→ {"v":1,"c":"cue","id":"light.main","seq":12,"p":{"i":0.8,"dur":3000,"ramp":800,"pri":2}}
← {"v":1,"c":"ack","seq":12,"r":"applied"}
```

命令是双向的。网页端发 `hello` `cue` `batch` `query` `cfg` `ping` `reset`；装置端发 `ready` `ack` `state` `input` `pong` `err`。协议里没有哪条命令专属某一端。

cue 的五个参数：

| 参数 | 类型 | 缺省 | 含义 |
|---|---|---|---|
| `i` | 0 ~ 1 | 1.0 | 强度。超出范围被钳住，不报错 |
| `dur` | 毫秒整数 | 30000 | 持续多久。30000 同时也是上限 |
| `ramp` | 毫秒整数 | 0 | 渐入多久。超过 `dur` 会被钳到 `dur` |
| `pri` | 0 ~ 3 | 2 | 优先级。**数字越小越强** |
| `hold` | true / false | false | 常驻：忽略 `dur`，直到被抢占或复位 |

协议里定死的数字：

| 项 | 值 |
|---|---|
| 帧定界 | `\n`（`\r\n` 也容忍） |
| 单帧上限 | 512 字节 |
| 心跳 | 3000 ms，由网页端发起 |
| 判定掉线 | 10000 ms 收不到 `pong` |
| 看门狗 | 15000 ms 收不到任何有效帧，装置清空全部输出 |
| 单条效果上限 | 30000 ms，`hold` 例外 |
| `batch` 上限 | 8 条 |

每一条被正常处理的 cue 都会回一个 `ack`，带 `r` 字段：`applied`、`preempted`、`dup` 或 `dropped`。「收到了但没执行」也要回执，这是装置安静和链路断掉之间的区别。

## 为什么这么设计

**每行一条 JSON。** 可读、可 `tee`、可人肉调试。出问题时看到的是 `{"c":"cue","id":"light.main","p":{"i":0.4}}`，而不是需要解码的字节。代价是每帧多几个字节，换来的是串口调试不再是这个项目里最难的部分。

**两端对等而不是主从。** 见上面「架构」一节。代价是两端各要实现一套会话层；换来的是多装置、多端这些方向不需要重新设计。

**协议是地基，SDK 不是。** SDK 只是它上面的一层便利封装。用 SDK 的创作者、直接写裸帧的创作者、实现装置端的固件作者，读的是同一份文档——所以接一个新语言或新平台只需要一份新实现，不需要一份新规范。

**SDK 零依赖、单文件。** 创作者的项目大多是 AI 生成的一个 HTML 文件。任何构建步骤、任何 `npm install` 都会正好卡在那一步。`sdk/argx.js` 是一个文件、原生 JS、`<script src>` 直接用。

**降级优于报错。** 没有硬件、连接失败、`file://` 打开页面，所有调用都**静默成功**：cue 打到 console，剧情继续走。绝不抛错、绝不弹窗、绝不阻塞剧情。装置只负责演，剧情判定一行都不依赖它。

**能力是注册式的。** 加一路输出，只需要在装置端注册一个能力 id 并声明参数。协议里没有 `switch(id)`，也没有写死的功能表，所以新硬件既不用改协议，也不用改 SDK。

**只发语义 cue，绝不下发引脚电平。** 网页说「灯调到 40%」，不说「GPIO4 输出 PWM 102」。哪个引脚上挂了什么由装置端决定——这正是换一块板子不用改作品的原因。

## 快速开始

### 只想看看

- 引导页：<https://zhengtfb.github.io/argx/>
- 控制台：<https://zhengtfb.github.io/argx/console/>

控制台自带**虚拟装置**，不买任何硬件就能把一个作品从头玩到尾。

> Pages 上的控制台连的是**你自己电脑**的 USB 口，不是服务器的。
> Web Serial 要求 HTTPS 或 `localhost`，Pages 是 HTTPS，所以可用。端口枚举与授权发生在
> **访问者的浏览器和访问者的电脑之间**：你打开页面，插上你的 ESP32，点连接。

### 只想跑跑（不需要硬件）

```bash
git clone https://github.com/ZhengTFB/argx.git
cd argx

# 四条闸门。零依赖，不需要装任何东西
node tests/run.js            # 协议一致性              22 场景 / 213 项
node tests/sdk_smoke.js      # SDK 接虚拟设备真跑一遍        23 项
node tests/agents_guide.js   # 照 AGENTS.md 抄一遍能不能跑   12 项
node tests/demo_smoke.mjs    # Demo 端到端                  31 项

# 起控制台（需要 Node 20.19+ / 22.12+）
cd console
npm install
npm run dev                  # http://localhost:5173
```

控制台进来就自动连上虚拟装置。模拟器页能触发四路输出并看到可视化，设备页能跑自检，调试页能手动发 cue 并看到回执。

想预览「部署出去长什么样」：

```bash
cd console && npm run build && cd ..
node tools/site.mjs --serve          # http://localhost:4173/argx/
node tools/site.mjs --check          # 无头浏览器走查全站，扫 404 与异常
```

### 想接真硬件

硬件侧（接线、引脚、编译烧录、故障排查）在另一个仓库：

**→ [`argx-esp32`](https://github.com/ZhengTFB/argx-esp32)**

本仓库的 [`firmware/`](firmware/) 是同源码的一份拷贝，方便协议与固件对照着看。

### 让 AI 做接入

**[`argx-skill`](https://github.com/ZhengTFB/argx-skill)** 是给「手里已经有一个 ARG 网页」的人的 AI 助手用的技能包。它读你的网页、给出埋点方案、改代码、对着十项清单自检，最后把文件交回给你。

技能包里带着协议、SDK API 全集、事件词表、参数表、错误码与常量，AI 不需要回本仓库查任何东西。

你不需要读它。把仓库交给你的 AI，让它把 ARGX 接进去就行。

## 目录结构

```
argx/
├── protocol/     协议规范——唯一权威。两端实现都从这里派生
├── firmware/     ESP32 固件（Arduino C++）：会话层 + 能力层 + 入口
├── device/       虚拟设备。协议的第二实现，也是控制台模拟器的底座
├── tests/        标准帧序列（frames.json）与跑它的命令行脚本
├── sdk/          网页 SDK。零依赖纯原生 JS + AGENTS.md（给 AI 看的集成规范）
├── demo/         极简 ARG 示例作品。控制台的 ARG 库读同一份剧本
├── console/      控制台（Vite + React + TS）。模拟器直接引用 device/，不复制
├── landing/      引导页。零构建，原生 HTML/CSS/JS
├── guide/        对外文档。正文只写在这一份，控制台的文档页由它生成
├── design/       界面设计真源。原型 + 六份设计文档 + tokens.css
├── tools/        发布工具：GitHub Pages 站点的组装与校验、guide/ 的生成器
└── docs/         各阶段任务书与进度记录（PROGRESS.md 记着每个决策的理由）
```

`CLAUDE.md` 是给 AI 助手看的项目总纲——硬约束、已知坑、决策记录。如果你也用 AI 写这个项目的代码，从它开始。

## 开发

```bash
node tests/run.js -v              # 打印每一步收到的帧
node tests/run.js --scenario=11   # 只跑名字含 11 的场景

node tools/build-guide.mjs        # 从 guide/*.md 重新生成控制台的文档数据
node tools/build-guide.mjs --check  # 生成物与 md 不一致就非零退出

cd console
npm run build                     # 类型检查 + 打包 → dist/（纯静态）
npm run dev                       # 另开一个终端
node scripts/smoke.mjs            # 控制台端到端（97 项，无头浏览器 + DevTools 协议）
```

**改协议的顺序永远是**：先改 `protocol/`，再改 `firmware/` 与 `device/`，最后补 `tests/`。两端各有实现，**改一处必须同步另一处**——两个仓库里都有互相指路的注释。

**改界面的顺序是**：先看 `design/prototype/*.html`，再看 `design/` 里对应的文档，最后才动 `console/` 或 `landing/` 的代码。界面视觉以 `design/` 为准，不由实现者决定。

CI 在每次 push 与 PR 上跑四条闸门、控制台构建，以及一组浏览器类检查，见
[`.github/workflows/test.yml`](.github/workflows/test.yml)。

## 相关仓库

- **[`argx-esp32`](https://github.com/ZhengTFB/argx-esp32)** —— ESP32 适配器：硬件侧实现、接线图、引脚表、元件清单、编译烧录与故障排查
- **[`argx-skill`](https://github.com/ZhengTFB/argx-skill)** —— 给 AI 助手用的接入技能包

两边都需要的文件在各自的仓库里各放一份（协议文档、固件源码、接线文档），不使用 submodule。

## 许可协议

MIT © 2026 ZhengTFB
