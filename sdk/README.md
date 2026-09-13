# ARGX 网页 SDK

让网页作品操控现实物件：网页翻到某一段，玩家房间里的灯就暗下去。

给写 ARG 的人用，不涉及硬件、额外依赖与构建工具。

- 零依赖、纯原生 JS，`<script src="argx.js">` 直接可用
- 整个文件几百行，可以整段复制进你的单文件 HTML 项目
- 没有装置、连接失败、用 `file://` 打开时，所有调用都**静默成功**：不报错、不弹窗、不挡剧情

> 你要是正让 AI 帮你写作品，把 `AGENTS.md` 一起交给它。那份是写给 AI 看的，效果比这份好。
>
> 要给**整个作品**做一次接入（挑埋点、选模式、自检、交付），用
> [`argx-skill`](https://github.com/ZhengTFB/argx-skill)：自包含的技能包，含五步流程与十项检验清单。

---

## 三步接上

```html
<script src="argx.js"></script>
<script>
  ARGX.init();                  // 1. 初始化（不传参数最省事）
  ARGX.fire('reveal');          // 2. 剧情到了就触发一个事件
  ARGX.on('input', (id, f) => { // 3. 想响应物理开关就监听（可选）
    console.log('装置上的输入：', id, f.e);
  });
</script>
```

没接装置也能这么写：`fire` 会把该发的东西打印到浏览器 console 里，
你能看见埋点是不是在对的地方、对的时机触发。

**想在真装置上跑**，把连接放到一个按钮上：

```html
<button onclick="ARGX.connect()">连接装置</button>
```

浏览器规定首次连接必须由用户的真实点击触发，所以这一步必须交给用户按一下。

## 事件词表

`fire()` 用的是**事件名**，不是硬件名字。你不需要知道哪路灯该配多大亮度：

| 事件 | 什么时候用 |
|---|---|
| `calm` | 平静。灯光慢慢亮回来一点 |
| `tension` | 紧张。灯光压暗 |
| `reveal` | 揭示。灯猛地一亮 + 一声短响 |
| `danger` | 危险。灯急闪 + 蜂鸣 + 振动 |
| `relief` | 松一口气。灯光柔和回暖 |
| `ending` | 终局。灯常亮不灭 |

优先级是配好的，你不用管。装置没有的能力**会被自动跳过**——
一台只接了灯的装置照样能演 `danger`，只是没有声音和振动，不会整条事件被丢掉。

想加自己的事件：

```js
ARGX.defineEvent('act2.ritual_start', [
  { id: 'light.main', p: { i: 0.3, ramp: 3000, pri: 3 } }
]);
```

## 要更细的控制

```js
// 直接点名某个能力，参数照协议来
ARGX.cue('light.main', { i: 0.8, ramp: 2000, dur: 5000 });

// 几个能力同时动（灯和声音必须是同时，不能有先后）
ARGX.batch([
  { id: 'light.main', p: { i: 1, pri: 1 } },
  { id: 'sound.beeper', p: { i: 1, dur: 400, pri: 1 } }
]);

ARGX.reset();                  // 全部熄灭，回到待机
const st = await ARGX.state(); // 问装置"你现在的输出是多少"，没人应答给 null
```

参数说明（完整版见 `protocol/PROTOCOL.md`）：

| 参数 | 含义 |
|---|---|
| `i` | 强度 0~1。亮度、音量都用它 |
| `dur` | 持续多少毫秒（缺省 30 秒，上限也是 30 秒） |
| `ramp` | 渐变多少毫秒 |
| `pri` | 优先级 0~3，数字越小越强势。**用 `fire()` 的话不需要关心这个** |
| `hold` | `true` = 常驻，直到被抢占或 `reset()` |

**只发语义，不发引脚电平。** `light.main` 是"灯"，不是"GPIO4 拉高"——
哪个引脚上挂了什么东西由装置端决定，你的作品换一台装置不用改。

## 三种运行方式

| 方式 | 什么时候是这种 |
|---|---|
| 真实装置 | 页面上有"连接装置"按钮，用户点了，插着 USB |
| 模拟模式 | 没插装置、浏览器不支持串口、或者根本没连。cue 打到 console |
| 宿主通道 | 作品被别的页面嵌着跑时，宿主把现成的通道交给你（见下） |

不指定就自动选：能连真装置就真装置，连不了就模拟模式。

想写死某一种：`ARGX.init({ transport: 'serial' })` / `ARGX.init({ transport: 'mock' })`。

### 被宿主页面嵌着跑

作品挂在别人的页面里（例如 ARGX 控制台）时，宿主可以把已经连好的通道直接交给你，
你的作品就不用自己再连一次：

```js
// 宿主那边：
window.ARGX_HOST_TRANSPORT = myTransport;   // 实现 connect/send/onMessage/onClose/close

// 作品里什么都不用改，照常 ARGX.init()
```

## 三个环境限制

**1. 用 `file://` 双击打开：串口用不了。**
浏览器在 `file://` 下直接禁掉串口。这不是 bug，检测到了会给你一句能照做的话：

```js
if (ARGX.hint()) { /* 显示在页面角落，里面写着该执行什么命令 */ }
```

`ARGX.hint()` 返回空串表示环境没问题。建议把它显示出来——
只说"不支持"没用，得告诉人下一步做什么。

**2. 手机不行。** Web Serial 只有桌面版 Chrome / Edge 有。手机玩家能看剧情，但装置不会动。

**3. 页面必须是 `https://` 或 `http://localhost`。** 局域网 IP 也不行，浏览器会当不安全上下文。

本地调试最省事的两条命令：

```bash
npx serve            # 然后访问它给的 http://localhost:xxxx
python -m http.server 8000
```

## 硬件不是判定源

**剧情判定不要交给装置。** 没接装置的玩家必须能完整通关，装置只负责把效果演出来。

```js
// 对：不管有没有装置，剧情都往下走
门开了();
ARGX.fire('reveal');
```

错的做法是等装置的回应再决定剧情；装置没接，玩家就卡在那里了。

## 完整 API

| 方法 | 参数 | 返回 | 说明 |
|---|---|---|---|
| `init(opts?)` | `opts.transport`：`'serial'` / `'mock'` / 宿主通道对象，缺省自动选<br>`opts.quiet`：静默<br>`opts.keep`：只改配置、不重连 | `ARGX` | 建立会话。重复调用不会连出第二条链路；初始化失败也静默 |
| `connect()` | — | `Promise<boolean>` | 真正打开串口。**必须放在用户点击的回调里** |
| `close()` | — | `Promise` | 断开 |
| `fire(name)` | 事件名，取自词表 | `boolean` | 触发一个事件。按装置能力过滤后再发；多条 cue 合并成一个 `batch` |
| `cue(id, p?)` | 能力 id + 参数对象 | `boolean` | 直接点名一路能力，精确控制参数时用 |
| `batch(cues)` | `[{ id, p }]` | `boolean` | 一帧同时触发多路，最多 8 条 |
| `reset()` | — | `undefined` | 全部熄灭、回到待机 |
| `defineEvent(name, cues, meta?)` | — | `boolean` | 定义一个自己的事件 |
| `state(opts?)` | `opts.timeout` 毫秒，缺省 900 | `Promise<{dev, uptime, out, in} \| null>` | 问装置此刻的输出。没人应答给 `null`，**永远不 reject** |
| `status()` | — | `'disconnected' \| 'connecting' \| 'ready' \| 'active' \| 'stale' \| 'lost' \| 'mock'` | 会话状态 |
| `mode()` | — | `'serial' \| 'mock' \| 'host'` | 传输种类 |
| `caps()` | — | `{ out: string[], in: string[] } \| null` | 装置声明了哪些能力，未握手时是 `null` |
| `device()` | — | `string \| null` | 装置的名字，形如 `ARGX-0001` |
| `events()` | — | 对象 | 全部可用事件（内置 + 自定义） |
| `hint()` | — | `string` | 环境提示。空串表示没问题，非空时要显示在页面上 |
| `on(type, fn)` | 见下表 | `ARGX` | 注册处理器 |
| `off(type, fn)` | **必须传精确的 `fn`** | `ARGX` | 退订。不传处理器会清空该类型的整张处理器表 |
| `version` | — | `string` | 属性，不是方法 |

可监听的类型与回调参数：

| `type` | 回调参数 |
|---|---|
| `ready` | `(caps, dev)` |
| `ack` | `({ seq, r, res })` |
| `state` | `(frame)` |
| `input` | `(id, frame)` |
| `err` | `(frame)` |
| `status` / `lost` | — |
| `fire` | `(name, cues)` |
| `frame` | `(msg, dir)` |
| `pong` | `(ms)` |

`on('ack', ...)` 只用来记日志或改表现，**不要用它推进剧情**——没买装置的玩家收不到 ack。

完整协议在 `protocol/PROTOCOL.md`。要接自定义硬件（自己做的装置、新能力），
看 `firmware/` 和那份协议，加一个能力注册就行，SDK 与协议都不用改。
