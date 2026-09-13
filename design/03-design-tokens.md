# ARGX 设计 Token 规范

> 版本 v1.0 ｜ 面向 Web 端（桌面优先）
> 本文件是整个设计体系的**唯一数值来源**。所有页面、组件、原型必须引用这里的 token，不得出现硬编码数值。

---

## 0. 设计基准

| 项目 | 数值 | 说明 |
|---|---|---|
| 基准网格 | **4px** | 所有间距、尺寸、圆角均为 4 的倍数 |
| 设计基准宽度 | **1440px** | 控制台布局基准 |
| 内容最大宽度 | **1280px** | 首页/文档正文容器 |
| 栅格 | **12 列 / 24px gutter** | |
| 基础字号 | **14px** | 控制台正文；首页正文 16px |

---

## 1. 间距阶梯 Spacing

12 档，基于 4px。**命名即数值含义**，禁止出现阶梯外的值。

| Token | 值 | 使用场景 |
|---|---|---|
| `--space-1` | **4px** | 图标与文字间隙、标签内边距（水平） |
| `--space-2` | **8px** | 按钮内图标间隙、紧密堆叠的元素间 |
| `--space-3` | **12px** | 卡片内小模块间距、输入框内边距 |
| `--space-4` | **16px** | **基准间距**：卡片内边距（小卡）、表单行间距 |
| `--space-5` | **20px** | 卡片内边距（标准卡） |
| `--space-6` | **24px** | **卡片间距基准**：卡片之间、区块内元素间距 |
| `--space-8` | **32px** | 区块内边距、区块内大分组间距 |
| `--space-10` | **40px** | 页面主内容区上边距 |
| `--space-12` | **48px** | 区块垂直间距 |
| `--space-16` | **64px** | 首页大区块间距（移动端） |
| `--space-24` | **96px** | 首页大区块间距（桌面） |
| `--space-32` | **128px** | 首页 Hero 区上下留白 |

### 关键间距规则
- **页面内边距**：控制台主区 `32px`（左右+上），移动端降为 `20px`
- **卡片之间**：`24px`（横向+纵向统一，不搞大小不一）
- **卡片内边距**：标准卡 `20px`；紧凑卡（KPI 小卡）`16px`；大卡（画布区）`24px`
- **区块与区块之间**：`32px`；跨主题区块 `48px`

---

## 2. 圆角阶梯 Radius

6 档。整体偏**大圆角、柔和**（对齐参考图）。

| Token | 值 | 使用场景 |
|---|---|---|
| `--radius-xs` | **4px** | 标签 tag、徽章 badge、小 chip |
| `--radius-sm` | **6px** | 输入框、下拉框、小按钮、图标容器 |
| `--radius-md` | **10px** | 标准按钮、胶囊内层元素、选项卡单项 |
| `--radius-lg` | **14px** | **标准卡片**（KPI 卡、内容卡） |
| `--radius-xl` | **18px** | **大卡片 / 面板**（画布容器、大内容块） |
| `--radius-2xl` | **24px** | 弹窗、抽屉、浮层 |
| `--radius-full` | **9999px** | 胶囊按钮、状态胶囊、头像、开关轨道 |

### 圆角规则
- 嵌套时：**内层圆角 = 外层圆角 − 内边距**（避免同心圆角视觉不齐）
- 卡片统一 `--radius-lg`(14px)，**不因卡片大小随意改圆角**
- 唯一例外：大画布容器用 `--radius-xl`(18px)，因为内边距更大

---

## 3. 阴影阶梯 Elevation

**核心原则：阴影极淡，靠边界和层次而非阴影堆叠。** 参考图的卡片几乎看不出阴影。

