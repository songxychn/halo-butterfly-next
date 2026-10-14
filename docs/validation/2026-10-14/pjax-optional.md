# D02：可选主题入口和 GA4 手动统计限定验收

这是 [内容 PJAX 第一批](pjax-completion.md) 的补充，不把任意第三方 SDK 或完整 1.0 合同标为通过。遵守 DEC-02 通用 Markdown/HTML 决定。

## 候选与结果

产品源码 `0b29fe5adfb37f0ff6eaa4a6dfbeda2f464d717c`；ZIP SHA-256 `6ebe55e4b213fa0883a5a4a99852537a3a3fe664546ee73aa45f6449f7e49eb7`。Halo 2.26.1、官方 CommentWidget 3.3.2、Bun 1.4.0、Playwright 1.63.0，独占回环端口 18761。

- `bun run verify`：699 passed、0 failed；类型、矩阵一致性、构建和安装包检查全部通过。
- `scripts/navigation-loading/optional.mjs`：三引擎 × 1440/390 × light/dark，12/12。每组四轮文章/列表往返，Share.js 和 effects 库各加载一次；分享 URL/标题随页变化，微信二维码可打开/Escape关闭；旧分享节点和画布断开；画布始终最多一个、每轮有实际 RAF 进展；减少动画移除画布，恢复偏好重新创建；Busuanzi 使用当前 Referer，回调注册表归零，无 pageerror。
- `scripts/navigation-loading/analytics.mjs`：上述 12 组加三引擎 SDK 失败回退，15/15。文章/列表/单页与前进后退的 URL、标题、referrer 精确对应，每次成功提交一次事件，SDK/config 各一次；官方评论草稿触发 history.back 后取消，URL/草稿保留且新增事件为零，清稿再返回恢复正常统计。

原始结果、候选归属、协议探测及限制见 [JSON](pjax-optional.json)。浏览器全部外网被阻止；Busuanzi 响应与 GA4 SDK 是受控夹具。因此上述结果证明主题生命周期，不证明真实服务接收或账户配置。

## 实现与验收中的修正

Share.js 只复用库，新区域明确传入当前页面分享信息；旧二维码/监听随旧节点释放。默认 Busuanzi 改用官方 JSONP 接口，活动页面独立回调，清理后删除回调引用，晚到回调由共享 no-op 接住。自定义 Busuanzi URL 不推断协议。

本地特效使用显式工厂/销毁函数，管理画布、RAF、DOM事件和标签计时器。Chromium 在四轮重入后的诊断中，媒体查询已显示 reduce=true，而当前 MQL 未送达 change，旧 draw 直接返回导致静止画布残留。最终在已有 RAF 首先观察到 reduce 时执行 stop；媒体分发器只引用活动实例，偏好恢复仍靠媒体事件。未增加轮询。保留独立动画进展断言，没有仅延长超时或跳过减少动画断言。

GA4 的新 `analytics.google_analytics_manual_pageviews` 默认 false；只有单独 GA4、官方 SDK、无其他分析/聊天/AdSense 才进入手动适配。必须先在服务后台关闭增强型衡量的历史 pageview；主题配置 `send_page_view:false`，首次加载成功及 `pjax:complete` 后手动上报，避免取消历史转换产生主题幽灵 PV。配置或 ID 改变、加载失败/尚未结束保留完整导航。[官方手工协议](https://developers.google.com/analytics/devguides/collection/ga4/views) 明确说明只设置 send_page_view:false 不会关闭后台增强型历史事件；实际 DebugView 仍是账户验收门禁。

## 公共协议与剩余边界

默认 Busuanzi 除浏览器合成回归外，单独进行了一次无凭据公开协议探测，Referer 仅为 `http://127.0.0.1:18761/pjax-protocol-fixture/`。官方返回 `try{__haloThemeBusuanzi.c1(...);}catch(e){}`，确认命名空间回调可用。证据只保存字段名与成功布尔值，不保存服务计数。最初 fullmatch 没考虑 try/catch 包装而失败，修正匹配后复用同一次响应，未重复请求。服务说明见 [Busuanzi](https://ibruce.info/2015/04/04/busuanzi/)。

- **Cloudflare**：[官方 SPA 文档](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/) 提供自动观察及 spa:false；无已公布的逐页手动事件协议，无法排除草稿历史取消前已观察的临时 URL，因此保留完整导航。
- **AddToAny**：[API](https://www.addtoany.com/buttons/api/) 有 init_all 重扫，但当前 loader 创建持久 iframe、菜单根及匿名 message 监听，整 body 替换会断开这些对象。需持久宿主/清理设计，不是仅缺账户。已读源码 hash 记在 JSON，没有执行审计下载的 SDK。
- **Chatra/Tidio/Crisp/Knocket**：[Chatra](https://chatra.com/help/api/) 有 kill/restart/pageView；[Crisp](https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/dollar-crisp/) 有 off，但 session:reset 会改变会话。尚未证明卸载能保留对话和草稿，不盲目调用破坏性重置；需要提供方适配和实际会话验收。
- **Baidu/Clarity/GTM/Umami/AdSense**：GTM 容器可运行任意标签、广告含持久 iframe、记录型 SDK 的全局观察器也没有主题通用清理协议。Umami 不在此批改变现存版本语义。继续原生导航，不将其统称为仅需账户即可完成。
- 未知脚本、自定义元素、embed、自定义统计脚本和真机 Safari/设备、完整固定 Hexo 对照仍待验；矩阵不新增 verified。

## 重跑

在此 checkout 的已拥有 Halo 评论夹具上，设置 `HALO_PORT=18761 HEXO_PORT=14761`，安装精确包后：先运行 `python3 scripts/navigation-loading/optional-fixture.py` 和 `BASE_URL=http://127.0.0.1:18761 bun scripts/navigation-loading/optional.mjs`；再运行 `python3 scripts/navigation-loading/analytics-fixture.py` 和同 BASE_URL 的 `analytics.mjs`。两套配置顺序执行，不共享并行变更。其他端口须与实验室身份一致。

后续补充：本记录当时保留的 AddToAny 持久宿主缺口已进一步开发，新的限定范围和独立候选验收见 [pjax-addtoany.md](pjax-addtoany.md)。本文件早先结果不追加计数或升级状态。
