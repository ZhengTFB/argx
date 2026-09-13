# ARGX 控制台

ARGX 的中枢：连接管理、设备测试、能力查看、作品目录、文档查阅、协议调试，
内置一个**虚拟装置模拟器**——没有 ESP32 的人点进去就能看完整套东西怎么运作。

技术栈：Vite + React + TypeScript。界面视觉以 `../design/` 为唯一真源
（`design/prototype/console.html` 是最终答案）。构建产物是**纯静态文件**，没有服务端依赖。

---

## 一、本地启动

```bash
cd console
npm install
npm run dev
```

然后在浏览器打开 **http://localhost:5173**（Vite 会自动打印实际地址）。

打开后应该看到：左边 56px 图标栏、顶部六个栏目胶囊 tab、右边 76px 常驻状态栏。
默认停在「引导」。

> **必须用 `localhost` 或 `https://` 打开。** 用局域网 IP（`192.168.x.x:5173`）打开时
> 浏览器会直接拿掉 Web Serial，串口功能整个消失——这不是 bug，是浏览器的安全要求。
> 模拟器不依赖串口，用局域网 IP 给别人演示模拟器仍然正常。

### 想直接看效果

| 地址 | 你会看到 |
|---|---|
| `#onboarding` | 引导：两条路径（新手连通 / 开发者接入） |
| `#library` | ARG 库：作品目录 |
| `#device` | 设备：连接、四路自检、能力列表、心跳折线 |
| `#simulator` | 模拟器（**进来自动连虚拟装置**，四路可触发，含故障注入） |
| `#docs` | 文档：快速开始 / 连接方法 / 指令表 / 错误码 / 故障排查 |
| `#debug` | 调试：收发时间线、手动发 cue、故障注入、input 注入 |
| `#play:work-study` | 站内播放页：把 `demo/` 那个真页面嵌进来跑 |

栏目写进地址栏的 hash，可以直接把链接发给别人。
旧的两套 hash（`#overview` `#home` `#timeline` `#creator` 等）会被**重定向到最近的新栏目
并改写地址栏**，不留死链——映射表在 `src/routes.ts`。

### 首页

`../landing/` 是**零构建**的官网首页（原生 HTML/CSS/JS）。dev server 也把它映射进来了：

```
http://localhost:5173/landing/
```

---

## 二、构建与部署

```bash
npm run build      # 先 tsc 类型检查，再打包 → dist/
npm run preview    # 本地预览构建产物（默认 http://localhost:4173）
```

`dist/` 里就是全部产物，**直接上传到任意静态服务器**即可：

```
dist/
├── index.html          控制台
├── assets/             打包后的 css / js
├── landing/            官网首页（连同它的 tokens 依赖一起）
├── demo/               示例作品（播放页 iframe 指的就是它）
├── sdk/                零依赖网页 SDK
└── design/             设计真源（tokens.css + 原型 + 六份设计文档）
```

四条已经处理好的事：

- `vite.config.ts` 里设了 `base: './'`，所有资源都是相对路径，
  **放在子目录（如 `https://example.com/argx/`）也能直接用**，不需要改配置
- `demo/` `sdk/` `landing/` `design/` 由 `vite.config.ts` 的插件从仓库根映射进来
  （dev 用中间件、build 拷进 dist），**不是复制一份进 `console/`** ——
  复制正是这个项目一直在避免的事
- `design/` 整个一起发布是有意的：token 是运行时依赖，原型与设计文档顺带也有了，
  部署出去之后对着同一个地址就能翻设计
- 没有服务端依赖，不需要 Node 运行时

部署后要用**串口**功能的话，站点必须是 HTTPS（静态服务器一般自带证书）。
只用模拟器的话 HTTP 也行。

### 可选：端到端冒烟测试

```bash
npm run dev                     # 先起服务（另一个终端）
node scripts/smoke.mjs          # 用无头浏览器真的点一遍，90 项检查
```

它会自己找一个本机的 Chrome/Edge 跑无头模式，零依赖（Node 自带的 fetch 与 WebSocket
直连 DevTools 协议，不装 puppeteer）。断言的都是**类型检查证明不了的事**：

- 六个栏目都渲染得出来、顶部 tab 高亮跟着走
- 右栏恰好 4 槽位，而且是 **3 个电平轨道 + 1 个两态灯块**（连续量 / 开关量的区分是硬要求）
- 模拟器触发一路之后，**右栏的数字真的变了**（证明两处读的是同一条链路）
- 六个故障开关逐个拨动都不把界面搞崩
- 掉线会弹通知，四路回退到待机（证明状态是回查来的，不是本地记账）
- 旧 hash 不只是跳到合理位置，**地址栏也被改写**
- 八种控件聚焦时都有可见的 focus 环（真的 focus 一次再读计算样式）
- 官网首页：开场层内容、首访/非首访两条路径、背景四层、无 canvas
- 1440 / 1100 / 900 三档宽度都不出横向滚动条

