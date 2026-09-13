# ARGX 阶段五：开源发布与仓库拆分

> **这是独立的第五阶段。** 前四阶段的任务书是 `ARGX-01` ~ `ARGX-04`，
> 本文件是它们的后继，做的是**把已经做完的东西发布出去**——不新增功能、不改界面、
> 不动协议。
>
> 读完本文件后，你还要读：`docs/PROGRESS.md`（看清现在到哪了）、
> `CLAUDE.md`（常驻规则，尤其第 5 节全局硬约束）。

| | |
|---|---|
| **前置** | 阶段四已通过审查；`git status --short` 干净；五条闸门 + 界面冒烟全绿 |
| **本阶段做** | 建仓 → 部署 Pages → 拆两个仓库 → 写两份 README → 开源 |
| **本阶段不做** | 不新增任何功能；不改界面；不改协议；不做 CI 之外的自动化；不写宣传物料 |
| **关键动作** | **先单仓跑通部署，再拆仓**。绝不跳步 |
| **收尾动作** | 更新 `PROGRESS.md`；**STOP** 等审查 |

**账号事实**（本机已确认）：

- GitHub 账号：`ZhengTFB`
- `gh` CLI 已登录（`gh auth login` 走设备码成功），git 协议已设为 HTTPS
- 本机**能**访问 `github.com`、能调 API、能推代码（验证：设备码登录成功）
- **但** `msstore` 源不可达（`winget` 默认源会报 `12029` / `0x80072efd`），
  装工具时永远加 `--source winget`

---

## 0. 开工顺序（严格按这个来，不要跳）

1. 读 `docs/PROGRESS.md`，确认阶段四已通过审查、没有遗留未做的事
2. 读 `CLAUDE.md` 第 5 节（全局硬约束）与第 6 节（目录结构）
3. 跑 `git status --short` 与 `git log --oneline -5`，**确认工作区干净、没有未提交的改动**
4. 跑一遍五条闸门 + 界面冒烟，确认发布前的基线是全绿的：
   ```bash
   node tests/run.js && node tests/sdk_smoke.js && node tests/agents_guide.js && node tests/demo_smoke.mjs
   cd console && npm run build
   ```
5. **扫一遍敏感信息**（这一步不能省，见第 6 节）
6. 再开始建仓

**第 3 步不干净就不要往下走。** 发布前的仓库必须是干净的——把阶段四的剩余提交先处理掉。

---

## 1. 本阶段的总目标

把 `argx` 这个**已经能跑的完整项目**从本机搬到 GitHub，公开、可访问、能被别人跑起来，
并且**拆成两个仓库**方便后续开发者接手。

三条并行线，缺一不可：

1. **能看**——引导页和控制台在 GitHub Pages 上有可访问的网址
2. **能跑**——任何人 clone 下来，照着 README 就能跑起来（三条路径：只看 / 只跑 / 接硬件）
3. **能读**——代码结构清楚，两份 README 讲清了「这是什么、怎么用、为什么这么设计」

**完全开源。** 两个仓库都是 public，许可协议见第 7 节。

---

## 2. 仓库拆分方案（已定，不需要你重新论证）

### 2.1 两个仓库

| 仓库 | 装什么 | 为什么这么分 |
|---|---|---|
| **`argx`**（主仓） | `protocol/` `firmware/` `device/` `tests/` `sdk/` `demo/` `console/` `landing/` `design/` `docs/` `CLAUDE.md` | 核心：协议 + 虚拟设备 + SDK + 控制台 + 引导页 |
| **`argx-esp32`** | ESP32 硬件侧实现（源自 `firmware/`）+ 接线/引脚/烧录文档 | **ESP32 适配器**，纯硬件向 |

### 2.2 为什么不是三个仓

原来的想法是「协议 / 控制台界面 / 硬件」三仓。**但协议与硬件拆不开**：
协议不是独立产物，`device/virtual_device.js`、`firmware/argx_mvp/`、`tests/` 都是它的**实现**，
三块是**依赖链**而不是独立体。硬拆会产生循环依赖。

