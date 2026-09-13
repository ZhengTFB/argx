# ARGX — 项目总纲（常驻入口）

你是本项目的实现者。本文件在每次会话自动加载，是唯一常驻入口。
**开工前完整读完本文件；进入某阶段前，完整读完该阶段任务书。**

> **当前阶段是「阶段五：开源发布与仓库拆分」。**
>
> 阶段四（界面重做）已完成并验收通过。阶段五做的是**把已经做完的东西发布出去**：
> 建仓 → 部署 GitHub Pages → 拆两个仓库 → 写两份 README → 开源。
> **不新增功能、不改界面、不动协议。**
>
> **两条最重要的原则先记住：**
>
> 1. **界面长什么样 → `design/` 说了算**（`design/prototype/*.html` 是最终答案）
> 2. **界面上有哪些功能 → 底层代码说了算**（`protocol/` `firmware/` `device/` `sdk/`
>    `console/src/core/`），**不看旧界面**
>
> 阶段二、三做出的"小白工作台 / 专业工作台"两套界面**已全部作废**。

---

## 1. 项目是什么

做一套**让虚拟故事能操控现实物件**的通用连接设施。

ARG（替代现实游戏）的本质是"故事溢出到现实"——玩家不只是在读剧情，他觉得故事真的发生在自己身边。现在缺最后一步：玩家房间里的灯、声音、抽屉没有跟着故事动。

本项目补这一步，且**不是为某个游戏做一套装置**，而是做中间那层基础设施：任何 ARG 能接、任何装置能用。

类比：ARG 是电影，硬件装置是音响，**我们做的是那根标准音频线**。

**整个项目的地基是协议**（阶段一产出）。协议要像脚手架：内置一套基础能力，但允许使用者自定义，加新功能不需要改协议本身。

## 2. 三个角色

- **创作者** — 会写故事，不懂硬件。想要沉浸感，不想学单片机，且大多在用 AI 写代码。
- **玩家** — 想要更真的体验。愿意买装置，不想折腾驱动。
- **硬件作者** — 会做装置，不想每个装置都从零写全套通信。

**关键判断：创作者的真实客户接口是他的 AI，不是创作者本人。** 作者不会来读你的文档，他的工作流是对 AI 说"给这场景加点氛围"。SDK 要在这场对话里被想起来。

## 3. 术语表（全项目统一，杜绝歧义）

| 术语 | 含义 |
|---|---|
| 装置 / 节点 | 跑固件的硬件实体（ESP32）。协议字段 `dev` 即装置 ID |
| 网页端 | 控制台或第三方作品页面，跑在浏览器里 |
| 能力 | 一个可被引用的输出或输入对象，id 形如 `light.main` |
| cue | 网页端发往装置的语义指令，只描述"要什么感觉"，不含引脚电平 |
| 会话层 | 两端共用的握手、心跳、ACK、重连、看门狗逻辑 |
| 传输层 | 具体通道（USB/Web Serial 或 Mock），统一接口 `connect` / `send` / `onMessage` / `close` |

## 4. 技术事实

| 项 | 值 |
|---|---|
| 目标芯片 | **ESP32-S3**（成品板 ESP32-S3-DevKitC-1-N8R8） |
| 框架 | Arduino C++ |
| 传输 | **USB 数据线 + Web Serial** |
| 调试方式 | **纯虚拟设备**，全部阶段不接真实硬件 |


**Web Serial 硬规则**：必须在 HTTPS 或 localhost 下运行；首次连接必须由用户真实点击触发；仅桌面 Chrome/Edge 支持，手机端不可行（已接受的场景约束）。

## 5. 全局硬约束

**NEVER 引入联网代码。** 不做 WiFi、蓝牙、WebSocket 服务端、任何形式的网络传输。这是范围红线。

**NEVER 让 SDK 依赖构建工具。** SDK 必须能整段复制进第三方单文件 HTML 项目，零依赖、纯原生 JS。控制台可以用构建工具，但两者是不同产物。

**NEVER 从协议或 SDK 下发引脚电平。** 只发语义 cue，硬件拓扑由设备端决定。

