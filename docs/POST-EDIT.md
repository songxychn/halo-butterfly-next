# 后台编辑快捷入口

主题设置 →「文章设置」→「后台编辑入口」提供“显示编辑本文快捷入口”开关（`post.post_edit.enable`），默认关闭。开启后，有文章查看及管理权限的登录用户会在文章日期旁看到“编辑”，在新标签页打开该文章的 Halo 后台编辑页。仅文章详情页提供此入口；普通访客、自定义页面和文章列表不显示。

## Halo 平台适配决定

2026-10-11，维护者选择“给自己快速进入 Halo 后台”，并授权实现上述方案。上游 Butterfly 5.7.0 的 `post_edit.url` 是 GitHub 等文章源文件的编辑地址前缀；本项目保留对应矩阵 ID，适配为 Halo 当前文章的固定后台路由 `/console/posts/editor?name=<post.metadata.name>`。不新增外部 URL 输入，也不要求逐篇配置链接。此决定只适用于文章编辑入口，不缩减其他 1.0 能力。

路由及权限依据：Halo [文章路由](https://github.com/halo-dev/halo/blob/v2.26.1/ui/console-src/modules/contents/posts/module.ts)、[列表中的编辑操作](https://github.com/halo-dev/halo/blob/v2.26.1/ui/console-src/modules/contents/posts/components/PostListItem.vue)、[官方权限判断](https://github.com/halo-dev/halo/blob/v2.26.1/ui/packages/shared/src/utils/permission.ts)。Halo 2.20.2 的[文章路由](https://github.com/halo-dev/halo/blob/v2.20.2/ui/console-src/modules/contents/posts/module.ts)也使用同一编辑路径；源代码核对不等于该版本的实际运行验收。

## 身份与权限

Halo 的服务端安全方言先检查登录身份：匿名页面不输出入口模板，不为此功能发起权限请求。已登录页面使用同源、禁缓存的 `GET /apis/api.console.halo.run/v1alpha1/users/-/permissions`，仅在官方 `uiPermissions` 包含 `*`，或同时包含 `system:posts:view` 和 `system:posts:manage` 时挂载链接。该判断与后台路由的 UI 权限一致；后台继续执行自己的权限校验，主题入口不授予编辑权限。

查询超时（5 秒）、拒绝、重定向、错误响应或过期会话都保持隐藏。不显示空按钮或临时占位，不在浏览器持久化角色、权限或凭据。登录或权限变更后刷新文章即可重新判断；已经打开的文章不会持续轮询权限。

链接使用文章资源 ID 而非标题或 slug，由模板 URL 表达式编码；原生链接支持键盘操作，图标作为装饰，名称说明将打开新标签页，并使用 `noopener noreferrer`。登录过期后的登录流程及返回行为由 Halo 后台管理。

## 配置与验收边界

旧配置缺字段时保持关闭；回退旧主题包只会忽略新增开关，不修改文章内容。新增设置同步冻结性能默认配置，旧性能采样仍保留原身份。

离线测试运行 `bun test --isolate tests/post-edit.test.mjs`，工程门禁运行 `bun run verify`。实际合成 Halo、身份组合、布局、跳转和原始失败记录见[限定验收记录](validation/2026-10-11/post-edit.md)。矩阵只更新为 `implemented-unverified`，固定双站、真实 Safari、实体设备、独立审查及完整 1.0 合同仍需分别完成。

合成会话的无头浏览器复测命令和权限角色说明也见上述验收记录；可运行的入口为 `scripts/post-edit/check-browser.mjs`。

封面布局随后按维护者要求去掉元信息底板并移到底部，“编辑”仍紧邻日期；布局与渐变说明见[文章与阅读配置](READING-OPTIONS.md)。旧截图和验收记录保留其原提交身份，新的候选包需按[封面布局复核](validation/2026-10-11/post-cover.md)判断。