> 端口注意：dev server 端口被占时 Vite 会自己换一个（5173 就用 5174），
> 而冒烟默认打 5173。跑之前确认端口，别对着一个空端口跑出一片假绿。

---

## 三、目录结构

```
console/
├── src/
│   ├── transports/       传输层：统一接口 + mock / serial 两个实现（**接口契约冻结**）
│   │   ├── types.ts      connect / send / onMessage / close
│   │   ├── mock.ts       连 ../device/virtual_device.js（同一份文件，不复制）
│   │   └── serial.ts     Web Serial 连真实 ESP32
│   ├── core/             与界面无关的逻辑
│   │   ├── session.ts    网页端会话层（握手、心跳、掉线判定、seq）—— 行为冻结
│   │   ├── device.ts     ★ 唯一那条连接。全站唯一调用 ARGX API 的模块，
│   │   │                   也是唯一调 ARGX.state() 的地方
│   │   ├── streams.ts    高频流：帧日志 / 心跳延迟 / 回执 / 错误计数（合并到 ~8 次/秒）
│   │   ├── channels.ts   四路输出的界面词汇表（连续量 vs 开关量、参数、状态词）
│   │   ├── selfCheck.ts  四路连接测试
│   │   ├── cue.ts        cue 参数的统一形状
│   │   ├── capabilities.ts 能力的中文名 / 引脚 / 需要买什么
│   │   ├── sdk.ts        ../sdk/argx.js 的接入点（**只给 device.ts 用**）
│   │   ├── sdkTransports.ts 文本 ↔ 对象的翻译层
│   │   └── virtualDevice.ts 接入 ../device/virtual_device.js 的桥
│   ├── ui/               可复用组件（按钮、胶囊、通道卡、右栏、故障面板…）
│   ├── sections/         六个栏目 + 播放页
│   ├── data/             文档正文、剧本数据
│   ├── routes.ts         hash 空间与旧 hash 映射
│   └── works.ts          ARG 作品数据（扩展位）
├── scripts/
│   ├── smoke.mjs         端到端冒烟测试
│   └── lib/browser.mjs   无头浏览器 + DevTools 协议的最小封装
├── src/styles/           组件样式（普通 CSS，值全部走 token）
└── vite.config.ts
```

**加一个新作品**：只改 `src/works.ts`，加一条数据。列表是数据驱动的，不用动任何组件。
`link` 的三种形态决定了它的去向：

```ts
link: '#play:work-study'                  // 自家 demo → 站内播放页
link: 'https://example.com/my-arg'        // 第三方项目 → 新标签打开作者自己的站
link: undefined                           // 还没上线 → 只展示，按钮禁用
```

**加一页文档**：只改 `src/data/docs.ts`，加一条数据。

**加一种传输方式**（蓝牙之类）：在 `src/transports/` 里加一个实现，
别的地方一行都不用改——上层只认 `Transport` 接口。

---

## 四、这个控制台不做什么

- **不实现协议逻辑**。设备端行为全部来自 `../device/virtual_device.js`（阶段一的同一份文件），
  模拟器只是把它画出来。改协议时先改 `../protocol/PROTOCOL.md`，再改那份文件。
- **不是作品托管平台**。第三方作品永远跑在作者自己的站上，这里只存一个网址。
  所以没有、也不该有「提交作品」这类界面。
- **不发明底层没有的能力**。界面上每一项都要能在 `protocol/` `firmware/` `device/` `sdk/`
  里找到出处——找不到就不做。原型里那些画了但底层没有的东西（固件版本、供电电压、
  端口扫描列表、裸帧发送、`cfg` 参数面板）都据此删掉了，`docs/PROGRESS.md` 有逐条记录。
- **不做界面上的本地记账**。右栏显示的是装置报回来的状态：装置拔了线，它就回到「待机」，
  而不是继续显示上一次的亮度。

---

## 五、常见问题

| 现象 | 原因与处理 |
|---|---|
| 页面空白，控制台报 `没能加载 device/virtual_device.js` | 仓库结构被挪动过。模拟器直接引用 `../device/virtual_device.js`，确认它在仓库根的 `device/` 下 |
| 页面空白，报 `没能加载 sdk/argx.js` | 同上，确认 `../sdk/argx.js` 在，且 `vite.config.ts` 的 `server.fs.allow` 覆盖到仓库根 |
| 点「连真实装置」没弹端口框 | 不是 localhost/https，或者浏览器不是桌面 Chrome/Edge；也可能这个按钮不在真实点击的调用栈里 |
| 连上了但界面一直「未连接」 | 看控制台「文档」栏目的故障排查 |
| 改了样式没生效 | 组件类名撞上 Tailwind 工具类了（见 `src/index.css` 顶部的说明） |
| 冒烟测试对着一片空白跑 | dev server 换了端口。先确认 5173 上到底是谁 |

更完整的排查（驱动、数据线、端口选择、两个 USB 口的区别）在控制台的**「文档」**栏目里。
