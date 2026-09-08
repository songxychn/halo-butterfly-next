# 作者欢迎链接局部无障碍验收

Issue #28 修复作者卡片欢迎链接的小字对比度和重复键盘入口。范围仅 `src/html/views/aside.html` 的欢迎块、`src/scss/core/aside.scss` 的该组件及本验收运行器；不修改全局主题色，也不作为 alpha.2 的发布前置。

固定上游 Butterfly 5.7.0 / `f223b1888b42b2b336068e6c959ed90a3cd7c8f3`：`layout/includes/widget/card_author.pug:20` 使用单个链接，`source/css/_layout/aside.styl:55` 起定义背景、文字和 hover，`source/css/var.styl:69` 起定义按钮变量。这是结构与视觉参考；1.0 的键盘与对比度要求单独验收。

原 Halo 欢迎块由外层链接包住按钮。真实 Tab 先进入链接、再进入按钮；Chromium 为二者提供默认焦点轮廓。暗色按钮14px文字为白色0.7透明度、背景为 `#3aa675`，axe 4.12.1 在桌面和手机正常/hover/focus均报2.23:1。旧 hover 使用色相滤镜，axe所报告颜色未计入该滤镜；原始 computed filter、颜色和截图均保留，不把该数值当作所有滤镜后像素的精确对比度。

修复把欢迎块合成同地址、target和HTML内容的单个 `a.button`。局部不透明白字配蓝色/绿色背景，hover使用明确背景色，键盘焦点显示2px外轮廓。该链接使用原生Enter激活；Space保留原生链接滚动语义。

验收依据是 [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) 的普通文字至少4.5:1，以及 [WCAG 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) 的可见键盘焦点。实际结果记录在本地 `.evidence/aside-a11y/`，不提交截图或凭据。

```sh
pnpm verify
node scripts/aside-a11y/check-browser.mjs http://127.0.0.1:18095 .evidence/aside-a11y/final
```

先在独立18095安装当前SHA生成的包并逐文件核对。运行器用新的独立headless会话，验证1440×1000、390×844与亮暗；每组测正常、hover、真实Tab焦点、Tab移出及ShiftTab回归，原生Enter仅新开一个配置的同源about标签页并保留原页，记录不透明计算色的精确对比度、局部axe与截图。它只允许明确传入该任务隔离站，要求现有 `fixtures/comparison` 合成内容，且不更改服务端配置。真实浏览器不是当前CI的自动步骤；CI仍由 `pnpm verify` 执行工程测试和构建。

当前插件状态、包哈希、安装文件一致性和独立审查结论随最终本地证据补充。局部通过不能代替全站A11Y合同或上游全部作者卡片功能验收。