**ALWAYS 保持两端地位对等。** 网页端和装置跑同一套会话层逻辑，只是注册的处理器不同。不是主从关系——这个决定决定了将来能否扩展出多装置、多端。

**ALWAYS 让 `protocol/` 保持唯一权威。** 两端实现都从它派生，改协议先改这里。

**ALWAYS 让降级优于报错。** 无硬件、连接失败、`file://` 环境——静默成功，绝不抛错、绝不弹窗、绝不阻塞剧情。

## 6. 目录结构

```
argx/
├── CLAUDE.md              # 本文件：常驻规则 + 阶段指针
├── docs/
│   ├── ARGX-01-协议与设备端.md
│   ├── ARGX-02-控制台与模拟器.md      # ⚠️ 界面部分已作废
│   ├── ARGX-03-Demo与SDK.md
│   ├── ARGX-04-界面重做.md            # ← 界面怎么做看这份
│   ├── ARGX-05-开源发布.md            # ← 发布/拆仓看这份（阶段五）
│   └── PROGRESS.md        # 阶段状态，你每次收尾时更新
├── design/                # ★ 界面设计真源（原型 + 设计文档）
│   ├── README.md          #   入口：谁权威、怎么用
│   └── prototype/         #   index.html（首页）/ console.html（控制台）
├── landing/               # 官网首页（阶段四新建）
├── protocol/              # 协议规范（唯一权威来源）
├── firmware/              # 设备端：可直刷的 Arduino 代码
├── device/                # 虚拟设备（调试主力）
├── tests/                 # 标准帧序列与一致性测试脚本
├── console/               # 控制台网站（可构建，产物纯静态）
├── sdk/                   # 网页 SDK（零依赖，可内联）
├── demo/                  # 极简 ARG 示例
└── docs/                  # 接线文档等
```

## 7. 阶段推进机制（分阶段执行，不要一次做完）

每个阶段按这个顺序走：

1. 读 `docs/PROGRESS.md`，确认当前阶段
2. 用 Read 工具完整读取该阶段任务书
3. 实现，并按任务书末尾的验收清单逐项自检
4. 更新 `docs/PROGRESS.md`：阶段状态、验收结果、协议变更、决策记录
5. **STOP** — 停下向我汇报，等我审查确认

**未确认前，绝不提前实现下一阶段的任何内容。** 我需要在每个阶段审查方向，避免最后整体返工。

**跨阶段依赖**：阶段一产出 `device/virtual_device.js` → 阶段二模拟器直接复用；阶段二产出 `console/src/works.ts` → 阶段三 Demo 注册进去。

## 8. 交互策略

**只有两类情况才打断我，其余一律自己决策、最后汇报。**

🛑 **类别一：实现逻辑与本设计出现重大偏离**
- 协议结构需要根本性重构
- 你认为某个硬约束绕不开、项目无法完成
- 我给出的硬件事实有误
- 你有明显更优的整体架构方案

🛑 **类别二：需要我手动操作**
- 安装系统级软件且装不上
- 需要我的手或眼睛（按 BOOT 键、插拔 USB、肉眼确认等）

✅ **自己决策并记录在 `docs/PROGRESS.md` 的决策记录里：**
- 变量命名、函数拆分、代码组织方式
- 用数组还是结构体等实现细节
- 协议的小改动——直接用，事后在交付说明里列出改了什么、为什么
- 遇到小故障但有把握自行解决

**原则：方向性偏离 → 问我。需要我的手 → 问我。其余自己定，最后汇报。**

开发环境和依赖自己装，装不上才找我。

> ### ⚠️ 关于 UI 细节：这条规则已改（阶段四起生效）
>
> ~~UI 配色、布局、文案、SDK 接口命名等细节一律自己定，不要问我。~~
>
> **改成：**
>
> - **配色、布局、组件形态、动效** → **以 `design/` 目录为准，不由你决定。**
>   界面真源是 `design/prototype/*.html`；实施任务书见 `docs/ARGX-04-界面重做.md`。
> - **界面该有哪些功能** → 看底层代码（`protocol/` `firmware/` `device/` `sdk/`
>   `console/src/core/`），不看旧界面。
> - **界面上的文案措辞** → 仍然自己定。
> - **SDK 接口命名** → 仍然自己定义（这条没变）。
>
> 想加一个原型里没有、底层代码里也找不到出处的功能时，**先问我**——
> 那说明要么你想偏了，要么发现了底层缺口，两种都值得停下来说。

