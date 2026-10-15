# P03 官方插件能力边界与方案撤回

2026-10-15。维护者已明确拒绝将本次功能增强提交上游，并澄清“不考虑兼容性”仅指本主题自身，不包括 Halo 或官方插件。此前定制资源协议、强制 Halo 2.27.0 与 Umami 插件扩展路线已撤回；没有向三个插件上游提交 issue/PR，也没有发布或生产部署。详见[兼容边界更正](PLATFORM-COMPATIBILITY-CORRECTION.md)。

以下保留当日对官方发行版的源码调查事实，用于说明现有能力边界，不构成修改上游的行动计划。

## 当前结论与版本

| 插件 | 已核对版本与提交 | 当前资源行为 / 兼容限制 |
| --- | --- | --- |
| 官方 CommentWidget，本项目既有基线 | `v3.3.2`，`1bb6becf499d3f23f3bf9c8ab08b71bb8e078b74` | head 无条件插入版本化 JS `modulepreload` 与 CSS；主题现有懒加载仅延后模块执行/组件挂载及评论数据请求，不能阻止这两项首屏下载。 |
| 官方 CommentWidget，查询时最新正式版 | `v3.4.0`，`ae278ec1be30bc197e99557090d62f34d76823de`，2026-10-14 发布；查询时 main 为 `dfbf67e1761aefec18362a4846f98a719f55d858` | release 和 main 的 head 注入仍无条件；release 设置没有资源按需开关。`plugin.yaml` 明确要求 Halo `>=2.27.0`，不能直接替换合同 Halo 2.26.1 上的 3.3.2 来解决本项。 |
| Halo KaTeX，查询时最新正式版 | `v3.0.0`，`07c18d120c43dd680390aebe112bd7c6a9565278`，2026-01-16 发布；查询时 main 为 `88d0def91739bb0e4a892fcefc4dee7d988beb32` | 要求 Halo `>=2.22.2`。有基本配置时 head 全站输出 CSS；开启客户端渲染后全站输出 JS。release 和 main 的 head 处理器均未按页面公式内容判断；关闭客户端渲染不能去掉 CSS。 |

来源：[CommentWidget 3.3.2 head](https://github.com/halo-dev/plugin-comment-widget/blob/1bb6becf499d3f23f3bf9c8ab08b71bb8e078b74/src/main/java/run/halo/comment/widget/CommentWidgetHeadProcessor.java)、[3.4.0 release](https://github.com/halo-dev/plugin-comment-widget/releases/tag/v3.4.0)、[3.4.0 head](https://github.com/halo-dev/plugin-comment-widget/blob/ae278ec1be30bc197e99557090d62f34d76823de/src/main/java/run/halo/comment/widget/CommentWidgetHeadProcessor.java)、[3.4.0 设置](https://github.com/halo-dev/plugin-comment-widget/blob/ae278ec1be30bc197e99557090d62f34d76823de/src/main/resources/extensions/settings.yaml)、[3.4.0 平台要求](https://github.com/halo-dev/plugin-comment-widget/blob/ae278ec1be30bc197e99557090d62f34d76823de/src/main/resources/plugin.yaml)；[KaTeX 3.0.0 release](https://github.com/halo-sigs/plugin-katex/releases/tag/v3.0.0)、[release head](https://github.com/halo-sigs/plugin-katex/blob/07c18d120c43dd680390aebe112bd7c6a9565278/src/main/java/run/halo/katex/KaTeXHeadProcessor.java)、[main head](https://github.com/halo-sigs/plugin-katex/blob/88d0def91739bb0e4a892fcefc4dee7d988beb32/src/main/java/run/halo/katex/KaTeXHeadProcessor.java)、[平台要求](https://github.com/halo-sigs/plugin-katex/blob/07c18d120c43dd680390aebe112bd7c6a9565278/src/main/resources/plugin.yaml)。

## 当前主题处理方式

- 评论继续使用官方 CommentWidget 的版本化模块地址，按需要延迟组件挂载和数据请求，保留立即模式、锚点、失败重试和切页清理。官方插件 head 预加载的脚本/样式仍可能提前下载，不宣称首屏零评论资源。
- KaTeX 继续使用官方插件输出，主题处理显示、复制及原文回退；不删除或劫持官方注入，不增加必须由定制插件提供的按需协议。全站 CSS/JS 的行为按官方版本如实记录。
- Halo 最低版本恢复 `>=2.20.2`，评论入口仍遵循官方插件最低版本及其 Halo 要求。已有实测基线为 Halo 2.26.1 / CommentWidget 3.3.2；3.4.0 自身要求 Halo 2.27.0，不等于整个主题必须提高最低版本。未来官方版本按实际组合验证，不承诺未经测试的全部版本。
- Umami 保留主题追踪和公开统计接口消费功能；私有凭据不能放在浏览器。撤回现有插件的统计端点补丁，后端承载待重新讨论，不自动建立另一套服务。

## 状态与历史记录

严格的评论／公式资源按需目标保持未满足；此次纠正不将其标为通过、取消或延期。后续方案需在维护者确认的官方兼容边界内讨论。三个上游提交计划已取消，不再列为待审批事项。

`946d63d` 和 `2d6fbad` 的补丁实验与运行记录保留在 Git 历史及明确标注撤回的验收文档中，只说明那组定制组合曾怎样运行，不能证明当前官方插件兼容组合已验收。当前源码不包含这些补丁或专用安装脚本。