| Token | 值 | 使用场景 |
|---|---|---|
| `--shadow-none` | `none` | 默认卡片（靠 border 区分，不用阴影） |
| `--shadow-xs` | `0 1px 2px rgba(16,24,40,.04)` | 卡片默认态 |
| `--shadow-sm` | `0 2px 4px rgba(16,24,40,.05), 0 1px 2px rgba(16,24,40,.03)` | 卡片 hover |
| `--shadow-md` | `0 4px 12px rgba(16,24,40,.06), 0 2px 4px rgba(16,24,40,.04)` | 卡片 hover 抬升 / 悬浮元素 |
| `--shadow-lg` | `0 8px 24px rgba(16,24,40,.08), 0 2px 6px rgba(16,24,40,.04)` | 下拉菜单、气泡 |
| `--shadow-xl` | `0 16px 48px rgba(16,24,40,.12), 0 4px 12px rgba(16,24,40,.06)` | 弹窗、抽屉 |
| `--shadow-focus` | `0 0 0 3px rgba(37,99,235,.16)` | **键盘 focus 环（专用，必用）** |
| `--shadow-focus-danger` | `0 0 0 3px rgba(220,38,38,.16)` | 错误态 focus 环 |
| `--shadow-inset` | `inset 0 0 0 1px rgba(16,24,40,.04)` | 内凹区域（代码块） |

### 阴影规则（严禁违反）
- **同一视觉层级只允许一层阴影**：卡片内不再放带阴影的卡片
- **卡片内嵌子卡片用背景色区分**（`#F5F6F8`），**不加阴影、不加边框**
- 全站阴影最深不超过 `--shadow-lg`，弹窗才可用 `--shadow-xl`
- 深色主题下阴影**必须加重至 2 倍不透明度**（深色背景吃阴影，见配色方案第 5 节）

---

## 4. 字号阶梯 Typography

**字体族**
```css
--font-sans: "Inter", -apple-system, "Segoe UI", "PingFang SC",
             "Microsoft YaHei", "Helvetica Neue", sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", "Cascadia Code",
             ui-monospace, "Consolas", monospace;
```
> 中文走 PingFang SC / Microsoft YaHei 回退；数字与代码走 mono，**所有数值、KPI、串口指令、时间戳必须用 mono**。

### 字号阶梯（13 档）

| Token | size / line-height | 字重 | 使用场景 |
|---|---|---|---|
| `--text-3xs` | **10px / 14px** | 500 | KPI 卡标签、mini 徽章（全大写 + letter-spacing） |
| `--text-2xs` | **11px / 16px** | 500 | 辅助标签、图例、时间戳、表头 |
| `--text-xs` | **12px / 18px** | 400–500 | 次要说明、卡片副标题、面包屑 |
| `--text-sm` | **13px / 20px** | 400 | **控制台侧栏项、表头、密集列表** |
| `--text-base` | **14px / 22px** | 400 | **控制台正文基准**、按钮、输入框 |
| `--text-md` | **15px / 24px** | 500 | 卡片标题（小）、列表主标题 |
| `--text-lg` | **16px / 26px** | 400–500 | 首页正文、文档正文 |
| `--text-xl` | **18px / 28px** | 600 | **卡片标题（标准）**、区块小标题 |
| `--text-2xl` | **22px / 30px** | 600 | 页面区块标题 |
| `--text-3xl` | **28px / 36px** | 650 | **KPI 大数字**、页面标题 |
| `--text-4xl` | **36px / 44px** | 700 | 首页区块大标题 |
| `--text-5xl` | **56px / 64px** | 700 | 首页 Hero 主标题 |
| `--text-6xl` | **80px / 88px** | 700 | 首页开场四拍（Hero 动效层） |

### 字重
`400` 正文 ｜ `500` 强调/按钮/标签 ｜ `600` 标题 ｜ `700` 大标题 ｜ `650` KPI 数字（Inter 可变字重支持）

### 字间距 letter-spacing
| 场景 | 值 |
|---|---|
| 大标题（≥36px） | `-0.02em`（负收紧，视觉更整） |
| KPI 数字（≥28px） | `-0.03em` |
| 正文 | `0` |
| 全大写小标签（≤11px） | `0.06em` |

