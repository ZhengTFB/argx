# ARGX 控制台

ARGX 的中枢：连接管理、设备测试、能力查看、作品浏览、文档查阅，内置一个**虚拟装置模拟器**——
没有 ESP32 的人点进去就能看完整套东西怎么运作。

技术栈：Vite + React + TypeScript + Tailwind CSS。构建产物是**纯静态文件**，没有服务端依赖。

---

## 一、本地启动

```bash
cd console
npm install
npm run dev
```

然后在浏览器打开 **http://localhost:5173**（Vite 会自动打印实际地址）。

打开后应该看到：左侧是七个导航分区，默认停在「总览」，右上角显示装置、传输方式与心跳延迟。

> **必须用 `localhost` 或 `https://` 打开。** 用局域网 IP（`192.168.x.x:5173`）打开时
> 浏览器会直接拿掉 Web Serial，串口功能整个消失——这不是 bug，是浏览器的安全要求。
> 模拟器不依赖串口，用局域网 IP 给别人演示模拟器仍然正常。

### 想直接看效果

| 地址 | 你会看到 |
|---|---|
| `http://localhost:5173/#simulator` | 模拟器（会自动连上虚拟装置） |
| `http://localhost:5173/#devices` | 设备面板：能力、手动测试台、连接测试 |
| `http://localhost:5173/#timeline` | 时间线：每一帧收发 |

分区会写进地址栏的 hash，所以可以直接把链接发给别人。

---

## 二、构建与部署

```bash
npm run build      # 先 tsc 类型检查，再打包 → dist/
npm run preview    # 本地预览构建产物（默认 http://localhost:4173）
```

`dist/` 里就是全部产物，**直接上传到任意静态服务器**即可：

```
dist/
├── index.html
└── assets/
    ├── index-xxxx.css
    └── index-xxxx.js
```

三条已经处理好的事：

- `vite.config.ts` 里设了 `base: './'`，所有资源都是相对路径，
  **放在子目录（如 `https://example.com/argx/`）也能直接用**，不需要改配置
- 代码里没有任何写死的域名或绝对路径
- 没有服务端依赖，不需要 Node 运行时

部署后要用**串口**功能的话，站点必须是 HTTPS（静态服务器一般自带证书）。
只用模拟器的话 HTTP 也行。

### 可选：端到端冒烟测试

```bash
npm run dev                     # 先起服务（另一个终端）
node scripts/smoke.mjs          # 用无头浏览器真的点一遍，21 项检查
```

它会自己找一个本机的 Chrome/Edge 跑无头模式，验证「点预设按钮 → 协议 → 虚拟装置 → 视觉反馈」
整条链真的通。零依赖，用 Node 自带的 fetch 与 WebSocket 直连 DevTools 协议。

---

## 三、目录结构

```
console/
├── src/
│   ├── transports/       传输层：统一接口 + mock / serial 两个实现
│   │   ├── types.ts      connect / send / onMessage / close
│   │   ├── mock.ts       连阶段一的虚拟装置（本阶段默认）
│   │   └── serial.ts     Web Serial 连真实 ESP32
│   ├── core/             与界面无关的逻辑，阶段三的 SDK 可以直接搬
│   │   ├── session.ts    网页端会话层（握手、心跳、掉线判定、seq）
│   │   ├── connection.ts 把会话层、传输层、全局状态粘起来
│   │   ├── store.ts      全局状态（连接状态 + 时间线）
│   │   ├── cue.ts        cue 参数的统一形状
│   │   ├── capabilities.ts 能力的中文名 / 引脚 / 需要买什么
│   │   └── virtualDevice.ts 接入阶段一虚拟设备的桥
│   ├── panels/           七个分区各一个文件
│   ├── simulator/        模拟器的三块：可视化、预设、故障注入
│   ├── ui/               共用展示件
│   └── works.ts          ARG 作品数据（扩展位）
├── scripts/smoke.mjs     端到端冒烟测试
└── vite.config.ts
```

**加一个新作品**：只改 `src/works.ts`，加一条数据。列表是数据驱动的，不用动任何组件。

**加一种传输方式**（WebSocket、蓝牙…）：在 `src/transports/` 里加一个实现，
别的地方一行都不用改——上层只认 `Transport` 接口。

---

## 四、这个控制台不做什么

- **不实现协议逻辑**。设备端行为全部来自 `../device/virtual_device.js`（阶段一的同一份文件），
  模拟器只是把它画出来。改协议时先改 `../protocol/PROTOCOL.md`，再改那份文件。
- **不含 SDK**。SDK 是阶段三的产物，必须零依赖纯原生 JS，能整段复制进第三方单文件 HTML。
  控制台可以用框架，两者是不同产物。
- **不做代码生成 / 作品编辑**。创作者平台本阶段只占位。

---

## 五、常见问题

| 现象 | 原因与处理 |
|---|---|
| 页面空白，控制台报 `没能加载 device/virtual_device.js` | 仓库结构被挪动过。模拟器直接引用 `../device/virtual_device.js`，确认它在仓库根的 `device/` 下 |
| 点「连接真实串口」没反应 | 不是 localhost/https，或者浏览器不是桌面 Chrome/Edge |
| 连上了但界面一直"未连接" | 看「文档」页的排查清单 |

更完整的排查（驱动、数据线、端口选择）在控制台的**「文档」**分区里。
