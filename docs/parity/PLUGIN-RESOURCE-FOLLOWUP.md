# P03 官方插件能力边界

核对日期：2026-10-15。主题使用官方已发布插件接口，主题自身配置或内部接口调整不改变 Halo／官方插件兼容要求。

以下官方发行版调查用于说明当前资源加载边界与未完成要求。

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
- Halo 最低版本为 `>=2.20.2`，评论入口遵循官方插件最低版本及其 Halo 要求。已有实测基线为 Halo 2.26.1 / CommentWidget 3.3.2；3.4.0 自身要求 Halo 2.27.0，不等于整个主题必须提高最低版本。未来官方版本按实际组合验证，不承诺未经测试的全部版本。
- Umami 保留主题追踪和公开统计接口消费功能；私有凭据不能放在浏览器。后端承载待确定，不自动建立另一套服务。

## 当前状态

严格的评论／公式资源按需目标保持未满足，不自行标为通过、取消或延期。后续方案需在维护者确认的官方兼容边界内讨论。
