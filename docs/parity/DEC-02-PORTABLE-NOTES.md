# DEC-02 补充：通用提示块外观

日期：2026-10-26。依据：维护者明确确认“那就采用通用提示块的方案”。本记录补充 [通用正文决定](DEC-02-PORTABLE-CONTENT.md)，解决其中四项 note 配置的待映射取舍；不改变其他正文能力合同。

## 1.0 方案

- 使用原生 `blockquote` / `aside` 保存文字，以可选 `data-content-note` 增强；支持 `info`（默认）、`success`、`warning`、`danger` 四种语义。
- 采用已有浅深色配色、边框、左侧强调线和默认 6px 圆角。外观通过自定义 CSS 调整，不增加四项旧全局配置。
- 提示含义必须由正文文字表达，不要求自动图标。图标和配色不能代替“注意”“成功”等实际文字。
- 1.0 不复刻 `note.style` 的样式枚举、`note.icons` 的自动图标开关、`note.border_radius` 的全局圆角数值及 `note.light_bg_offset` 的全局背景亮度算法。自定义 CSS 是外观调整途径，不承诺旧设置或旧主题外观等价。
- 不兼容 Hexo 标签、专属 class 或完整参数域；普通 Markdown 引用不会自动变成警告块。换主题后保留文字、结构与链接，增强外观不保证保留。

## 来源与映射

固定上游 Butterfly 5.7.0：`f223b1888b42b2b336068e6c959ed90a3cd7c8f3`。当前产品：`64f526621870bd96514683b5746c30a610dc6e93`；本次没有修改产品代码。

| 历史 ID | 上游消费者 | 1.0 保留能力 |
| --- | --- | --- |
| `config:note.style` | `scripts/tag/note.js` 选择样式 class，`source/css/_tags/note.styl` 应用样式 | 原生提示正文、四种语义和统一样式，可用 CSS 调整 |
| `config:note.icons` | `source/css/_tags/note.styl` 控制伪元素图标及留白 | 实际文字表达提示含义，不要求自动图标 |
| `config:note.border_radius` | `source/css/_tags/note.styl` 生成像素圆角 | 默认 6px；可用 CSS 覆盖 |
| `config:note.light_bg_offset` | `source/css/var.styl` 计算浅色背景变量，供提示样式消费 | 已有浅深色语义配色；可用 CSS 覆盖，不复刻亮度偏移算法 |

目标消费者为 `src/scss/modules/content-extensions.scss`；作者输入见 [正文扩展](../CONTENT-EXTENSIONS.md)。源码摘要和逐项断言见 [机器对账](portable-note-reconciliation-2026-10-26.json)。

## 状态与证据边界

四项从 `mapping-required` 转为 `implemented-unverified`，表示维护者已选择现有实现作为替代方案。保留 ID、来源、历史证据与适用分母，不改为 `verified` 或 `not-applicable`。矩阵仍为 897 项，其中 184 项不适用、23 项延期，1.0 适用 690 项；本次不新增运行验收。

EXT-01 的编辑器保存重开、文字/结构/链接保留、浅深色阅读、嵌套、锚点、打印、重复初始化、失败回退与换主题阅读继续验收；功能合同内的键盘/焦点要求不取消。历史 PR #408 及旧候选证据保留原范围，不自动成为当前包通过记录。其余行内图片、行内标记与封面类型映射仍待核对。

本次只修订合同和清单，PR #430 保持草稿，先不发布 1.0。
