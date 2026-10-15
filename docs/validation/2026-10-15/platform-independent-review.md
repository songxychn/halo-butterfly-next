# 平台工作独立审查

## 合并前独立复审

对 `3a6844ae7810a66e9b570310f314eb9814784ad5` 相对 `master` 的完整差异，再由两名未参与本轮清理的审查者分别核对撤回方案残留与证据一致性。发现并修复验收总表中仍列为后续路线的上游资源契约/兼容回移文字，以及已完成批次仍列在 pending 的过期状态；修订仅涉及当前汇总说明，不改写原始批次结果、失败或候选归属。两名审查者复核修订后均无剩余合并阻塞项。

当前产品文件与 `9a0f9201ef4957fe18efca6970e74962a84ee641` 一致，重新运行 `bun run verify` 通过：748 项测试、类型/矩阵检查、构建与 265 文件包检查。重新构建 ZIP SHA-256 仍为 `2733dc6380c727682d15ad7491d09c89b53bde2441affb937700e7b4fbd3d0ce`；不是一次新的真实 Halo 验收。独立核对机器总表中本地可读取的 33 份原证据文件摘要全部一致，分候选通过/失败记录保留。没有发现定制插件实现、实验补丁或对应 runner 残留，主题最低 Halo 版本仍为 `>=2.20.2`。

精确提交 CI 与合并状态以 PR #416 为准；既有 Firefox 请求停滞、完整资源按需、图片映射/blur、设备、性能及其余 1.0 门禁继续保持未完成。

## 原产品与采集器审查

2026-10-15。审查者为独立验收 lane，未编写本次 RSS／站点地图、图片产品修复或其专用采集器。下列结论来自源码、差异和原始证据核对；不替代真实运行结果。[已有功能验收](existing-feature-acceptance.md)保留失败与恢复清单，[集成验收](platform-acceptance.md)记录各候选最终结果。

## 产品

- **RSS／站点地图**：检查两个 layout 的 head 输出、空配置回退、footer 链接、官方插件启用／版本条件及 PJAX 路由回退。独立核对 Halo 2.20.2 与 2.26.1 的 `pluginFinder.available` 语义为 STARTED 状态与版本约束同时满足；可选插件所需 Halo 版本与主题最低版本分别记录。XML 链接使用原生导航，现有导航过滤也排除预取。初审提出的图片页脚链接对比度与默认语言词条问题已修复并复审。
- **picture 灯箱**：复审 `AmplifyImg.ts` 改为整体包装 `picture`，使 `source`／`img` 保持直接子关系；已有链接与已有触发器仍避免重复包装。真实夹具曾证明旧结构会选错大屏图片，修复后的正文与专用图片验收分别记录，不能只靠 DOM 单测宣称跨浏览器通过。
- **原生 loading 的跨浏览器默认值**：真实图片验收发现未写／无效 `loading` 属性在 Firefox／WebKit 的 IDL 读值为 `eager`，原判断把它误当作者显式要求。修复改读内容属性 `getAttribute('loading')`，大小写不敏感地仅识别实际 `eager` 关键字，继续排除主题生成图片。缺失、空值、无效值与带空格值进入原生增强；显式 eager 保留，disabled 和 post 范围排除保留作者属性。独立运行 `bun test tests/image-loading.test.mjs tests/navigation-loading.test.mjs`：8/8 通过，涵盖两种 IDL 默认值、重复初始化、src/srcset/sizes 保真及回退。真实三引擎修复后结果由集成报告记录。

## 验收工具与恢复

图片修复作者另提供 `.runtime/platform-acceptance/image-loading-idl-probe-1791997853707.json` 与 `image-loading-source-probe-1791997950799.json`，本审查者已读取原始记录：前者确认三引擎 IDL 差异，后者将实际源码静态打包后跑三引擎 × native／post-only／disabled，9/9 通过。它们属于静态浏览器诊断，不是安装后的 Halo 候选验收。

- **RSS 浏览器采集器**：复审 `browser.mjs`、`browser.py`、`browser-support.mjs` 与对应测试。CSS 过渡等待先于实际对比度断言；no-JS 上下文移除导致 Firefox 创建挂起的 storageState，仍检验初始 HTML；每例总预算与清理预算有界。独立审查发现的 `active` 变量遮蔽已改为 `enabled_state`，最终恢复新增 active theme 和 installed-package 记录精确比较。未降低业务断言或把超时改为通过。
- **插件未安装阶段**：复审 `uninstalled.py` 候选／活动主题守卫、指定 JAR 备份与校验、插件配置／启停恢复及最终读取比较。操作范围是本任务独占合成实例。
- **原生图片采集器**：复审 `check-native.mjs`、`native-fixture.py` 与 HTML 夹具。窄屏使用实际 1x 候选，导航使用 Halo 实际 permalink；区分初始 HTML 与脚本增强，保留作者 eager、响应式图片、无脚本与反复 PJAX 断言。独立提出的活动主题／安装记录前后守卫已补。夹具发布时间改用当前 UTC；setup error、controller 非零退出和 restoration 失败分别记录。`stdin` error handler 捕获 EPIPE 并保留非零状态，避免未处理事件提前退出而丢失报告。夹具只清理本轮拥有的合成内容，并回读配置。
- **已有功能诊断采集器**：本 lane 编写 `scripts/site-content/check.mjs` 的请求账本及继续收集选项，由主代理独立审查。原断言与 30 秒阈值保留；继续收集后有任何失败仍非零退出，不自称独立审查自己的改动。

## 仍未关闭的验收项

此前候选 `07758ff` 的核心 120/120、axe 40/40 与后续图片 IDL 修复前候选 `d61ecfc` 的核心 119/120 分别保留。后者 Firefox 深色桌面文章文档 HTTP 200，但主题 `post.min.js` 无响应，等待 domcontentloaded 超时；社交／组合批次也分别存在图片或官方评论 JS 无响应的失败。有限八例网络对照没有复现，不能据此将原失败改判通过，也没有证据直接归因主题执行错误、Halo 或浏览器拦截器。

`d61ecfc` 的 scoped 正文、瞬间、SEO、安全与语言缓存验收结果仍只属于其安装包；新 loading 修复需要新的包与真实验收记录，旧结果不能自动迁移。普通作者图片没有初始 `loading` 属性时，脚本后来设为 lazy 并不证明初始网络请求已延后。实际 Safari／真机、屏幕阅读器、完整双站对照、性能、外部账户与安装升级回退仍是单独门禁。

图片 IDL 产品修复已提交为 `9a0f9201ef4957fe18efca6970e74962a84ee641`。本次独立源码审查结论适用于该修复；已独立核对集成负责人提供的真实 Halo 2.26.1 新包 native 验收：24/24 通过（native-site／native-post／disabled，三引擎两视口有脚本共 18 例，Chromium 两视口无脚本共 6 例），`restoration.result=passed`、`controllerExitCode=0`，无 controller／恢复错误。报告为 `.runtime/platform-acceptance/halo-lab/native-images/de0c98300ef0fe9a/report.json`，报告 SHA-256 `f39e8416763d6a920b8e055769731613306bbbcd0da7988263bbc3734b7b663d`，安装包 SHA-256 `2733dc6380c727682d15ad7491d09c89b53bde2441affb937700e7b4fbd3d0ce`。结果仍是 `scoped-passed-with-open-mapping`：普通未标注作者图片的初始请求延后映射未关闭，旧候选其他批次的通过或失败均不迁移到新包。