### 关键排版规则
- **不用副标题解释标题**：标题下面不挂说明句，靠布局层级自解释
- 一个区块内**最多 3 级字号**，避免层级噪音
- 数字统一 `font-variant-numeric: tabular-nums`（防止跳动）

---

## 5. 动效 Token

| Token | 时长 | 缓动 | 使用场景 |
|---|---|---|---|
| `--dur-micro` | **90ms** | `ease-out` | 微反馈：hover 变色、图标位移、focus 环浮现 |
| `--dur-fast` | **140ms** | `cubic-bezier(.32,.72,0,1)` | 按钮 hover、开关切换、chip 选中 |
| `--dur-normal` | **260ms** | `cubic-bezier(.32,.72,0,1)` | 卡片 hover 抬升、折叠展开、tab 指示器位移 |
| `--dur-slow` | **360ms** | `cubic-bezier(.32,.72,0,1)` | 弹窗/抽屉进出、面板切换 |
| `--dur-page` | **480ms** | `cubic-bezier(.22,1,.36,1)` | 页面/视图切换 |
| `--dur-reveal` | **700ms** | `cubic-bezier(.22,1,.36,1)` | 首页开场逐词揭示（每词间隔 220ms） |

### 缓动曲线
```css
--ease-out:    cubic-bezier(.32, .72, 0, 1);      /* 主缓动，快进慢出 */
--ease-in-out: cubic-bezier(.65, 0, .35, 1);      /* 对称场景 */
--ease-reveal: cubic-bezier(.22, 1, .36, 1);      /* 大位移揭示 */
--ease-linear: linear;                            /* 进度条、仪表盘数值 */
```

### 允许动的属性（**白名单，硬约束**）
```css
transform    /* translate / scale / rotate */
opacity
filter       /* blur / brightness —— 首页逐词揭示用 */
background-color / color / border-color   /* 无位移的变色 */
box-shadow
clip-path / mask-position                  /* 进度、揭示 */
```
**禁止动**：`width` `height` `top` `left` `right` `bottom` `margin` `padding` `font-size`

### prefers-reduced-motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
  /* 首页逐词揭示：直接全部显示，不做依次出现 */
  .reveal-word { opacity: 1 !important; filter: none !important; transform: none !important; }
}
```

---

## 6. 层级 z-index

| Token | 值 | 使用 |
|---|---|---|
| `--z-base` | 0 | 默认 |
| `--z-sticky` | 100 | 吸顶导航、表头 |
| `--z-dropdown` | 200 | 下拉菜单 |
| `--z-overlay` | 300 | 遮罩 |
| `--z-modal` | 400 | 弹窗 / 抽屉 |
| `--z-toast` | 500 | 全局提示 |
| `--z-tooltip` | 600 | 气泡提示 |

---

## 7. 断点

| 名称 | 范围 | 控制台行为 |
|---|---|---|
| `sm` | < 640px | 侧栏收为抽屉；KPI 卡 1 列；右侧预览条隐藏 |
| `md` | 640–1023px | 侧栏仅图标；KPI 卡 2 列；右侧预览条窄版 |
| `lg` | 1024–1439px | 完整布局；KPI 卡 3 列；预览条完整 |
| `xl` | ≥ 1440px | 内容区最大 1280px 居中；预览条完整 |

> 本阶段交付为**桌面端（≥1280px）**完整原型，移动端仅标注规则。

---

## 8. 动效时长速查（对照你的准则）

| 你的准则 | 本方案对应 | 校验 |
|---|---|---|
| 微反馈 80–120ms | `--dur-micro: 90ms` | ✅ |
| 按钮 120–180ms | `--dur-fast: 140ms` | ✅ |
| 卡片 200–350ms | `--dur-normal: 260ms` | ✅ |
| 弹窗 300–400ms | `--dur-slow: 360ms` | ✅ |
| 页面切换 400–600ms | `--dur-page: 480ms` | ✅ |
