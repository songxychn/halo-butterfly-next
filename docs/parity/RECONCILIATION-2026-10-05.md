# 功能矩阵与近期成果对账（2026-10-05）

本轮修复近期实现和验收记录没有同步到矩阵的问题。以 `6ad05ee24a5db83e7f777143a9142f3e39a63150` 的源码和文档为检查快照，核对 **35 条记录，改变 10 条状态**。唯一可编辑来源为 [matrix.json](matrix.json)，[MATRIX.md](MATRIX.md)重新生成；逐项前后值、代码入口、报告路径与 SHA-256 见 [机器可读对账](reconciliation-2026-10-05.json)。

## 具体更正

| 条目 | 更正与保留边界 |
| --- | --- |
| `interaction:tool-order` | 已有按钮分组、排序、去重、齿轮、Escape 和焦点处理，改为待对照验收；chat/comment 按钮未接入 |
| `interaction:outdated`、`template:includes/post/outdate-notice` | 文章模板和单篇三态覆盖已接入，改为待对照验收；天数取整、SSR 时钟与固定阈值边界仍待核对 |
| `interaction:post-pagination` | 已有 1/2/false 模式及 Halo cursor 方向映射，改为待对照验收；首尾、缺封面与摘要全域未完成验收 |
| `template:includes/post/reward` | 二维码列表及 hover 模板已接入，改为待对照验收 |
| `interaction:reward` | 保留 gap；已有 hover 弹层，但 div 按钮缺明确键盘和触屏开关，不能据模板存在宣称交互完整 |
| `interaction:related`、`helper:related_posts` | 保留 gap；实际入口只有候选去重和截断，加权/随机排序函数未接入 |
| 18 条阅读配置/注解 | 保持待对照验收，补齐 #356、实际代码入口与局部报告引用；不再只有实现说明而无证据 |
| `interaction:toc-anchor`、`interaction:toc-scroll` | 更新章节、历史、滚动偏移和单篇覆盖说明；保留完整跨引擎/真机缺口 |
| `config:rightside_bottom`、`config:rightside_scroll_percent` | 删除 item_order 仍未实现的陈旧交叉描述；本轮没有重验其全部参数域 |
| `page:home/post/page/archive/tag` | 最新 Linux 运行分别有失败路由，改为 verification-failed，关联 #338 与失败明细；原有搜索失败保留 |

生成器同时修复了一个展示遗漏：有 `halo.settings` 时也显示 `halo.finding`，让可读矩阵保留实现差异和剩余工作；897 条固定清单、验收断言和裁定范围保持不变。

## 证据与状态

[阅读配置局部报告](../validation/2026-10-05/reading-options.json)属于源码 `224691f391b189c66d4408bee153751c0ce8344d`。[最新 master 报告](../validation/2026-10-05/master-acceptance.json)属于 `b0ead077f5929b941f69c0b9ee763e7dd9a606f2`。两者安装包相同，但历史独立审查仍只代表原范围，不能迁移为本次文档提交或完整合同的审查证明。

Linux 运行共 111/120 页通过，9 页失败分布在上述 5 类页面；对账 JSON 逐条保留引擎、路径、宽度、亮暗和失败分类。页面失败不等于已经确定主题根因，也不自动把所有配置或交互改为失败。本地 HTTP/Chromium 局部通过不能抵消该失败。

| 状态 | 对账前 | 对账后 |
| --- | ---: | ---: |
| 有相关实现，待对照验收 | 280 | 280 |
| 待实现（可能含部分实现） | 361 | 356 |
| 待平台映射 | 108 | 108 |
| 验证失败 | 1 | 6 |
| 延期阻塞 | 12 | 12 |
| 不适用（已裁定） | 135 | 135 |
| 完整已验收 | 0 | 0 |
| 合计 | 897 | 897 |

待验收数量保持 280 是因为新增 5 条，同时有 5 类页面转为失败。不能因此推断本轮没有实现进展，也不能将 897 个交叉追踪条目换算成独立用户功能完成率。

本次仅核对上述 35 条，没有新跑浏览器或重新盘点所有余项。未改 tag 输入契约、延期 series 或提供方裁定。完整上游对照、逐项断言、非作者审查和对应提交 CI 仍是 verified 的前提；本次对账自身也待独立审查。

## 本次修复检查

`bun run verify` 通过：573 项测试、0 失败，类型检查、矩阵一致性和 127 文件安装包检查通过。新增生成器回归检查确认有设置入口时也保留缺口说明。另核对 897 个 ID、合同断言/场景、裁定和延期信息未变，仅本轮 35 条修改；全部新增证据路径与 SHA-256、本地文档链接有效，9 个 Linux 失败页均准确映射一次，`git diff --check` 通过。这些是文档修复的本地检查，不新增浏览器或独立审查证据。
