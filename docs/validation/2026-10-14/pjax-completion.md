# D02 内容页面 PJAX 限定验收

本次补齐文章、单页、无额外脚本的插件公共布局导航，未把任意第三方 SDK 生态标记为完成。通用正文使用普通代码围栏与 HTML，不增加 Hexo 标签兼容层，遵循 DEC-02。

## 实现和协议

- Halo 2.26.1 官方 JAR 的 `HaloTrackerProcessor.SKIP_TRACKER` 标记在文章/单页启用 PJAX 时禁用固定身份的原生 history 包装器。主题按已提交页面作用域向官方 counter API 上报，身份来自当前服务端页面，列表不计旧文章；PJAX 关闭继续原生计数。
- 官方 JAR SHA-256：`7a1d6ea0800e8940672aab99a7328b7bd9520e297677169594328004a41991bc`。`BOOT-INF/classes/static/halo-tracker.js` 的身份在脚本初始化时捕获；原生 localStorage 读取受限会中止，因此主题在该情形同样不计数。保留 `haloTracker.disabled`，失败不重试、不阻塞正文。
- 官方 CommentWidget 3.3.2 每页创建当前内容身份实例；立即/懒挂载共用主题宿主，旧 body 断开组件及本次创建的 toast host，由官方 disconnectedCallback 销毁编辑器和监听器。
- 未提交草稿保留原生离开提醒。主题 history 条目记录索引；后退 veto 先恢复已提交条目，再发起原生完整导航。取消后保留原历史位置、URL、正文、草稿和计数；接受则采用普通完整导航语义。等待目标 HTML/CSS 时开始编辑也检查，失败路径同样保护。
- 图表、ABC 乐谱、Mermaid 和图库脚本声明精确资源身份；渲染配置在目标入口前重新执行，旧页面资源由 PageScope 销毁。未知脚本、自定义元素、嵌入页及 `data-no-pjax` 继续完整导航。

## 可复现验证

`bun run verify` 使用 Bun 1.4.0，694 tests 通过，typecheck、parity、ZIP 与安装包检查通过。安装包源码和 SHA 以同名 JSON 为准，证据文档自身提交不改变包源码。

独占本地 Halo 2.26.1 端口 18761，隔离 Playwright 1.63.0 无头浏览器；所有外站请求阻断，没有生产访问。先使用官方评论 fixture，再运行：

```sh
HALO_PORT=18761 HEXO_PORT=14761 python3 scripts/navigation-loading/content-fixture.py
BASE_URL=http://127.0.0.1:18761 bun scripts/navigation-loading/content.mjs
bun scripts/navigation-loading/check.mjs
```

真实内容矩阵：Chromium/Firefox/WebKit × 1440/390 × 明/暗。每组反复导航文章1、文章2、单页与列表两轮，检查持久 sentinel、计数请求的内容身份、官方 API 200、旧评论组件断开、新组件身份与唯一实例；前进后退不串计数。另两轮进入/退出含三种正文渲染器和图库的文章，检查真实 canvas/SVG、旧节点断开。对官方编辑器逐键输入未提交草稿，分别点击链接及 history.back，取消原生对话框后检查 URL/评论身份/草稿/计数不变；清草稿后后退到原前项。

合成矩阵覆盖三引擎两宽度各六轮导航、脚本为空的插件布局、历史遍历、移动抽屉、主题切换、标题/meta、未知脚本/排除规则、HTTP/CSS 失败、请求竞争、图片懒加载和预取。完整结果保存在同名 JSON。

## 失败记录与边界

早期 WebKit 测试使用 Playwright `fill()` 写官方 Tiptap 编辑器，实际 DOM 未写入；改用逐键输入并等待插件草稿持久化后，真实原生对话框可验证。未以跳过对话框断言处理。最终前一包升级后首个 `goto` 曾 15 秒超时，独立 HTTP 恢复 200 后原样重跑完成；该失败另存 JSON，不归因为已证明的 Halo 上游缺陷。

可选 Hexo 参考站 `hexo clean` 返回 2；Halo 用拥有标识的隔离实验室单独启动、安装和配置，未宣称完成固定双站视觉对照。没有真实 Safari/移动设备、屏幕阅读器、账号型服务、全插件生态或完整 1.0 验收。

D02 仍保留缺口：分析/聊天/广告 SDK、AddToAny、Share.js、Busuanzi、未定义重建协议的外观特效，以及含未知脚本/嵌入元素的插件页仍可能全站或逐页整页回退。Moment 官方评论宿主已允许精确 `moment.halo.run` / `Moment`，本 lane 没有安装 Moments 插件，整合验收由父 lane 完成。i18n config、根语言及 head 元数据具备切页同步路径，跨语言联验仍由整合阶段补充。

矩阵建议保留 `interaction:pjax`、`template:includes/third-party/pjax` 为 gap，更新已完成范围及剩余，不增加 verified；配置两项维持 implemented-unverified。详见 `pjax-matrix-delta.json`。

后续 Share.js、默认 Busuanzi、本地特效和显式 GA4 手动事件适配见 [补充验收](pjax-optional.md)；本页第一批证据与其历史边界保持原样。
