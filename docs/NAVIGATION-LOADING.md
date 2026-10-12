# 导航与加载

本批跟踪 [#393](https://github.com/songxychn/halo-butterfly-next/issues/393)。参考固定 Butterfly 5.7.0 `f223b1888b42b2b336068e6c959ed90a3cd7c8f3` 的 `_config.yml`、`layout/includes/third-party/pjax.pug`、`scripts/filters/post_lazyload.js`、`source/js/main.js` 和 `source/js/utils.js`；Halo 页面使用 [模板契约](https://docs.halo.run/developer-guide/theme/template-variables) 与现有公共布局。

## 配置

| 设置 | 默认值 | 行为 |
| --- | --- | --- |
| `pjax.enable` | false | 同源主题页面无刷新导航；更新整页内容、标题、canonical 与其他 head 元数据 |
| `pjax.exclude` | 空 | 每行一个路径/完整 URL；路径末尾 `*` 匹配前缀。预取也遵守该列表 |
| `loading.instantpage` | false | 对主题列表/分页或显式 `data-theme-prefetch` 链接，在鼠标经过、键盘聚焦时生成浏览器预取提示 |
| `loading.enable` | true | 独立控制四种已有 Loading 动画；关闭后直接显示正文 |
| `snackbar.enable` | false | 模式、繁简切换消息及通用操作反馈使用指定位置；关闭时仍保留必要操作反馈 |
| `snackbar.position` | bottom-left | top/bottom × left/center/right 共六种位置 |
| `snackbar.bg_light` / `bg_dark` | #1f2937 / #374151 | 明暗模式消息背景，自定义时需保证白字可读 |
| `lazyload.enable` | true | 图片按需加载；关闭后主题图片及带 data-lazy-src 的图片立即加载 |
| `lazyload.native` | true | 使用浏览器 loading 属性；关闭后主题卡片和显式延迟图片使用 IntersectionObserver |
| `lazyload.field` | site | site 全站，post 仅正文；post 模式下侧栏及列表封面立即加载 |
| `lazyload.blur` | false | 选定范围内未完成图片模糊；成功/失败均解除 |

原有 `loading.type`、`loading.img.preload/err` 与随机封面设置继续使用。旧配置缺少新字段时维持原生图片懒加载及现有 Loading。原保存的 `loading.type: 'null'` 仍表示关闭。无 JS 时正文可读，非原生延迟的主题卡片提供 noscript 图片。

## 导航生命周期

普通左键/键盘链接激活才使用 PJAX。外链、下载、新标签页、同页锚点、后台/认证/API/静态文件地址保留浏览器行为。前进后退恢复历史滚动，新页面聚焦主内容，带 fragment 的新链接定位目标。快速连续点击取消过时请求；HTML 请求 10 秒、脚本和 CSS 8 秒超时后回退普通导航。

切换前销毁主题页面作用域：全局事件、导航/图片/代码/公式观察器、图表、目录、Typed、灯箱、剪贴板及请求取消。新页面重新执行标记的主题配置与页面入口；第三方库的普通 DOM 事件由对应实例销毁或旧节点清理。`pjax:send`、`pjax:complete`、`pjax:error` 和 `halo-butterfly-next:before-replace/page-ready` 提供可观察事件。

Halo 文章/单页的 `/halo-tracker.js` 包装 history 且绑定内容身份，尚无安全销毁协议，因此这些页面保留完整导航和原生计数。当前 PJAX 主要覆盖首页、列表、分类标签及归档之间的导航。插件公共布局、未知可执行脚本、自定义元素、iframe、base、meta refresh 和 `data-no-pjax` 页面使用完整导航。启用全局插件脚本可能使整个站点回退；这是一项明确兼容边界，并不宣称任意插件已适配 PJAX。目标响应重定向、非 HTML、错误状态或资源失败也回退正常导航。表单始终保持普通提交。PWA 和评论懒挂载不在本批范围。

预取最多提示 8 个链接；带查询参数、后台/外部资源、省流量和 2G 网络跳过。使用浏览器标准 prefetch，不创建主题 HTML 缓存或绕过鉴权。浏览器可以忽略预取提示。

## 正文图片边界

主题控制的封面在服务端决定 src/占位与 loading。Halo 作者正文保持原始 HTML，不在模板中用正则改写任意内容。已有 `src/srcset` 的正文图片可能在主题脚本执行前请求；脚本不会用占位图替换已显示的内容，作者显式 `loading="eager"` 保留。需要可靠延迟的正文可由编辑器输出 `loading="lazy"`，或使用 `data-lazy-src` / `data-lazy-srcset`。后者在原生模式、关闭懒加载、缺少 IntersectionObserver 时立即恢复真实来源。

因此，本批提供 Halo 配置和交互适配，尚不宣称等同 Hexo 构建期对全站任意作者 HTML 的过滤器。该完整语义继续在矩阵保留缺口。头像保留原生 loading；IO 模式不把已有头像 src 改成占位。

## 验证

运行 `bun run verify`。独立合成页面回归为 `bun scripts/navigation-loading/check.mjs`，依赖按仓库 `scripts/browser/install.mjs` 准备的隔离浏览器。检查三引擎桌面/手机连续六次切页、代码初始化、移动抽屉、明暗切换单次响应、标题/meta、前进后退、排除/未知脚本/HTTP 与 CSS 失败、请求竞争、懒加载开关及预取。真实 Halo 记录见 `docs/validation/2026-10-13/navigation-loading.md`。

作者回归不替代固定双站的全部配置组合、插件生态、Safari 真机及完整 1.0 工程验收。