**结论：两个仓。相互依赖的文件允许两边各放一份，不用 submodule。**

### 2.3 重复文件清单（哪些要放两边）

| 文件 | 主仓 | ESP32 仓 | 说明 |
|---|---|---|---|
| `protocol/PROTOCOL.md` | ✅ 权威版本 | ✅ **副本** | 副本开头必须加「权威版本在那边」的标记 |
| `firmware/argx_mvp/*` | ✅ | ✅ | 硬件仓的主体就是它 |
| `firmware/WIRING.md` | ✅ | ✅ | 接线文档，两边都需要 |
| `device/virtual_device.js` | ✅ | ❌ | 纯网页侧，硬件仓不需要 |
| `tests/` | ✅ | ❌ | 跑虚拟设备的，硬件仓不需要 |

### 2.4 拆仓时的同步风险（必须处理）

**问题**：仲裁逻辑（抢占 / TTL / 幂等 / 看门狗）在**固件**与**虚拟设备**里**各有一份实现**。
拆仓后这两份分居两个仓库，非常容易悄悄漂移——而漂移之后两边的行为就不一致了，
协议就失去了「唯一权威」的意义。

**必须做的四件事**：

1. **`argx-esp32` 里那份 `PROTOCOL.md` 开头加显式标记**：
   ```
   > ⚠️ **本文档是副本。** 权威版本在 `argx/protocol/PROTOCOL.md`。
   > 协议有任何变更，请先改主仓，再把本文件同步过来——不要在这里直接改。
   ```

2. **两份实现的仲裁代码处互相加注释指路**。
   `firmware/argx_mvp/` 与 `device/virtual_device.js` 的仲裁逻辑处各加一段注释，写明
   「同一套规则的另一份实现在〈哪个仓库〉的〈哪个文件〉，**改一处必须同步另一处**」。
   （`device/virtual_device.js` 在主仓，加注释不违反「一个字不改」——那是行为约束，
   加注释不改行为。**但只加注释，一个字逻辑都不许动。**）

3. **两份 README 互链**，`argx-esp32` 明确写清它适配的主仓协议版本（`proto: 1`）。

4. **主仓 `PROTOCOL.md` 里加一句回指**：「ESP32 侧参考实现见 `argx-esp32` 仓库」。

---

## 3. 执行顺序（分四步，每步都要能独立验证）

### 第 1 步：主仓先建、先推、先部署（**不拆**）

**先在一个仓库里把部署跑通。** 这是整件事里风险最高的一环（Pages 路径、`base`、
静态资源 404 都可能出问题），**在单仓状态下调试成本最低**。

1. 建远程仓库：`gh repo create argx --public --source=. --remote=origin`（**先别 push**，
   等检查完）
2. 确认 `.gitignore` 覆盖到位（`node_modules/` `console/dist/` `.vite/` `*.log` 已有；
   **再检查有没有别的构建产物、临时文件、编辑器目录**）
3. **扫敏感信息**（见第 6 节）
4. 推上去
5. **先让 CI 跑通**（见第 5.1 节），再加 Pages

### 第 2 步：GitHub Pages 部署（**最可能踩坑的一步**）

#### 3.1 关键事实

- **一个仓库只能有一个 Pages 站点。** 所以主仓只开一个站点，内部做路径分区：
  - 引导页 → `https://zheng tfb.github.io/argx/`
  - 控制台 → `https://zhengtfb.github.io/argx/console/`
  （实际地址以你的用户名为准，下同）

- **`console/vite.config.ts` 当前 `base: './'`（相对路径）。**
  这**不是** `'/argx/console/'`。相对路径在单层目录下通常能用，但在子路径 +
  SPA hash 路由下**必须实测**。见 3.2。

#### 3.2 部署前必须先跑一次本地验证

**不要靠推理判断路径对不对。** 先在本地模拟 Pages 的子路径环境：

