# P03 插件资源按需：只读调查与最小后续范围

核对日期：2026-10-15（Asia/Shanghai）。本轮只读查询官方 GitHub release、精确 tag 与主线源码；没有修改外部仓库、提交上游 issue/PR、替换运行插件或部署生产。范围服从 [#415](https://github.com/songxychn/halo-butterfly-next/issues/415) 与 [平台决定](DEC-03-PLATFORM-DECISION.md)。下述是待实现的接口建议，不是现有插件已经支持的选项，也不是验收通过记录。

## 当前结论与版本

| 插件 | 已核对版本与提交 | 当前资源行为 / 兼容限制 |
| --- | --- | --- |
| 官方 CommentWidget，本项目既有基线 | `v3.3.2`，`1bb6becf499d3f23f3bf9c8ab08b71bb8e078b74` | head 无条件插入版本化 JS `modulepreload` 与 CSS；主题现有懒加载仅延后模块执行/组件挂载及评论数据请求，不能阻止这两项首屏下载。 |
| 官方 CommentWidget，查询时最新正式版 | `v3.4.0`，`ae278ec1be30bc197e99557090d62f34d76823de`，2026-10-14 发布；查询时 main 为 `dfbf67e1761aefec18362a4846f98a719f55d858` | release 和 main 的 head 注入仍无条件；release 设置没有资源按需开关。`plugin.yaml` 明确要求 Halo `>=2.27.0`，不能直接替换合同 Halo 2.26.1 上的 3.3.2 来解决本项。 |
| Halo KaTeX，查询时最新正式版 | `v3.0.0`，`07c18d120c43dd680390aebe112bd7c6a9565278`，2026-01-16 发布；查询时 main 为 `88d0def91739bb0e4a892fcefc4dee7d988beb32` | 要求 Halo `>=2.22.2`。有基本配置时 head 全站输出 CSS；开启客户端渲染后全站输出 JS。release 和 main 的 head 处理器均未按页面公式内容判断；关闭客户端渲染不能去掉 CSS。 |

来源：[CommentWidget 3.3.2 head](https://github.com/halo-dev/plugin-comment-widget/blob/1bb6becf499d3f23f3bf9c8ab08b71bb8e078b74/src/main/java/run/halo/comment/widget/CommentWidgetHeadProcessor.java)、[3.4.0 release](https://github.com/halo-dev/plugin-comment-widget/releases/tag/v3.4.0)、[3.4.0 head](https://github.com/halo-dev/plugin-comment-widget/blob/ae278ec1be30bc197e99557090d62f34d76823de/src/main/java/run/halo/comment/widget/CommentWidgetHeadProcessor.java)、[3.4.0 设置](https://github.com/halo-dev/plugin-comment-widget/blob/ae278ec1be30bc197e99557090d62f34d76823de/src/main/resources/extensions/settings.yaml)、[3.4.0 平台要求](https://github.com/halo-dev/plugin-comment-widget/blob/ae278ec1be30bc197e99557090d62f34d76823de/src/main/resources/plugin.yaml)；[KaTeX 3.0.0 release](https://github.com/halo-sigs/plugin-katex/releases/tag/v3.0.0)、[release head](https://github.com/halo-sigs/plugin-katex/blob/07c18d120c43dd680390aebe112bd7c6a9565278/src/main/java/run/halo/katex/KaTeXHeadProcessor.java)、[main head](https://github.com/halo-sigs/plugin-katex/blob/88d0def91739bb0e4a892fcefc4dee7d988beb32/src/main/java/run/halo/katex/KaTeXHeadProcessor.java)、[平台要求](https://github.com/halo-sigs/plugin-katex/blob/07c18d120c43dd680390aebe112bd7c6a9565278/src/main/resources/plugin.yaml)。

## 第一项：评论资源

最小建议是在官方插件增加**明确 opt-in 的主题管理资源契约**：默认保持当前注入；仅在当前请求/当前主题明确接管资源时，head 不再发出 `modulepreload`/stylesheet，而以不会触发下载的元数据提供版本化模块与 CSS 地址。具体变量/API 形式须在 Halo 的模板执行顺序下验证并与上游约定，不能假定一个新字段已被平台识别。避免仅增加全站总开关而让切换到其他主题后丢失样式。

预计插件侧涉及 `CommentWidgetHeadProcessor.java`、资源契约声明/配置入口、说明和定向测试；不更改评论存储、权限、提交、验证码或编辑器。主题侧继续复用现有 `comment-lazy.ts` 和官方组件，在接近视口/锚点跳转时加载样式和模块；当前 `commentModuleUrl()` 从 `modulepreload` 读取 URL，因此必须同步支持上述不下载元数据，不能只删除 preload。需要样式失败/重试、资源去重、切页取消和版本一致性检查。

验收分别记录下载、组件挂载、数据请求：普通无评论页和延迟区未触发时不下载评论资源；接近视口、点击跳转、直接锚点可加载；立即模式仍正常；Post/SinglePage/Moment 主体正确；CSS/JS 故障能恢复，编辑草稿不被重建，PJAX 往返不重复请求/组件。插件缺失/停用、旧版资源契约与其他主题继续回归。

**版本决定仍需明确**：优先向当前上游提交通用能力；若仍以 Halo 2.26.1 完成合同，则需要官方兼容版本回移或一个明确维护的 3.3.2 补丁来源。自行升级合同 Halo、安装不满足最低版本的 3.4.0、长期维护私有 fork 均不属于本建议默认授权。

## 第二项：KaTeX 资源

最小建议同样为官方插件提供明确 opt-in 的资源接管/按内容加载入口，默认保持旧行为。`KaTeXHeadProcessor.java` 在接管模式不再全站输出资源；插件的 Post/SinglePage 内容处理器与前台初始化器需要一起处理，避免它们仍插入依赖全局 `katex` 的同步脚本。

默认编辑器保存的 MathML 与原始 TeX 分开处理：已渲染 MathML 保持原文与可访问语义，有公式时按需补 CSS，不需要重新加载渲染 JS；其他编辑器的原始节点仅在明确选择器实际命中时加载 JS，加载完成后再渲染，禁止重复处理已有 MathML。无公式页面不得因启用插件而下载 CSS/JS；有公式页不要求等到公式进入视口后才加载。若采用 DOM 探测，应在当前页面内容初始化后执行并参与 PJAX 生命周期，不用固定延时猜测时序。

预计外仓范围为 head 处理器、`BasicConfig`/设置与文档、两种内容处理器、`KaTeXJSInjector` 和定向测试；不改编辑器存储格式、不引入新的数学渲染库、不重做插件。现有选择器会直接进入生成脚本，相关变更应采用正确序列化并验证非法选择器；此处只是改动边界建议，不将其他潜在问题扩大成本轮实现任务。

来源：[Post 内容处理器](https://github.com/halo-sigs/plugin-katex/blob/07c18d120c43dd680390aebe112bd7c6a9565278/src/main/java/run/halo/katex/DefaultPostContentHandler.java)、[SinglePage 内容处理器](https://github.com/halo-sigs/plugin-katex/blob/07c18d120c43dd680390aebe112bd7c6a9565278/src/main/java/run/halo/katex/DefaultSinglePageContentHandler.java)、[前台初始化器](https://github.com/halo-sigs/plugin-katex/blob/07c18d120c43dd680390aebe112bd7c6a9565278/src/main/java/run/halo/katex/KaTeXJSInjector.java)。

验收覆盖无公式/MathML/原始公式、客户端渲染开关、合法/非法选择器、加载失败及恢复、PJAX 五次往返、重复初始化、辅助 MathML 保留、切换其他主题与插件启停。主题显示开关仍只控制阅读表示，不冒充插件资源控制。

## 留到最后的审批项

需要维护者决定的是插件支持与发行路线：向当前官方上游推进上述通用资源契约，还是在维持 Halo 2.26.1 合同基线的同时准备 CommentWidget 3.3.2 兼容回移，并明确其维护与发行来源。建议优先争取官方契约；最新 CommentWidget 的最低 Halo 版本使兼容回移无法被一次普通主题修改代替。向上游提交 issue/PR 和生产安装/升级须有对应授权；本地只读调查、可撤销的技术验证本身不需要额外审批。当前不请求通过放宽首屏资源要求关闭 P03。

本仓库可以继续独立推进 RSS／站点地图、原生图片映射和已有实现验收；P03 保留未满足资源要求，不把本次源码调查当成新的真实运行证据。
