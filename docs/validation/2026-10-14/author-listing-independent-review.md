# D06 独立审查（2026-10-14）

审查者：Moments/D07 lane；实现作者：i18n/D06 lane。目标提交 `dbc7a35bae1869e5a0721603d8fd54c8a7972d0d`，工作树 `theme-i18n/halo-butterfly-next`。本次未修改目标代码或实验室配置。

结论：未发现阻断问题。

阅读全部提交差异，重点检查逐篇 aside/代码初始折叠的覆盖优先级和模板变量上下文；版权字段文字转义、危险协议拒绝与 Render 保留服务端原文链接；标签排序后裁剪和字号边界；归档菜单同站过滤、年月服务端标题；日期格式允许列表和默认回退。

独立运行 `bun test tests/listing-options.test.mjs tests/post-copyright.test.mjs tests/code-shrink.test.mjs tests/aside-hide-button.test.mjs tests/tags-style.test.mjs`，Bun 1.4.0 下 22 项通过、0 失败。只读请求作者独占 `18105` 实验室 `/archives/2026/08?language=en`，HTTP 200，服务端标题为 `2026-08`，无非法日期格式泄漏。

作者记录明确区分最后图表默认字号和日期格式修复前后的浏览器运行，不将旧包的全部运行冒充最终包。此次独立审查未复跑会写入 fixture/config 的完整浏览器脚本；合并后的 PJAX、语言及整体浏览器验收仍交由主任务执行，不新增完整 verified。