```bash
cd console
npm run build
# 构建产物 dist/ 里含 index.html assets/ landing/ demo/ sdk/ design/
```

然后**用一个真正的静态服务器**把它挂在子路径下，用浏览器打开确认：
- 页面能出来
- CSS / JS 资源没有 404
- hash 路由切换正常
- `landing/` 与 `demo/` 能访问到

**如果 404**，把 `base` 改成 `'/argx/console/'`（注意 `dist` 是挂在 `/argx/console/`
下的），重新构建再验一次。

#### 3.3 部署方式

用 **GitHub Actions**（`actions/deploy-pages`），不要用 `gh-pages` 分支手动推。

原因：主仓的 Pages 内容**不是现成目录**，而是「引导页 + 控制台构建产物」两件东西拼出来的。
用 Actions 可以在 CI 里跑 `npm run build` 再把两个目录组装成站点，**构建产物不进仓库**。

**站点组装结构**（要自己拼）：

```
site/
├── index.html          ← landing/ 的内容（引导页在根）
├── landing.css
├── landing.js
├── design/             ← token（landing 引用了它）
├── console/            ← console/dist/ 的全部内容
│   ├── index.html
│   ├── assets/
│   ├── demo/
│   ├── sdk/
│   └── ...
```

> **实现提示**：`console/vite.config.ts` 里那个 `sharedDirs` 插件在 `closeBundle()`
> 会把 `demo/` `sdk/` `landing/` `design/` 拷进 `console/dist/`。
> 所以 `console/dist/` 里**已经有一份 `landing/`**——组装站点时注意别搞混：
> 根目录要放 `landing/index.html` 的内容，而 `console/landing/` 是构建时顺带拷进去的。
> **这一点必须实测确认，别想当然。**

#### 3.4 Web Serial 的说明要写进 README 与引导页

**Pages 是 HTTPS，所以 Web Serial 可用。** 但必须讲清一件事：

> **Web Serial 连的是访问者自己电脑上的 USB 口，不是服务器的。**
> 部署在 GitHub Pages 上的控制台，能通过浏览器直接跟**你插在自己电脑上的 ESP32** 通信。

这句话不写清，开源后第一个提问就是它。

### 第 3 步：拆仓

**等主仓的部署确认能开了，再拆。** 拆仓会动目录结构，先部署能避免同时调两个变量。

1. 建第二仓：`gh repo create argx-esp32 --public`
2. 按 2.3 的清单搬文件过去
3. 按 2.4 做四件同步措施
4. **`argx-esp32` 要能独立编译**：`arduino-cli compile -b esp32:esp32:esp32s3 .`
   能在仓库根跑通（需要的话配一份最小的 `README` 说明工具链）
5. 主仓里**删掉**搬走的东西？**不删**——主仓保留 `firmware/`（它本来就在，
   且 `tests/` 与文档引用它）。两个仓库各有一份，这是既定方案

### 第 4 步：写两份 README

见第 4 节。

---

## 4. 两份 README（本阶段最重要的交付物）

**定位：完全开源。技术向。不要营销腔、不要 badge 堆砌、不要 emoji 标题。**

### 4.1 主仓 `argx/README.md` — 基础设施风

**参照对象：`vite` / `esbuild` / `bun` 这类仓库的 README。**

结构（按这个顺序写）：

1. **一句话说清这是什么**（不超两行）。例：
   > 让网页上的故事操控现实物件的通用连接设施。
2. **它解决什么问题**（3–5 行）。说清 ARG 这个品类缺什么，以及本项目补的是哪一层。
   **必须提到那个类比**：ARG 是电影，硬件是音响，本项目是那根标准音频线。
3. **三个角色**（创作者 / 玩家 / 硬件作者），各一句话讲清他们分别得到什么。
4. **架构图**（**必须有**）。用 ASCII 或 Mermaid 画出：
   ```
   浏览器（控制台 / 第三方作品）
        │  SDK（零依赖）
        │  协议：每行一条 JSON
   ┌────┴────┐
   │  传输层  │  Web Serial ／ Mock
   └────┬────┘
        │
   ESP32 装置（固件）
   ```
   讲清「两端地位对等」「协议是唯一权威」这两条设计决定。
