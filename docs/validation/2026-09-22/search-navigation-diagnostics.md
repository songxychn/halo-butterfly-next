# 搜索导航一次超时与诊断补强

## 保留的失败

2026-09-22，公开 alpha 准备环境使用真实 Halo 2.26.1、官方 SearchWidget 1.7.1 / CommentWidget 3.3.2。运行器源提交为 `b971e1a8c9c2dfaf5c404d6f65c5dbdec7da3c53`，安装主题源提交为 `72930941dc14212217228ab272ed4bdc010c1a9c`，ZIP SHA-256 为 `ef93971f6a263a0e579dd15345d8221ea8c152fadeec813e3d2e37aae93b2441`。

该轮 26 项检查中，17 项通过，8 项搜索关闭焦点返回检查失败，另有 `search-390-light-query-and-navigation` 在 Enter 后等待 `domcontentloaded` 超时。原结果保持失败，不用后续复跑覆盖。8 项焦点失败是另行登记的问题，也未被此改动修复或转为通过。

超时日志已记录导航到正确的 `/archives/preview-1`；失败前截图也显示唯一正确结果被选中。代码中等待器在 Enter 前注册，URL 谓词容许尾斜杠。因此现有证据不能归因于错误结果选择或 URL 匹配。原运行未记录待完成资源和页面生命周期，无法确定为何未在 30 秒内满足 `domcontentloaded`。

## 有界定向调查

非作者审查 agent 使用独立匿名 headless Chromium 153.0.8010.12，在 390×844 亮色新 context 中复现相同的三次查询、Escape 关闭、键盘重开、背景关闭、再次查询和 Enter 操作，共 6 次通过。Enter 至导航提交为 23–33 ms，至 DOMContentLoaded 为 225–268 ms，至 load 为 254–296 ms。这些结果只能说明本轮定向调查没有重现原异常，不能证明原失败消失，也不构成搜索完整验收通过。

原始失败位于集成运行的 `.evidence/alpha-search-b971e1a8-enabled/report.json` 和同目录截图；定向调查原始材料暂存审查机 `/private/tmp/search-navigation-diagnose/`。这些本地路径不是可移交的正式发布证据；后续候选证据索引需保存脱敏副本及摘要。调查 trace 仅限匿名合成数据，不提交仓库或当成公开附件。

## 运行器改动与使用

每个搜索视口/模式在执行操作前开始记录有界结构化事件：请求开始/响应/完成/失败、导航提交对应的 `framenavigated`（区分主 frame）、DOMContentLoaded 和 load。失败检查附带当时的 URL、`document.readyState` 和待完成请求，整个搜索场景结束时再保存最终快照。事件最多 600 条、待完成请求最多 300 条，截断数量单独保留；文档状态读取最多等待 1 秒，上下文不可用时明确记录 `unavailable`。

新增诊断只记录 HTTP(S) origin/path、方法、资源类型、状态和标准网络错误代码；丢弃 URL 用户信息、查询与片段，不读 headers、Cookie、存储、请求体或响应体。不生成 trace，不在登录评论阶段采集。请求按对象身份跟踪，同 URL 的并发请求不会互相抵消。

命令和既有输出目录要求不变；运行后查看 `report.searchDiagnostics` 及失败检查的 `diagnostics`。既有等待时限、断言、通过标准和失败退出码均保持不变，不自动重试。若再次出现该异常，应关联导航提交、DOMContentLoaded 和未完成资源判定原因；不能把延长超时或一次复跑成功当作修复。
