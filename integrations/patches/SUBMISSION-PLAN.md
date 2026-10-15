# 上游提交准备

2026-10-15。维护者已授权本地开发、并行审查与实验站验证；下面三项补丁尚未提交上游。正式插件版本由各上游维护者决定，本仓库的候选后缀只用于识别联调产物，不承诺长期私有发行。

## CommentWidget

- 仓库：[halo-dev/plugin-comment-widget](https://github.com/halo-dev/plugin-comment-widget)
- 建议标题：`Allow themes to opt into managed comment resources`
- 问题：全站 head 的 modulepreload 和 CSS 会在评论区触发前下载，主题无法实现真正按需加载。
- 改动：主题显式声明 `haloCommentResourcesManaged=true` 后，插件输出版本化资源元数据；未声明的主题继续原有全局注入。评论存储、权限、提交及编辑器保持原插件职责。
- 验证：198 项 Java 测试、完整前端构建、干净基线重建；Halo 2.27.0 三引擎网络、组件及数据请求检查；切换 Earth/返回主题、插件停用/恢复均通过。
- 可审查源码：[补丁](comment-widget/0001-theme-managed-resources.patch)与[构建说明](comment-widget/README.md)。

## KaTeX

- 仓库：[halo-sigs/plugin-katex](https://github.com/halo-sigs/plugin-katex)
- 建议标题：`Load frontend KaTeX resources only when content needs them`
- 问题：无公式页面仍下载样式，启用客户端渲染后还会全站下载 renderer。
- 改动：增加可选 `on_demand` 模式；已有 MathML 仅加载 CSS，明确选择器命中的原始公式才加载 JS；提供 refresh/suspend 生命周期，避免重复渲染和迟到资源污染。默认 global 模式仍可供其他主题使用。
- 验证：4 项 Java 测试，真实打包资源三引擎 36 项、CSS 竞态 2 项；真实 Halo 三引擎无公式/MathML/原始公式/PJAX 检查通过。已覆盖插件 classloader 隔离问题。
- 可审查源码：[补丁](katex/0001-content-aware-resources.patch)与[构建说明](katex/README.md)。

## Umami

- 仓库：[halo-sigs/plugin-umami](https://github.com/halo-sigs/plugin-umami)
- 建议标题：`Expose opt-in bounded public statistics for a fixed Umami website`
- 问题：主题需要展示访问统计，但不能把访问 Umami API 的凭据交给浏览器；未配置插件还可能注入无效跟踪脚本。
- 改动：扩展现有插件，默认关闭的匿名汇总端点只接受路径参数；服务端固定站点、统计起始日和上游，凭据仅从固定环境变量读取；加入缓存、限流、超时、严格数值/路径校验，以及关闭跟踪和空配置保护。
- 验证：52 项 Java 测试、控制台及完整构建；真实 Halo 匿名路由、缓存、非法输入、故障回退以及首页/文章数字展示共 6 组检查通过。上游是自托管 Umami 3.4.0 协议的本地合成响应，真实账户对账尚未完成。
- 可审查源码：[补丁](umami/0001-public-statistics.patch)与[构建说明](umami/README.md)。

## 提交与发行边界

建议先提交三项可独立评审的上游 PR，再根据上游反馈确定正式插件版本。主题暂时明确要求已验的补丁协议；不恢复旧 Halo/旧插件兼容层。上游若尚未接收，不把本地候选当作已发布依赖，也不据此宣布 1.0 完成。

待维护者最终确认的是是否提交上述三个上游 PR。生产升级和正式发行不在此提交动作内；真实账户、完整 1.0 合同及最终发行门禁仍须另行完成。