5. **快速开始**（**分三条路径，这是 README 最实用的部分**）：
   - **① 我只想看看** → 给 Pages 网址（引导页 + 控制台）
   - **② 我只想跑跑**（不需要硬件）→ clone + `node tests/run.js` + 起控制台 +
     用内置虚拟装置模拟器
   - **③ 我想接真硬件** → 指向 `argx-esp32` 仓库
6. **目录结构**（简短，每个目录一行说清干什么）
7. **为什么这么设计**（挑 3–5 条最有说服力的讲）：
   - 为什么协议每行一条 JSON（可读、可 `tee`、可人肉调试）
   - 为什么两端对等而不是主从
   - 为什么 SDK 零依赖、能整段复制进单文件 HTML
   - 为什么降级优于报错（无硬件时静默成功，绝不阻塞剧情）
   - 为什么能力是注册式的（加新功能不改协议）
8. **开发**（跑测试、改协议的顺序、改界面的顺序）
9. **相关仓库** → 指向 `argx-esp32`
10. **许可协议**

**必须回答的三个问题**（因为是完全开源，读者从零开始）：
1. ARG 是什么？
2. 三个角色怎么协作？
3. 我想看看 / 我想跑跑 / 我想接硬件——各走哪条路？

### 4.2 硬件仓 `argx-esp32/README.md` — 硬件项目风

**参照对象：`espressif/arduino-esp32` / `qmk` / `zmk` 这类仓库的 README。**

结构：

1. **这是什么** — ESP32 适配器，让 ARGX 协议跑在实物上
2. **支持的板子** — ESP32-S3-DevKitC-1-N8R8（成品板）、ESP32-WROOM-32E（旧款，见注意事项）
3. **元件清单（BOM）** — 表格：元件、规格、数量、备注
4. **接线图** — 接线的文字/ASCII 图 + 引脚表
5. **引脚表** — | 能力 id | GPIO | 元件 | 备注 |
   **必须写明为什么选这些引脚**：不用 GPIO5/6/7（5 是 strapping 脚，6/7 接内部 flash）
6. **编译与烧录** — 分步骤，讲清 `arduino-cli` 命令与 Arduino IDE 两条路；
   **必须写明 S3-DevKitC-1 的两个 USB 口区别**与 `USB CDC On Boot = Enabled` 这个开关
7. **连接测试** — 怎么确认装置活了（用控制台或 SDK）
8. **故障排查** — 常见问题对照表
9. **协议版本** — 适配主仓的 `proto: 1`，并链接回主仓
10. **许可协议**

**硬件仓 README 应该配图多**——接线图、实物照片。有图就放，没有就画 ASCII 图。

---

## 5. CI 与自动化

### 5.1 必须有的：主仓的测试 CI

**一个 workflow：在每次 push 和 PR 上跑五条闸门。** 这是开源仓库的基本门槛。

```yaml
# .github/workflows/test.yml
# node tests/run.js / sdk_smoke.js / agents_guide.js / demo_smoke.mjs
# cd console && npm install && npm run build
```

**固定所有 action 的版本**（写 `@v4` 而不是 `@main`）。

### 5.2 必须有的：Pages 部署 workflow

见 3.3。用 `actions/deploy-pages`。

### 5.3 不做的事

- ❌ 不做自动发布 / 自动打 tag
- ❌ 不做依赖更新机器人（Dependabot）
- ❌ 不做 code coverage 上报
- ❌ 不引入任何需要密钥的第三方服务

**理由：本阶段的目标是「发布出去」，不是「搭一套完整的工程化体系」。**
多了就是给后续维护加负担。

---

## 6. 发布前的敏感信息扫描（**不能省**）

**在第一次 push 之前，逐项确认：**

