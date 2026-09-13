# ARGX 阶段进度

> 每次阶段收尾由 Claude 更新。新会话先读本文件，确定当前阶段再动手。

## 当前阶段

**阶段六：文档专业化与 AI-Skill** — 状态：**已完成，待审查**

七件全部做完，三个仓库都已推送，`argx` 的两个 workflow 全绿，
线上 <https://zhengtfb.github.io/argx/> 校验 0 个 404、0 个未捕获异常。

三个仓库：

| 仓库 | 地址 |
|---|---|
| 主仓 `argx` | <https://github.com/ZhengTFB/argx> |
| 硬件仓 `argx-esp32` | <https://github.com/ZhengTFB/argx-esp32> |
| **技能包 `argx-skill`（阶段六新建）** | <https://github.com/ZhengTFB/argx-skill> |

任务书：`docs/ARGX-06-文档与AI-Skill.md`

> 验收自检、去 AI 味对照表、决策记录全在下面「阶段六」几节。

---

**阶段五：开源发布与仓库拆分** — 状态：**已通过**（三个收尾项见下）

### 阶段五的三个收尾项（已完成）

1. **浏览器类检查进 CI**：`test.yml` 新增 `e2e` job —— `npm ci` → `npm run build`
   → `node tools/site.mjs --check`（跑 `dist`，阶段五那个白屏缺陷只有它看得见）
   → 起 dev server → `node console/scripts/smoke.mjs`（界面 90 项）。
   ubuntu runner 自带 `google-chrome`，`console/scripts/lib/browser.mjs` 的候选列表里已有它。
2. **对齐「灯亮 / 灯灭」**：`demo/script.json` 的 `pitch` 与 `console/src/works.ts` 的
   `summary` 都写「灯会自己**暗**下去」，而 `third` 的 cue 是 `{"event":"reveal"}`
   （灯猛地**一亮**）。改的是那两句摘要（`暗下去` → `猛地亮起来`），
   **`demo/` 的 cue 与正文一个字没动**。
3. **归档 `docs/阶段五汇报.md`** —— 已进版本库。

> 这个收尾项的起因是阶段四末尾那次「Demo 翻页」修订留下的已知不一致，
> 记录见本文件末尾「Demo 翻页修订」一节的「遗留（本次按你的选择没修）」。

已发布，两个仓库都 public：

| 仓库 | 地址 |
|---|---|
| 主仓 `argx` | <https://github.com/ZhengTFB/argx> |
| 硬件仓 `argx-esp32` | <https://github.com/ZhengTFB/argx-esp32> |

Pages（HTTPS，所以 Web Serial 可用）：

| 页面 | 地址 |
|---|---|
| 引导页 | <https://zhengtfb.github.io/argx/> |
| 控制台 | <https://zhengtfb.github.io/argx/console/> |

任务书：`docs/ARGX-05-开源发布.md`

> ⚠️ **本阶段发现并修复了一个阶段四遗留的严重缺陷**：`console/dist` 构建产物
> 在浏览器里**全站白屏**。详见下面「阶段五验收自检」里的说明。
>

## 阶段状态表

| 阶段 | 任务书 | 状态 |
|---|---|---|
| 一 | `docs/ARGX-01-协议与设备端.md` | 已通过（含审查后补的 `batch` / `hold`） |
| 二 | `docs/ARGX-02-控制台与模拟器.md` | 已通过（界面部分已在阶段四重做） |
| 三 | `docs/ARGX-03-Demo与SDK.md` | 已通过（产物无界面，全部有效） |
| 四 | `docs/ARGX-04-界面重做.md` | **已通过**（验收证据见下；但构建产物白屏是阶段四遗留，阶段五已修） |
| 五 | `docs/ARGX-05-开源发布.md` | **已通过**（三个收尾项已完成，见「当前阶段」一节） |
| 六 | `docs/ARGX-06-文档与AI-Skill.md` | **已完成，待审查**（七件全做完；验收证据见下） |

状态取值：未开始 / 进行中 / 待审查 / 已通过

> 阶段四**只删界面、只加界面**。协议、固件、虚拟设备、SDK、Demo、测试断言一个字没动——
> 证据是下面那四条回归全部保持原样通过（213 / 23 / 12 / 26）。
>
> **阶段四已通过审查（2026-09-13）**。四条 grep 结构证据全绿：
> `views/basic|views/pro|panels/|simulator/` 无残留；`.tsx` 里无真实 `ARGX` 调用；
> `ARGX.state(` 只有一处；`git status` 显示 `protocol/` `firmware/` `device/` `sdk/`
> 四个目录**零命中**（禁区守住）。

---

## 阶段六验收自检

### 7.1 硬闸门（原始输出）

```bash
$ node tests/run.js
22 个场景 / 213 项检查 → 通过 213，失败 0

$ node tests/sdk_smoke.js
全部通过：23 项通过，0 项失败

$ node tests/agents_guide.js
全部通过：12 项通过，0 项失败

$ node tests/demo_smoke.mjs
31 项检查 → 通过 31，失败 0

$ node tools/build-guide.mjs --check
✓ guide/ 10 页 / 4 组，生成物与 md 一致

$ cd console && npm run build
✓ 46 modules transformed；零类型错误

$ node scripts/smoke.mjs http://localhost:5173/
控制台冒烟测试 → 通过 97，失败 0（共 97 项）

$ node tools/site.mjs --check
Pages 站点校验 → 通过 18，失败 0（共 18 项）

$ node tools/site.mjs --check-live https://zhengtfb.github.io/argx
Pages 站点校验 → 通过 18，失败 0（共 18 项）
```

> `agents_guide.js` 那 12 项是这一阶段最关键的一条：它把 `sdk/AGENTS.md` 第 1 节的代码
> **原样抓出来执行**。改了 AGENTS.md 而它仍然全绿，说明那段代码逐字没动。
>
> 冒烟从 90 项涨到 97 项：新增的 7 项覆盖件六（四拍文案、价值三卡编号、仓库区三卡等大并列、
> 三张卡的地址、AI 接入入口 ≥3 处），另外两项是原来的开场断言从 3 词改成 4 拍。

### 7.2 文档验收