## 9. 开工第一步（进入阶段一之前完成）

1. 在本文件末尾「工作笔记」区追加各阶段会用到的命令（启动、测试、构建）
2. 记录目录职责约定
3. 记录你发现的、文档里没写明的坑

之后每个新会话它会自动加载，省去重复读任务书的开销。我也会在后续往里补充规则。

## 10. 当前阶段

进度总览：@docs/PROGRESS.md

当前阶段任务书（阶段推进后，把这一行改成对应文件）：
@docs/ARGX-05-开源发布.md

> **阶段五开工前，除本文件外还要先读 `@docs/PROGRESS.md`**，
> 确认阶段四已通过审查、没有遗留未做的事，且工作区是干净的。
>
> 同一会话内切换阶段时，本文件的修改不会立即生效——此时直接用 Read 工具打开新阶段任务书。

## 11. 已知待确认项（按默认理解先做，不要停下问）

- 老款 ESP32-WROOM-32E 无原生 USB，Web Serial 实际不可用。默认按"能编译通过"处理，运行时验证只对 S3
- 阶段一交付物含 `tests/frames.json` 与测试脚本，原总纲目录结构中无 `tests/`，已补入
- 阶段一 `firmware/WIRING.md` 讲引脚接线，阶段二控制台文档区讲电脑连接与故障排查，两者不重复

## 12. 工作笔记（你和我共同维护）

### 常用命令

```bash
# 零依赖的那几条（不需要装任何东西、不需要起服务）
node tests/run.js                 # 协议一致性，全部 22 个场景 / 213 项
node tests/run.js -v              # 额外打印每步收到的帧
node tests/run.js --scenario=11   # 只跑名字含 "11" 的场景
node tests/sdk_smoke.js           # SDK 接虚拟设备真跑一遍（23 项）
node tests/agents_guide.js        # 照着 sdk/AGENTS.md 抄一遍能不能跑（12 项）
node tests/demo_smoke.mjs         # Demo 端到端，自带静态服务器（26 项）

# 控制台（阶段四已按 design/ 重做）
cd console
npm install
npm run dev                       # http://localhost:5173
npm run build                     # 类型检查 + 打包 → dist/（纯静态，含 demo/ sdk/ landing/ design/）
npm run dev                       # 另开一个终端，冒烟要先有 dev server
node scripts/smoke.mjs            # 控制台端到端（90 项，零依赖，无头 Edge + DevTools 协议）

# 编译固件（本机没有 g++/clang，C++ 只能靠这条）
# 路径是作者本机的，你按自己的环境改（arduino-cli 装在哪就用哪）
CLI=/c/Users/msa/.argx-tools/arduino-cli.exe
$CLI compile -b esp32:esp32:esp32s3 firmware/argx_mvp    # 目标板 S3
$CLI compile -b esp32:esp32:esp32   firmware/argx_mvp    # 老款 WROOM-32E
```

首页（`landing/`）**零构建**：双击 `landing/index.html` 就能看，
或经控制台的 dev server 访问 `http://localhost:5173/landing/`。

控制台的分区可以直接用 hash 打开。**只有一套界面，hash 空间就是这七个：**

```
#onboarding  #library  #device  #simulator  #docs  #debug  #play:<workId>
```

> ⚠️ 旧的两套 hash 空间（小白版的 `#home` `#help`、专业版的 `#overview` `#works`
> `#timeline` `#creator`）**已作废**。它们会**被重定向到最接近的新栏目并改写地址栏**，
> 不留死链。映射表见 `console/src/routes.ts` 的 `OLD_HASH_MAP`：
>
> `#overview` `#devices` → `#device` ｜ `#home` `#help` → `#onboarding`
> ｜ `#works` `#creator` → `#library` ｜ `#timeline` → `#debug`
>
> `scripts/smoke-basic.mjs` 与旧的 `scripts/smoke.mjs` 已在阶段四**删除并重写**成一个。

