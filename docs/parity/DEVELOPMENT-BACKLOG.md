> 2026-10-28：当前产品范围以 [DEC-10](DEC-10-THEME-SCOPE.md) 为准。以下旧进度和任务条目保留作历史，不要求恢复已删除的能力。

# 1.0 收口清单

当前依据：[DEC-09 发布门禁收口](DEC-09-RELEASE-CLOSURE.md)与[验收要求](../RELEASE-ACCEPTANCE.md)。只保留主题严重缺陷、核心使用和发行必需检查；不再全量推进旧 P0/P1/P2。当前清单未定位新的未修复主题严重缺陷。1.0 的有限运行收尾已完成，发行材料准备和审查/CI 状态见[最终准备记录](../validation/2026-10-28/release-1.0.md)；本轮不打 tag、不发布。

## 当前收口顺序

| 项目 | 尚需完成 | 现有依据 |
| --- | --- | --- |
| R1 核心证据对账 | 页脚调整后本地预览 ZIP 为 08c90952…；保留原候选的核心/动画证据，新补桌面与窄屏页脚检查，见[本地 demo 更新](../validation/2026-10-28/local-demo.md) | [核心页面/插件组合](../validation/2026-10-24/halo-2271-acceptance.md)、[导航/评论/公式](../validation/2026-10-25/user-flows.md)、[图片](../validation/2026-10-25/images-faults.md)、[当前包性能](../validation/2026-10-25/performance-hero.md)、[RSS/站点地图](../validation/2026-10-17/rss-sitemap-followup.md) |
| R2 安装/升级/回退 | 已完成全新 Halo 2.27.1 安装、公开 alpha.4 同 ID 往返、旧值/正文保留、配置导出恢复及完整冷备份恢复；语义迁移边界明确 | [安装升级流程](../INSTALL-UPGRADE.md)、[迁移支持范围](../MIGRATION.md)；不扩展平台组合 |
| R3 发行包与审查 | 原包的发行材料与重建记录保留；页脚更新包 805/0 和安装核验通过，当前摘要及源码重建状态见本地 demo 更新记录。准备 PR 的审查/CI/合并与发布授权分别处理 | 工具 PR 的 CI 不代替最终候选的全部证据；不额外创建预发布流程 |

自然回收观察固定运行产品为 `2eb87dffd321411b00b48bf10bc7771b960a83d2`，ZIP SHA-256 为 `594c6fb24714c9e9de14b608f87741c4c88129660b997e4d9c7042297f2883e6`。原生/PJAX 历史滚动、评论立即挂载和 OG locale 修复保留。维护者已要求撤销为性能指标改变外观的调整：当前源码恢复标题/副标题一秒入场动画，含手机端。观察实例继续使用原包；新候选不继承取消动画包的性能通过结论，详见[回滚记录](../validation/2026-10-27/hero-animation-rollback.md)。

## 已知限制

| 范围 | 当前结论 |
| --- | --- |
| 评论图片草稿 | 所测 WebKit 刷新恢复 File 后上传失败，直接选图对照正常；不外推实际 Safari，不承诺刷新后的图片可靠续传。[证据](../validation/2026-10-27/webkit-file-transport.md)保留，上游补丁及一次性诊断入口已退出维护。 |
| 正文输入与图片 | 编辑器保存增强属性有差异；普通图片入口不保证初始 loading，原生 blur 不生成低清图；按[输入边界](../validation/2026-10-16/content-editor-followup.md)披露。 |
| 插件与平台 | 保留官方完整导航回退；不保证任意插件/SDK 组合；采用 Halo 原生访问控制、正文/UI 语言分离与通用提示块。 |

这些限制不改判为通过；若后续证据显示严重安全/数据风险或核心用途不可用，按具体影响重新分级。

## 后续改进（不是本轮执行队列）

- 评论/公式完整业务与其他编辑器矩阵；图片全配置、缓存和初始加载的全面覆盖。
- A02 平台长尾、时区、行内标记及完整来源映射；母语审校、外部 SDK 与 RSS 阅读器长尾。
- 固定执行机 CI；P3 实际 Safari/真机/完整无障碍/真实账户；PWA、Umami 私有统计、严格零资源按需和系列活数据沿用既有延期。

完整 D01–D08、P01–P03、A01/A02 分类依据见 [DEC-09](DEC-09-RELEASE-CLOSURE.md)。矩阵 897 个 ID 和原状态保持不变，不要求全部 verified 后发布。

## 已启动观察收尾

[自然回收观察](../validation/2026-10-27/natural-gc.md) `ac230b71aa8ba2fd7342` 继续使用原进程和锁，完成计时、清理与恢复后停止自动跟进。不另起批次或修改期限，不因局部失败自动扩展新支线，也不把该观察增设为发布门禁。

## 历史证据

[#338](https://github.com/songxychn/halo-butterfly-next/issues/338) 已按 Halo 2.27.1 正式包原范围关闭。历史失败、限定通过和恢复分别保留在 [10 月 25 日记录](../validation/2026-10-25/remaining-acceptance.md)、[上传记录](../validation/2026-10-27/comment-uploads.md)及各原始 JSON。清理前逐项清单见[固定 Git 快照](https://github.com/songxychn/halo-butterfly-next/blob/409e79cc6e4bc027b35d2972b8854efcfbc61b28/docs/parity/DEVELOPMENT-BACKLOG.md)，其中旧执行顺序不再适用。
