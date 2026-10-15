# 平台接入与既有功能验收总表

2026-10-15。[机器总表](platform-acceptance.json)保存候选 SHA/包摘要、原报告 SHA-256、逐场景结果与恢复状态。本轮限定工作已收束，仍有未完成门禁；不同包的结果不合并成一个“全部通过”候选，也不提升矩阵 `verified`。

## 已确认范围

维护者 [#415](https://github.com/songxychn/halo-butterfly-next/issues/415) 已确认：PWA/离线延期到 1.0 之后（后续版本与是否实施待评估，不自动排入 1.1）；RSS/站点地图 → 评论/KaTeX 按需 → 图片原生懒加载 → Umami。接受 `loading="lazy"`，不要求视口进入前严格零请求。对应[提案](../../parity/PLATFORM-WORK-PROPOSAL.md)、[当前合同](../../RELEASE-ACCEPTANCE.md)与[决策记录](../../parity/DEC-03-PLATFORM-DECISION.md)已更新。

897 条矩阵保留：633 `implemented-unverified`、39 `gap`、16 `mapping-required`、5 `verification-failed`、184 `not-applicable`、20 `blocked`（12 条既有 1.1 系列 + 8 条 post-1.0 PWA）。当前 1.0 适用分母 **693**；RSS/Sitemap 另以必需合同场景 PLG-07 追踪。**verified 仍为 0**。

## 候选与证据

| 候选 | ZIP SHA-256 | 本表可引用的范围 |
| --- | --- | --- |
| `07758fff4bee7a465c1cfe0bba8c91d2890aa815` | `e98fc89d97a2379a0f163d96f34dbfc084a0a33e5a352121d1fef33b5c6ef409` | RSS 入口初始产品；核心浏览器与自动 axe。早于 picture 修复，不能给新候选全部背书。 |
| `d61ecfc745ce0c0bbc643a95cbed1456d044a5cf` | `fb27a08f50406f405e4d6eee84d43a530510ab6a24f1b6fa7369dc8c63e4cbcc` | 图片 IDL 修复前候选；含 RSS 入口及 picture 修复，RSS HTTP/浏览器/真实缺失插件及既有功能运行归属此包。 |
| `9a0f9201ef4957fe18efca6970e74962a84ee641` | `2733dc6380c727682d15ad7491d09c89b53bde2441affb937700e7b4fbd3d0ce` | 修复原生 loading 属性判断；本候选原生图片 24/24 与本地 verify 归属此包，旧批次不自动迁移。 |
| picture 独立合成构建 | 以产品文件与内存 bundle 摘要绑定，见[专项报告](picture-responsive.json) | 修复在提交前验证；报告 HEAD `bc9d08c…` 不含当时尚未提交的修复，不能误作修复提交。 |

| 验收范围 | 当前结果 | 限定与未完成 |
| --- | --- | --- |
| 核心 10 路由，三引擎 × 两宽度 × 亮暗 | 120/120 核心冒烟通过 | 仅旧 `07758ff` 包；不是双站视觉一致性、P+ 或所有交互验收。 |
| 图片 IDL 修复前候选核心补跑 | 119/120，Firefox 1 条失败 | Chromium/WebKit 各 40/40；Firefox 1440 暗色 preview-2 的 post.min.js request 12 关闭前仍未收到响应。保留未解决失败，不用旧包或重跑覆盖。 |
| Chromium 自动 axe 4.12.1 | 40 场景完成，0 自动违规 | 同为旧包；40 个 `color-contrast` incomplete 仍待人工判断，不等于无障碍/屏幕阅读器通过。 |
| RSS/Sitemap 匿名 HTTP | 11/11 阶段通过，恢复通过 | 公开/私密/草稿、已发布更新、公开转私密、canonical、主题开关及插件停用/恢复。Sitemap 允许其既有 30 秒缓存传播窗口；旧插件版本未验。 |
| RSS/Sitemap 实际卸载与重新安装 | 4/4 阶段通过，恢复通过 | 两插件分别真实 404/入口隐藏，再按锁定官方 JAR 恢复。非生产升级证明。 |
| RSS 浏览器首轮 | 13 条已有结果：10 通过、3 失败；整轮未完成 | 保留原失败，原因涉及过渡动画采样时机与默认英文断言。未据诊断改写为通过。 |
| RSS 浏览器完整新批次 | 7 阶段、60/60 通过，恢复通过 | d61/fb27；三引擎入口/布局、明暗/窄屏、PJAX/历史、无 JS、默认 locale、开关与停用/重启。首轮独立保留；旧插件/读者客户端与实际 Safari 不在此范围。 |
| PJAX 页脚过渡诊断 | 三引擎 +350ms 均观察到稳定白字/深色背景 | 仅诊断；不替代修正收集器后的完整 RSS 浏览器验收。 |
| 原生图片 Halo 首轮 | 夹具发布超时，0 条浏览器场景，恢复通过 | 首轮固定 publishTime 晚于运行 UTC；已改实际当前 UTC 并保存最后发布状态；后续新批次独立记录，原报告保留。 |
| 原生图片 Halo 实际场景 | 16/24，8 条真实产品缺陷，恢复通过 | Firefox/WebKit 将无 loading 属性的 IDL 映射为 eager，代码误判作者显式 eager，跳过 plain img 的 lazy 初始化。已复现三引擎属性差异；修复与新候选结果单列，不覆盖本次失败。 |
| 原生图片修复后 Halo 新候选 | 24/24 通过，恢复通过，控制器退出 0 | 9a0f920/2733dc6；18 条 JS + 6 条 Chromium no-JS；native/site 每引擎每宽度 5 次 PJAX。作者无属性的初始延迟与 blur 视觉仍不在通过声明内。 |
| picture/灯箱修复 | 原始 2/2 复现失败；修复后 6/6 新回归、7/7 既有回归通过 | 独立合成页，并有后续 native Halo 结构/候选验证；无实际 Safari/真机结论。 |
| 通用正文 | 27/27 限定通过 | API HTML 输入；不是实际编辑器保存/重开流程。 |
| 瞬间 | 33/33 限定通过 | 合成 Halo/插件数据与无头浏览器；完整组合、设备和合同仍独立。 |
| 社交/页脚/友链 | 初轮 17/18；诊断全批 28/29，仍失败 | Firefox networkidle/资源停滞原始记录保留；有限 8 场景诊断全过不替代正式批次。 |
| 跨功能组合首次 | 5 条均失败/中止 | 等待评论组件等原始记录保留；未完成。 |
| 跨功能组合 eager 配置 | 11/12，1 条 Firefox networkidle 超时 | 保留失败，后续修正/复跑应作为新记录追加。 |
| 安全及 SEO | 各 36/36 限定通过 | 同一 d61/fb27 候选；完整范围见[既有功能报告](existing-feature-acceptance.md)。 |
| 评论 locale 协议 | 3/3 限定通过 | 使用合成公开评论响应；不是全部真实评论服务与权限验收。 |

最新源码本地 `verify` 通过：typecheck、parity、748 条 Bun 测试及实验室 Python 守卫、构建和包检查。产品提交 `9a0f920` 的 [CI run 38604906238](https://github.com/songxychn/halo-butterfly-next/actions/runs/38604906238) 通过；最终文档提交 CI 仍以 PR 的精确 HEAD 状态为准。此结果不替代完整浏览器/性能/设备门禁。

机器总表携带 RSS HTTP 的各阶段断言结果、实际卸载四阶段、浏览器首轮 13 条结果、诊断关键样本以及其他批次逐场景状态，不仅列本机路径。原始完整日志/响应/截图仍留在各任务 runtime，机器总表同时记录其路径和 SHA-256。私有恢复快照、账号、Cookie 和凭据不进入本表。

## 恢复与失败处理

- RSS HTTP：自有合成文章已删除，主题订阅设置与两插件原启停状态恢复并读回通过。
- 实际卸载：官方 JAR/版本与摘要、原插件配置 data/存在性、启用态和原主题配置恢复通过；当前激活主题及 installed-package 记录保持。重装会重新生成 UID/资源版本，不将其说成位级备份恢复。
- RSS 浏览器完整新批次：主题设置、两插件原启停态、活动主题和 installed-package 记录恢复/一致性核对通过。
- 浏览器首轮：为诊断停止旧浏览器进程后，控制器 finally 恢复通过；批次结果仍为 failed。
- 原生图片首轮：夹具未到 ready，浏览器未执行；自有夹具和原配置恢复通过。旧 runner 将非零 controller 退出误写进 restorationError；已拆分 setup error / controllerExitCode / restorationError，未回写旧报告。
- 原生图片修复后新候选：24/24，控制器退出 0，自有文章删除与原设置恢复读回通过；活动主题/安装记录保持。
- 原生图片实际场景：控制器退出 0，恢复通过；16/24 的整体失败来自真实产品断言。
- 既有功能独立实验室 18616：主题设置、系统设置、插件启停态等恢复读回通过；临时诊断 JVM 参数未持久化，正常启动参数复验后已停实验室、端口无监听。具体清单见[独立报告](existing-feature-acceptance.json)。
- 集成实验室最终核对：265 个安装文件与最新 ZIP 一致，主题设置恢复，8 个插件恢复原 disabled 状态；活动主题正确。已停止自有实验室，18615/14615 均无监听。

## 继续推进与审批边界

[独立审查](platform-independent-review.md)已覆盖 RSS、picture、原生 loading 产品修复和采集器恢复/证据逻辑；审查未留下阻塞代码项，但不会将失败运行或未完成合同场景变成通过。

RSS 浏览器完整批次和原生图片修复后的新候选 Halo 批次已完成并分候选记录。Firefox 资源停滞导致的核心/组合/社交失败仍未关闭，最终提交 CI 另由 PR 状态追踪。普通作者 `<img>` 未声明 loading 的路径仍是初始 HTML 映射缺口，JS 后补 lazy 不证明初始请求已延迟。native-post 的 blur=true 仅检验该配置下正常加载，未单独断言模糊占位视觉或加载后 class 清理，不能视为 blur 选项完整验收。

评论/KaTeX 的[官方插件能力边界](../../parity/PLUGIN-RESOURCE-FOLLOWUP.md)已核对：查询时 CommentWidget 3.4.0 要求 Halo≥2.27 且仍全站注入，不能直接替换本轮 Halo 2.26.1 / CommentWidget 3.3.2 的验收组合；KaTeX 3.0.0 仍全站 CSS/可选 JS。严格资源按需目标尚未满足，后续方案须在官方兼容边界内讨论；本 PR 不包含上游功能改造或定制插件协议。Umami 私有凭据后端承载待确定，真实账号与设备人工检查仍独立。

既有五类双站页面失败、最终包性能预算、实际 Safari/真机、屏幕阅读器、安装升级/回退、完整合同与正式发布均未被上述限定测试消除。本表不声称 1.0 已完成，也不授权生产部署或正式发行。