`arduino-cli.exe` 故意放在仓库外（`C:\Users\msa\.argx-tools\`），不要提交进仓库。
（`C:\Users\msa\` 是作者的机器路径，不是仓库的一部分——你按自己的环境改。）
esp32 core 3.3.11 已装好，不需要再 `core install`。

### 目录职责约定

| 目录 | 职责 | 谁依赖它 |
|---|---|---|
| `protocol/` | 协议规范，**唯一权威**。两端实现都从它派生 | 全部 |
| `firmware/argx_mvp/` | Arduino 草稿目录。会话层 + 能力层 + 入口 | — |
| `device/` | 虚拟设备，协议的第二实现，也是控制台模拟器的底座 | 控制台 |
| `tests/` | 标准帧序列 + 跑它的命令行脚本 | 全部 |
| `console/` | 中枢控制台（Vite + React + TS）。模拟器**直接引用** `device/virtual_device.js`，不复制不重写 | 唯一一套界面 |
| `design/` | **界面设计真源**。`prototype/*.html` 是最终视觉答案；六份设计文档解释每个决定；`tokens.css` 是共享的设计变量 | 全部界面 |
| `landing/` | 官网首页。**零构建**（原生 HTML/CSS/JS），独立于控制台，不做数据、不做路由 | — |
| `sdk/` | 网页 SDK，零依赖纯原生 JS + `AGENTS.md`（给 AI 看的集成规范） | 全部第三方作品 |
| `demo/` | 示例作品。`script.json` 是剧本数据，控制台的 ARG 库也读同一份 | 控制台的播放器 |

控制台里几块的分工：

- `transports/`（通道，接口契约冻结）、`core/`（连接、会话、流）
- `core/device.ts` —— **全站唯一调用 ARGX API 的模块**，
  也是唯一调 `ARGX.state()` 的地方（原因见文件头注释，两条都是踩出来的）
- `ui/`（可复用组件）、`sections/`（六个栏目）、`data/`（文档与剧本数据）
- `works.ts`（作品数据）、`routes.ts`（hash 空间与旧 hash 映射）

> ⚠️ 旧的 `panels/`（专业版面板）、`simulator/`（旧模拟器 UI）、
> `views/pro/`（专业版外壳）、`views/basic/`（小白版）、`core/connection.ts`、
> `core/store.ts`、`core/basicDevice.ts` **都已在阶段四删除**。
> 现在只有一套界面、一条连接。

改协议的顺序永远是：先改 `protocol/`，再改 `firmware/` 与 `device/`，最后补 `tests/`。

**改界面的顺序是**：先看 `design/prototype/*.html`，再看 `design/` 里对应的文档，
最后才动 `console/` 或 `landing/` 的代码。**不要凭记忆写样式。**

**SDK 与 Demo 的位置关系**：`demo/index.html` 只加载 `../sdk/argx.js`，
`console/vite.config.ts` 里那个插件负责让 dev server 与构建产物都能拿到这两个目录
（`/demo/*` 与 `/sdk/*`）。所以这两个目录任何时候都不能往 `console/` 里复制一份。

### 已知坑

1. **Arduino 草稿目录名必须与 `.ino` 同名**，所以入口在 `firmware/argx_mvp/`，
   不是任务书里写的 `firmware/argx_mvp.ino` 扁平布局——扁平布局 IDE 直接打不开。
2. **引脚别用 GPIO5/6/7**：5 是经典 ESP32 的 strapping 脚，6/7 在那块板上接内部
   flash，接负载直接起不来。现在用的是 4 / 18 / 17 / 16，两端板子都安全。
3. **S3-DevKitC-1 有两个 USB 口**。用原生 `USB` 口时必须在 IDE 里开
   `USB CDC On Boot = Enabled`，否则串口是哑的。见 `firmware/WIRING.md`。
4. **GitHub 现在可达了**（2026-09-13 实测）：`gh auth login --web` 设备码流程走通，
   `gh` 已登录为 `ZhengTFB`。但 **`winget` 默认的 `msstore` 源仍然不可达**
   （报 `12029` / `0x80072efd`），装工具一律加 `--source winget`。
   `downloads.arduino.cc` 与 `espressif.github.io` 也可达。
5. **没有主机端 C++ 编译器**（无 g++/clang/MSVC）。固件只有「能编译」这一层
   验证，逻辑正确性靠虚拟设备等价保护——所以两端的仲裁代码必须逐条对齐。
6. **git 会在 Windows 上把 LF 转 CRLF**（提交时刷 warning）。协议帧定界用的是
   `\n`，代码里已按 `\r` 可容忍处理，不用管这些 warning。
7. **虚拟设备的 `send()`**：传对象自动补 `\n`（发一帧）；传字符串原样灌入不补
   （测垃圾串扰与半行分片）。测试里发垃圾行要自己带 `\n`，否则会粘到下一帧上。
   **传输层调用它时必须自己补换行**（`console/src/transports/mock.ts` 里就有这一行，
   漏了整个链路会静默失效：界面正常、帧也发出去了，装置什么都不做）。
8. **虚拟设备是 UMD，没有 ESM 导出**。控制台用副作用导入 + `globalThis` 桥接它
   （`console/src/core/virtualDevice.ts`），导入路径故意不写 `.js` 后缀，
   这样 TS 会认旁边的 `device/virtual_device.d.ts`。别再给它加 ESM 导出，
   那会动到阶段一已验收的产物。
9. **控制台的 node_modules 与 dist 已进 .gitignore**，别用 `git add -A` 一把梭。
10. **模拟器的可视化数据全部来自 `device.getState()`**，界面上不另算协议状态。
    改协议时只要那份文件的 state 形状对，界面就跟着对。
11. **SDK 是单例**（一个页面一个 `ARGX`）。控制台只用一个会话，所以够用；
    将来要在一个页面里同时接两台装置，得先给它加一个实例化入口。
12. **同一条通道上挂了两个会话**：控制台自己的 SDK 会话，和 iframe 里 Demo 的。
    所以 `sdkTransports.ts` 里的 `connect()` 必须幂等——串口的 connect 是
    `requestPort()`，第二次调用既会二次弹窗、又不在用户的点击调用栈里，浏览器直接拒。
13. **Demo 的 iframe 顺序不能反**：先把通道挂到 `window.ARGX_HOST_TRANSPORT`，
    再给 iframe 设 `src`。反过来的话作品会先按"没有宿主通道"初始化（自己找串口）。
14. **`demo/` 的剧本节点 cue 是"进入这一幕时触发"**。
    所以 cue 要挂在本节点，不要挂在上一节点——`reveal` 那种"做成了什么"的 cue
    挂在密码那一幕，会变成一进这一幕灯就闪、玩家还没输密码。
15. **自检那四个绿勾必须是"回查到了"才亮**（`ARGX.state()` 有应答）。
    绝不能改成"我们发过了所以算通过"——装置拔了线那样也会全绿，自检就白做了。
16. **dev server 端口被占时 Vite 会自己换一个**（5173 被占就用 5174），
    而 `smoke.mjs` 默认打 5173。跑冒烟前先确认端口，别对着一个空端口跑。
    **而且只 `pkill vite` 常常杀不掉**——旧进程还占着 5173，新进程悄悄换到 5174，
    你以为刷新了其实看的还是旧页面。用 `netstat -ano | grep ":5173 "` 找 PID 再 `taskkill //F //PID`。

17. **组件类名和 Tailwind 工具类共用一个命名空间**。组件里出现过的类名，
    Tailwind 会当成候选去生成工具类 —— `.ring` 就撞上了 Tailwind 的 `ring-1`，
    结果灯光那个渐变环外面凭空多了一圈黑边，而且看不出是谁画的。
    已经撞过一次并改名：`.ring` → `.light-ring`。加新类名之前先确认它不是 Tailwind 的工具类。

18. **旧 hash 改写必须发生在「读到 hash 的那一刻」**，不能放进 `useEffect` 靠 route 变化触发。
    `#overview` 和 `#devices` 都映射到 `#device`，第二次进来时 rewrite 的字符串和上次一样，
    依赖没变 effect 就不会再跑，地址栏停在旧值上。见 `App.tsx` 的 `syncHash()`。

19. **短效果会整个落进 800ms 轮询的空隙里**。振动 dur 300ms、短鸣 500ms，
    而右栏靠 `query` 回查、800ms 一次 —— 等下一拍再查，效果早结束了，
    右栏从头到尾都不会显示过。所以 `device.cue/batch/fire/reset` **发完立刻回查一次**。
    这不是本地记账（那仍然禁止），走的是同一条 query → state 链路，只是把时机提前。

20. **只在连接那一刻生效的故障，拨开关必须重连才看得见**（不发 ready / 延迟应答 / 中途断连）：
    它们要么在 `connect()` 里排定时器，要么在握手时生效。所以 `setFault` 带一个 `restart` 参数，
    拨到这一类会自动重连一次 —— 不这样的话，就只能靠一行小字说「重连后生效」，而没人会去重连。

21. **`MockTransport` 不能复用实例**。`VirtualDevice.close()` 不清 `_lineListeners`，
    而 `MockTransport.connect()` 每次都重新注册 —— 复用 + 重连 N 次 = 每帧被投递 N 次、
    还留着 N 个僵尸会话。所以每次 attach 新建一个，**故障开关作为控制台自己的状态**
    保存下来、在 attach 时重新 `setFaults` 施加。

22. **`ARGX.mode()` 分不出模拟器和真机**：只要往 `ARGX.init` 传的是 Transport 对象，
    它一律包成 `HostTransport`，`mode()` 恒为 `'host'`。传输类型必须由控制台自己记。

23. **`ARGX.state()` 的应答是先进先出配对的，不看 `seq`**（`_pendingState.shift()`）。
    两个调用者同时查，第二个的应答会解到第一个头上。所以全站**只有一个调用点**
    （`core/device.ts` 里的轮询器），别处一律走 `queryNow()` —— 它挂在下一个完成的查询上，
    保证任何时刻只有一个 state 请求在飞。

24. **`ARGX.on` 每个事件类型只能注册一次，退订必须用精确 token**：
    不带处理器的 `off(type)` 会清空整张处理器表，两个组件各订阅一次再各自退订就会互相抹掉。
    所以事件接线只在 `core/device.ts` 的模块初始化里做一次，组件一律不 import `core/sdk`。

### 决策记录

（详细理由见 `docs/PROGRESS.md` 的决策记录，这里只留长期有效的结论）

- 引脚定 4 / 18 / 17 / 16，理由是双目标板都避开 strapping 与 flash 引脚
- 能力回调被反复调用（渐变逐帧喂 level），不是只在收到 cue 时调一次
- `caps` 由注册表遍历生成，任何地方不得手写第二份能力清单
- 所有被正常处理的 cue 都回 ack，用 `r` 字段区分 applied/preempted/dup/dropped
- `dur` 缺省 = 30000（即 TTL 上限），防止缺省效果永久占用输出
- 连点去重纳入参数比较，否则氛围播放中途调不了亮度
- `batch` 的原子性拆两半：校验原子（任一不合法整批拒绝），执行各自仲裁
- `hold` 不绕过看门狗：放开的是 30 秒 TTL，不是安全兜底
- 控制台的会话层不依赖框架，阶段三的 SDK 直接搬它，别写第三份
- 模拟器进来自动连虚拟装置；可视化用 rAF 读 getState()，不进全局 store

阶段三（SDK / Demo / 界面基础）：

- SDK 的会话层是 `console/src/core/session.ts` 的逐条翻译，不是新写一套；改一个必须改另一个
- SDK 的传输层收**对象**、自己序列化与定界（补换行那类契约要能被漏掉，干脆让它不存在）
- 作者只写事件名（`ARGX.fire('reveal')`），不写能力 id 和参数；优先级在词表里配好
- `fire()` 按装置的能力声明过滤再发——不过滤的话 `batch` 的校验原子性会把整条事件丢掉
- 没装置、连不上、`file://`：一律静默降级，cue 打到 console，绝不抛错也绝不弹窗
- 装置只负责演，剧情判定一行都不许依赖它（AGENTS.md 第 4 节，这是硬性要求）
- ~~小白控制台整个建在 SDK 上，SDK 的第一个用户就是自己~~
  → ⚠️ 小白版已删。**新界面仍然建在 SDK / `core/` 之上**，这条的意图保留
- ~~小白版与专业版是两条独立连接，各连各的装置，互不干扰~~
  → ❌ 作废。只有一套界面、一条连接
- 作品播放器嵌真页面（iframe + 宿主通道），不在 React 里重写一份剧情界面
- 四路状态全部来自 `ARGX.state()` 回查，**界面不本地记账**（这条阶段四依然必须遵守）
- ~~专业版一行没改：只把 `App.tsx` 主体整体搬成 `views/pro/ProApp.tsx`~~
  → ❌ 作废。`views/pro/` 已删

阶段四（界面重做）：

- **界面视觉以 `design/` 为准**，`design/prototype/*.html` 是最终答案；不要凭记忆写样式
- **界面功能以底层代码为准**（`protocol/` `firmware/` `device/` `sdk/` `console/src/core/`），
  不从旧界面推
- 所有间距 / 圆角 / 字号 / 色值走 token，**禁止魔法值**
- 禁止多色相彩色渐变；只允许同色相明度渐变与中性透明渐变
- 动效只动 `transform` / `opacity` / `filter` / 颜色 / `box-shadow` / `clip-path`
- 连续量（灯/声/振动）与开关量（继电器）**在视觉形态与切换动效上必须区分**
- `core/session.ts` 的行为、`transports/` 的契约、`device/virtual_device.js` 一个字不改

阶段四（界面重做）执行时定下的：

- 全站**只有一条连接**，就是 SDK 那条；`core/connection.ts` 与 `core/store.ts` 已删除，
  有用的内容（帧日志 / 心跳延迟序列 / 回执与错误计数）搬进 `core/device.ts` + `core/streams.ts`
- **`core/device.ts` 是全站唯一调用 ARGX API 的模块**，也是唯一调 `ARGX.state()` 的地方
- 界面样式**全部走 `design/tokens.css`**（`design/` 下唯一一个代码文件），
  只有一份 token 结构、两套主题值；首页/控制台 dev/dist/双击 file:// 四种打开方式共用它
- 组件样式是**普通 CSS**（镜像原型写法），Tailwind 只承担 preflight 与 token 映射
- **缩到 1425px 可视宽（1440 窗口）是设计基准**，断点不能定在 1439，
  否则基准宽度下会少排一列、还把文档的「本页目录」藏掉
- 不引 Google Fonts CDN，走 token 里的字体栈（离线与 file:// 都要能用）
- 故障注入面板在模拟器页与调试页**共用同一个组件**（任务书两处都要求有它）
- 「全部触发」走一条 `batch`（`fire()` 的词表里没有 `env.relay`，逐条发也做不到同时）
- 引导页的步骤 2/3 与原型不同：Web Serial 没有端口枚举，改成「选装置 → 点连接 → 在系统弹窗里选端口」
- 设备页的四张 KPI 换成真实数据（设备 ID / 传输通道 / 心跳延迟 / 在线时长）；
  原型的「固件版本」「供电电压」「可用设备列表」在协议里没有出处，不做

阶段五（开源发布与仓库拆分）：

- 拆**两个**仓库：`argx`（核心）+ `argx-esp32`（ESP32 适配器）。**不用 submodule**，
  相互依赖的文件两边各放一份
- **先单仓跑通 Pages 部署，再拆仓**——拆仓会动目录结构，先部署能避免同时调两个变量
- Pages 是 HTTPS，所以 **Web Serial 可用**；但连的是**访问者自己电脑的 USB 口**
- 仲裁逻辑在固件与虚拟设备里各有一份实现，拆仓后必须加**互指注释**防漂移
- 两份 README：主仓走基础设施风（`vite` 那类），硬件仓走硬件项目风（`qmk` 那类）
- 完全开源，默认 MIT