| 验收项 | 结果 | 证据 |
|---|---|---|
| `guide/` 下 10 页 md 全部存在，frontmatter 完整 | ✅ | `_meta.json` 4 组；10 页各自的 slug/group/nav/title/lead/order 齐全，生成器缺一个字段就报错 |
| 10 页**标题**全部专业化 | ✅ | 见下面「件一：新旧标题对照表」，10 页逐条 |
| **去 AI 味**：三条扫描命令的原始输出已附上 | ✅ | 见「件二」一节的扫描输出（①命中 1 处已改、②破折号每页 ≤1、③两处命中都在表格里） |
| **去 AI 味**：三个「读一遍」测试做了，并说明删了什么 | ✅ | 见「件二」最后一节 |
| **去 AI 味**：提供了「改动前后对照表」 | ✅ | 见「件二」，逐处写位置 / 原文 / 改后 / 删掉的病征 |
| **技术信息零丢失** | ✅ | 见「件二：怎么核对零丢失」——数字与标识符集合比对，**「旧有新无」= 无** |
| **不是整篇重写** | ✅ | 九页共改 51 处句子，逐处列在对照表里；正文其余部分逐字未动（md 是从旧 `docs.ts` 逐段搬运后定点改的） |
| `docs.ts` 已删除，正文唯一来源是 `guide/` | ✅ | `git rm console/src/data/docs.ts`；现在只有 `docs.types.ts`（手写）与 `docs.generated.ts`（生成物） |
| `tools/build-guide.mjs` 零依赖 | ✅ | `grep -c "from '"` 命中 3 行：2 行是 `node:fs` / `node:path` 内置模块，第 3 行是生成器**输出的字符串**（生成物自己的 import 行），第三方依赖 **0** |
| `--check` 在 CI 里 | ✅ | `test.yml` 的 console job 加了「文档生成物与 guide/*.md 一致」一步 |
| 生成物头部有「勿手改」注释 | ✅ | `docs.generated.ts` 头两行 |
| 两页 README 重心已对 | ✅ | 主仓讲协议与实现思路（十一节，第 4 节「协议速览」最厚）；硬件仓讲安装与调试（「调试」独立成节，含串口/波特率/期望输出/心跳/手动发 cue 五种能力的示例帧） |
| 硬件仓「固件实现到什么程度」保留且如实 | ✅ | 保留并强化：声音二值、只验证到能编译（24% / 22%）、**真机链路从未验证过**、`input` 未实现。徽章 `on-device: not yet verified` 是同一件事的声明 |
| `PROTOCOL.md` 那处口语已改（其余零改动） | ✅ | 任务书给的 grep 词表在 `PROTOCOL.md` 里**一处都没命中**；实际的口语在「附：与任务书 3.x 的差异记录」第 6 条：`退化成 30 秒效果——语义可接受（就是短了点）` → 改成 `退化成 30 秒效果，语义可接受，不会出错`。全文其余部分未动 |
| `sdk/AGENTS.md` 第 1 节的代码**逐字未改** | ✅ | `git diff sdk/AGENTS.md` 里没有一行属于那段示例；`agents_guide.js` 12 项全绿 |

### 7.3 `argx-skill` 仓库验收

| 验收项 | 结果 | 证据 |
|---|---|---|
| 仓库已建，public，MIT | ✅ | `gh api repos/ZhengTFB/argx-skill` → `private: false`；`/license` → `spdx_id: MIT` |
| 4.2 结构里列的文件全部存在 | ✅ | `check-skill.mjs` 第 1 项断言 21 个文件，全在 |
| `node tools/check-skill.mjs` 通过，且在 CI 里 | ✅ | 本机 5 项全过；`.github/workflows/ci.yml` 跑它，push 后 run 绿（13s） |
| `assets/argx.js` / `argx.d.ts` 与主仓逐字节一致 | ✅ | sha256 比对：与主仓 `sdk/` 下同名文件**哈希相同**。**反向验证过**：往 `argx.js` 尾部加一个换行，自检立刻从「通过 5」变「通过 4」 |
| 4.3 自包含清单 12 个问题逐条能查到答案 | ✅ | 见下面「自包含清单 12 条」 |
| 三个提示词都在，`verify.md` 十项齐全、要求结论 + 证据 | ✅ | `prompts/` 三份；`verify.md` 十项，明文要求「符合 / 不符合 / 不适用 + 证据指到文件行号」，并禁止「看起来没问题」这类无证据结论 |
| 交付物清单 4 项写进 `SKILL.md` | ✅ | `SKILL.md` 的「交付物」一节 |
| `protocol.md` 副本标记齐全 | ✅ | 开头四段：权威版本地址 + 先改主仓再同步 + 同步方式 + 为什么这个仓库还留一份 |
| `README.md` 与主仓、`argx-esp32` 互链 | ✅ | 顶部居中块正下方两条指针；「相关仓库」一节再列一次 |

**自包含清单 12 条**（任务书 4.3，逐条指出处）：

| # | 问题 | 出处 |
|---|---|---|
| 1 | 帧长什么样？`{v,c,id,p,seq}` 各是什么？ | `references/protocol.md` §2；`references/sdk.md` 的「公共字段」表 |
| 2 | 有哪些命令？两个方向各是哪些？ | `references/protocol.md` §4；`references/sdk.md` |
| 3 | `ARGX.fire('reveal')` 会让装置做什么？ | `references/event-vocabulary.md` 的六个词表 |
| 4 | 六个事件词是哪些，能不能自己发明？ | `references/event-vocabulary.md`——**不能**，答案写在同一页第一节 |
| 5 | 五个参数的取值范围与缺省？ | `references/parameters.md` |
| 6 | `ARGX` 有哪些方法、参数、返回值？ | `references/sdk.md` 的四张 API 表（初始化 / 触发 / 查询 / 监听） |
| 7 | 没插装置会怎样？ | `references/sdk.md` 的「静默降级」；`references/placement.md` 的「没有装置时的行为」——**静默降级，剧情照常** |
| 8 | 为什么不能 `ARGX.on('ack', () => 推进剧情)`？ | `references/placement.md` 的「剧情判定不得依赖装置」——**没买装置的人会卡死** |
| 9 | 一条 `err` 帧怎么读？ | `references/errors.md` |
| 10 | 心跳、掉线、看门狗分别是多少秒？ | `references/constants.md`——3s / 10s / 15s |
| 11 | 现在什么能跑、什么跑不了？ | `references/hardware-limits.md`——含声音二值、`input` 未实现、真机未验证 |
| 12 | 交付哪些文件？ | `SKILL.md` 的「交付物」表（4 项） |

### 7.4 入口验收（9 处逐个点开）

| # | 位置 | 结果 | 证据（线上实测） |
|---|---|---|---|
| 1 | 首页「我是开发者」卡片 | ✅ | 按钮「AI 接入 →」→ `./console/#docs:ai-skill`；点下去 hash 变 `#docs:ai-skill`，H1 =「AI 接入指南」 |
| 2 | 首页 hero 按钮组 | ✅ | hero 共 5 个按钮，「AI 接入」在列 |
| 3 | 首页页脚 | ✅ | 页脚 4 条：`文档 ／ AI-Skill ／ 协议 ／ 设备`，AI-Skill → `#docs:ai-skill` |
| 4 | 控制台文档页左树 | ✅ | 四组依次是 `AI 接入 / 入门 / 指南 / 参考`，**「AI 接入」在第一组** |
| 5 | 控制台文档页默认页 | ✅ | 打开 `#docs` → H1「AI 接入指南」 |
| 6 | 主仓 `README.md` | ✅ | 顶部块正下方独立一行 + 「Getting started」里的独立小节 |
| 7 | `argx-esp32/README.md` | ✅ | 顶部块正下方一行指向主仓的 AI 接入页 |
| 8 | `sdk/README.md`、`sdk/AGENTS.md` | ✅ | sdk/README 顶部引用块 + `## 完整 API` 前置；AGENTS.md 顶部引用块 + 结尾一句 |
| 9 | `protocol/PROTOCOL.md` 顶部表格 | ✅ | 新增一行「AI 接入 → `argx-skill` 仓库」 |

**深链**：`#docs:ai-skill` 在新标签页独立打开能落到该页；页内翻页同步写地址栏
（点「指令与参数」→ `#docs:cues`）；浏览器后退能回上一页；认不出来的 slug 回落到默认页不报错；
`#docs`（无子页）仍然可用。六个旧 hash 也仍然不留死链（`#overview` `#devices` → `#device` 等）。

**链接状态码**：

```
raw.githubusercontent.com/ZhengTFB/argx/main/design/logo.svg            → 200
raw.githubusercontent.com/ZhengTFB/argx-esp32/main/assets/logo.svg      → 200
raw.githubusercontent.com/ZhengTFB/argx-skill/main/assets/logo.svg      → 200
raw.githubusercontent.com/ZhengTFB/argx/main/README.zh-CN.md            → 200
raw.githubusercontent.com/ZhengTFB/argx-esp32/main/README.zh-CN.md      → 200
raw.githubusercontent.com/ZhengTFB/argx-skill/main/README.zh-CN.md      → 200

九条徽章 URL 逐个 curl：
  tests（GitHub 自带 badge）/ license-MIT / protocol-v1 / website-online /
  dependencies-0 / PRs-welcome / platform-ESP32-S3 / built%20with-arduino-cli /
  on--device-not%20yet%20verified                                → 全部 200

浏览器渲染三个仓库页（无头浏览器实测，不是靠推理）：
  github.com/ZhengTFB/argx       英文 README 渲染 ✓  图片 7 张，坏图 0  语言切换链在 ✓
  github.com/ZhengTFB/argx-esp32 英文 README 渲染 ✓  图片 6 张，坏图 0  语言切换链在 ✓  回主仓链在 ✓
  github.com/ZhengTFB/argx-skill 英文 README 渲染 ✓  图片 5 张，坏图 0  语言切换链在 ✓  回主仓链在 ✓
```

> ⚠️ **`curl https://github.com/...` 那几条报 000**——本机到 `github.com` 的 HTTPS
> 时通时不通（同一时间 `api.github.com` 与 `raw.githubusercontent.com` 是通的，
> 无头浏览器也能打开仓库页）。这是本机网络，不是仓库的问题，记在这里免得下次误判。
> 所以「仓库页渲染」这一条用的是**无头浏览器实测**，比状态码更能说明问题。

### 7.5 该给的证据

全部原始输出已在上面。另外：

```bash
$ git status --short          # 干净
$ git log --oneline -8
（阶段六收尾）阶段六收尾：阶段指针、目录结构、hash 空间与决策记录
e9c71f3 阶段六：三仓 README 改双语并加顶部徽章区
98ee4d3 阶段六：首页改版——新定位句、开场四拍、价值三卡、仓库区
5c91842 阶段六：新增 argx-skill 仓库与全站 AI 接入入口
571da10 修正：guide/commands.md 改过之后忘了重新生成 docs.generated.ts
32ed47e 阶段六：对外文档专业化、去 AI 味、文档页改 md 单一来源
282626d 阶段五收尾：CI 补浏览器类检查、对齐 demo 摘要与 cue、归档验收汇报
e2dc073 .gitignore：site/ 那条规则之前是失效的
```

**冻结清单里实际改动的地方**（§6，逐条列出）：

| 动到的地方 | 为什么非改不可 |
|---|---|
| `design/` 的 7 个文件 | 任务书 §5.3.3 明确列为唯一例外：件六改了首页开场拍数与 hero 文案，`design/` 里描述**首页**的那几处记述必须跟着改，否则下一轮 AI 会照旧记述改回去 |
| `console/scripts/smoke.mjs`、`tools/site.mjs` 的断言 | 这两处**不在** §6 的冻结清单里，但会因件六**事实性失效**（`waitForText('把网页变成')`、`.intro-word === 3`）。不放宽断言，只把期望值改成新事实，并补了 7 项新断言 |
| `protocol/PROTOCOL.md` | §3.1 明确允许的唯一一处口语微调；顶部表格加一行入口是 §5 第 9 条要求的 |
| `docs/ARGX-04-界面重做.md` | §5.1 明确要求「hash 清单补一行」，与 §3.2 的「ARGX-01~06 不改」冲突。按**更具体的 §5.1** 执行，只加了 `#docs:<slug>` 那一行 |
| `CLAUDE.md` | §6 允许的四类事实：阶段指针、目录结构、hash 空间、决策记录 |

**没有动**：`protocol/PROTOCOL.md` 的技术内容、`firmware/`、`device/virtual_device.js`、
`tests/` 的断言、`sdk/argx.js` 的行为、`demo/` 三个文件、`console/src/core/`、
`console/src/transports/`、`Docs.tsx` 的组件逻辑（只改了两行 import）、
`docs/PROGRESS.md` 的已有条目（只追加）。

---

## 件一：`guide/` 10 页新旧标题对照表

| slug | 分组 | 左树名 | 旧标题（悬念式） | **新标题** |
|---|---|---|---|---|
| `ai-skill` | AI 接入 | AI 接入 | —（新增页） | **AI 接入指南** |
| `quickstart` | 入门 | 快速开始 | 三步让它动起来 | **安装与首次点亮** |
| `connect` | 入门 | 连接方法 | 电脑侧怎么连上装置 | **电脑侧连接装置** |
| `sdk` | 入门 | 接入 SDK | 把 ARGX 接进你的作品 | **在作品中接入 SDK** |
| `cues` | 指南 | 指令与参数 | 一条 cue 能带什么 | **cue 帧与参数** |
| `ack` | 指南 | 回执与去重 | 装置回了什么 | **回执、幂等与重传** |
| `commands` | 参考 | 指令表 | 全部命令 | **命令参考** |
| `errors` | 参考 | 错误码 | err 帧的五个码 | **错误码参考** |
| `troubleshooting` | 参考 | 故障排查 | 不对的时候先看这里 | **故障排查** |
| `constants` | 参考 | 常量总表 | 一页记住所有数字 | **常量参考** |

小节标题也过了一遍（§3.3 要求「标题即索引」）：`三十秒接入 → 最小接入示例`、
`回查，而不是记账 → 状态回查`、`连点两下会怎样 → 连点去重`、
`什么样的行会被处理 → 有效帧的判定`、`能力声明长什么样 → 能力声明帧`、
`状态帧长什么样 → 状态帧`、`err 帧长什么样 → err 帧的结构`、
`什么不会产生 err → 不产生 err 的情况`、
`四种回执 → 五种回执`（表里本来就是 5 行，旧标题数错了）、
`调试页能做的几件事 → 调试页的四个功能`、
`模拟器里明明好好的，换真机就不对 → 模拟器正常，真机不对`。

---

## 件二：去 AI 味「改动前后对照表」

### ① 三条扫描命令的原始输出

```
$ grep -rn "综上所述\|值得注意的是\|值得一提\|不难发现\|众所周知\|总而言之\|除此之外\|换句话说\|这意味着\|更重要的是\|需要注意的是\|其实\|说白了\|特别说一句\|顺便说\|自然生效\|就自然\|才是\|正是\|真正\|赋能\|抓手\|闭环\|颗粒度\|底层逻辑\|堪称\|无疑\|至关重要" guide/
guide/commands.md:46:- 只处理以 { 开头的行，其余**静默丢弃**，不回 err。对垃圾回 err 会变成刷屏，把真正的错误淹掉
  → 命中 1 处（「真正」），已改：「把真正的错误淹掉」→「把其他错误淹掉」
  → 重跑后：0 命中

$ grep -c "——" guide/*.md
guide/ack.md:1   guide/commands.md:1   guide/connect.md:0   guide/constants.md:0
guide/cues.md:1  guide/errors.md:1     guide/quickstart.md:0  guide/sdk.md:1
guide/troubleshooting.md:0
  → 单页最多 1 处（阈值是 3），全部达标。剩下 5 处里 1 处在代码块注释里、4 处在表格单元格里

$ grep -rn "（[^）]*）" guide/ | awk -F'（' 'NF>2'
guide/commands.md:16:| batch | 否 | 一帧里同时触发多路（≤8 条） | 一个 ack（带 res） / err |
guide/cues.md:35:| 切换动效 | 有过渡（260ms） | 硬切（0ms） |
  → 两处命中都是**表格行**，两个括号分属两个单元格，不是「一句话里的插入语」，保留
```

### ② 改动前后逐处对照（位置 / 原文 / 改后 / 删掉的病征）

病征编号对应任务书 §3.4.2（A 句子级 / B 段落级 / C 词表级 / D 标点级）。

| # | 位置 | 原文 | 改后 | 删掉的病征 |
|---|---|---|---|---|
| 1 | quickstart · lead | 不需要装驱动、不需要编译固件、不需要懂串口。装好之后，从零到灯亮大约两分钟。 | 不装驱动、不编译固件、不用碰串口。这一页从接上 USB 线讲到四路自检全绿。 | A「三段式排比」的一串「不需要」；「大约」= R2「含糊限定」 |
| 2 | quickstart · §1 | 注意是数据线，不是纯充电线 —— 纯充电线里没有数据针脚…… | 纯充电线里没有数据针脚：板子会亮，但电脑看不到它。 | A「元评论（注意）」+ D「破折号」 |
| 3 | quickstart · 警告框 | 控制台认的是标着 USB 的那一个（原生 USB）。另一个（标着 UART 或 COM）只供电……两个口都试一下不算错，但记住是 USB 那个。 | 控制台认标着 USB 的那一个，即原生 USB 口。另一个标着 UART 或 COM，只供电…… | A「括号堆叠」（一句里 2 个括号）+ A「口语提示词（记住…那个）」 |
| 4 | quickstart · §2 | 浏览器会弹出一个端口选择框 —— 那个框是**操作系统**画的，网页看不到里面有什么，所以…… | 弹出的端口选择框由**操作系统**绘制，网页读不到里面的内容，所以…… | D「破折号」 |
| 5 | quickstart · §2 | 没有硬件也想先看看效果？点「连虚拟装置」。 | 没有硬件时点「连虚拟装置」。 | A「反问句开头」 |
| 6 | quickstart · §3 | 每一路都要等装置把状态**回查回来**才算绿勾 —— 不是"我们发过了所以算过"。 | 每一路都要等装置把状态**回查回来**才判定通过。 | D「破折号」+ A「自证与辩护」 |
| 7 | quickstart · 提示框 | ……也不会亮绿勾 —— 这正是自检有意义的原因。 | ……也不会亮绿勾。 | D「破折号」+ A「情绪化收尾（这正是…的原因）」 |
| 8 | connect · 提示框 | 最后一条常被误解成"这个按钮有时候不灵"。它**其实**是浏览器的安全设计…… | 最后一条常被当成"这个按钮有时候不灵"。它是浏览器的安全设计…… | C「其实」 |
| 9 | connect · §为什么没有扫描设备 | 因为浏览器不给。……所以"扫描到两台设备、每行一个连接按钮"这种界面做不出来 —— 那是能力边界，不是偷懒。 | 浏览器没有提供这个能力。……因此"扫描到两台设备、每行一个连接按钮"的界面无法实现。 | A「防御性后缀」+ D「破折号」+ C「浏览器不给」 |
| 10 | connect · 危险框 | 这不是崩溃，是设计好的降级 —— 故事一行都不会因此中断。 | 掉线属于设计内的降级，故事不会因此中断。 | A「否定式抬高」+ D「破折号」 |
| 11 | sdk · lead | 整段复制进你已经做好的网页**就行**。不用重做游戏，不用构建工具。 | 整段复制进已有的网页**即可**。不需要重做游戏，也不需要构建工具。 | C「就行」 |
| 12 | sdk · 首节标题 | 三十秒接入 | 最小接入示例 | §3.3「标题是销售话术不是索引」 |
| 13 | sdk · §最小接入示例 | 就这两句。ARGX.init() 会自己找装置：控制台里嵌着跑的时候用宿主通道…… | 上面就是全部接入代码。`ARGX.init()` 自己找装置：在控制台里以 iframe 运行时用宿主通道…… | C「就这两句」 |
| 14 | sdk · §作者只写事件名 | 你不需要知道哪一盏灯配多亮、哪一个优先级**会不会被抢**。 | 不需要知道哪一盏灯配多亮，也不需要知道优先级会不会被抢占。 | A「反问式从句」 |
| 15 | sdk · 提示框 | ……而是只演灯那一部分。**这是必须的**：协议里 batch 是校验原子 —— 一条不合法整批都会被拒。 | ……只演灯那一部分。协议里 `batch` 的校验是原子的，一条不合法整批都会被拒，所以这个过滤是必需的。 | A「自证与辩护」+ D「破折号」 |
| 16 | sdk · 小节标题 | 回查，而不是记账 | 状态回查 | B「对仗凑节奏」 |
| 17 | sdk · 危险框 | ……故事都必须照常玩得下去。**这是硬性要求，不是建议。** | ……故事都必须照常玩下去。 | A「防御性后缀」 |
| 18 | sdk · 埋点列表 | 一个作品保留 3–8 个触发点就够，**多了会变成迪厅** | 一个作品保留 3–8 个触发点，超出这个数量会显得嘈杂 | §3.8.2「比喻退场」 |
| 19 | sdk · 埋点列表 | ……不要挂在标题页 —— 否则一进这一幕灯就闪，玩家还没做任何事 | ……挂在标题页会让玩家一进这一幕就看到灯闪，而他还没做任何事 | D「破折号」 |
| 20 | cues · lead | 网页发到装置的东西只有一种：cue —— 只描述"要什么感觉"，不含任何引脚电平。 | 网页发往装置的东西只有一种：cue。cue 只描述"要什么感觉"，不含任何引脚电平。 | D「破折号」 |
| 21 | **cues · 声音那段（用户截图选中的）** | 声音这一路**要特别说一句**：**协议支持连续强度**（i 是 0~1 的小数，虚拟装置会按它做渐变），但**当前固件实现是二值的** —— i > 0.02 就输出 2.7kHz 方波，否则静音，音量不可调。所以同一段作品在真机上声音只有"响 / 不响"，在模拟器里能看到强度差异。**这是固件实现到什么程度的问题，不是协议设计的问题**；**将来**固件换成带 DAC 的驱动，这一路的强度**就自然生效了**，协议一行都不用改。 | 声音这一路，当前固件的强度是二值的：i > 0.02 输出 2.7kHz 方波，否则静音。虚拟装置按 i 做渐变，所以模拟器里能看到强度差异，真机上只有有声与静音两种状态。协议侧 i 仍是 0~1 的连续值，换成带 DAC 的驱动即可生效，协议不需要改。 | **一段里同时犯了 A「口语提示词」+ A「括号/破折号堆叠」+ A「自证与辩护」+ A「空泛承诺（将来…自然生效）」+ B「一段讲三件事」+ D「破折号」** —— 任务书 §3.4.2 点名的典型 |
| 22 | cues · 连续量 | 四路里有三路是**连续量**（灯 / 声音 / 振动），一路是**开关量**（继电器）。**这个区别贯穿整个系统，不是界面上的装饰**： | 四路里有三路是**连续量**：灯、声音、振动；一路是**开关量**：继电器。两者的差异如下： | A「防御性后缀」 |
| 23 | cues · 优先级 | 被抢占的效果不会自己回来 —— **抢占不是暂停**。 | 被抢占的效果不会自行恢复。 | D「破折号」+ A「自证」 |
| 24 | cues · hold | 默认的效果最长 30 秒就会自己熄灭，**这是为了**防止"网页崩了灯一直亮"。 | 缺省情况下，效果最长 30 秒后自动熄灭，防止网页崩溃后灯一直亮。 | A「具体句末挂泛化目的」的句式；顺带把「默认」统一成本项目的「缺省」 |
| 25 | cues · hold 提示框 | **最后一条是刻意的。** 如果 hold 连看门狗都绕开……**放开的是 TTL，不是安全兜底。** | 如果 hold 连看门狗都绕开，……hold 放开的只是 TTL 上限。 | A「自证」+ B「重复已知信息」+ A「否定式抬高」 |
| 26 | ack · lead | 回执里带一个 r 字段，**告诉你它到底执行了没有**。 | 回执的 r 字段说明它是否被执行。 | C「到底」 |
| 27 | ack · 小节标题 | 四种回执 | 五种回执 | 标题与内容不符（表里是 5 行）——这不是 AI 味，是错 |
| 28 | ack · 提示框 | **为什么** dup 和 dropped 也要回 ack？**因为**不回的话…… | dup 与 dropped 也要回 ack，否则上层分不清…… | A「反问句开头」 |
| 29 | ack · 连点 | ……而且上一条还在跑 —— 第二次会被判成重复点击 | ……且上一条还在跑时，第二次会被判定为重复点击 | D「破折号」 |
| 30 | ack · 连点 | **注意**"参数也一模一样"这个条件。**它是有意加的**：……会被当成重复点击吞掉。 | "参数也一模一样"这个条件是刻意加的。……会被当成重复点击丢弃。 | A「元评论」+ A「自证」 |
| 31 | ack · batch 列表 | **所有条目共用一个时间戳** —— 这是 batch 存在的**全部理由** | **所有条目共用一个时间戳**，这是 batch 唯一的保证 | D「破折号」+ A「情绪化收尾」 |
| 32 | ack · 提示框 | **为什么非要 batch**：单独发两条 cue 之间隔着一次串口往返（十几个毫秒），"灯和声音同时起"做不到。**要同时，就得**在同一帧里。 | 单独发两条 cue 之间隔着一次串口往返，十几毫秒的间隔使"灯和声音同时起"做不到。要同时，就必须在同一帧里。 | A「反问句开头」+ C「非要 / 就得」+ A「括号插入语」 |
| 33 | commands · 小节标题 | 什么样的行会被处理 | 有效帧的判定 | §3.3 标题名词化 |
| 34 | commands · 列表 | 只处理以 { 开头的行。其余一律**静默丢弃**，不回 err —— 对垃圾回 err 会变成刷屏，把真正的错误淹掉 | 只处理以 { 开头的行，其余**静默丢弃**，不回 err。对垃圾回 err 会变成刷屏，把其他错误淹掉 | D「破折号」+ C「真正」 |
| 35 | commands · 小节标题 | 能力声明长什么样 / 状态帧长什么样 | 能力声明帧 / 状态帧 | §3.3 标题名词化 |
| 36 | commands · caps 段 | ……不带中文名、不带引脚、不带参数范围 —— 那些是协议的固定约定，不是装置报上来的。**所以**在控制台里看到的……是网页端查表补上的，**不是装置说的**。 | ……不带中文名、引脚与参数范围。那三项是协议的固定约定，由网页端查表补上：控制台里显示的……来自网页端，不是装置上报的。 | D「破折号」+ A「否定式抬高」×2 |
| 37 | errors · 小节标题 | err 帧长什么样 | err 帧的结构 | §3.3 标题名词化 |
| 38 | errors · p | **注意** err 里**没有 id 字段**：……这是目前实现的一个已知缺口。 | err 里**没有 id 字段**：……这是当前实现的一处缺口。 | A「元评论」 |
| 39 | errors · 小节标题 | 什么不会产生 err | 不产生 err 的情况 | §3.3 标题名词化 |
| 40 | errors · 列表 | 参数超出范围 —— 直接钳住（i 超了clamp 到 0~1，dur 超了钳到 30000） | 参数超出范围：直接钳住。i 超出 0~1 钳到边界，dur 超过 30000 钳到 30000 | D「破折号」+ 中英混排（`超了clamp 到`） |
| 41 | errors · 提示框 | 收到 unknown_input 不代表你的链路坏了。**恰恰相反**：**帧到了装置、装置也回了话**，这才产生了这个错误。上行链路是通的。 | 收到 unknown_input 说明**帧到了装置、装置也回了话**，上行链路是通的。 | C「恰恰相反」+ B「重复已知信息」 |
| 42 | troubleshooting · lead | 按"从最可能到最不可能"排的。 | 按发生概率从高到低排列。 | C「口语绕圈」 |
| 43 | troubleshooting · 列表 | **是不是重复点了？** 第一次弹框之后浏览器会记住授权…… | 重复点了：第一次弹框后浏览器会记住授权…… | A「反问句」（§3.3 第 6 条点名这一条） |
| 44 | troubleshooting · 列表 | 有 ack 但 r 是 dropped —— 优先级不够 | 有 ack 但 r 是 dropped：优先级不够 | D「破折号」 |
| 45 | troubleshooting · 列表 | Arduino IDE 里 USB CDC On Boot 没开成 Enabled —— 板子在跑，但串口是哑的 | ……没开成 Enabled：板子在跑，但串口是哑的 | D「破折号」 |
| 46 | troubleshooting · 小节标题 | 模拟器里**明明**好好的，换真机就不对 | 模拟器正常，真机不对 | C「明明」 |
| 47 | troubleshooting · p | 虚拟装置没有电气部分，**它永远不会告诉你**"电阻忘了串"。 | 虚拟装置没有电气部分，不会暴露"电阻忘了串"这类问题。 | A「拟人 + 断言式口语」 |
| 48 | troubleshooting · 小节标题 | 调试页能做的几件事 | 调试页的四个功能 | C「几件事」 |
| 49 | constants · lead | 协议里所有定死的数字都在这。改任何一个都要改协议，**不是改界面**。 | 协议里所有定死的数字。改其中任何一个都属于改协议。 | A「否定式抬高」 |
| 50 | constants · 警告框 | 引脚不能随手改。 | 引脚固定，不要随意更改。 | C「随手」 |
| 51 | **protocol/PROTOCOL.md** 附录 | 退化成 30 秒效果——语义可接受**（就是短了点）**，不会出错。 | 退化成 30 秒效果，语义可接受，不会出错。 | D「破折号」+ A「括号里的口语插入语」 |

**控制台用户可见文本（不在 `guide/` 里，但 §3.4.4 把范围划到了）**：

| # | 位置 | 原文 | 改后 | 删掉的病征 |
|---|---|---|---|---|
| 52 | 设备页 · 提示框 | ……网页看不到里面有什么，所以这里没有"扫描到的设备列表"**——那不是能做的事，不是没做**。 | ……网页读不到里面的内容，所以这里没有"扫描到的设备列表"。 | A「防御性后缀」+ D「破折号」 |
| 53 | 设备页 · 自检提示 | 点亮那一下**发的是能力 cue，不是"我们发过了"就算过 ——** 每一路都要等装置把状态回查回来才算数。 | 每一路都要等装置把状态回查回来才判定通过，不是网页发过就算数。 | A「自证与辩护」+ D「破折号」+ R1「串档」（玩家向文案里出现 cue） |
| 54 | 设备页 · 心跳空态 | 还没攒够数据 —— 至少要有两次心跳才画得出线 | 还没攒够数据，至少要有两次心跳才画得出线 | D「破折号」 |
| 55 | 设备页 · 固件版本解释 | ……**想要**固件版本，得先往协议里加字段**——那是改协议，不是改界面**。 | ……要加固件版本，得先往协议里加字段。 | A「防御性后缀」+ D「破折号」 |
| 56 | 引导页 · 选装置卡 | 没有硬件也能走完这条路 —— 虚拟装置和真装置跑的是同一套会话层。 | 没有硬件也能走完这条路。虚拟装置与真装置跑同一套会话层。 | D「破折号」 |
| 57 | 引导页 · 连接卡 | 真实装置会弹出一个端口选择框 —— 那是操作系统画的，网页看不到里面有什么。 | 真实装置会弹出一个端口选择框。那个框由操作系统绘制，网页读不到里面的内容。 | D「破折号」 |
| 58 | 引导页 · 试一下卡 | 点一下，装置真的动 —— 这一下走的是完整链路：**cue → 装置 → ack**。 | 点一下，装置真的动。这一下走的是完整链路：网页 → 装置 → 网页。 | D「破折号」+ R1「串档」（玩家向卡片里出现 cue / ack） |
| 59 | 模拟器 · 未连接提示 | 还没有装置。……动起来 —— 模拟器和真机跑的是同一套会话层，只是装置换成了虚拟的。 | 还没有装置。……动起来。模拟器与真机跑同一套会话层，只是装置换成了虚拟的。 | D「破折号」 |
| 60 | 模拟器 · 故障注入说明 | 故障注入只能作用在虚拟装置上 —— 真机上没法伪造丢包。 | 故障注入只对虚拟装置有效。真机上无法伪造丢包。 | D「破折号」+ C「没法」 |
| 61 | 播放页 · 说明 | ……控制台只是把它嵌进来 —— 右边的状态栏跟着它动，说明**两边说的是**同一条通道。 | ……控制台只是把它嵌进来。右边的状态栏跟着它动，说明两边走的是同一条通道。 | D「破折号」 |
| 62 | 故障面板 · 不发 ready 的说明 | ……**上层不该傻等它 ——** 发一帧 hello 就能要回来。 | ……网页端不应该等它，发一帧 hello 就能要回来。 | D「破折号」+ C「傻等」 |
| 63 | `sdk/README.md` | 给写 ARG 的人用的。**不需要懂硬件，不需要装任何东西，不需要构建工具。** | 给写 ARG 的人用，不涉及硬件、额外依赖与构建工具。 | A「三段式排比」 |
| 64 | `sdk/README.md` | **就这样。** 没接装置也能这么写**——** fire 会把该发的东西打印到…… | 没接装置也能这么写：fire 会把该发的东西打印到…… | C「就这样」+ D「破折号」 |
| 65 | `sdk/README.md` | **别把解谜结果押在装置上。** | 剧情判定不要交给装置。 | C「别 / 押在」 |
| 66 | `sdk/README.md` | 用 `file://` 双击打开 **=** 串口用不了 | 用 `file://` 双击打开**：**串口用不了 | D「等号当标点」 |
| 67 | `sdk/README.md` | 小节标题「三个坑」 | 「三个环境限制」 | §3.3 标题名词化 |
| 68 | `sdk/AGENTS.md` | ……必须能完整通关。**这是硬性要求，不是优化项。** | ……必须能完整通关。这是硬性要求。 | A「防御性后缀」（在 §4，不在冻结的 §2/§3/§5 里） |
| 69 | `sdk/AGENTS.md` | 三种状态对作品代码**没有任何区别**——这是故意的。 | 三种状态对作品代码**没有任何区别**。 | D「破折号」+ A「防御性后缀」 |

> **范围纪律**：`docs/` 内部任务书（ARGX-01~06、PROGRESS、CLAUDE.md）的「坑」「绝不能」
> 这类词**一处未动**——那是写给 AI 读的施工文件，这些词是有效载荷不是文风。
> `demo/script.json` 的剧本正文、`design/` 的设计文档也一处未动。

### ③ 三个「读一遍」测试做了什么

- **删除测试**（把这句删掉，段落丢不丢信息）：删掉了 8 处纯自证的句子——
  「这是必须的」「这是刻意的」「那是能力边界，不是偷懒」「不是装置说的」
  「这正是自检有意义的原因」「这是硬性要求，不是建议」「这不是崩溃，是设计好的降级」
  「这是固件实现到什么程度的问题，不是协议设计的问题」。删完逐段读过，没有一段丢失事实。
- **首末句测试**（只读每段第一句与最后一句，同义就删一句）：命中 2 处，都是
  「先给结论、结尾再用否定式重复一遍」的结构（`cues` 的 hold 提示框、
  `errors` 的 unknown_input 提示框），已删掉重复的那一端。
- **念出来测试**：读出声抓到 3 处「太长的句子」，都是括号 / 破折号把一句话拉到 60 字以上
  （quickstart 的 USB 口那段、cues 的声音那段、ack 的 batch 那段），已拆成独立句。

### ④ 怎么核对「技术信息零丢失」

对新旧正文各抽一遍**数字与标识符集合**，再比差集（`git show HEAD:console/src/data/docs.ts`
对 `guide/*.md`）：

```
[数字与量值] 旧有 46 个 / 新有 51 个
  旧有新无（= 丢信息）：（无）          ← 一个数字都没丢
  新有旧无（= 新增）：20 40 60 70 80   ← 是新加的 frontmatter order 值

[标识符] 旧有 199 个 / 新有 168 个
  旧有新无：全部来自旧文件的**代码**（DOC_PAGES、docBySlug、interface、
            export function、JSDoc 里的 PROTOCOL.md / AGENTS.md 提及），
            以及一处中英混排的「超了clamp 到」（这是错，不是信息）
  新有旧无：DANGER / NOTE / WARNING（引用块标记）、iframe、order
```

**结论：正文里的数字、参数名、条件与限定词一个没少**，少掉的全是旧 TS 文件的代码骨架。

---

## 阶段六决策记录

1. **`guide/` 放仓库根，不放 `docs/`。** `docs/` 已被 `CLAUDE.md` 定义为内部施工文档，
   两者混在一起以后没人分得清哪个是对外的。代价是根目录多一个目录。

2. **生成物提交进仓库**（不 gitignore）。理由：这个项目的核心卖点是「clone 下来就能跑」，
   提交生成物让任何人 clone 后不跑任何脚本就能起 dev。代价是可能与 md 脱节，
   所以配了 CI 的 `--check`。

3. **md 子集是受限的，而且不支持的语法一律报错。** 不支持有序列表（`DocBlock` 里没有 `ol`）、
   行内链接与图片（`Inline` 只认 `**粗体**` 与反引号代码）、软换行（会静默改变渲染结果）。
   报错而不是跳过：静默跳过会让文档悄悄丢内容。

4. **`ai-skill` 作为文档页的默认页与第一组。** 用户明确要求「AI 接入是本项目对创作者最重要的入口」。

5. **`#docs:<slug>` 沿用 `#play:<id>` 的冒号风格**，不是 `#docs/<slug>`。
   重挂由 `App.tsx` 里 `page` 的 `key`（含 `route.doc`）驱动，而不是在 `Docs` 里再挂一个
   hash 监听——「地址栏是路由的真相」这条原则不能破。

6. **`argx-skill` 的「逐字节一致」优先于「头部加拷贝注释」。**
   任务书 §4.8.2 要求给 `assets/argx.js` 头部加注释，§4.10 与 §7.3 要求它与主仓逐字节一致，
   **两者互斥**。取逐字节一致（它是 §7.3 的验收项，也是「防漂移最实在的一条」），
   副本标记改放在 `README.md`、`SKILL.md` 与 `references/protocol.md` 里。**已报备。**

7. **跨仓的「逐字节一致」用 sha256 钉在 skill 仓里**（`assets/checksums.json`），
   因为 skill 仓的 CI 拿不到主仓的文件。`--accept` 用来在主仓 SDK 更新后刷新记录。

8. **`.gitattributes` 钉死 `assets/argx.js` / `argx.d.ts` 的行尾（`-text`）。**
   本机 `core.autocrlf=true`，重新 checkout 会把它们变成 CRLF，本地 sha256 断言就会假红。

9. **`design/logo.svg` 是三个仓库唯一一份手写 logo，另两处是拷贝。**
   一份文件、浅色深色都看得见（字面 hex 的品牌强调色，不引外部样式）。

10. **徽章走 shields.io。** 它只是图片，不是「联网代码」，不违反全局硬约束。
    带状态词的徽章全部如实：`website: online` 有 `--check-live` 的实测支撑；
    硬件仓的 `on-device: not yet verified` 是**故意不是绿色**的——
    真机链路从未验证过，这是那枚徽章唯一诚实的写法。

11. **件六新增的「仓库区」用三张等大卡片，不是两张。** §5.3.4 给了「两张 + 可再加一条指向
    `#docs:ai-skill` 的行」两个选项；`argx-skill` 已经建好，做成第三张卡与它同级更清楚。
    小节标题随之从「两个仓库」改成「三个仓库」。

12. **控制台冒烟补了 7 项新断言。** 件六改了首页四处，原有断言里只有「开场 3 词」会碰到它，
    其余三处（价值三卡、仓库区、AI 接入入口）没有任何断言看着——补上之后它们才不会静默烂掉。
    `console/scripts/smoke.mjs` **不在** §6 的冻结清单里。

13. **`sdk/README.md` 与 `sdk/AGENTS.md` 的收紧与入口跟着件五一起提**，不放进件一至三。
    理由是它们都要加 `argx-skill` 指针（§5 入口表第 8 条），与件五同批改只动一次。

14. **`tools/check-skill.mjs` 留着并进 CI**（任务书 §4.10 允许砍，已征得同意）。
    它是「最便宜的止损」：结构、路径、frontmatter、拷贝哈希四项一次跑完，零依赖。

### 阶段六之后的遗留与风险

前五阶段的遗留项**全部继续有效**（真机链路从未跑过、双会话心跳是双份、
十条协议缺陷、`file://` 下 Demo 读不到剧本等等），本阶段不改变其中任何一条。

1. **协议现在有三份拷贝**（主仓 / `argx-esp32` / `argx-skill`），靠人工同步。
   skill 仓那一份有 sha256 断言守着，`argx-esp32` 那一份仍然只有副本标记 + 互指注释。
   **真正的解法**是让两个派生仓以主仓为上游、定期 diff，那需要 CI，本阶段没做。

2. **skill 仓的 sha256 记录是「某个时刻的主仓」**，主仓改了 SDK 而没人跑
   `--accept` 的话，skill 仓的 CI 会一直绿而拷贝已经旧了。这条断言防的是
   「skill 仓被单独改动」，**防不了「主仓改了没同步」**——后者仍然靠人工纪律。

3. **`guide/` 与 `sdk/AGENTS.md` 现在是两处讲同一件事**（怎么接入、埋点规则、
   六个事件词）。事件词表在两处各写了一遍，改一处要一起改。

4. **文档页无法渲染行内链接。** `DocBlock` 没有 link 类型，`Docs.tsx` 的逻辑在冻结清单里，
   所以 `guide/ai-skill.md` 里的 GitHub 地址只能写成可复制的纯文本代码块，
   做不到任务书 §5.2.7 说的「按钮样式的链接」。**按「不扩子集、记一笔」处理，已报备**——
   要补的话是给 `DocBlock` 加一个 `link` 类型 + `Docs.tsx` 的 `Block` 加一个 case。

5. **三仓 README 的中英两版靠人工保持一致。** 有个一次性脚本验过
   「相对文件与页内锚点」115 条全部解析得到，但那个脚本没进仓库，
   也没验两版的**事实一致性**（数字、参数名、命令）。

6. **`curl https://github.com/...` 在本机时通时不通**（`api.github.com` 与
   `raw.githubusercontent.com` 一直通，无头浏览器也能打开仓库页）。
   以后验「仓库页渲染」用浏览器，别只看 curl 的状态码。

7. **首页的 `landing/` 仍然零构建**，新增的仓库区复用了既有 `.fcard` 那套样式
   （`.rcard` 只多几条规则）。如果这一区将来要做成数据驱动的（比如自动列全部仓库），
   它就该搬进控制台，而不是继续长在零构建的首页里。

### 阶段六的提交与 CI

按任务书 §7.6，按件分批提交，每批推完等两个 workflow 变绿：
<https://github.com/ZhengTFB/argx/actions>

| 提交 | message | test | pages |
|---|---|---|---|
| `282626d` | 阶段五收尾：CI 补浏览器类检查、对齐 demo 摘要与 cue、归档验收汇报 | [34764740556](https://github.com/ZhengTFB/argx/actions/runs/34764740556) ✅ | [34764740542](https://github.com/ZhengTFB/argx/actions/runs/34764740542) ✅ |
| `32ed47e` | 阶段六：对外文档专业化、去 AI 味、文档页改 md 单一来源 | [34765220364](https://github.com/ZhengTFB/argx/actions/runs/34765220364) ⚠️ | [34765220393](https://github.com/ZhengTFB/argx/actions/runs/34765220393) ✅ |
| `571da10` | 修正：guide/commands.md 改过之后忘了重新生成 docs.generated.ts | [34765258282](https://github.com/ZhengTFB/argx/actions/runs/34765258282) ✅ | [34765258278](https://github.com/ZhengTFB/argx/actions/runs/34765258278) ✅ |
| `5c91842` | 阶段六：新增 argx-skill 仓库与全站 AI 接入入口 | [34765903387](https://github.com/ZhengTFB/argx/actions/runs/34765903387) ✅ | [34765903458](https://github.com/ZhengTFB/argx/actions/runs/34765903458) ✅ |
| `98ee4d3` | 阶段六：首页改版 | [34766394239](https://github.com/ZhengTFB/argx/actions/runs/34766394239) ✅ | [34766394226](https://github.com/ZhengTFB/argx/actions/runs/34766394226) ✅ |
| `e9c71f3` | 阶段六：三仓 README 改双语并加顶部徽章区 | [34766712094](https://github.com/ZhengTFB/argx/actions/runs/34766712094) ✅ | [34766712140](https://github.com/ZhengTFB/argx/actions/runs/34766712140) ✅ |

`argx-skill` 的 `ci` workflow（跑 `check-skill.mjs`）最近两次都是 success：
`34765610369`、`34766734917`。

> ⚠️ **`32ed47e` 的 test 是红的，红的正是新加的那条 `build-guide.mjs --check`。**
> 原因：先把 `guide/commands.md` 里「真正的错误」改成「其他错误」，改完忘了跑生成器，
> 生成物还停在旧文本上。**这条断言第一次上岗就抓到了真实的一次脱节**，是它存在的意义。
> 按纪律没有 force-push，改完用 `571da10` 补上，那一轮的 test 随即变绿。

---

## 阶段五验收自检

### 9.1 五条硬闸门（发布前基线）

```bash
node tests/run.js             # 22 场景 / 213 项 → 通过 213，失败 0
node tests/sdk_smoke.js       # 23 项 → 全部通过
node tests/agents_guide.js    # 12 项 → 全部通过
node tests/demo_smoke.mjs     # 31 项 → 通过 31，失败 0
cd console && npm run build   # ✓ 46 modules；零类型错误
```

### 9.2 发布验收逐项

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 主仓已 public，能 `git clone` | ✅ | 在 `/tmp/argx-verify-1951/` 这个**干净目录**里 clone 成功，96 个文件 |
| 2 | 引导页 Pages 可访问 | ✅ | <https://zhengtfb.github.io/argx/> 无头浏览器实测渲染、背景四层在、token 生效 |
| 3 | 控制台 Pages 可访问 | ✅ | <https://zhengtfb.github.io/argx/console/> 六个栏目 + 播放页**逐个点过**，全部渲染 |
| 4 | 子路径下资源不 404 | ✅ | 同上走查，Network 层 4xx/5xx **= 0**，`loadingFailed`（除去导航时正常的 ERR_ABORTED）= 0 |
| 5 | Web Serial 在 Pages 上可用 | ⚠️ | Pages 是 HTTPS（前提成立），`navigator.serial` 存在；**真机连接未验证**——没有硬件，见遗留项 |
| 6 | CI 全绿 | ✅ | `test` 与 `pages` 两个 workflow 在 main 上最近一次 push 均 success |
| 7 | `argx-esp32` 已建且 public，能编译 | ✅ | 干净目录里 clone 后 `arduino-cli compile -b esp32:esp32:esp32s3 firmware/argx_mvp` → 24% Flash 通过 |
| 8 | 两份 README 都写全 | ✅ | 主仓按第 4.1 节十条结构；硬件仓按第 4.2 节十条结构（含 BOM 表、引脚表与选型理由、两个 USB 口、故障排查） |
| 9 | 敏感信息扫描干净 | ✅ | 见下 |
| 10 | 两个仓都有 `LICENSE` | ✅ | `gh api repos/.../license` 两边都返回 `spdx_id: MIT` |
| 11 | 两份 README 互链 | ✅ | 主仓 README「相关仓库」→ argx-esp32；硬件仓 README 多处 → 主仓 |
| 12 | `argx-esp32` 的 `PROTOCOL.md` 有副本标记 | ✅ | 文件头第一段就是「⚠️ 本文档是副本」+ 主仓链接 + 同步方式 |
| 13 | 仲裁代码处有互指注释 | ✅ | 固件 `argx_node.cpp` 的 `applyCue()` 与虚拟设备 `virtual_device.js` 的 `_applyCue()` 各有一段，写明对方在哪个仓库、改一处必须同步另一处 |
| 14 | 五条闸门在干净 clone 里也全绿 | ✅ | 见下（**最重要的一条**） |

### 第 14 条：干净 clone 里的原始结果

```bash
$ mkdir /tmp/argx-verify-1951 && cd /tmp/argx-verify-1951
$ git clone https://github.com/ZhengTFB/argx.git && cd argx

$ node tests/run.js          → 22 个场景 / 213 项检查 → 通过 213，失败 0
$ node tests/sdk_smoke.js    → 全部通过：23 项通过，0 项失败
$ node tests/agents_guide.js → 全部通过：12 项通过，0 项失败
$ node tests/demo_smoke.mjs  → 31 项检查 → 通过 31，失败 0

$ cd console && npm install && npm run build
  ✓ 46 modules transformed；dist/assets/index-*.js 350.49 kB

$ cd .. && node tools/site.mjs --check
  Pages 站点校验 → 通过 18，失败 0（共 18 项）

$ cd .. && git clone https://github.com/ZhengTFB/argx-esp32.git && cd argx-esp32
$ arduino-cli compile -b esp32:esp32:esp32s3 firmware/argx_mvp
  Sketch uses 322969 bytes (24%)；Global variables use 23600 bytes (7%)
```

**这一条证明的是「别人 clone 下来真的能跑」**——没有依赖作者机器上的任何残留。

### 第 9 条：敏感信息扫描的原始结果

```bash
# 1. 真凭据形状（ghp_ / github_pat_ / sk- / AKIA / BEGIN PRIVATE KEY / 赋值式密码）
→ 唯一命中：docs/ARGX-05-开源发布.md:323，那是任务书自己把那串模式写进了示例命令里
→ 真实凭据：0

# 2. 硬编码个人路径
./CLAUDE.md:208  CLI=/c/Users/msa/.argx-tools/arduino-cli.exe
./CLAUDE.md:231  （arduino-cli.exe 放在仓库外）
./CLAUDE.md:232  （加注：这是作者的机器路径，你按自己的环境改）
其余命中全在 docs/ARGX-05 里，那是任务书描述的扫描命令本身
→ 按第 6 节要求处理：**保留真实路径 + 加注**，不换占位符

# 3. WiFi 凭据 / 内网地址 / .env
→ 无 SSID、无口令；唯一内网地址是 docs/ARGX-02 里举的例子 192.168.1.5:5173
→ .env 文件：0 个
```

另外确认：`.git` 无历史包袱（首次 push）、`console/node_modules/` 与 `console/dist/`
未进版本库、`arduino-cli.exe` 不在仓库里。

---

## 阶段五：发现并修复的阶段四遗留缺陷（**本阶段最重要的一件事**）

### 症状

**`console/dist` 的构建产物在浏览器里全站白屏。**

### 为什么五个测试一个都没抓到

`tests/` 的四条闸门 + `console/scripts/smoke.mjs` **全部打的是 dev server**。
阶段四验收里的「`npm run build` 零类型错误」只证明它能编译，**不证明它能在浏览器里跑**。
于是「dev 全绿、dist 白屏」这个状态一直没人看见，直到要部署 Pages。

复现方式（关键：**不带任何子路径**，排除「是不是 Pages 路径错了」）：

```bash
cd console && npm run build
# 用任意静态服务器把 console/dist 挂在**根路径**上，浏览器打开
# → 同样白屏、同样那两条异常。所以与 Pages、与子路径都无关。
```

### 根因一：UMD 被当成 CJS 打包，全局压根没被赋值

`sdk/argx.js` 与 `device/virtual_device.js` 都是 UMD：

```js
if (typeof module === 'object' && module.exports) module.exports = factory();
else root.ARGX = factory();
```

Rollup 打包时喂给它们一个假的 `module = { exports: {} }`（`exports` 恒真），
于是走了 **CJS 那条分支**，`globalThis.ARGX` / `globalThis.ArgxVirtualDevice`
**从来没有被赋值**。而 `core/sdk.ts` 与 `core/virtualDevice.ts` 恰恰只从全局取，
取到 `undefined` 就 `throw` —— 整个应用连初始化都过不去。

**dev 下 Vite 原样服务那个 UMD**，它自己挂全局，所以 dev 一直是对的。

修法：两条路都取一次（全局优先，取不到就退回模块导出）。改了
`console/src/core/sdk.ts` 与 `console/src/core/virtualDevice.ts`。

> 试过「只改构建配置」那条路（`build.commonjsOptions.exclude`）——**没用**，
> 产物字节不变。Vite 8 里包住它的不是那个插件。

### 根因二：播放页的 iframe 指向站点根

`console/src/sections/Play.tsx` 里是 `setSrc('../demo/index.html')`，只在
「控制台正好挂在站点根」时才对。挂到 `/argx/console/` 会解析成
`/argx/demo/index.html` → 404，Demo 播放器永远打不开。

改成 `'./demo/index.html'`：dev / dist 根 / 子路径 / `file://` 四种打开方式下都对。

### 顺带修掉的第三处

`console/scripts/smoke.mjs` 里那条断言硬编码了旧路径 `'../demo/index.html'`，
跟着改。（**不是**为了让 CI 变绿而放宽断言——是它的期望值本身错了。）

### 还改了测试脚本的浏览器查找

`tests/demo_smoke.mjs` 的 `findBrowser()` 写死一条 Windows Edge 绝对路径，
`console/scripts/lib/browser.mjs` 的 `launch()` 也只取候选列表的第 0 条
（注释写着「逐个试」，代码没用上列表）。于是这两个脚本**只在作者的机器上能跑**：
CI（ubuntu）直接 ENOENT，别人的 Mac 同样。改成真的逐个试。
**断言一条没动**，改的只是「怎么找到一个浏览器」。

---

## 阶段五决策记录

1. **分支从 `master` 改名 `main`**（只在本地改，push 前做的）。仓库配置属于第 11 节
   「自己定」的范围。

2. **站点拼法：引导页在根、控制台在 `/console/`**，拼装脚本是 `tools/site.mjs`。

   唯一的麻烦：`landing/` 在仓库里是**同级目录**，它按 `../design/tokens.css` 与
   `../index.html#docs` 写死（dev server 与 `console/dist` 都把它挂在 `/landing/`）。
   搬到站点根之后深度少了一层，这两处必须改写：

   ```
   ../design/     → ./design/      （站点根上有 design/）
   ../index.html  → ./console/     （站点根上的 index.html 是首页自己，不是控制台）
   ```

   **改动只发生在 `site/` 那份拷贝里，仓库里的 `landing/` 一个字不动。**
   组装时会断言「首页里没有残留的 `../`」，留一个就报错。

3. **`tools/site.mjs` 有三个子命令**：`--serve`（本地看）、`--check`（本地走查）、
   `--check-live <网址>`（对着已部署的那一份走查）。三个都自己组装，
   只有 `--check-live` 跳过组装。

   `--check` 是这一步唯一靠得住的验证方式：控制台是 `base: './'` + hash 路由，
   子路径下会不会 404 **只有真加载一次才知道**。它在做的过程中抓到了真问题。

4. **加了 `design/favicon.svg`，两处 `<link rel="icon">`。**

   上线后浏览器会去要域名根上的 `/favicon.ico`。项目站点的域名根
   （`zhengtfb.github.io/`）不归我们管，那一条必然 404 —— 而验收标准里
   「404 应为 0」是硬指标。声明自己的图标就不再走那条默认探测。

   **本地校验没抓到这条**（本地服务器把非 `/argx` 开头的请求 302 掉了），
   线上才暴露。所以 `--check-live` 不是重复劳动。

5. **CI 跑四条闸门 + 控制台构建 + 站点组装**，分两个 job。
   站点组装放进 CI 是为了守住「引导页在根、首页不许残留 `../`」这条不变量。

6. **硬件仓不做 CI。** 它的对等物是「编译通过」，但装 esp32 core 要几分钟且要缓存，
   而任务书第 5.3 节明确说本阶段不搭完整工程化体系。
   编译命令写进了硬件仓 README，**人工验证**（验收第 7 条）。

7. **`argx-esp32` 的目录结构与主仓**镜像**：`protocol/PROTOCOL.md` 与
   `firmware/` 用**同名同构的路径**。好处是两边的固件路径引用、文档里的命令
   完全一样（`arduino-cli compile -b esp32:esp32:esp32s3 firmware/argx_mvp`），
   而且 `diff` 两份拷贝时不需要换算路径。

8. **`landing/` 与 `design/prototype/` 的「在 GitHub 上浏览」占位链接**
   （裸 `https://github.com`）改成仓库地址。**已征得你同意**，两处一起改，
   保持设计真源与实现一致。只动了 `href`，没动任何样式与结构。

9. **`CLAUDE.md` 里的本机绝对路径保留 + 加注**，按任务书第 6 节的推荐做法
   （保留真实路径更可信，加一句「你按自己的环境改」）。

10. **两处 `not` 到的东西没动**：`design/` 的原型视觉、`console/src/core/session.ts`
    的行为、`transports/` 的契约、`tests/` 的断言内容，全都原样。

### 踩到的坑

1. **「五条闸门全绿」不等于「构建产物能用」。** 所有测试都打 dev server，
   这是本次最大的教训。**建议：把 `node tools/site.mjs --check` 当成第五条闸门跑**
   （它跑的是 `dist`，不是 dev）。我没把它塞进 CI 是因为它要浏览器，
   ubuntu runner 上能不能稳定起 Chrome 没验证过——留给你决定。

2. **UMD + 打包器 = 全局可能不被赋值。** Rollup 的 CommonJS 互操作会给 UMD 一个
   假的 `module`，`exports` 初始为 `{}` 恒真，于是 UMD 永远走 CJS 分支。
   凡是「副作用导入 + 读 `globalThis`」的写法在打包后都不可靠。

3. **相对路径深度是有语义的。** `'../demo/'` 与 `'./demo/'` 在开发服务器上
   可能都对（因为根路径不能再往上），但挂到子路径上就只有后者对。

4. **`--check-live` 的 fetch 会误报。** 本机到 Pages CDN 的连接实测会偶尔超时
   （同一条 URL 用 `curl` 取却是 200）。所以「连不上」和「站点没有这个文件」
   必须分开记：前者跳过，后者才算失败。假阴性会让这个校验失去意义。

5. **`Network.loadingFailed` 里 `net::ERR_ABORTED` 是正常的**（切栏目时在飞的请求
   被主动取消）。记进来会让检查项随机变红。

6. **CDN 上 `tokens.css` 要好几秒**。读完 HTML 就立刻读计算样式会拿到空值——
   那是慢，不是坏。断言前要先等它到位。

---

## 界面设计真源变更（阶段四起生效）

### 真源换到了哪里

| | 旧 | 新 |
|---|---|---|
| 界面视觉 | 无真源。由实现者自己定 | **`design/` 目录**（`prototype/*.html` 是最终答案） |
| 界面功能 | 由界面自身定义 | **底层代码**：`protocol/` `firmware/` `device/` `sdk/` `console/src/core/` |
| 实施任务书 | `ARGX-02` 第 4/5/7 节 | **`docs/ARGX-04-界面重做.md`** |

### 作废了哪些旧界面要求

以下记录全部失效，**不要再参考**：

| 旧的界面要求 | 现在 |
|---|---|
| 「打开默认进小白控制台，右上角一个入口切到专业版」 | ❌ 只有一套界面 |
| 「白色 / 浅色配色」只给小白版 | ❌ 配色以 `design/04-配色方案.md` 为准 |
| 「专业版保持现状，不要改它」 | ❌ 反向作废：专业版整个删掉 |
| 「一个滑块、一个专业术语都不出现」 | ❌ 按 `design/05-组件清单.md` 的组件规格走 |
| 「右侧固定一栏：四路当前状态，只读」 | ⚠️ 栏仍在，但形态重做（连续量用轨道、开关量用灯块） |
| 旧的七栏目（总览/设备/ARG 库/模拟器/时间线/文档/创作者平台） | ❌ 新栏目：引导/ARG 库/设备/模拟器/文档/调试 |
| 两套界面各占自己的 hash 空间 | ❌ hash 空间按新栏目重定 |
| 「UI 配色、布局、文案等细节一律自己定」 | ❌ 配色与布局以 `design/` 为准 |

### 不变的底层（改界面时一个字都不许动）

`protocol/PROTOCOL.md`、`firmware/argx_mvp/`、`device/virtual_device.js`、
`tests/` 的断言内容、`console/src/core/session.ts` 的行为、
`console/src/transports/` 的接口契约、`sdk/argx.js` 的对外行为、`demo/` 三个文件。

完整清单见 `docs/ARGX-04-界面重做.md` 第 6 节。

---

## 阶段四验收自检

### 9.1 底层回归（五条硬闸门，全绿）

```bash
node tests/run.js                  # 22 个场景 / 213 项检查 → 通过 213，失败 0
node tests/sdk_smoke.js            # 全部通过：23 项通过，0 项失败
node tests/agents_guide.js         # 全部通过：12 项通过，0 项失败
node tests/demo_smoke.mjs          # 26 项检查 → 通过 26，失败 0

cd console
npm run build                      # ✓ 46 modules transformed；零类型错误
node scripts/smoke.mjs             # 90 项检查 → 通过 90，失败 0
```

`tests/run.js` 的 213 项一条不少，证明改界面时没碰坏协议；
`sdk_smoke` / `agents_guide` / `demo_smoke` 证明 SDK 与 Demo 的对外行为没变。

### 9.2 界面验收逐项

| 验收项 | 结果 | 证据 |
|---|---|---|
| `design/` 已进仓库，`README.md` 写清谁权威 | ✅ | `design/README.md` 第一节的权威顺序表；`design/` 共 8 个文件 + `tokens.css` |
| 设计 token 落成代码，组件里没有魔法值 | ✅ | `design/tokens.css`（12 档间距 / 7 档圆角 / 7 档阴影 / 13 档字号 / 6 档时长 / 4 档缓动 / 7 档层级）；`console/src/index.css` 用 `@theme` 映射成 Tailwind 名字。组件样式只写 `var(--token)` |
| `landing/` 已建，首页与原型一致 | ✅ | `landing/` 三个文件、零构建。冒烟第 12 节 17 项：背景四层、无 canvas、token 生效、开场层内容、两个大按钮指向真实 hash |
| 开场动画：三词正中央原位替换，可跳过，首次才有 | ✅ | `landing.js` 的 `.intro-word` 全部 `position:absolute; left:50%; top:50%`；冒烟断言跳过按钮 / ESC 都结束开场并写 `sessionStorage` |
| 开场动画期间文字以外元素不显示 | ✅ | 冒烟断言 `#intro` 的子元素**恰好**是 `intro-stage\|intro-skip` |
| **非首次访问时所有元素正常显示**（原型修过的 bug） | ✅ | 冒烟「非首访」一组 4 项：不播开场、`body.ready`、`.page-shell` visible、主标题真的占版面 |
| 首页背景四层静态结构，无彩色渐变、无粒子 | ✅ | 冒烟断言 `.bg > *` 恰好 4 层、有 `.bg-noise`、**没有 canvas** |
| `views/basic/` `views/pro/` `panels/` `simulator/` 已删除 | ✅ | `find console/src -type f` 只剩 core / transports / ui / sections / data + 入口文件 |
| `core/` 与 `transports/` 行为未变 | ✅ | 四条回归原样通过；`session.ts`、`transports/*.ts`、`device/virtual_device.js`、`sdk/argx.js` 一字未改 |
| 控制台是一套界面，浅色，六个栏目 | ✅ | 冒烟第 1 节 6 项：逐个 hash 切换、顶部 tab 高亮跟着走、无未捕获异常 |
| 引导页两条路径分叉可用 | ✅ | 两张入口卡各自展开不同内容：五步连通（步骤状态由真实连接状态推出）/ 开发者接入（SDK 片段 + 裸协议） |
| ARG 库读 `works.ts`，区分必需与「有了更好」 | ✅ | 卡片右下角的硬件点阵：必需=实心、有了更好=半透明、不需要=灰点，`title` 里写明 |
| 设备页：能连接、渲染 `caps`、心跳折线、掉线通知 | ✅ | 冒烟第 3/7 节：连虚拟装置后 `conn-badge[data-kind=simulator]`；掉线弹 toast、徽标 `status=lost`、四路回 `待机/断开`。折线轴按观测最大值取（见决策记录） |
| 模拟器：触发四路都有可视化反馈，体现渐变与强度 | ✅ | 冒烟第 4 节：逐路触发后**对应槽位相对触发前变化**（不锚定具体数值，因为渐变 + 轮询有偏差）；卡内是渐变环 / 声波脉冲 / 抖动条 |
| 模拟器：连续量与开关量可视化形态明显不同 | ✅ | 冒烟第 2 节结构性断言：**3 个 `.sb-track` + 1 个 `.sb-binary`**；继电器切换 `transition-duration=0s`（第 4 节实测） |
| 故障注入每一项都能触发，不崩、状态正确 | ✅ | 冒烟第 6 节：6 个开关逐个拨、逐个复位，整段 `cdp.errors === 0` |
| 文档页内容真实可用 | ✅ | `src/data/docs.ts`：9 页，含三步快速开始 / 电脑侧连接方法 / 全部指令 / 参数与优先级 / 五个错误码 / 故障排查 / 创作者埋点规范 / 常量总表；客户端搜索与 ⌘K 聚焦都可用 |
| 调试页含时间线、手动发 cue（含回执）、input 注入 | ✅ | 冒烟第 8 节：时间线里同时有 `→` 与 `←`、有真实能力 id；回执区显示 `seq/r`，batch 时列出 `res` 逐条结果 |
| 右栏四槽位齐全，连续量用轨道、开关量用灯块 | ✅ | 冒烟第 2 节实测：栏宽 **76px**、槽位 **4** 个、通道名依次「灯光 声音 振动 继电器」、轨道 **11×78px** |
| 右栏数据全部来自 `ARGX.state()` 回查，不本地记账 | ✅ | `core/device.ts` 是全站唯一调 `ARGX.state()` 的地方（`grep` 可查）；掉线后四路回退即为证据 |
| 旧 hash 不留死链 | ✅ | 冒烟第 9 节 7 项：`#overview #devices #home #help #works #creator #timeline` 逐个断言**落到的栏目**与**地址栏被改写** |
| `npm run build` 仍是纯静态产物，相对路径 | ✅ | `dist/index.html` 里是 `./assets/...`；`base: './'`；`dist/` 含 `landing/` `demo/` `sdk/` `design/` |
| 全部动效支持 `prefers-reduced-motion` | ✅ | `base.css` 全局兜底 + `landing.js` 的 `matchMedia` 双判；冒烟实测过渡被压到 `0.00001s` |
| 所有可交互元素有可见 focus 环 | ✅ | 冒烟第 11 节：逐个真的 `focus()` 再读计算样式，tab / 侧栏 / 主按钮 / 次按钮 / 滑杆 / 开关 / 输入框 / 下拉 **8 种全过** |
| 缩到最小可用宽度不崩、不出横向滚动条 | ✅ | 冒烟实测 1440 / 1100 / 900 三档溢出均为 **0px** |

### 界面实测数值（CDP 读回来的，不是估的）

```
.shell grid-template-columns  = 56px 1263px 76px
.statusbar 宽                 = 76px
.sb-slot 数 / .sb-track 数     = 4 / 3（另有 1 个 .sb-binary）
.sb-track 尺寸                = 11 × 78px
.sb-binary transition-duration = 0s      ← 开关量硬切
.light-ring .fg stroke        = rgb(232,147,15)，dashoffset 176 ← 待机时环是空的
```

### 9.3 界面验收之外自己加的验证

| 项 | 结果 | 说明 |
|---|---|---|
| 类名与 Tailwind 工具类撞名扫描 | ✅ | 264 个类名扫一遍，只剩 `.grow` 一个语义重合的（`flex-grow:1`，行为一致）。已把 `.ring`→`.light-ring` 的坑写进 `index.css` 与 `CLAUDE.md` |
| 首页零构建可用性 | ✅ | 双击 `landing/index.html`（`file://`）也能拿到 token —— 这正是把 token 放 `design/` 的理由 |

---

## 阶段四决策记录

（按根 `CLAUDE.md` 第 8 节，实现层面的自己定；只记需要你知晓的）

1. **`core/connection.ts` 与 `core/store.ts` 删除**（任务书 5.2 原说要留，已征得你同意）。
   新界面只有一条连接，而且必须是 SDK 那条（验收要求「右栏数据全部来自 `ARGX.state()` 回查」），
   所以那两个文件没有任何使用者。**它们的内容没丢**，搬进了新的单连接层：

   | 从 `connection.ts` / `store.ts` 搬走的 | 搬到哪 | 在界面上哪里看得见 |
   |---|---|---|
   | 帧日志（400 条环形，`in`/`out`/`info`/`error`） | `core/streams.ts` 的 `log` | 调试页的收发时间线 |
   | 心跳延迟序列（最近 40 次）与往返计数 | `core/streams.ts` 的 `latency` / `pongCount` | 设备页的心跳折线图与 KPI 卡 |
   | 回执记录（`lastAck`）与错误计数 | `core/streams.ts` 的 `lastAck` / `errCount` | 调试页「手动发 cue」的回执区 |

   为什么保留内容、删掉文件：这三个东西都是**真实需要**的（任务书 2.3 节的能力单子里
   明确要求界面体现心跳与错误），但装着它们的那个文件是"第二条连接的接线"——
   留着就等于留着第二套连接实现的样板，与「只有一条连接」直接冲突。

2. **`core/basicDevice.ts` 演化成 `core/device.ts`，成为全站唯一那条连接**。
   它是唯一 import `core/sdk` 的模块，也是唯一调 `ARGX.state()` 的地方。
   两条都是硬约束，不是风格问题：
   - SDK 的 `_pendingState` 是**先进先出队列、不按 `seq` 配对**，两个调用者同时查会串应答。
     所以轮询器只有一个，别处一律调 `queryNow()`（挂在下一个完成的查询上）。
   - `ARGX.on` 的 `off(type)` **不带处理器会清空整张表**，两个组件各自退订就会互相抹掉。
     所以事件接线只在模块初始化里做一次，组件一律不 import `core/sdk`。

3. **发完 cue 立刻回查一次**（`device.cue/batch/fire/reset` 里调 `queryNow()`）。
   起因是冒烟测试暴露的真问题：振动 `dur` 只有 300ms、短鸣 500ms，而右栏 800ms 才轮询一次——
   等下一拍再查，效果已经结束了，**右栏从头到尾都不会显示过**。
   这不是本地记账（那仍然禁止），走的是同一条 `query → state` 链路，只是把时机提前：
   出站帧与查询帧走同一条通道，装置按顺序处理，所以查到的状态一定包含刚发的那条 cue。

4. **`core/streams.ts` 与连接快照分开，通知合并到约 8 次/秒**。
   连接快照是低频的（重连才变），帧日志是高频的（一次自检几十帧）。
   混在同一个 `useSyncExternalStore` 快照里，每追加一行都会让六个栏目整树重渲染。

5. **模拟器的 rAF 循环放在页面自己的 `useEffect` 里，不进 store**，并且：
   - 每帧**重新取** `device.virtualDevice`（重连会换实例，闭包捕获会永远画一台死装置）
   - 只在**量化签名**变了才 `setState`（`i` 按 1/50、`ttl` 按 50ms）
   - 签名里**不含 `t` / `uptime`**（每帧都变），也**不拿 `ttl` 判活**
     （关一条正在跑的效果时 `i` 归零而 `ttl` 仍是剩余毫秒，拿 `ttl` 判会把「关」看成「开」）

6. **每次 attach 新建 `MockTransport`，不复用**。`VirtualDevice.close()` 不清 `_lineListeners`，
   而 `MockTransport.connect()` 每次都重新注册——复用 + 重连 N 次 = 每帧被投递 N 次、
   还留着 N 个僵尸会话。故障开关改成**控制台自己的状态**，attach 时重新 `setFaults` 施加，
   所以「重连把故障悄悄清掉」这件事不会再发生。

7. **只在连接那一刻生效的故障，拨开关自动重连一次**（不发 ready / 延迟应答 / 中途断连）。
   它们要么在 `connect()` 里排定时器、要么在握手时生效，对一条已经连上的通道拨开关没有用。
   原来的做法是标一行小字「重连后生效」——但没人会去重连，等于这个开关是坏的。

8. **设备页四张 KPI 换成真实数据**：设备 ID / 传输通道 / 心跳延迟 / 在线时长。
   原型的「固件版本 1.4.2」「供电电压 5.02V」「板载温度」在协议、固件、SDK 里**都没有出处**
   （`ready` 只有 `dev`/`proto`/`caps`，`state` 只有 `i`/`pri`/`ttl`/`uptime`+`dev`）。
   页面上留了一个「为什么没有固件版本？」的按钮，点开直说这是协议里没有的字段。

9. **原型里做不出来的界面**（都换成了能做的等价物，不是删需求）：
   - 「扫描设备列表 + 每行一个连接按钮」→ Web Serial 没有端口枚举，只有 `requestPort()`
     （操作系统弹框，网页拿不到列表）与 `getPorts()`（只返回授权过的）。
     引导页步骤 2/3 改成「选装置 → 点连接 → 在系统弹窗里选端口」，把真实发生的事说清楚。
   - 调试页的「裸帧输入框 + 发送」→ SDK **没有 raw send**，对外只有
     `init/connect/close/fire/cue/batch/reset/defineEvent/events/state/on/off/status/mode/caps/device/hint`。
     改成 cue 构造器（选能力 id + 填参数 + 发送），这也正是任务书 5.4 要求的形态。
   - 调试页的「参数组 A / B + 应用」→ `cfg` 在 SDK 层没有入口。改成 cue 的参数表单，
     参数取真实存在的那五个：`i` / `dur` / `ramp` / `pri` / `hold`。
   - 顶部搜索与通知图标、侧栏用户头像块（`side-user` PK）→ 底层没有对应能力，删掉。

10. **心跳折线图的纵轴按观测到的最大值取**（并留一个最低量程 20ms）。
    虚拟装置是同步应答，往返常在 0~2ms；照原型写死 0~60ms 的话曲线会一直贴底，
    等于什么都没画。同时去掉「近 1 小时」「−1.2ms」——没有任何进程有那么多历史。

11. **`env.relay` 的中文名统一叫「继电器」**，不叫 `core/capabilities.ts` 里的「环境」。
    原型、线框、配色文档三处一致用「继电器」。`capabilities.ts` 在任务书的「不改」清单里，
    所以保持原样——它在文档页继续供引脚 / 元件 / 买什么，界面词汇表放在 `core/channels.ts`。
    这是原型与文档之间的一处不一致，记在这里。

12. **`sound.beeper` 的强度滑杆保留**，但文档页要如实写明固件行为：
    协议支持连续强度（`i` 是 0~1，虚拟装置按它做渐变），
    **当前固件实现是二值的**（`i > 0.02` 输出 2.7kHz 方波，否则静音，音量不可调）。
    所以同一段作品在真机上只有「响 / 不响」。这是**固件实现到什么程度**的问题，
    **不是协议设计的问题**——将来换成带 DAC 的驱动，这一路自然生效，协议一行都不用改。

13. **设计 token 放 `design/tokens.css`**，首页与控制台共用同一份（一份结构、两套主题值）。
    选这个位置是因为它是唯一能让**首页 / 控制台 dev / 控制台 dist / 双击 `file://`**
    四种打开方式都拿到同一份 token 的地方。`vite.config.ts` 的 `SHARED_DIRS`
    因此多了 `landing` 与 `design`。

14. **控制台样式是普通 CSS**（镜像原型的写法），Tailwind 只承担 preflight 与
    token → 工具类的映射（`index.css` 的 `@theme`）。理由：原型的端点、mask、轨道刻线
    这些细节直接照搬比翻译成工具类可靠，而"改一处要同步改三处"的风险更小。

15. **不引 Google Fonts CDN**（原型引了）。在一个「NEVER 引入联网代码」的项目里，
    为了一份字体去加外部依赖不值当，而且离线 / `file://` 下必然回退。
    走 token 里的字体栈：正文 Inter → Segoe UI → PingFang SC → Microsoft YaHei，代码走 Consolas 回退。

16. **断点定在 1280，不是 1440**。1440 的窗口扣掉滚动条只有约 1425 可视宽，
    拿 1439 当断点的话，**在设计基准宽度下**就会少排一列作品卡、还会把文档的「本页目录」藏掉。

17. **旧 hash 重定向必须改写地址栏**，而且改写要发生在「读到 hash 的那一刻」。
    放进 `useEffect` 靠 route 变化触发是错的：`#overview` 与 `#devices` 都映射到 `#device`，
    第二次进来时 rewrite 字符串和上次一样，依赖没变 effect 就不跑，地址栏停在旧值上。

18. **`landing/` 零构建**：原生 HTML + CSS + JS 三个文件，不引 React、不引构建。
    这份页面没有数据、没有路由、没有状态，引入框架只会让它变重。

19. **`#play:<workId>` 是 ARG 库的子页面，不是第七个栏目**：进去之后顶部「ARG 库」仍高亮，
    侧栏与顶栏不新增项。ARG 库的两类条目（站内 demo / 第三方外链）在卡片左上角用角标区分，
    外链用 `target=_blank rel=noopener noreferrer` 打开。

20. **`works.ts` 加了第五条示例数据**（`work-hollow`，第三方外链），
    为了让「外链」这条路径能被冒烟测试覆盖到。你按需改删。

### 我改坏了又修好的地方（留个记录）

- **`.ring` 撞上 Tailwind 的 `ring-1`**：灯光那个渐变环外面凭空多了一圈 1px 黑边，
  而且查不出是谁画的。改名 `.light-ring`，并把这条写进 `index.css` 顶部与 `CLAUDE.md` 已知坑。
- **冒烟测试里把故障"关掉"其实是在打开**：默认全关，我点那两个开关等于开了 50% 丢包 + 3 秒延迟，
  于是「触发一路右栏跟着变」整组全红。改成按「全部关闭」按钮。

---

## 阶段三验收自检

六条验证命令（前两条零依赖，后三条要浏览器，最后一条要先起 dev server）：

```bash
node tests/run.js                  # 阶段一协议回归 → 22 场景 / 213 项，全绿
node tests/sdk_smoke.js            # SDK 接虚拟设备真跑 → 23 项，全绿
node tests/agents_guide.js         # 照着 AGENTS.md 抄一遍 → 12 项，全绿
node tests/demo_smoke.mjs          # Demo 端到端（自带静态服务器）→ 26 项，全绿

cd console
npm run build                      # 类型检查 + 打包 → dist/（含 dist/demo 与 dist/sdk）
node scripts/smoke-basic.mjs       # 小白控制台端到端 → 34 项，全绿（需 npm run dev）
node scripts/smoke.mjs             # 专业控制台回归 → 26 项，全绿
```

| 验收项 | 结果 | 证据 |
|---|---|---|
| SDK 零依赖，直接复制进单文件 HTML 即可用 | ✅ | `tests/agents_guide.js` 把 `argx.js` 投进一个**只有 console 的裸环境**里加载并执行——不需要模块系统就跑起来了；`demo/index.html` 也是 `<script src>` 直接用的 |
| 未连接硬件时所有调用静默成功，不抛错、不阻塞 | ✅ | `sdk_smoke` 第 8 组：连着调 cue/fire/batch/reset/state/close，全程无异常；`agents_guide` 也验了一遍 |
| 模拟模式在 console 打印 cue | ✅ | `sdk_smoke` 第 7 组断言 `[ARGX] batch: light.main … + sound.beeper …`；Demo 冒烟里也断言了整场玩下来埋点都打出来了 |
| `file://` 下给出可执行的提示文案 | ✅ | `demo_smoke` 最后一步真的用 `file://` 打开，断言提示盒里含 `file://` 与 `npx serve / http.server` 字样 |
| SDK 内部分层（传输 / 会话 / 应用），传输层接口与阶段一二一致 | ✅ | `sdk/argx.js` 里三段分明；传输层仍是 `connect/send/onMessage/onClose/close`，只是**收发对象**而不是文本 |
| Demo 通过 SDK 接入，不是绕过 SDK 直连 | ✅ | `demo/game.js` 里唯一的装置调用是 `ARGX.fire()`；没有一处直接写帧 |
| Demo 单画面、一两下操作即可触发，能展示多种能力 | ✅ | 一屏终端，5 个触发点覆盖四路能力（灯 / 声音 / 振动 / 继电器）；`demo_smoke` 从第一幕点到结局 |
| Demo 已注册进控制台 ARG 库，带硬件需求备注 | ✅ | `works.ts` 第一条；小白版显示"要用的东西"并区分必需与"有了更好"，冒烟有断言 |
| 在模拟器中能看到 Demo 触发的效果 | ✅ | `smoke-basic` 第 8 步：在嵌入的作品里点一下，断言右侧状态栏出现"亮着 N%" |
| AGENTS.md 包含第 4.3 节全部内容 | ✅ | §1 集成方式 / §2 事件命名与词表 / §3 埋点时机与克制 / §4 硬件不是判定源 / §6 自检清单 |
| AGENTS.md 规则用肯定句书写，含可复制示例代码 | ✅ | 正文用"只在情绪转折点触发""保留 3–8 个"这类肯定句；示例是完整可复制的 HTML |
| 按 AGENTS.md 的指引，能独立在新项目中完成一次集成 | ✅ | `tests/agents_guide.js` 把文档里那段"三十秒接入"**原样抓出来执行**，跑通并且 console 出正确的 cue |

### 你这一阶段另外提的要求

> ⚠️ **整张表已作废**（阶段四按 `design/` 重做界面）。
> 保留在这里只为了记录"当年做过什么"。现在看这些要求是反的，不要参考。

| 要求（❌ 已作废） | 当时结果 | 现在 |
|---|---|---|
| 打开默认进小白控制台，右上角一个入口切到专业版 | ✅ | ❌ 只有一套界面 |
| 白色 / 浅色配色，简洁直观 | ✅ | ❌ 配色以 `design/04-配色方案.md` 为准 |
| 专业版保持现状，不要改它 | ✅ | ❌ 专业版整个删掉 |
| 一个滑块、一个专业术语都不出现 | ✅ | ❌ 按新组件规格走 |
| 引导仅首次显示，之后通过"帮助"再调出 | ✅ | ⚠️ 改成"引导"栏目 + 首页开场动画，机制不同 |
| ARG 库：剧本 / 集成案例、人话说明、需要哪些硬件 | ✅ | ✅ 功能保留，长相按新设计 |
| 设备选择：真实硬件 / 模拟器，两者都能选 | ✅ | ✅ 功能保留（新界面里在"引导"页分两条路径） |
| 右侧固定一栏：四路当前状态，只读 | ✅ | ⚠️ 栏保留，形态重做（连续量轨道 / 开关量灯块） |
| 自检：四路依次各跑一遍，每个不到 1 秒 | ✅ | ✅ 功能保留 |
| 三态：绿勾 / 黄叹号 / 转圈 | ✅ | ✅ 功能保留（含灰圈"还没测"） |
| 判断依据是状态回查 | ✅ | ✅ **这条是关键约束，阶段四依然必须遵守** |
| 目录结构容纳两套界面，路由现在就留好 | ✅ | ❌ 两套界面的结构整个删掉 |

## 阶段三决策记录

（按根 `CLAUDE.md` 第 8 节，实现层面的自己定；只记需要你知晓的）

1. **小白控制台整个建在 SDK 上**，而不是复用专业版那条会话。
   它就是 SDK 的第一个用户——自己人都不用，没法指望外人用。
   代价是多了一条连接（见第 2 条），换来的是"SDK 能不能用"这件事每天都被验证。
2. **小白版与专业版是两条独立的连接**，各连各的。用途不同（一边在调协议，一边只是选个装置看看），
   互不干扰；代价是同一个虚拟装置会有两个实例（各连各的，状态不共享）。
3. **作品播放器嵌的是真页面**（`iframe` 指向 `demo/index.html`），不是在这里重写一份终端界面。
   Demo 是给别人抄的样板，两份就一定会有对不上的那天。
   宿主把通道挂在 `window.ARGX_HOST_TRANSPORT` 上交给作品——这个约定写进了 `sdk/README.md`，任何作品都能用。
4. **同一条通道上挂了两个会话**（控制台自己的 + iframe 里作品的）。
   协议本来就是两端对等的，多端是设计方向，所以这不算越界；代价是心跳变成双份
   （虚拟链路上无所谓，真实串口上也是双份，见遗留风险）。
5. **Vite 插件把 `demo/` 与 `sdk/` 映射进来**（dev 用中间件、build 拷进 dist），
   而不是把这两个目录复制一份进 `console/`——复制正是这个项目一直在避免的事。
6. **`works.ts` 加了 `optional` 字段**（有了更好、没有也能玩）。
   因为 SDK 会按能力声明自动跳过装置没有的那几路，"缺一件不能玩"和"缺一件少个效果"是两回事。
   专业版面板一行没改，所以它只看 `needs`；小白版两栏都说清楚。
7. **专业版的「打开作品」现在会跳到小白版的播放页**（`link: '#play:work-study'`）。
   这只是 `works.ts` 里的数据，`WorksPanel` 一行没动。
8. **专业版里没有"回到简洁版"的入口**——因为你说了专业版不要改它。
   目前靠浏览器后退，或者把地址栏的 hash 清掉。你要的话我加一行就行。
9. **引导区的顺序是 引导 → 设备（含自检）→ ARG 库**，和你编号的 1/2/3 不同：
   按"先选装置、再验证、最后玩"的使用顺序排的，CLAUDE.md 第 8 节说布局自己定。
10. **自检加了第四个视觉状态（灰圈＝还没测）**。你给的是三态，
    但第一次打开时如果没有"还没测"这一态，四路全灰的画面会被误读成"全都没通过"。
11. **事件词表做进 SDK**（`calm/tension/reveal/danger/relief/ending`），
    AGENTS.md 教的就是 `ARGX.fire('reveal')` 而不是能力 id + 参数。
    理由是你的原话：让创作者记住哪路灯配多大亮度不现实，而每人一套名字的话硬件端清单会变垃圾场。
    优先级在词表里配好，作者永远不需要知道"优先级"这回事。
12. **`fire()` 会按能力声明过滤**再发（装置没有的那几路自动去掉）。
    这也是必须的：协议里 `batch` 是校验原子（一条不合法整批拒绝），
    不过滤的话"灯+蜂鸣+振动"的事件在只有灯的装置上会一条都不演。
13. **Demo 剧本里 `reveal` 从"密码那一幕"挪到了"第三页"**。
    节点的 cue 是"进入这一幕时触发"，挂在密码那一幕等于一进第二幕灯就闪、玩家还没输密码。
    这是我自己写数据时踩的坑，顺手记一笔：**cue 挂在"玩家做成了什么"的那一幕上**。
14. **`tension` 的渐变从 250ms 改成 1500ms**。250ms 读起来像故障闪一下，不像气氛。
15. **真实串口的 connect 做了幂等**（`sdkTransports.ts`）。
    同一条通道要给两个会话用，第二次 `connect()` 既会二次弹窗、又不在用户的点击调用栈里（浏览器直接拒）。

## 阶段二验收自检

> ❌ **本节整节已作废**（阶段四按 `design/` 重做了界面）。
> 里面描述的是当年那套「专业控制台 / 小白控制台」两套界面，代码 **已经全部删除**
> （`views/pro/` `views/basic/` `panels/` `simulator/` `core/connection.ts` `core/store.ts`）。
> 保留在这里只为了记录"当年做过什么"。要看现在是什么样，看上一节「阶段四验收自检」。
>
> **唯一仍然有效的**是本节的第 3 条（端到端冒烟测试这件事本身）与那条真 bug 记录：
> `MockTransport.send()` 漏补换行会让整条链静默失效 —— 这个教训在阶段四依然成立。

三条验证命令：

```bash
node tests/run.js              # 阶段一协议测试（回归）→ 22 场景 / 213 项，全绿
cd console && npm run build     # 类型检查 + 打包 → dist/ 纯静态产物
node console/scripts/smoke.mjs  # 端到端冒烟（需先 npm run dev）→ 26 项，全绿
```

| 验收项 | 结果 | 证据 |
|---|---|---|
| 一条命令启动，`localhost` 能看到完整控制台 | ✅ | `npm run dev` → `http://localhost:5173`；无头浏览器实测七个分区都渲染出来 |
| 导航包含第 4 节全部栏目，创作者平台为占位 | ✅ | 总览/设备/ARG 库/模拟器/时间线/文档 + 创作者平台（标注「阶段三填充」，功能一行未实现） |
| 模拟器能触发四种能力，虚拟装置有对应视觉反馈 | ✅ | 冒烟测试逐项断言：亮度 100%、鸣响、震动中、吸合（通电） |
| 模拟器能体现渐变、强度等参数差异 | ✅ | 「最终解谜」渐变 1500ms 后到 100% 被断言；手动滑杆改到 0.8 后亮度变化被断言 |
| 故障注入面板每一项都能触发，控制台不崩且状态正确 | ✅ | 六个开关逐项断言：都能切换、开着时界面不崩、「全部关闭」可用；「中途断连」另断言触发掉线通知 + 状态回退 |
| 手动测试台能发送任意 cue 并看到设备回执 | ✅ | 断言「最近回执」出现；多选目标时自动走 `batch`，并展示逐条结果 |
| 掉线时有明确通知，状态回到未连接 | ✅ | 断言顶部出现「连接已断开」横幅 + 侧栏回到「未连接」 |
| 设备面板能渲染 `caps` 展示能力 | ✅ | 断言渲染出能力 id 与引脚（GPIO4 等） |
| ARG 库条目带硬件需求备注，列表数据驱动 | ✅ | `src/works.ts` 一条数据一个作品；连上装置后标出「装置能跑 / 缺 N 项」 |
| 文档区包含连接方法与引脚端口表 | ✅ | 三步连接法 + 两个 USB 口的区别 + 引脚/元件表 + 八条故障排查 |
| 时间线实时滚动展示收发事件 | ✅ | 断言有收发记录；支持只看帧/只看错误、自动滚动、清空 |
| `npm run build` 产出纯静态文件，可直接部署 | ✅ | `dist/index.html` + `dist/assets/*.{css,js}`，`base: './'` 全相对路径 |
| README 写清启动与部署两条命令 | ✅ | README 前两节 |

**额外做的验证**（验收清单之外，但我认为必须做）：

| 项 | 结果 | 说明 |
|---|---|---|
| 端到端冒烟测试 | ✅ | `console/scripts/smoke.mjs`，26 项。验收里「能看到视觉反馈」「掉线有通知」这类只能真的渲染出来才算数，类型检查证明不了 |
| 阶段一协议测试回归 | ✅ | 213/213。控制台复用了 `device/virtual_device.js`，改坏它会立刻在这里暴露 |

**冒烟测试上线当天抓到两个真 bug**（都已修）：

1. `MockTransport.send()` 没有按传输层契约补换行。虚拟设备把字符串当原始字节收
   （那是留给垃圾串扰与半行分片的），于是它一直在等一个永远不来的 `\n`——
   界面看着正常、帧也确实发出去了，但装置什么都不做。**整条链静默失效**。
2. 传输层被动断开（对端自己断）时只更新了状态，没有走掉线通知那条路，
   于是「掉线」这件事在界面上是无声的。

## 阶段二决策记录

（按根 `CLAUDE.md` 第 8 节，实现层面的自己定；只记需要你知晓的）

1. **复用虚拟设备的方式：副作用导入 UMD + `globalThis` 桥**，不复制文件。
   那个文件是 UMD、没有 ESM 导出，所以 `import { VirtualDevice }` 会拿到 undefined。
   改它又会动到阶段一已验收的产物，于是在它旁边加了一个
   `device/virtual_device.d.ts`（只声明"它可以被导入"，不伪造导出）。
   导入故意不写 `.js` 后缀——写了后缀 TS 只会去找 `virtual_device.js.d.ts` 这种名字。
2. **会话层 `core/session.ts` 不依赖 React、不依赖任何框架**。
   阶段三的 SDK 可以把这一个文件整段搬过去，而不是再写第三份会话逻辑。
3. **传输层接口沿用阶段一的命名**（`connect` / `send` / `onMessage` / `close`），
   按任务书要求；换通道只加一个实现，上层一行不改。
4. **模拟器进来就自动连虚拟装置**。模拟器不该要求用户先去做一次「连接」动作——
   点进模拟器应该直接看到东西在动。
5. **可视化不走全局 store**：模拟器在 rAF 循环里读 `device.getState()`，
   只更新自己的局部 state，并按签名比较（ttl 按 50ms 粒度）避免 60fps 全树重渲染。
   全局 store 只放连接状态与时间线这两块真正共享的东西。
6. **分区写进地址栏 hash**（`#simulator`）。这样能把链接直接发给别人，
   对方打开就是模拟器——正好对上任务书里"想给别人看效果但不想让他装硬件"那句话。
7. **预设按钮刻意用了 `batch` / `hold` / `critical`**：
   把审查后新加的两条协议能力变成界面上看得见的东西，
   否则它们只存在于文档和测试里，没人会想起来用。
8. **多加了一个 `console/scripts/smoke.mjs`**（交付物清单之外）。
   理由见上面验收自检里的说明：这一阶段有几条验收项只有真的渲染出来才能证明。
   零依赖，用 Node 自带的 fetch/WebSocket 直连 DevTools 协议，不装 puppeteer。
9. **新增 `.gitignore`**：`console/node_modules` 与 `console/dist` 都不该进仓库。

## 阶段一记录（已通过）

> 阶段一已审查通过：`node tests/run.js` 全绿、能力层为注册式、无 `switch(id)`、
> 可扩展性达标。审查后又按要求补齐了两处协议缺口（`batch` 与 `hold`）。

验证命令：`node tests/run.js` → **22 个场景 / 213 项检查，通过 213，失败 0**

| 验收项 | 结果 | 证据 |
|---|---|---|
| `protocol/PROTOCOL.md` 完整定义第 3 节全部内容 | ✅ | 文档 §2~§11 逐条覆盖；另补 §12 扩展指南、§13 常量总表 |
| 虚拟设备跑通完整流程（连接→能力声明→cue→ack→心跳→掉线） | ✅ | 场景 01/02/10/11；`ready` 帧含 `caps`，`pong`/`state` 与掉线置 stale 均有断言 |
| 四种能力全部可被 cue 触发，内部状态正确变化 | ✅ | 场景 02（含渐变的中间值断言）；场景 06 四路同时 |
| 效果优先级抢占符合第 4 节规则 | ✅ | 场景 05（ambient 被抢 / normal 不被 ambient 抢 / 同优先级抢占）、场景 06（critical 先清空全部） |
| 未知 id 回 `err`，非法帧被忽略，不崩溃 | ✅ | 场景 08、09（含坏 JSON、缺 `c`、超长行、半行分片） |
| 故障注入每一项都能触发且不导致崩溃 | ✅ | 场景 13~18：不发 ready / 延迟 3 秒 / 精确丢包 / 可复现随机丢包 / 垃圾串扰 / 中途断连与重连 |
| 看门狗 15 秒超时后自动回 idle | ✅ | 场景 11（14s 仍亮、15s 归零）；场景 12 另验「复位路径不可被抢占」 |
| 手动注入 input 帧能被正确上报 | ✅ | 场景 19（press/release/未知 id 回 `err`） |
| `WIRING.md` 能让零基础的人照着接好线 | ✅ | 含两个 USB 口的区别、逐项接线图、独立供电、常见错误对照表 |
| 提供命令行脚本，能跑一遍 `tests/frames.json` 并打印结果 | ✅ | `node tests/run.js`（`-v` 打印帧、`--scenario=` 过滤，失败退出码非 0） |

**审查后补的两处协议缺口**（你指出阶段三 Demo 必然用到，已实现并验证）：

| 项 | 结果 | 证据 |
|---|---|---|
| `batch`：一帧同时触发多个能力 | ✅ | 场景 20；两条渐变 cue 在同一帧发出后各走半程，证明共用一个时间戳 |
| `batch` 校验原子性 | ✅ | 场景 20；混入未注册 id → 整批回 `err`，同批另一条也不生效 |
| `hold`：效果常驻直到被抢占或复位 | ✅ | 场景 21；靠心跳维持会话走过 36 秒（超过 30 秒 TTL）灯仍亮，`ttl` 报 `-1` |
| `hold` 的释放路径完整 | ✅ | 场景 21/22；被抢占、被 `reset` 清、被看门狗清、被断连清，重连后仍可用 |
| `hold` 与 `ramp` 共存 | ✅ | 场景 22；`dur` 归零不把 `ramp` 一起抹掉 |

**额外做的验证**（验收清单之外）：

- 固件在 `esp32:esp32:esp32s3` 与 `esp32:esp32:esp32`（WROOM-32E）两个目标下**编译通过**
  （32% 与 22% Flash 占用）。本机无 g++/clang，运行时无法验证，见「遗留与风险」。
- 虚拟设备与固件的仲裁代码逐条对齐（抢占、TTL、幂等、看门狗、复位窗口）。

### 阶段一：协议变更记录

线上版本号保持 `v: 1`（没有顶层结构变化，不递增）。以下是落地时做的补充，
均已写进 `protocol/PROTOCOL.md`，并在文末「附：与任务书 3.x 的差异记录」列出理由：

| 变更 | 为什么 |
|---|---|
| `ack` 增加可选 `r`（`applied`/`preempted`/`dup`/`dropped`） | 所有被正常处理的 cue 都回 ack，避免因优先级丢弃被误判掉线；`r` 让上层能区分「执行了」和「按协议丢弃了」 |
| 明确 `dur` 缺省 = 30000 | 任务书只写了 TTL 上限，没写缺省。不明确的话「缺省 dur」会永久占用输出，正是 TTL 要防的那个 bug |
| `ready` 增加可选 `proto` 字段 | 与帧内 `v` 同义，人工排查时一眼确认 |
| 连点去重纳入参数比较（原为「同 id 同优先级去重」） | 纯按 id+优先级去重会导致氛围播放中途无法调亮度，是明显的可用性缺陷 |
| 明确「有效帧」= 以 `{` 开头且 JSON 可解析；垃圾行**不回 err** | 对垃圾回 err 会变成刷屏，把真正的错误淹掉 |
| **新增 `batch` 命令**（审查后补） | 单发多条 cue 之间隔着串口往返，「灯和声音同时起」做不到，阶段三 Demo 必然需要 |
| **新增 `hold` 可选参数**（审查后补） | `dur` 缺省 30000 意味着「最终解谜后灯常亮」做不到 |
| `batch` 的 ack 带 `res` 逐条结果，聚合为 `partial` | 一个 ack 才能让网页端只等一个 `seq`；`res` 让「谁被丢了」可查，否则排查全靠猜 |
| `state.ttl` 对常驻效果报 `-1` | 正常效果 TTL 恒 ≥ 0，用 `-1` 表示「无时限」不需要新增字段 |
| §12 补充版本判定原则 | 「新增安全、改变破坏」——明确这两项为何不动 `v` |

保持 `v: 1` 的依据：老设备收到 `batch` 回 `err:unknown_cmd`（会话不断），
收到 `hold` 直接忽略、退化成 30 秒效果（就是短了点）。都是**明确拒绝**或
**按缺省降级**，不存在「理解错了还照做」，符合 §12 的判定原则。

### 阶段一：决策记录

实现层面自己定的（按根 `CLAUDE.md` 第 8 节，不需要打断你）：

1. **固件拆三个编译单元**：`argx_node.*`（会话层，不知道任何具体能力）/
   `capabilities.*`（能力层，注册式）/ `argx_mvp.ino`（入口，只做三件事）。
   主循环里没有一行业务逻辑，加能力不需要碰它。
2. **能力回调被反复调用**，不是只在收到 cue 时调一次：渐变期间会话层按 tick
   算出当前该输出的强度再回调，能力回调只需写「把 level 写进硬件」。
   好处是定时逻辑只有一份，两种实现不会各写一套。
3. **引脚定 4 / 18 / 17 / 16**。任务书建议 GPIO4 主输出（沿用），其余三个我改了：
   GPIO5 是经典 ESP32 的 strapping 脚、GPIO6/7 在那块板上接内部 flash，
   都不能接负载。现在这四个脚在 S3 和 WROOM-32E 上都安全。
4. **入口放在 `firmware/argx_mvp/`**（Arduino 草稿目录），不是任务书里的扁平
   `firmware/argx_mvp.ino`：Arduino 要求草稿目录名与 `.ino` 同名，扁平布局
   IDE 直接打不开，违背「可直刷」。
5. **引脚 `#define` 放在 `capabilities.h`** 而不是 `.ino` 顶部：`.ino` 与 `.cpp`
   是两个编译单元，`#define` 传不过去。接线只认这一处，`WIRING.md` 与之对齐。
6. **PWM 兼容两套 ledc API**（arduino-esp32 2.x/3.x），避免换核就编不过。
7. **虚拟设备时间自己推进**（`advance(ms)`），不依赖系统时钟——否则测 15 秒
   看门狗要真等 15 秒，阶段二模拟器也是每帧喂一次 delta 即可。
8. **故障注入默认全关**，只在显式打开时生效：默认状态必须是一台正常设备。
   随机丢包用固定种子的 xorshift，跑多少次结果都一样，测试才可复现。
9. **`noReady` 故障只压掉连接时的那一次** ready，之后 `hello` 仍能要回来：
   模拟「这一帧在路上丢了」，正好验证上层不该傻等。
10. **复位「不可抢占」用一个可观测的窗口实现**（`resetHoldMs` 故障注入）：
    真实硬件上复位是同步的、没法插进去一帧，加这个钩子才能真的测到这条规则。
11. **`batch` 的原子性拆成两半**：校验原子（任一不合法整批拒绝、无副作用），
    执行各自仲裁。理由：优先级是本端当前状态的函数，校验阶段根本判定不了；
    但「不会出现灯亮了、声音因为 id 拼错没响」这半条是最有用的那半条。
12. **`batch` 里所有条目共用一个 `now`**，这是它存在的全部理由；
    单独发两条 cue 没有这个保证，两帧之间隔着一次串口往返。
13. **`hold` 把 `dur` 归零，但先按 dur 钳完 `ramp`**。顺序反了的话
    「常驻 + 渐变」会静默退化成「瞬间到位」，是最容易写错的一处。
14. **`hold` 不绕过看门狗**。放开的是 30 秒 TTL，不是安全兜底——
    否则「玩家关掉浏览器灯一直亮」这个事故就回来了，测试场景 21 专门钉这条。

## 遗留与风险

1. **固件只有「能编译」这一层验证**。本机没有硬件也没有主机端 C++ 编译器，
   真实串口时序、USB CDC 行为、电气部分（三极管驱动、继电器吸合）全都未验证。
   补偿手段是虚拟设备与固件仲裁逻辑逐条对齐——**改一端必须改另一端**。
2. **Web Serial 的场景约束**（已接受）：必须 HTTPS 或 localhost、首次连接必须
   由真实点击触发、只有桌面 Chrome/Edge。阶段二的连接 UI 要按这个前提设计。
3. **阶段二的接口已经留好**：`device/virtual_device.js` 暴露 `getState()`
   （含 `state`/`caps`/`out[].i,ttl,active`）与 `level(id)`，模拟器每帧调
   `advance(delta)` 推进即可原地复用，不需要改这个文件。
4. ~~`console/` `sdk/` `demo/` 三个目录本阶段一个文件都没建~~ →
   阶段二已建 `console/`；阶段三补齐 `sdk/`（4 个文件）与 `demo/`（3 个文件）。
   三个目录现在都满了。

### 阶段二的遗留与风险

1. **真实串口只做过环境探测**，没有硬件，所以「连上真实 ESP32 能看到 ready」
   这一条没有被验证过——控制台侧代码写完了、能编译、能构建，但真机链路未跑通。
   模拟器那条路是完整验证过的，两者走的是同一套会话层，
   所以剩下的风险集中在 Web Serial 本身（端口选择、驱动、CDC 设置）。
2. **模拟器在后台标签页会被浏览器降频**（rAF 节流到 1fps 左右）。
   不影响正确性——虚拟装置的时间是由真实流逝的 delta 驱动的，
   回到前台会一次性补上——但视觉上会跳一下。
3. **界面目前假设只有一个装置**。协议是对等的、虚拟设备也支持多实例，
   但 store 里的 `conn` 是单份的，多装置要把它改成按装置 id 索引的 map。
   阶段三如果要做"多装置协同"，这是第一处要动的地方。
4. ~~**ARG 库的作品入口全是 `#`**，按钮被禁用并标注「阶段三接入」~~
   → 阶段三已接上：《深夜自习室》的入口指向小白版的播放页，`WorksPanel` 一行没改。

### 阶段三的遗留与风险

> 第 3、5 条与界面有关，阶段四重做界面时会被一并处理。其余仍然有效。

1. **真机链路仍然一次都没跑过**（没有硬件）。这一阶段又多了一条依赖真机的路径：
   小白控制台的「真实硬件」按钮、以及 Demo 在真实装置上的表现。
   代码路径与模拟器那条完全同一套（同一个 SDK、同一个会话层），
   所以剩下的风险仍然集中在 Web Serial 本身（端口选择、驱动、CDC 设置）。
   **阶段四同样适用**：新界面的连接路径也是这一条，不因为换了界面而改变。
2. **同一条通道上挂了两个会话**（控制台的 + iframe 里作品的），心跳因此是双份的。
   虚拟链路上无所谓；真实串口上也是双份——不致命（一秒钟多一行 ping），但不干净。
   真要清理的话，是"作品只发不收、由宿主代发"或者"作品跟着宿主的连接走但不自建会话"，
   两种都想清楚了再动，别为了省几行心跳把对等结构改掉。
   **阶段四不动这块。**
3. ~~**专业版与小白版各有一台虚拟装置**（两条独立连接）~~ →
   **阶段四已消除**：只有一套界面、一条连接。
4. **`file://` 下 Demo 读不到剧本**（`fetch` 被浏览器挡住）。
   页面会给一句可照做的话，但剧本本身加载不出来——这是浏览器规矩，绕不过去。
5. ~~**小白版不显示故障与协议细节**~~ → **阶段四已消除**：
   新界面的"调试"栏目对所有人开放，不再按界面分人群。

### 我认为结构上可以更好的地方（未改代码，仅列出）

1. **会话逻辑仍然有两份**：设备端 C++（阶段一）、网页端 JS（SDK 与 `console/src/core/session.ts`
   是同一份逻辑的两种写法——SDK 是照着 `session.ts` 逐条翻译的）。
   ~~真正的解法是让控制台也用 SDK 的会话层（专业版还没换）~~
   → **阶段四已消除这一半**：控制台现在只走 SDK 那条连接，
   `core/session.ts` 不再被界面使用（但它作为 SDK 的"母本"留着，两边要对齐改）。
   剩下的那份设备端 C++ 仍然是真·第二实现，改一端必须改另一端。
2. ~~**传输层的 `send(text)` 是文本接口**，专业版那一边还留着老接口~~
   → **阶段四已消除**：界面只跟 SDK 打交道（收对象），文本接口只剩
   `core/sdkTransports.ts` 这一个翻译层，被 `device.ts` 独占。漏补换行那个坑
   现在只可能出现在那一个文件里。
3. **时间线是全量日志，没有会话分段**。回溯"某一局触发了什么"只能靠肉眼扫，
   而"一局"在这个项目里是有意义的概念（换一局要 reset）。
   按 reset / 重连切段是个低成本的改法。
4. **故障注入面板直接操作虚拟设备实例**（`connection.mock.device.setFaults`），
   绕过了会话层。这是故意的——要在传输层以下做手脚才能伪造丢包与垃圾串扰——
   但代价是 `connection.mock` 成了泄漏的抽象。如果将来模拟器要支持多台虚拟装置，
   这一层需要重新设计（大概是"传输层自带一个可控的故障策略"）。
5. **事件词表住在 SDK 里**（`argx.js` 的 `EVENTS`）。它其实是一份"故事语言 → 能力"的
   翻译表，将来很可能需要让创作者自己扩（比如某个作品想要自己的 `act3.bell` 组合），
   现在只能靠 `defineEvent` 在代码里加。放成数据文件（像 `script.json` 那样）会更顺。
6. **小白控制台的自检与作品播放器都需要"设备回来话了"这个信号**，
   现在是各自等 `ARGX.state()`。真到了要显示"哪一路没接通"的细节时，
   可能需要一个共享的探针层，而不是各自轮询。

### 协议里我认为还有缺陷 / 有更好方案的地方（未改代码，仅列出）

> 原本这份清单里的「没有同时触发多效果的原子操作」与「长驻效果做不到」
> 两条，已按你的指示在审查后补掉（`batch` 与 `hold`）。

1. **没有时间同步机制**。多装置将来需要一条统一时间轴，现在没有任何时间基准，
   谁都不带时间戳。这是扩展出多装置时第一个会撞上的问题。
   `batch` 只解决了「同一帧内的效果同时起」，跨帧、跨装置的同步还没有答案。
2. **`seq` 去重只记每个能力最后一条**（`lastSeq`）。实时链路够用，但如果将来加
   重传或乱序网络，需要定义接收窗口大小。`batch` 让这个问题的暴露面变大了：
   整批共用一个 `seq`，逐条去重靠的是各自的 `lastSeq`。
3. **反向通道是单向的**：`input` 帧没有 ack，网页端无法确认设备收到。
   做「按密码盘」这类需要确认的交互时会需要。
4. **`state` 帧里没有 `caps`**。网页端中途丢了能力声明只能再发一次 `hello`。
   可以让 `query` 支持 `p:{caps:true}`，成本很低。
5. **`hold` 没有配对的「释放」语义**。现在释放常驻效果只能靠抢占、`reset`、
   看门狗或断连——「剧情结束了，把这盏灯关掉」只能发一条新的低强度 cue。
   需要一个显式的 `release`（或 `hold:false` 的明确含义），
   但要想清楚它和 TTL 保护的关系，别把兜底又拆了。
6. **`batch` 上限 8 条 + 单帧 512 字节**，一次动十几个效果做不到。
   这是刻意的（一次要动十几个说明该在设备端定义一个组合能力），
   但如果阶段三的 Demo 撞到这面墙，第一个该考虑的是「组合能力」而不是提高上限。
   （阶段三没撞到：Demo 一个节点最多 2 个事件，每个事件最多 3 条 cue。）

> 下面三条是阶段三做 SDK 时新发现的。

7. **`state` 帧不回 `seq`**，所以网页端只能"先到先得"地配对（`sdk/argx.js` 里
   `_pendingState` 是队列，取最早那个）。一个未决查询时够用，
   但并发查两次就会串到对方的应答上。协议里 `query` 带 `seq`、`state` 却不带，
   这是**明显该补的一处**——补上之后配对就从"猜"变成"对"。
8. **反向通道 `input` 没有 ack**（第 3 条）在小白控制台里第一次变成了真问题：
   将来要做"玩家按了物理开关 → 网页确认收到"的交互，没有 ack 就只能靠超时猜。
9. **"宿主把通道交给作品"这件事没有协议位置**。现在它是一个 SDK 层面的约定
   （`window.ARGX_HOST_TRANSPORT`，写在 `sdk/README.md` 里）：
   控制台把连好的通道交给 iframe 里的作品，作品跟着宿主走。
   如果"多端"是方向（控制台 + 作品 + 手机遥控同时看着一台装置），
   这个约定值得从 README 抬进 `protocol/PROTOCOL.md`——它实际上定义了一种端间关系。
10. **事件词表在协议里没有位置**。现在 `reveal` 是 SDK 翻成能力 cue 再发出去的，
    装置端只认能力 id——这符合"不下发引脚"的原则。但如果将来要让装置**离线**按事件演出
    （没有网页端在跑的时候），协议里就缺一个"以事件为单位"的入口。

> ⚠️ **这十条在阶段四一条都不做。** 阶段四是界面重做，不碰协议。
> 它们留在这里，等将来真的需要动协议时再逐条议。

---

## 阶段四：待做的事（从旧风险里继承）

阶段四开始前，先把下面这些记住。它们不是阶段四的任务，是阶段四**不能碰坏**的东西：

| 项 | 为什么 |
|---|---|
| 真机链路从未验证过 | 新界面换了连接入口，但底层路径没变。**别以为改界面就能修好真机问题** |
| 双会话心跳是双份的 | 阶段四不改这块结构 |
| `file://` 下 Demo 读不到剧本 | 属于浏览器规矩，不是界面问题 |
| 十条协议缺陷 | 阶段四不碰协议 |
| 六条"结构上可以更好的地方" | 阶段四只在必要处调整，不借机重构 |

**唯一被阶段四"顺手解决"的是这两条：**

- 专业版与小白版各有一台虚拟装置（两条独立连接）→ 消除，只剩一套
- 小白版不显示故障与协议细节 → 消除，"调试"栏目对所有人开放

### 阶段四之后的遗留与风险

1. **真机链路**仍然一次都没跑过（没有硬件）。新界面换了连接入口，
   但底层路径没变 —— 别以为改界面就能修好真机问题。剩下要验的还是 Web Serial 本身：
   端口选择、驱动、CDC 设置。跳过了「连接真实装置」这一步的自动化测试是**有意的**：
   无头浏览器里 `navigator.serial` 存在，`requestPort()` 会弹一个没人能选的框，挂在那里。
2. **右栏的回查延迟**：`query` 800ms 一次，加上「发完立刻回查」，
   短效果（振动 300ms）能显示出来，但**结束的时刻**仍可能晚一拍才反映。
   这是"回查而非记账"的固有代价，不是 bug，也不打算为了它去加长连接数。
3. **模拟器的两套观测口径**：卡片读 `getState()`（装置内部，逐帧），
   右栏读 `state`（协议帧，800ms）。渐变期间两者会不一致。
   已把卡片数字按整数显示，冒烟也只断言"变了"。
4. **`design/` 会被整个拷进 `dist/`**（含原型与六份设计文档，约 200KB）。
   有意为之：token 是运行时依赖，原型与文档顺带也就有了，部署出去对着同一个地址能翻设计。
   如果将来不想要，改 `vite.config.ts` 的 `SHARED_DIRS` 里 `design` 的处理方式即可。
5. **`core/session.ts` 不再被界面使用**，但保留着 —— 它是 SDK 的母本，
   两份要一起改。如果将来确认 SDK 是唯一实现，可以考虑删掉它并让 SDK 成为唯一来源。

### 阶段五之后的遗留与风险

前四阶段的遗留项**全部继续有效**（真机链路从未跑过、双会话心跳是双份、
十条协议缺陷、`file://` 下 Demo 读不到剧本等等），发布不改变其中任何一条。
下面是阶段五新增的：

1. **真机链路仍然一次都没跑过。** 验收第 5 条「Web Serial 在 Pages 上可用」只能
   证明**前提成立**（页面是 HTTPS、`navigator.serial` 存在），
   「插上真装置能连上」这一条仍然未验证。这是从阶段一就存在、一直被如实记录的风险。

2. **`firmware/` 在两个仓库里各有一份，靠人工同步。** 这是拆仓方案（不用 submodule）
   的既定代价。缓解手段是两处仲裁代码的互指注释 + `PROTOCOL.md` 副本标记。
   **真正的解法**是让硬件仓以主仓为上游、定期对比，但那需要 CI，本阶段没做。

3. **硬件仓没有 CI**，编译验证靠人工。要补的话是「装 esp32 core + 编译」一条 workflow。

4. ~~**凡是需要浏览器的检查，一条都不在 CI 里。**~~ → **阶段五收尾已补上**（`e2e` job，
   见本文件开头「阶段五的三个收尾项」）。下面是当时的原文，保留作为记录。
   具体是两处：

   - `node tools/site.mjs --check` —— 拼站点 + 起服务 + 无头浏览器扫 404。它跑的是
     `dist` 而不是 dev server，**恰好能覆盖阶段五这次的白屏缺陷**（五条闸门 +
     控制台冒烟 90 项全都看不见它）。
   - `node console/scripts/smoke.mjs` —— 界面结构 90 项，跑的是 dev server。

   两条都没进 CI，只是因为不敢肯定 ubuntu runner 上能稳定起 Chrome。
   **这是最值得优先补的一件事**：GitHub 的 ubuntu runner 自带 `google-chrome`，
   而 `console/scripts/lib/browser.mjs` 的候选列表里已经有 `google-chrome` 这一项
   （阶段五为了可移植性刚加的）。补齐之后，`test.yml` 会新增一个 `e2e` job：
   `npm ci` → `npm run build` → `node tools/site.mjs --check` → `node console/scripts/smoke.mjs`。
   若 Chrome 起不来，退回「只组装」，并在本文件里记一笔。

5. **知识仍然集中在主仓。** `CLAUDE.md`（硬约束、已知坑、决策记录）在 `argx` 仓库里，
   只改硬件的人看不到。硬件仓 README 已经写明「两侧实现要一起改」，
   但更完整的背景还在主仓。

6. **`design/` 会被整个拷进 `dist/` 并发布出去**（含原型与六份设计文档）。
   有意为之，阶段四就记过；发布的站点上对着同一地址能翻设计。

---

## Demo 翻页修订（阶段四验收之后，对阶段三已验收产物的修订）

> `demo/` 在「绝不能动清单」里。这是一次**定向修订**，只修下面这一个问题，
> 顺手优化一行都没做。留痕在此。

### 问题

用户报：**「用户无法翻到第三页，从而无法触发灯灭。」**

### 复现与根因

复现方式：写 CDP 脚本，用**真键盘事件**（`rawKeyDown`+`char`+`keyUp`）驱动无头 Edge，
在 ①独立打开 `demo/index.html`、②控制台 `#play:work-study` 的 iframe，
两处各走一遍全程。

**「翻不过去」没能按字面复现**：第二幕真键盘敲 `314` 能进第三幕；
iframe 里按钮 `top:325 bottom:367`、iframe 高 620，**没有被裁切**；
状态机 `arrive→cipher→third→{close|readon}→dawn` 六节点全可达，没有死胡同。

**真实症状是：剧本让玩家「翻页」，界面上却没有任何翻页动作。** 根因：

- `demo/script.json` 的 `cipher`（扉页，第二幕）节点 ——
  三行正文写着「**再往后翻**，每一页都只有一句话」，
  提示写着「提示：**翻到第三页**，第一行，第四个词。」
- 但这一幕的 `action` 只有 `type: "input"`（一个密码框），
  `game.js` 的 `renderActions()` 对 `input` 型只渲染「确认」+「看提示」。
  **整个 demo 里没有任何一个按钮叫「翻页」。**
- 于是照着提示走的玩家被卡住：剧本让他翻到第三页，他找不到翻的法子。
  唯一出口是那个密码框，而密码（`314`）恰恰是扉页上明写的 `「三 一 四」`本身 ——
  提示指的地方到不了，到得了的地方提示又不认。

> 附带发现（**本次没修，见文末**）：`pitch` / ARG 库摘要承诺「翻到第三页时，
> 桌上的灯会自己**暗**下去」，而 `third` 实际触发的是 `reveal`（灯猛地**一亮**）。

### 怎么修的

只动三个地方，**不新增 schema**：

| 文件 | 改动 |
|---|---|
| `demo/script.json` | `cipher` 的 `action` 加一行 `"options": [{ "label": "往后翻", "next": "third" }]` |
| `demo/game.js` | `renderActions()` 的 `input` 分支里，渲染完「确认」后把 `a.options` 也渲染成按钮 |
| `demo/script.json` | `third` 首行删掉「锁扣弹开。」四个字 |

`game.js` 加的那段：

```js
// 输入型的幕也要能带出路。扉页那一幕就是：剧本说「再往后翻」，
// 那就得真翻得动，不能只有"输对密码"一条路——否则照着提示走的玩家会卡死。
(a.options || []).forEach(function (opt) {
  box.appendChild(button(opt.label, 'primary', function () {
    play(opt.next);
  }));
});
```

### 为什么这么修

- **复用 `options` 字段，而不是新造一个。** `choice` 型本来就用 `options`，
  `ScriptAction` 接口里也早就声明了 `options?: ScriptOption[]` ——
  所以 `console/src/data/script.ts`（它 `import` 了这份 json）**一个字都不用改**，
  不新增 schema 概念，第三方的剧本照抄也还是那几个字段。
- **保留密码框**，而不是删掉它。抽屉里那把锁不是 bug，bug 是"只有这一条路"。
  这样第二幕的正文、提示、`answer`/`hint`/`wrong` 全部不用动，
  `demo_smoke.mjs` 原有的 6 条密码相关断言也全部继续有效 ——
  修订已验收产物的动静越小越好。
- **删「锁扣弹开。」是为了让两条路都读得通。** 这句是阶段三 `1e447dc`
  为了让灯闪得"有来由"补的，但它是**"输对密码"专属**的叙述：
  玩家要是直接翻过去，读到「锁扣弹开」会莫名其妙。删掉后两条路都成立。
- **翻页按钮用 `primary`**，和 `choice` 的选项一致 ——
  它是"往前走的路"，不该被做成次要样式藏着。

### 补的断言（硬性要求）

`tests/demo_smoke.mjs` 加了一节（第 7 节，原 7/8 顺延为 8/9），
**全程不碰输入框**，只点剧本里写明的翻页动作：

```
✓ 再走一遍：点「看扉页」回到第二幕
✓ 第二幕又出现了
✓ 第二幕有真的翻页动作（「往后翻」）
✓ 点「往后翻」
✓ ★ 一个字的密码都没输，就翻到了第三页（这次修的 bug）
```

**这节必须单独立，因为原来那条主线盖章不出这个 bug** ——
它是照着密码输的，一路绿灯。26 项全绿时，「第二幕只有密码框」这件事
没有任何一条断言看得见。

**反向验证过**：把 `demo/` 的修复 `git stash` 掉再跑，这节准确变红三项：

```
✗ 第二幕有真的翻页动作（「往后翻」）
✗ 点「往后翻」
✗ ★ 一个字的密码都没输，就翻到了第三页（这次修的 bug）
```

冒烟项数：**26 → 31**。

### 遗留（本次按你的选择没修）

`pitch`（`script.json`）与 ARG 库摘要（`console/src/works.ts`）承诺
**「翻到第三页时，桌上的灯会自己暗下去」**，但 `third` 触发的是
`reveal`（灯猛地一亮、响一声）。**两者始终对不上**：
正文和 cue 是一致的（都是有来由的"一亮"），对不上的是那两句摘要。

这次选的是「缺翻页动作」那条读法，所以 cue 与摘要都没动。
真要修，是"改第三页的 cue + 那一句正文"或"改两句摘要"二选一 ——
下次单独提。
