# 开源图片灯箱与回归

主题运行时固定使用 [Viewer.js 1.14.0](https://github.com/fengyuanchen/viewerjs/tree/v1.14.0)，[MIT 许可](https://github.com/fengyuanchen/viewerjs/blob/v1.14.0/LICENSE)随 ZIP 分发。接口依据为[同版本官方文档](https://github.com/fengyuanchen/viewerjs/blob/v1.14.0/README.md)。Fancyapps v5 的许可标注更正及比较实验室边界见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 行为与边界

- 文章、单页、图库、瞬间共用同一适配器；旧 decorator 导出指向相同实现，重复初始化不会重复包装或注册事件。
- 未链接图片增加可聚焦入口；图片原图链接打开灯箱，同时保留原始 href 和 Ctrl/Command 修饰点击。普通页面/外部链接和 download 链接保持原生导航，不被灯箱抢占。可用 `data-no-lightbox` 明确退出。
- 默认同页图片在同组；作者显式设置的 `data-lightbox-group` 或旧 `data-fancybox` 分组继续隔离。没有分组时保持此前同页集合语义，不把每个 figure 拆成独立组。
- 保留多图切换、缩放/1:1、重置、旋转、水平/垂直翻转、幻灯片及缩略图切换。播放时 Escape 先停止幻灯片，再按一次关闭；普通查看时 Escape 直接关闭。触摸支持点击、滑动及双指缩放。
- 动态追加图片会获得入口；打开时重新采集图片集合和 URL，懒加载优先使用 `data-lazy-src`，其他图片使用 currentSrc/src，原图链接使用 href。标题/alt 只作为文字展示，不插入 HTML。
- 控件有中文可访问名称及可见焦点，打开时保存背景 inert 值并约束 Tab，关闭后恢复背景与仍存在、可见的实际入口焦点。44px 工具栏按钮在窄屏换行；不承诺逐像素复刻 Fancybox 外观。

## 可复验命令

```sh
bun install --frozen-lockfile --ignore-scripts
bun run verify
node scripts/browser/install.mjs
node scripts/lightbox/check.mjs .evidence/lightbox/run-new
```

可选局部 WCAG A/AA 扫描：提供 `LIGHTBOX_AXE_PATH=/absolute/path/to/axe-core/axe.min.js`（本轮使用 4.12.1）。脚本保存各组合的完整 axe 原始结果与版本；违规返回 1，`incomplete` 保留为待人工判断并返回 2，不作为通过。未设置该变量时没有 axe 通过声明。

浏览器脚本只启动自己的 loopback 合成页面和全新无头上下文，不访问 Halo、生产站、现有浏览器或外部资源。使用仓库固定浏览器工具时可指定 `LIGHTBOX_BROWSER_RUNTIME=/absolute/path/to/.runtime/browser-matrix` 复用只读浏览器缓存；浏览器临时目录仍在本任务 `.runtime/lightbox/tmp/`。输出目录必须不存在，失败证据不覆盖。

脚本覆盖 Chromium、Firefox、WebKit × 1440/390 两种视口：键盘开关、Tab 约束、切换、缩放/1:1、旋转/翻转、幻灯片、缩略图、Escape/关闭按钮/遮罩的焦点恢复、原图及普通外链、独立分组、懒加载和动态图片、标题注入及重复初始化。Chromium 390px 另执行可信 CDP 触摸点击、滑动、双指缩放。报告记录 runner/合成 bundle SHA-256、源码 SHA、工作树状态及截图；任何断言失败返回非零。`bun run verify` 另检查运行时依赖和 ZIP 不含旧灯箱实现，并要求新 MIT 正文存在。

合成页面通过不能替代真实 Halo 上最终 ZIP 的安装回归；WebKit 不是实际 Safari，触摸事件不是手机软硬件实测。此变更不将 1.0 矩阵标为 `verified`。最终候选应在真实文章/单页/图库/瞬间分别复验，确认页面样式、图片加载与插件生命周期集成。
