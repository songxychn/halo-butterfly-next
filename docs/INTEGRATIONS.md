# 第三方接入与资源配置

本批以 Hexo Butterfly 5.7.0 固定源码为参考，跟踪 [#397](https://github.com/songxychn/halo-butterfly-next/issues/397)，实现见 [PR #402](https://github.com/songxychn/halo-butterfly-next/pull/402)。分析、聊天和 AdSense 默认关闭；填写公开 ID 或启用服务后才加载独立的 `integrations.min.js`。管理员配置的广告 HTML 独立显示，无需启用分析服务。

## 分析统计

“分析统计”组提供百度统计 ID、GA4 `G-…`、Cloudflare Web Analytics 公开 token、Clarity 项目 ID、GTM `GTM-…` 容器 ID 和 Umami。多个分析服务可以并存；与 Halo 全局注入或其他插件重复配置同一追踪脚本会重复统计，应只在一个入口配置。

Umami 支持 Cloud 或自托管服务、脚本名、网站 UUID 和 JSON 追踪选项。允许 `data-host-url`、`data-domains`、`data-tag`、`data-do-not-track`、`data-exclude-search`、`data-exclude-hash`；网站 ID 由配置固定，主题设 `data-auto-track=false` 并在 SDK 到达后记录当前页面一次。第三方 SDK 尚无统一的无刷新销毁协议，启用分析、聊天或 AdSense 的页面使用完整导航，与 [PJAX 兼容边界](NAVIGATION-LOADING.md)一致；默认关闭的页面保留 PJAX 能力。

PV/UV 使用可选的**公开只读统计接口**，由站点自己的插件或后台提供：

```json
{"site_uv": 120, "site_pv": 456, "page_pv": 78}
```

文章请求附加 `path=/archives/example/`；请求不携带 Cookie 或认证头，5 秒超时。只接受非负安全整数；失败或无效值保留 `—`。站点计数位于网站信息卡片，文章计数位于元信息。不配置接口则不显示占位计数。

上游 `umami_analytics.UV_PV.token` 在浏览器调用认证 API 的方案没有直接照搬。主题不提供后台统计代理，也不渲染已保存的此字段；应由后端保管 API 凭据并提供上述接口。本字段的服务端适配保持待映射，未标不适用。

## 在线聊天

选择 Chatra、Tidio、Crisp 或 Knocket，并填写相应公开标识。默认使用服务原生入口。“使用主题聊天按钮”启用后隐藏原生入口，在工具栏用键盘或触摸打开/关闭。SDK 失败、标识缺失或延迟就绪超过 8 秒时移除无效主题按钮；不会阻塞正文或 Loading。工具栏排序新增 `chat`，默认顺序为 `toc,chat,comment`。

未使用主题按钮时，可开启“滚动时显示或隐藏原生入口”：向下滚动隐藏，向上显示；已展开聊天不因滚动关闭。Knocket 对齐上游浮动联系面板的显示/隐藏，不宣称拥有完整会话 API。Chatra 的隐藏 CSS 仅在主题按钮模式生效。

## 广告

AdSense 使用 `ca-pub-` 加 16 位数字的公开发布商 ID，支持脚本地址、自动广告和页面级广告初始化参数。广告展示、填充率及服务方账户设置由 AdSense 决定。主题独立记录脚本加载结果；服务故障保留正文。

`ad.index` 在首页每三篇文章后插入，`ad.aside` 位于普通侧栏及非简洁阅读侧栏，`ad.post` 位于文章上下篇导航之前。空值不输出。内容作为管理员可信 HTML 渲染，可包含广告单元或自有图片/链接。AdSense 加载成功后只初始化尚未排队的 `.theme-ad ins.adsbygoogle`，同一文档不重复排队。

## 资源来源

默认使用完整随包资源，原有配置缺少新字段时继续使用安装包。

| 设置 | 当前映射 |
| --- | --- |
| `CDN.internal_provider` | `local` 或 `custom`；目标是 Next 实际生成的 assets，不能用 Hexo npm 脚本替换 Halo 入口 |
| `CDN.third_party_provider` | 当前独立资源为 Font Awesome Free 6.7.2：local/jsdelivr/unpkg/cdnjs/custom |
| `CDN.version` | 本地缓存参数与可用 npm URL 的版本段；cdnjs 固定使用 6.7.2 |
| `CDN.custom_format` | `${name}`、`${version}`、`${file}`；主题 name 为 `halo-butterfly-next`，字体包为 `@fortawesome/fontawesome-free` |
| `CDN.option` | 单项覆盖优先于来源设置；HTTPS 或本站根路径，无效值回到安装包/官方地址 |

例如，把当前版本完整 `templates/assets/` 发布到自己的静态目录后，可以设置：

```text
https://assets.example.com/${name}/${version}/${file}
```

主题资源覆盖项：`main`（各页面脚本）、`main_css`、`integrations`、`masonry`、`loading`、`fontawesome`、`prismjs_js`、`prismjs_css`、`code_light`、`code_dark`。页面脚本和样式覆盖使用 `${file}`，避免所有页面收到同一入口。Prism 和已合入页面包的 Typed/LazyLoad/Viewer/InfiniteGrid 等保留当前构建适配；修改内部来源会一起改变其承载文件的地址，不单独下载不兼容的上游库。

分析、聊天、AdSense 也有单项脚本地址覆盖，服务脚本的 ID 初始化保持原配置。服务来源覆盖不会自动改写 SDK 内部的二次请求或接收数据的端点。

外部主题脚本/样式发生原生加载错误时回退一次到随包资源。Prism 只在外部请求失败后重试随包代码，最终结果才结算阅读增强。服务脚本在 8 秒后停止等待，不自动重试计费/追踪请求。CDN 请求仅超时而未触发浏览器错误时，不承诺脚本已经取消或强制重试。无 JS 的文章仍可阅读，Loading 的结束不依赖外部 SDK。

尚未开发的 Mermaid、Chart.js、ABC、PJAX、特效等资源，以及已捆绑库的独立 URL 覆盖不由本批框架自动补齐；对应矩阵条目继续保持缺口。

## 复验

当前限定验证：640 项测试、三引擎 204 场景和合并后 36 项 SEO/注入回归，见 [验收记录](validation/2026-10-13/third-party-resources.md)。

```bash
bun run verify
bun scripts/browser/install.mjs
bun scripts/integrations/check-browser.mjs http://127.0.0.1:18131 .runtime/third-party-halo
```

浏览器脚本只修改具有本项目 `lab.json` 和已核实 Halo 进程的回环实验室，并在结束时恢复原主题配置。所有外部 SDK 和字体请求被拦截为本地固定桩，检查请求、队列、配置、失败及 DOM；没有向正式服务发送数据。实际账号接入、外部 SDK 更新、Safari/真机和完整合同验收依旧单列，不能用本地桩提升为 `verified`。

服务契约参考：[固定上游分析](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/head/analytics.pug)、[固定上游聊天](https://github.com/jerryc127/hexo-theme-butterfly/tree/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/third-party/chat)、[固定上游资源](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/scripts/events/cdn.js)、[GA4](https://developers.google.com/tag-platform/gtagjs)、[Cloudflare](https://developers.cloudflare.com/web-analytics/get-started/)、[Umami](https://docs.umami.is/docs/tracker-configuration)、[Chatra](https://chatra.com/help/api/)、[Crisp](https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/dollar-crisp/)。