```bash
# 1. 有没有 token / 密码 / 密钥
grep -rn -i "ghp_\|github_pat_\|api[_-]key\|secret\|password\|passwd\|token" \
  --include="*.md" --include="*.json" --include="*.ts" --include="*.tsx" \
  --include="*.js" --include="*.mjs" --include="*.ino" --include="*.cpp" --include="*.h" \
  . | grep -v node_modules

# 2. 有没有硬编码的个人路径
grep -rn "C:\\\\Users\\\\msa\|/Users/msa\|msa\\\\" --include="*.md" --include="*.json" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" . | grep -v node_modules

# 3. 有没有 WiFi 凭据 / 内网地址
grep -rn -i "ssid\|wifi\|192\.168\|10\.0\.\|password" . | grep -v node_modules
```

**已知需要处理的两处**：

1. **`CLAUDE.md` 第 12 节与已知坑里有多处 `C:\Users\msa\.argx-tools\arduino-cli.exe`
   这类绝对路径。** 这些**不是秘密**（只是本机路径），但对别人无用。
   处理方式二选一：
   - 保留，但加注「这是作者的机器路径，你按自己的环境改」
   - 或换成占位符 `<你的工具路径>`
   **推荐前者**——保留真实路径能让 README 更可信，加注即可。

2. **`.gitignore` 里 `arduino-cli.exe` 那行的说明**——确认它没被提交进去。

**另外确认**：
- `.git` 目录里没有历史的敏感内容（**这个仓库是本地的，第一次 push，所以没有历史包袱**）
- `console/node_modules/` 和 `console/dist/` 没被 `git add`
- 没有任何 `.env` 文件

---

## 7. 开源许可

**用户已确认：完全开源。**

**默认用 MIT**（最宽松、最常见、对使用者最友好，符合「希望别人来用」的意图）。

**两个仓库都要有 `LICENSE` 文件**，文件名不带后缀（`LICENSE`，GitHub 才能识别）。
README 末尾的许可协议一节写：

```
MIT © <年份> <作者名>
```

**如果用户对许可协议有别的想法，先问他再做。**

---

## 8. 绝不能动清单

发布阶段**只加文件、只加配置**。以下内容一个字都不许改：

| 不能动 | 为什么 |
|---|---|
| `protocol/PROTOCOL.md` 的**内容** | 协议是唯一权威，发布不改内容（只可能加回指 `argx-esp32` 的一句） |
| `firmware/argx_mvp/` 的逻辑 | 阶段一已验收；加同步注释可以，逻辑一行不许动 |
| `device/virtual_device.js` 的行为 | 阶段一已验收；同上，只许加注释 |
| `tests/` 的断言内容 | 五条闸门是发布的门槛，不能为了让 CI 通过而改断言 |
| `console/src/core/session.ts` 的行为 | 阶段二已验收 |
| `console/src/transports/` 的接口契约 | 阶段二已验收 |
| `sdk/argx.js` 的对外行为 | 阶段三已验收 |
| `demo/` 三个文件 | 阶段三已验收 |
| `design/` 的**设计与原型** | 阶段四已验收，界面真源 |

**唯一允许的改动是「加注释」和「加新文件」。** 任何逻辑改动都要先问。

---

## 9. 验收标准

### 9.1 五条硬闸门（发布前基线，必须全绿）

```bash
node tests/run.js             # 213 项
node tests/sdk_smoke.js       # 23 项
node tests/agents_guide.js    # 12 项
node tests/demo_smoke.mjs     # 26 项
cd console && npm run build   # 零类型错误
```

### 9.2 发布验收（逐项）

