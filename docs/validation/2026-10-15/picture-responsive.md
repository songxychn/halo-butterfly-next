# 响应式 picture 与灯箱修复

2026-10-15。原生图片验收中发现 `AmplifyImg.prepare()` 将 `<picture>` 的直接子节点 `<img>` 移入新建的 `<span>`。浏览器因此不再使用相邻 `<source>` 的 media/srcset；桌面页面可能从宽图切换为错误的窄图。

先在独立无头 Chromium 合成页复现，原报告保留：1440 与 390 宽均发现 `img.parentElement` 由 `PICTURE` 变为 `SPAN`；1440 宽的 `currentSrc` 从 `/wide.svg` 变为 `/narrow.svg`。这是实际 DOM/请求候选变化，不只是静态推测。

修复只改变灯箱触发器包装位置：当图片直接属于 `<picture>` 时，把完整 `<picture>` 包在可聚焦触发器中，保留 source/img 结构。已有链接、普通图片、作者 src/srcset、eager 属性不改写。

[原始失败与修复后证据](picture-responsive.json)记录精确产品文件哈希和内存 bundle 哈希。运行时 HEAD 为 `bc9d08ca231e388256c4675cd0a9903f0a7475b2`，修复尚未提交，不能把该 HEAD 误认为包含修复。产品代码没有构建到 `dist`，也没有修改运行 Halo。

- 新回归 `scripts/images/check-picture.mjs`：Chromium／Firefox／WebKit × 1440／390，共 6/6 通过。检查初始候选、初始化后候选、跨断点 resize、img/source 属性、重复初始化、键盘打开、正确灯箱原图、关闭焦点返回及带链接 picture。
- 既有 `scripts/lightbox/check.mjs`：三引擎两宽度六组及 Chromium 触摸模拟附加项，共 7/7 通过；覆盖普通图片、分组、动态图片、原图链接、键盘、缩放/旋转、焦点、外链与下载。
- 无头 WebKit 不等于实际 Safari；本结果不覆盖真机、屏幕阅读器或安装到 Halo 后的完整验收，不提升矩阵 `verified`。

复跑（每次使用新的输出目录）：

```bash
bun scripts/images/check-picture.mjs .runtime/platform-acceptance/picture-rerun
bun scripts/lightbox/check.mjs .runtime/platform-acceptance/lightbox-rerun
```
