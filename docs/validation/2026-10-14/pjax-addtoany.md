# D02 AddToAny 有界生命周期

源码候选 `a5318f5`，基线 `c906141`；Bun 1.4.0，Halo 2.26.1，官方 CommentWidget 3.3.2。父工作区另负责 i18n/D08 合并联验。本记录不增加全局 verified，不代表完整 1.0 合同通过。

## 实现与审计

- 原 body、SDK 菜单根、utility iframe 和 SDK 样式保持连接。仅 AddToAny 已知实例使用 body 子节点替换，其余页面沿用原替换路径。
- 一个 kit 初始化一次。审计发现 SDK 私有 K/ne 会保留每次 `init_all` 产生的 kit/anchor，因此不靠反复重扫解决生命周期。新页面复用原 anchor/图标/监听，同步 dataset URL/title、静态 href、ARIA 和主题文本。SDK 回调总是返回当前提交页面身份。
- 复制服务会在 head 追加 `a2a.copyLink('url')` 一次性内联脚本；share 回调的 microtask 仅清除此精确已执行命令，不对白名单开放任意内联脚本。
- 仅默认 facebook/x/wechat/sina_weibo/facebook_messenger/email/copy_link 及 twitter 允许持久实例导航。其他服务、预注入配置/实例、未知脚本/iframe、自定义元素、配置变化、打开的 SDK 菜单或弹窗保留原生导航。
- 请求等待期间可能新增未知 SDK 节点，因此提交前再次执行完整当前文档资格检查。草稿 veto 在替换前发生，取消历史导航保留 URL、评论草稿和同一 iframe window。
- 10 秒超时和 loader onerror 保留错误状态与复制/平台链接；成功 ready 清理计时器和旧页面错误回调。超时后的迟到 ready 不重新启用 PJAX。

公开协议：[AddToAny API](https://www.addtoany.com/buttons/api/)、[share/ready 回调](https://www.addtoany.com/buttons/customize/events)。实际源码审计文件和 SHA256 位于 `scripts/navigation-loading/addtoany-sdk.json`；不分发第三方 SDK 到主题包。page.js 的 SRI 是运行时约束，选择 core.iho16r34.js。core、locale、icon、utility iframe 仍信任服务方内容；下载验收时 hash 校验不能冒充运行时全链路 SRI。中文 locale 只有 a2a_localize 字典赋值，ready 时捕获其精确 DOM 节点；其他 locale 不放宽白名单。公开 loader 的 CORS 头已只读确认 `Access-Control-Allow-Origin: *`。

## 验收方法

`bun run verify`：700 测试通过，独立 TypeScript、parity、构建及 253 文件包检查通过。新增单元回归验证新页面 URL/翻译 caption 在任何 SDK 事件前更新，并保留原 anchor、SVG 和 SDK target；相同 URL 的其他 script 节点不能冒充 owned 节点。

先运行 `bun scripts/navigation-loading/cache-addtoany.mjs` 准备已审计公开字节；在独占 Halo 实验室执行 `addtoany-fixture.py` 和 `BASE_URL=http://127.0.0.1:18761 bun scripts/navigation-loading/addtoany.mjs`。真实 SDK/locale/icon/utility 代码在浏览器中执行，所有网络被路由到本地 Halo 或校验过的原字节；分享外发、服务统计、其他未知请求全部拦截，没有向任何人发消息。浏览器 window.open 记录合成分享目的地址。

默认完整服务列表：三引擎 Chromium/Firefox/WebKit × 1440/390 × 亮/暗，每组 4 次文章/列表往返，断言 body/kit/iframe window 同一身份、SDK/utility 请求各一次、初始化 index 不增长、当前 URL/title/静态 href、复制弹窗当前链接、真实官方评论草稿 history.back 取消、清空草稿后返回、打开弹窗时原生导航。每引擎另检验 unknown iframe、目标 HTML 等待中新增 iframe、加载失败错误状态、迟到加载、超时后迟到 ready 保持原生。

最终候选三引擎 **27/27** 通过；ZIP SHA256 为 `a362a17c2b09390ab1d3f76aa8477ece4d830f86061a7dd45eeaecce98561a70`，逐项结果见旁边 JSON。源码 `aa2d691` 的前序默认列表 24/24 已通过；恢复异步错误提示后的最终候选单独复验，不将旧结果直接挪用。

## 审查修正和范围

独立审查提出并修复：复用 anchor 的静态 href/ARIA/主题文本滞留，当前文档等待中新增未知节点的竞态，以及替换加载器后异步错误提示丢失。最初 SDK 复制弹窗有限动画尚未完成时就按 Escape 会遇到上游 transitionend 竞态，测试改为等待真实入场状态完成后关闭，没有放宽关闭或导航结果断言。

仍需父候选跨语言联验和 D08 实际加载提示整合；服务账号真实发布分享、物理 Safari/设备、任意自定义 AddToAny 服务以及其余分析/聊天/广告生命周期均未据此宣称完成。
