# 导航与加载

本批跟踪 [#393](https://github.com/songxychn/halo-butterfly-next/issues/393)。参考固定 Butterfly 5.7.0 `f223b1888b42b2b336068e6c959ed90a3cd7c8f3` 的 `_config.yml`、`layout/includes/third-party/pjax.pug`、`scripts/filters/post_lazyload.js`、`source/js/main.js` 和 `source/js/utils.js`；Halo 页面使用 [模板契约](https://docs.halo.run/developer-guide/theme/template-variables) 与现有公共布局。

## 配置

| 设置 | 默认值 | 行为 |
| --- | --- | --- |
| `pjax.enable` | false | 同源主题页面无刷新导航；更新整页内容、标题、canonical 与其他 head 元数据 |
| `pjax.exclude` | 空 | 每行一个路径/完整 URL；路径末尾 `*` 匹配前缀。预取也遵守该列表 |
| `loading.instantpage` | false | 对主题列表/分页或显式 `data-theme-prefetch` 链接，在鼠标经过、键盘聚焦时生成浏览器预取提示 |
| `loading.enable` | true | 控制加载提示；关闭后不加载 Pace 或 Loading 动画 |
| `loading.mode` | pace | 默认 Pace 非阻塞进度；animation 显式选择四种动画，与 Pace 互斥 |
| `loading.pace_css_url` | 空 | 自定义 Pace CSS 优先于 CDN 选项，失败回退内置 minimal 样式 |
| `snackbar.enable` | false | 模式、繁简切换消息及通用操作反馈使用指定位置；关闭时仍保留必要操作反馈 |
| `snackbar.position` | bottom-left | top/bottom × left/center/right 共六种位置 |
| `snackbar.bg_light` / `bg_dark` | #1f2937 / #374151 | 明暗模式消息背景，自定义时需保证白字可读 |
| `lazyload.enable` | true | 图片按需加载；关闭后主题图片及带 data-lazy-src 的图片立即加载 |
| `lazyload.native` | true | 使用浏览器 loading 属性；关闭后主题卡片和显式延迟图片使用 IntersectionObserver |
| `lazyload.field` | site | site 全站，post 仅正文；post 模式下侧栏及列表封面立即加载 |
| `lazyload.blur` | false | 选定范围内未完成图片模糊；成功/失败均解除 |

`loading.type` 仅在显式 animation 模式使用；缺少 mode 一律 Pace，历史 type 不推断动画或关闭。四种可选类型外的值回落 circle，关闭须使用 enable。`loading.img.preload/err`、随机封面与原生图片懒加载继续独立生效。无 JS 时正文可读，非原生延迟的主题卡片提供 noscript 图片。

## 导航生命周期

普通左键/键盘链接激活才使用 PJAX。外链、下载、新标签页、同页锚点、后台/认证/API/静态文件地址保留浏览器行为。前进后退恢复历史滚动，新页面聚焦主内容，带 fragment 的新链接定位目标。快速连续点击取消过时请求；HTML 请求 10 秒、脚本和 CSS 8 秒超时后回退普通导航。

切换前销毁主题页面作用域：全局事件、导航/图片/代码/公式观察器、图表、目录、Typed、灯箱、剪贴板及请求取消。新页面重新执行标记的主题配置与页面入口；第三方库的普通 DOM 事件由对应实例销毁或旧节点清理。`pjax:send`、`pjax:complete`、`pjax:error` 和 `halo-butterfly-next:before-replace/page-ready` 提供可观察事件。

启用 PJAX 时，文章/单页通过 Halo 2.26.1 的 `HaloTrackerProcessor.SKIP_TRACKER` 服务端标记停用绑定旧身份的原生 history 包装器，改由主题向官方 counter API 每个已初始化页面作用域上报一次；文章、单页和历史遍历使用各自的服务端身份，列表不继承旧文章身份。保留 `haloTracker.disabled` 停用约定，计数失败不重试、不阻塞正文。关闭 PJAX 继续由原生 `/halo-tracker.js` 计数。 Halo 2.20.2不支持该服务端停用标记：主题检测到当前内容的原生tracker时不再重复上报，内容页保留完整导航；因此最低版本的基本浏览兼容不等于其支持当前内容PJAX生命周期。

官方 CommentWidget 3.3.2 使用新的组件实例与目标内容身份；非懒加载配置立即挂载，懒加载继续按可见性触发。旧 body 替换时组件、其 shadow DOM 和主题挂载产生的 toast host 一并断开，插件的 disconnectedCallback 清理编辑器和全局监听。尚未提交的评论触发 beforeunload veto 时交给浏览器完整导航及原生离开提醒，避免绕过草稿保护；等待 HTML/CSS 期间开始编辑同样重新检查。

文章图表、ABC 乐谱、图库及脚本为空的插件公共布局已参与页面生命周期；正文渲染配置在切页时重新执行。未知可执行脚本、自定义元素、iframe、base、meta refresh 和 `data-no-pjax` 页面仍使用完整导航。Share.js、官方默认 Busuanzi 与主题本地特效已按页面清理和重新初始化；GA4 仅在显式手动统计模式满足后台前置条件时支持。AddToAny 的默认服务列表支持下述有界持久宿主协议；其他分析/聊天/广告 SDK、自定义 Busuanzi 脚本仍保持完整导航。不会因脚本来自某个受信任 CDN 就放行整站。目标响应重定向、非 HTML、错误状态或资源失败也回退正常导航。表单始终保持普通提交。PWA 另行跟踪。

预取最多提示 8 个链接；带查询参数、后台/外部资源、省流量和 2G 网络跳过。使用浏览器标准 prefetch，不创建主题 HTML 缓存或绕过鉴权。浏览器可以忽略预取提示。

## 正文图片边界

主题控制的封面在服务端决定 src/占位与 loading。Halo 作者正文保持原始 HTML，不在模板中用正则改写任意内容。已有 `src/srcset` 的正文图片可能在主题脚本执行前请求；脚本不会用占位图替换已显示的内容，作者显式 `loading="eager"` 保留。需要可靠延迟的正文可由编辑器输出 `loading="lazy"`，或使用 `data-lazy-src` / `data-lazy-srcset`。后者在原生模式、关闭懒加载、缺少 IntersectionObserver 时立即恢复真实来源。

因此，本批提供 Halo 配置和交互适配，尚不宣称等同 Hexo 构建期对全站任意作者 HTML 的过滤器。该完整语义继续在矩阵保留缺口。头像保留原生 loading；IO 模式不把已有头像 src 改成占位。

## 验证

运行 `bun run verify`。独立合成页面回归为 `bun scripts/navigation-loading/check.mjs`，依赖按仓库 `scripts/browser/install.mjs` 准备的隔离浏览器。检查三引擎桌面/手机连续六次切页、代码初始化、移动抽屉、明暗切换单次响应、标题/meta、前进后退、排除/未知脚本/HTTP 与 CSS 失败、请求竞争、懒加载开关及预取。真实 Halo 记录见 `docs/validation/2026-10-13/navigation-loading.md`。

作者回归不替代固定双站的全部配置组合、插件生态、Safari 真机及完整 1.0 工程验收。

2026-10-14 内容 PJAX 的独立私有 Halo 回归使用 `scripts/navigation-loading/content-fixture.py` 配置已有官方评论夹具，再运行 `BASE_URL=http://127.0.0.1:<owned-port> bun scripts/navigation-loading/content.mjs`。覆盖内容计数身份、评论实例、前进后退、三种正文渲染器和图库反复进入，以及未提交评论。证据及验收边界见 [限定验收](validation/2026-10-14/pjax-completion.md)。

2026-10-14 的 [DEC-03](parity/DEC-03-RESOURCES-DECISION.md)新增 Pace 1.2.4 默认进度，通过当前请求的阶段来源跟踪主题 fetch；普通 fetch 不自动被 Pace 跟踪。首屏与请求进度为估算，资源失败或连续进度超过 30 秒回落原导航提示，正文保持可读。验证见 [Pace 限定记录](validation/2026-10-14/dec03-pace.md)。


## 可选服务的页面生命周期

Share.js 复用库而每页绑定新的 URL、标题、图片与描述，二维码和事件只附着当前分享节点。默认 Busuanzi 直接使用官方 JSONP 协议，每次按当前页面 Referer 请求；旧回调删除后成为无节点引用的 no-op。自定义统计脚本因协议不确定保持原生回退。主题特效每页显式创建/销毁画布、RAF、交互监听与标签计时器，文档只保留一个媒体变化分发器，页面销毁时清空实例引用；若动画帧先观察到减少动态偏好，则立即清理，不等待媒体事件。

GA4 的 `analytics.google_analytics_manual_pageviews` 必须先关闭服务后台增强型历史事件；主题只在成功提交页面后发 pageview，详见 [集成配置](INTEGRATIONS.md)。Cloudflare 自动历史观察无法在草稿取消前撤销事件，继续完整导航。

AddToAny 复用一个已初始化的分享 kit，更新当前 URL、标题、主题按钮链接和标签，避免 `init_all` 在 SDK 私有集合里保留旧 kit。仅此已知入口保持原 body、菜单宿主、utility iframe 和 SDK 样式始终连接；新页面替换其余子节点。支持默认 facebook/x/wechat/sina_weibo/facebook_messenger/email/copy_link 及 twitter，其他服务、预注入自定义配置、未知节点或脚本、打开的菜单/复制弹窗、失败/超时及 service 配置变化继续原生导航。提交前再次检查当前文档，覆盖请求等待期间新增未知 iframe 的竞态。

主题强制校验已审计 page.js 的 SRI，其内容选择 core.iho16r34.js；core、中文 locale、图标与 utility iframe 仍信任服务方同源资源，不能将审计文件 SHA256 写成运行时全链路 SRI。loader 内容更新后会安全失败并提示复制/平台链接回退，需要重新审计和更新 SRI。实际三引擎限定验收见 [AddToAny 生命周期](validation/2026-10-14/pjax-addtoany.md)。聊天会话、GTM 任意标签与 AdSense 自动广告仍没有主题可通用安全销毁的协议。