| # | 验收项 | 怎么证明 |
|---|---|---|
| 1 | 主仓已 public，能 `git clone` | 在**另一个目录** clone 一遍，不是在自己仓库里看 |
| 2 | 引导页 Pages 可访问 | 打开网址，页面正常、背景四层在 |
| 3 | 控制台 Pages 可访问 | 打开 `/console/`，**六个栏目逐个点一遍**，无 404 |
| 4 | 控制台子路径下资源不 404 | 浏览器 DevTools Network 面板，**筛选 404**，应为 0 |
| 5 | Web Serial 在 Pages 上可用 | 打开控制台，插上真装置（或至少验证 `navigator.serial` 存在且页面是 HTTPS） |
| 6 | CI 全绿 | Actions 页面，最近一次 push 的 workflow 通过 |
| 7 | `argx-esp32` 已建且 public | clone 下来，`arduino-cli compile` 能过 |
| 8 | 两份 README 都写全 | 逐节对照第 4 节的结构清单 |
| 9 | 敏感信息扫描干净 | 第 6 节三条命令，无真实命中 |
| 10 | 两个仓都有 `LICENSE` | GitHub 仓库页顶部显示 MIT |
| 11 | 两份 README 互链 | 点过去能到 |
| 12 | `argx-esp32` 的 `PROTOCOL.md` 有副本标记 | 打开文件头看 |
| 13 | 仲裁代码处有互指注释 | `firmware/` 与 `device/` 各看一处 |
| 14 | 五条闸门在 clone 下来的干净副本里也全绿 | **在 clone 的目录里跑**，证明没依赖本机残留 |

**第 14 条最重要。** 它证明的是「别人 clone 下来真的能跑」——这是开源的底线。

### 9.3 该给的证据

- 两个仓库的网址
- Pages 的两个可访问链接
- CI 通过截图或链接
- 第 6 节三条扫描命令的输出（**应该无真实命中**）
- 在干净 clone 目录里跑五条闸门的输出

---

## 10. STOP

做完第 9 节全部验收项后：

1. 更新 `docs/PROGRESS.md`：加阶段五行、写清验收结果与决策记录
2. **STOP** —— 停下汇报，等审查

**不要顺手做任何本阶段范围外的事**（不新增功能、不重构、不优化界面）。

---

## 11. 交互策略

### 🛑 必须停下来问的

| 情况 | 为什么 |
|---|---|
| **需要用到我的 GitHub 账号做认证**（如新建 token、改账号设置） | 只有我能做 |
| **Pages 路径怎么调都跑不通，需要我判断** | 可能要在域名/仓库名上做取舍 |
| **你发现要改协议才能拆仓** | 协议是地基，这说明拆分方案有问题 |
| **许可协议要改**（不想用 MIT） | 法律相关，我拍板 |
| **发现任何敏感信息**（token、密码、内网地址） | 立刻停下告诉我，不要自作主张删除或改写 |
| **需要我提供硬件照片 / 接线图素材** | 硬件仓 README 需要图 |
| **仓库名和我的账号对不上**（`ZhengTFB` 是账号，仓库名你定） | 确认一下 |

### ✅ 自己定的

- 仓库名之外的所有仓库配置（描述、topics、默认分支）
- workflow 的具体写法（用哪个 action 版本、怎么缓存依赖）
- README 的措辞、结构微调、代码示例怎么写
- 站点目录怎么拼（只要验收能过）
- `argx-esp32` 里文件的摆放方式
- commit message 的写法

**原则：涉及账号、域名、法律、敏感信息 → 问我。其余自己定，最后汇报。**

（注意本阶段与前面阶段的不同：`CLAUDE.md` 第 8 节说「变量命名、代码组织」这类自己定，
这条仍然有效。但**发布涉及外部可见的东西，边界比写代码时窄**。）

---

## 12. 完成后提供

1. **两个仓库的网址**
2. **Pages 两个可访问链接**（引导页 + 控制台）
3. **CI 的 workflow 文件内容**与最近一次运行结果
4. **两份 README 的全文**（或链接）
5. **第 6 节三条扫描命令的原始输出**
6. **在干净 clone 目录里跑五条闸门的原始输出**（这是最关键的一项）
7. **过程里踩到的坑**（写进 `PROGRESS.md` 的决策记录，供后续开发者参考）
