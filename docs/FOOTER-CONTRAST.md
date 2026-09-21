# 页脚对比度回归

默认页脚保留品牌蓝色 `#49b1f5`，文字与链接使用不透明 `#102a43`（约 6.20:1）；开启页脚导航时下半区原有 10% 黑色背景保留，对应约 5.04:1。亮暗模式均不再继承带透明度的 `--light-grey`。链接正常、悬停保持文字色、常显下划线及当前色 2px 键盘焦点框。

`footer_img` 图片分支继续使用白字，仅版权、框架/主题、自定义文字、导航及备案文字添加局部不透明 `#333` 底板（12.63:1）。图片分支的白色键盘焦点框使用 -2px 内侧偏移，确保落在深色底板内，逐链接记录焦点截图及底板/偏移断言。页脚图片和 mask.footer 开关不改变；遮罩关闭或图片纯白也不依赖背景来满足文字对比度。用户额外自定义 CSS/配色不在此默认组合的通过声明内。

## 只读候选验证

构建后可在自有 comparison lab 上复验：

```sh
pnpm verify
BASE_URL=http://127.0.0.1:18121 \
LAB_RUNTIME=/absolute/path/to/.runtime/release-readiness \
BROWSER_RUNTIME=/absolute/path/to/.runtime/browser-matrix \
FOOTER_AXE_PATH=/absolute/path/to/axe-core/axe.min.js \
node scripts/footer/check.mjs .evidence/footer/run-new
```

脚本校验 loopback 与 lab owner 标识，只读取 Halo 首页 HTML；把候选 ZIP 的 index CSS 替换到自己的无头 Chromium 响应中，不安装候选、不修改服务端配置。纯白图片、导航、自定义文字和备案是浏览器内夹具，不能冒称持久化设置已经验收。输出记录站点实际安装包、候选包和 CSS 摘要、源码 SHA、runner 摘要与工作树状态。

覆盖 1440/390 × 亮暗 × 纯色/白图开启遮罩/白图关闭遮罩 × 导航开/关共 24 组合；逐链接核对正常、悬停、键盘焦点，保存完整 axe 4.12.1 WCAG A/AA、计算样式/祖先绘制属性、截图及横向溢出断言。所有外部网络请求被阻断。

任何违规或断言失败返回 1；`incomplete` 保持 `needs-manual-review` 并返回 2。遮罩伪元素可能使 axe 在读取文字底板前返回 `pseudoContent`：独立审查人须结合最终包、截图及祖先属性核实白字/不透明 #333、无额外透明度/滤镜/混合/覆盖、底板位于遮罩上方，才能另行签署 12.63:1。原始报告不能改绿。此脚本不替代最终包实际安装、真实 Safari/手机或屏幕阅读器验收。
