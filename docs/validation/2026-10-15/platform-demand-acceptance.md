# Halo 2.27 平台按需加载验收

2026-10-15，本任务本地 Halo **2.27.0** 的限定集成验收通过。主题实现提交 `946d63d7d512c7f50167060b55217b5e0292c27b`，安装包 `halo-butterfly-next-0.1.0-alpha.4.zip` SHA-256 为 `c593b2b3e9950dafdcd188ffb15d3fcf1c7fc8d2bb16b5d96293a4e755e97d95`。这不是完整 1.0 验收，也不覆盖或改写历史 Halo 2.26.1 的通过、失败及候选归属。

[精简机器记录](platform-demand-acceptance.json)保存原始报告路径／SHA、插件补丁与 JAR 身份；[独立审查](platform-demand-independent-review.md)记录代码、构建和协议审查。运行及恢复由集成负责人执行，本记录通过读取原始报告核对结果，没有另行操作实验室。

| 批次 | 结果 | 实际覆盖 |
| --- | --- | --- |
| 评论／公式真实浏览器 | 27/27 | Chromium、Firefox、WebKit 各 9 例：首页、关闭评论、延迟评论、已有 MathML、原始公式、单页、评论锚点、CSS 失败重试、五次真实 PJAX 往返 |
| 插件及主题生命周期 | 4/4，`restored=true` | 插件停用仍完整 HTTP 200 并保留正文；重新启用恢复资源契约；切到 Earth 获得默认全局评论资源；切回候选恢复主题管理模式 |
| Umami 匿名只读接口与主题展示 | 6 组通过，插件和主题配置均恢复 | 关闭时 404；固定站点／时间范围返回合成统计；缓存共享；非法及任意上游参数拒绝；上游失败返回有限 503，不泄露凭据／地址或伪造零值；真实主题首页／文章显示统计 |
| 主仓本地 verify | 753 测试通过，0 失败 | `verify-ready.log`；构建及安装包检查通过，265 文件 |
| 插件本地验证 | 全部通过 | CommentWidget Java 198；KaTeX Java 4、三引擎 36、迟到 CSS 竞态 2；Umami 52。来源分别为补丁目录验证记录，不与主题 753 重复累计 |

浏览器原始报告 `.runtime/platform-demand/browser-final.json` 保存 `sourceSha=946d63d…`、`sourceDirty=false`，runner SHA-256 为 `b6988a4e144c3d468aefd04859a4bbf1c6ae7ff9a1fde6ec57bc26219959a8ad`。安装记录明确说明 sourceCommit 由调用者提供，包字节由 SHA-256 标识；没有把 Git SHA 本身当作可重现构建证明。生命周期与 Umami 接口报告自身未嵌入完整主题包身份，机器记录保留这一归属限制。

## 本地插件候选

| 插件 | 版本 | JAR SHA-256 |
| --- | --- | --- |
| CommentWidget | `3.4.0-theme-demand.1` | `7bd5890f8197086d50febeb641be5f9743ec318b78631fc6da33cbaa7788a5f1` |
| KaTeX | `3.0.0-demand.1` | `e9bc80d62cc8c045144e3aea8229783557c7af3dbd64fecd8456c45bb7f8ef4c` |
| Umami | `1.5.0-next.1` | `3ddc802851c2f62a718df506f1d820b6c411eb0f270a8b952f40696579133cbb` |

身份依据 `integrations/patches/comment-widget/validation.json`、`integrations/patches/katex/README.md`、`integrations/patches/umami/manifest.json`。这些是本地源码补丁候选，并非官方已发布能力；上游接收、发行和生产部署未完成。本轮使用的 Halo JAR SHA-256 为 `d3151ea97c4b8d1d4525149477535a3f5c6c713939be592e17a1dc6f9bbd4892`。

## 原失败与修复

早期 `browser-first.json`、`browser-second.json`、`browser-third.json` 和后续 `browser-fourth.json` 均保留原文件，摘要见机器记录。早期存在首页／文章等待 domcontentloaded 超时及 PJAX 文档 sentinel 丢失，不能只凭这些前端症状推断根因；结合服务端诊断与独立审查，本轮修复了以下具体问题：

- KaTeX 默认资源加载使用宿主线程 classloader，不能读取插件内嵌脚本，导致 head 渲染失败。最终 JAR 改用显式插件 classloader，并增加隔离回归。替换错误候选 JAR 时仅停止本任务实例，安装方式保留在浏览器报告中。
- Halo 版本范围解析不接受评论插件的预发行 range，造成 HTML 流中断。模板改用可用性判断，前端继续严格校验资源协议、同源路径和 CSS／JS 版本一致性。
- Umami 空配置注入 `null/umami.js`，产生无效请求并干扰 PJAX 支持判断。最终补丁仅在 tracker 必需配置有效且未禁用时注入，新增空配置回归；未通过放宽 PJAX sentinel 断言消除失败。

最终 27 例保持按需资源、组件唯一性、真实公式渲染及文档保留断言。已有 MathML 只请求 CSS，无公式页面不预取 KaTeX；评论直到需求触发才加载，正确 subject／编辑器及评论 API 200 均有检查。

## 待补充和边界

Umami 使用本地合成的 Umami 3.4.0 统计结构。新增 Chromium 真实 Halo 主题展示检查通过：首页显示站点 UV 120／PV 456，文章显示 page PV 78；每个文档仅一个匿名同源统计请求，HTML 不含合成密钥。插件与主题配置都已恢复。最初夹具误要求文章页同时显示三个数字，但文章页按设计没有站点 webInfo 卡；原 `umami-theme-fixture-failure.json` 保留，后续改为首页查站点统计、文章查阅读数，未修改产品。真实账号统计口径、权限和生产数据对账仍未验收。

已独立通过 GitHub API 核对 [Verify theme CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/38749657715) 在实现提交 `946d63d…` 上完成且结论为 success。记录快照时 Linux 验收工作流仍在运行；后续提交的最终 CI 结果见 [PR #416](https://github.com/songxychn/halo-butterfly-next/pull/416)，不将运行中状态记作通过。

内容来自合成 HTML，不能替代编辑器保存／重开。无头 WebKit 不等于实际 Safari；真机、屏幕阅读器、完整性能预算、安装升级回退及完整 1.0 矩阵仍未完成。历史候选的 Firefox 请求停滞失败继续保留，本轮针对平台资源契约的通过不能将它们改判通过，也不能将旧核心、可访问性、正文或安全批次自动迁移到本候选。

补充字节核验 `.runtime/platform-demand/installed-byte-check.json` 确认本轮 ZIP 的全部 265 个文件与已安装主题逐字节一致，提交和包摘要与本报告相同。各恢复字段已核对；集成负责人已停止本任务独占 Halo 18627 并关闭 headless 会话，记录者另以 `lsof` 确认 18627 无监听。本记录没有启动、重配或关闭其他实验室。

补充脚本审查收紧了恢复失败的退出状态及父子 runner 的实验站地址传递；修复后重新执行生命周期 4/4 与 Umami 6/6，所有恢复标记为 true，随后再次停止独占 Halo。前次成功报告另存为 `*-before-runner-hardening.json`，机器记录引用复验后的报告摘要。
