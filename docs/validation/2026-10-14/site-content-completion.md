# 社交、页脚和友链 D07 限定验收（2026-10-14）

实现提交 `3e5630d57c28d15db79ab2e56f51c0bada6f46ed`；独立审查修复提交 `691853f3ae355922b6b4356e83c36d01ff461e06`，以下机器记录已更新为修复后的精确提交包。输入契约见[使用说明](../../SOCIAL-FOOTER-LINKS.md)，[机器证据](site-content-completion.json)及[矩阵 delta](site-content-completion-matrix-delta.json)交主任务统一集成；本 lane 不修改路线图/矩阵/剩余清单，不新增 verified。

## 已完成

- 社交入口位置：侧栏、首页标题下、两者、隐藏；关闭首页大图时保留内容标题下入口。沿用名称/链接/图标，并增加每项亮色/深色色值。图标经过允许列表净化，危险协议和 CSS 声明注入被拒绝。
- 页脚保留平铺 nav 与纯文本 custom_text；新增嵌套列/分组/条目、1–12 相对宽度、独立 custom_html。HTML 先转义，初始化后净化，无脚本时仍安全。
- 友链原生组说明按 metadata.name 映射（官方 Links 2.3.0 无组说明字段）；可选公开 JSON 的独立组/卡片输入，分组内随机顺序、坏图首字符回退；1 MiB/50组/500链接/10秒限制，匿名且无 Referer，失败重试而保留本地。
- 新文案提供 data-i18n-loading/empty/error 接口，父任务另行接入七语言。

## 验证

`bun run verify`：Bun 1.4.0，703 项测试、0 失败；typecheck/parity/build/256 文件 package check 通过。

仅操作本工作树自有 `18431` loopback Halo 2.26.1 实验室，安装官方 Links 2.3.0；原生/远端数据为带所有权标记的合成样本。测试结束恢复原主题设置，无外部站点写入。

`scripts/site-content/check.mjs` 精确提交包验收 29 项全部通过：Chromium、Firefox、WebKit × 1440/390 × light/dark；实际主题颜色、两种社交入口和品牌颜色、净化 HTML、列宽、原生说明、随机后成员完整、远端分组与坏图、文字元数据转义、无 XSS/页面脚本错误/横向溢出。额外覆盖 JSON 空、无效地址、503、重试、社交各位置/隐藏大图、无脚本原生链接。

报告/截图保存在工作树 `.runtime/site-content-check-review-fix/`。已检查手机深色友链、桌面浅色和手机深色页脚截图；列自动换行，卡片及文本可见。外部网络在主浏览器矩阵中被拦截，资源故障不改变断言。

## 未包含

Hexo 参考站前序 bootstrap 在 Bun 1.4.0 下报 `module.require is not a function`，继续使用既有 Halo-only 实验室接口，未修改上游或放宽比较标准；没有双站截图比较证据。未覆盖真实设备、Safari 应用、屏幕阅读器、完整性能预算、任意外部 JSON 服务可用性、CI 或完整 1.0 合同。新增 HTML/图标净化进入公共脚本，其性能影响需纳入父任务全分支预算。独立审查由 PJAX lane 执行，发现当前页锚点/相对 URL 错用站点根目录的问题；已改用 document.baseURI，并在工具测试及三引擎真实非根页面验证。完整分支联验由父任务执行。
