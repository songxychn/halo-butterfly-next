> 2026-10-28：当前产品范围以 [DEC-10](DEC-10-THEME-SCOPE.md) 为准。以下旧进度和任务条目保留作历史，不要求恢复已删除的能力。

# 1.0 收口清单

当前依据：[DEC-09 发布门禁收口](DEC-09-RELEASE-CLOSURE.md)、[DEC-10 产品范围](DEC-10-THEME-SCOPE.md)与[验收要求](../RELEASE-ACCEPTANCE.md)。只保留主题严重缺陷、核心使用和发行必需检查；不再全量推进旧 P0/P1/P2。当前候选以 [releases/v1.0.0.json](../../releases/v1.0.0.json) 的源码、ZIP、证据和门禁状态为准；下方历史包不覆盖该身份。本轮不打 tag、不发布。

## 当前收口顺序

| 项目 | 完成条件 | 当前依据 |
| --- | --- | --- |
| R1 核心证据对账 | 删减后包的核心页面、原生导航及声明插件入口可用；未受影响证据按精确包/源码差异复用 | [第二轮范围删减](../validation/2026-10-28/scope-reduction-round2.md)，补充证据见发行清单 |
| R2 安装/升级/回退 | 当前包新装、公开 alpha.4 同 ID 往返、配置迁移/正文保留及完整冷备份恢复 | [安装升级流程](../INSTALL-UPGRADE.md)、[迁移支持范围](../MIGRATION.md)；实测状态见发行清单，不扩展平台组合 |
| R3 发行包与审查 | 固定源码归档重建 ZIP 一致、独立审查关闭问题、PR 与合并后 CI 通过 | 审查/CI 与发布授权分别记录；维护者作发布决定后才创建公开制品 |

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
- A02 平台长尾、时区、行内标记及完整来源映射；母语审校与 RSS 阅读器长尾。
- 固定执行机 CI；P3 实际 Safari/真机/完整无障碍/真实账户；PWA、严格零资源按需和系列活数据沿用既有延期。

完整 D01–D08、P01–P03、A01/A02 分类依据见 [DEC-09](DEC-09-RELEASE-CLOSURE.md)。矩阵 897 个 ID 和原状态保持不变，不要求全部 verified 后发布。

## 已启动观察收尾

[自然回收观察](../validation/2026-10-27/natural-gc.md) `ac230b71aa8ba2fd7342` 继续使用原进程和锁，完成计时、清理与恢复后停止自动跟进。不另起批次或修改期限，不因局部失败自动扩展新支线，也不把该观察增设为发布门禁。

## 历史证据

[#338](https://github.com/songxychn/halo-butterfly-next/issues/338) 已按 Halo 2.27.1 正式包原范围关闭。历史失败、限定通过和恢复分别保留在 [10 月 25 日记录](../validation/2026-10-25/remaining-acceptance.md)、[上传记录](../validation/2026-10-27/comment-uploads.md)及各原始 JSON。清理前逐项清单见[固定 Git 快照](https://github.com/songxychn/halo-butterfly-next/blob/409e79cc6e4bc027b35d2972b8854efcfbc61b28/docs/parity/DEVELOPMENT-BACKLOG.md)，其中旧执行顺序不再适用。
