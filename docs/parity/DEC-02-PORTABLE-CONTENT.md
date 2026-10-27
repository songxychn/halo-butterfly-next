# DEC-02 补充：通用 Markdown / HTML 正文

日期：2026-10-14。依据：维护者在本次需求盘点中明确纠正“完整兼容旧 Hexo 标签”目标，并要求同步路线图、矩阵和剩余需求；已合并的 [PR #408](https://github.com/songxychn/halo-butterfly-next/pull/408) 提供实现依据。本记录补充并取代 [DEC-02 原记录](https://github.com/songxychn/halo-butterfly-next/blob/409e79cc6e4bc027b35d2972b8854efcfbc61b28/docs/RELEASE-ACCEPTANCE.md#dec-02-裁定记录2026-09-15) 中冲突的成功条件；不声称原 issue #45 或 PR #408 已追加本次确认。

## 决定与成功条件

- 正文尽量使用通用 Markdown 和原生 HTML 保存真实文字、标题、列表、链接与图片。可选 `data-content-*` 属性只负责渐进增强，不是跨主题标准。
- 不以兼容 Hexo `{% %}`、专属 DOM/class、别名和完整参数域为目标；不要求作者把正文改写为 Butterfly 生成的结构。旧标签原文不由主题解析。
- 通用 Hexo 标签离线转换不是 1.0 默认义务。已有图库专用转换工具保留其原有范围；其他转换只在有明确迁移需求时另行确定，不以尚无通用转换器阻止正文能力验收。
- 按通用输入验证正文和交互：提示用 `blockquote/aside`，折叠和查看答案用 `details/summary`，Tabs 用带标题的 `section`，时间线用有序列表，按钮和静态卡片保留真实链接。接受可反复开合的原生折叠替代旧 hide 的一次性/行内揭示，不要求复刻旧按钮行为。
- 无脚本、脚本失败或换主题后应保留基本阅读与链接入口；不保证外观或增强交互跨主题一致。编辑器粘贴、保存、重开后的结构与内容保留仍需验证。
- 图库、图表和乐谱继续验收各自已声明的内容输入、渲染、按需资源、错误回退与生命周期；本决定不取消这些用户能力，也不把 JSON 增强输入说成通用 Markdown 标准。

## 矩阵处理

所有上游 ID 和来源保留，`tag:*` 作为能力来源索引，不是标签兼容清单。历史证据保留原提交与范围，不重写为新验收结果。

| 范围 | 本次处理 |
| --- | --- |
| `tag:btn/flink/hideBlock/hideInline/hideToggle/note/series/subnote/subsubtabs/subtabs/tabs/timeline`，`interaction:tabs/hide`（共 14 条） | PR #408 已有对应通用输入与实现，从 `gap` 改为 `implemented-unverified`；仍须完整验收。 |
| `tag:inlineImg`、`tag:label`（2 条） | 改为 `mapping-required`：按普通图片/行内 HTML 标记核对阅读能力、编辑器与样式，不再立项复刻旧标签 class/参数；尚无足够证据关闭。 |
| `config:note.style/icons/border_radius/light_bg_offset`（4 条） | 改为 `mapping-required`：旧配置保留为来源，需要核对提示语义、图标/文字、可读配色与外观定制的通用映射；不直接照搬旧键和取值，也不默认为已验收或不适用。 |
| 其他 `tag:*`、对应正文样式、`page:gallery` | 修改适配和断言，取消强制 Hexo 结构/转换，保留已实现能力与原状态。 |

1.1 活数据系列/侧栏系列的 12 条延期不变；第三方提供方等 184 条不适用不变；5 条验证失败不变。没有新增 `verified`，也没有新增不适用。矩阵逐项修订与源码哈希见 [机器记录](portable-content-reconciliation-2026-10-14.json)。

## 证据边界

PR #408 的实现及原限定报告见 [正文扩展](../CONTENT-EXTENSIONS.md)、[2026-10-13 验证记录](../validation/2026-10-13/content-extensions.md)。切换主题只验证了 Earth 1.15.3；无头手机宽度不代表真机或实际 Safari。当前修订只调整需求和证据解释，没有新增产品代码、真实 Halo、编辑器、设备或外部服务验收。

完整合同 EXT-01 继续要求通用正文能力、键盘、嵌套、锚点、打印、重复初始化、失败回退与可移植性证据；EXT-02 及其他无关合同场景保持原范围。

## 本次文档校验

- Bun 1.4.0 下 `bun run verify` 通过：691 项测试、0 失败，类型检查、897 条矩阵门禁、构建和 253 文件安装包检查通过。
- 最终补齐图表/乐谱相关条目的旧转换措辞后，重新生成 MATRIX.md，`bun run parity:check` 与 14 项矩阵测试通过。
- 共修订 64 条矩阵记录，其中 20 条状态变更；897 个 ID/上游来源、既有证据、失败/延期/不适用条目保持，剩余 97 条 gap/mapping-required 均有排期归组；机器记录和清单哈希一致，`git diff --check` 通过。
- 产品源码未修改；这些是文档一致性与工程检查，不是新增功能运行验收。
