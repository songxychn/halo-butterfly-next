# SearchWidget 1.8.0 限定集成验收

2026-10-08，官方 [1.8.0](https://github.com/halo-dev/plugin-search-widget/releases/tag/v1.8.0) 包含 [PR #66](https://github.com/halo-dev/plugin-search-widget/pull/66) 的焦点恢复修复。当前开发版将真实插件验收固定为 1.8.0；主题没有新增插件内部补丁，继续调用公开 `SearchWidget.open()`。入口兼容基线保留 >=1.7.1，旧版焦点缺陷必须明示；本轮不升级已发布 alpha.3 或演示站。

## 固定身份与结果

机器摘要：[search-widget-1.8.json](search-widget-1.8.json)。以下结果属于 `559b3a18c2258011702d37baa3f01b323db3e3e1`，不能迁移到未来提交。后续最终 head 检查单独保存原始报告及收据。

| 对象 | 身份 / 结果 |
| --- | --- |
| 主题源码与 runner | `559b3a18c2258011702d37baa3f01b323db3e3e1` |
| 实际安装 ZIP | `halo-butterfly-next-0.1.0-alpha.3.zip` / SHA-256 `abdae98d37799f616cd36d215b632dd177491123d3c889b6344769e052518998`；本地开发构建，不冒充已发行 alpha.3 附件 |
| Halo | 官方 2.26.1 / SHA-256 `7a1d6ea0800e8940672aab99a7328b7bd9520e297677169594328004a41991bc`；Corretto 21.0.8 |
| 搜索插件 | 官方 1.8.0 / JAR SHA-256 `4ada3473c55a1428134f0373fc7069cb6a906ae44582fd5e7319687f7d27cc2d`；下载与安装后核对，实际 manifest requires >=2.26.0 |
| 评论插件 | 官方 3.3.2，摘要按 `fixtures/search-comment/versions.json` |
| 浏览器 | Playwright 1.63.0；Chromium 153.0.8010.12、Firefox 155.0、WebKit 26.6；均为独立无头引擎 |
| 焦点专项 | `focus-02`：96/96 通过；含 24 个 Escape/遮罩焦点检查、12 组合与 12 张关闭后截图 |
| 现有集成流程 | `flows-01`：26/26 通过；中文、英文、无结果、鼠标打开、键盘打开/跳转、8 项关闭焦点、评论提交/权限/审核提示与启停；`fixtureRestored=true`、`restoreErrors=[]` |
| 工程门禁 | `bun run verify`：583 项测试及 129 文件安装包检查通过；不代替真实插件流程 |

## 场景与证据边界

专项每引擎执行 1440×1000 / 390×844 × 亮暗四组合，每组合有 Escape、遮罩、重复三次开关、多个入口、同批次关闭再打开、入口隐藏、入口移除及真实结果跳转八项。先验证键盘打开后焦点进入 Shadow DOM 内的输入框，再等待插件 DOM 更新并验证回到本次实际入口，防止“入口始终聚焦”被误记为恢复。额外入口为上下文内的合成 DOM，未改写服务器内容、插件私有 DOM 或组件原型。搜索输入和 Enter 跳转使用实际索引内容。

首轮 `focus-01` 属于 `2381a53b84b2c68647421c48ee6f80e52105a8aa`：错误使用当前 Playwright 包未导出的 `expect` 使 84 项失败；另一次 Firefox 390 暗色导航在 DOMContentLoaded 阶段超时。独立审查发现并推动修正断言接口和输入焦点前置条件，随后在新报告中重跑。首轮 85 个失败保持原始报告，既有 Halo 资源加载问题没有因后一轮通过而被宣称解决。

原始报告与截图保留在本任务 `.evidence/search-1.8-20261008/`，公开机器摘要记录每份原始报告及截图的摘要、提交、断言结果和边界，不承诺原始文件公开下载。私有合成会话、密码、数据库、插件 JAR 和完整 runtime 不进入文档或 Git。

报告 `workingTreeClean=false` 原样保留：焦点运行启动时只有预先存在、未跟踪的 `.codegraph/` 索引；集成流程在文档编辑前启动。实测脚本、主题 ZIP 和插件均有独立摘要，不将该字段改绿。

## 审查与剩余工作

独立审查人为 `/root/search_upgrade_review`，未参与文件修改。其核对运行脚本、版本与 Halo 要求、96/96 和 26/26 报告、主题/runner SHA、ZIP/插件摘要及截图数量；初始两项脚本问题已修正，当前代码无未解决阻塞。最终文档与矩阵冻结后再进行最终 head 复核，另存身份，不重写以上历史证据。

矩阵只更新 `config:search.use`、`interaction:search-popup` 和官方搜索依赖，见 [对账记录](../../parity/reconciliation-2026-10-08-search.json)。搜索交互从 verification-failed 转为 implemented-unverified；完整合同仍未完成，0 条提升为 verified。

实际 Safari、真实手机软键盘、完整 Tab 焦点约束、屏幕阅读器、全部角色/生命周期组合、Linux 原生资源加载及完整 1.0 未获本轮通过声明。#313 的缺陷关闭范围只涵盖固定正式插件的焦点恢复集成；最终首发候选和 #338 的资源问题另行验收。没有发布主题、部署站点或改写历史 alpha.3 发行记录。

## Linux 准备阶段冲突与后续修正

`d4f48973f0e2e596a24611e9f40f9267bd8231e3` 的 [构建 CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/37785826290) 和重复构建通过；该提交另有新焦点 96/96、集成 26/26 报告及独立审查，本地 `final-head.json` 保留其身份。

同 SHA 的 [Linux 对照 37785826360](https://github.com/songxychn/halo-butterfly-next/actions/runs/37785826360) 在插件准备阶段失败：安装后重复提交启用请求，与 Halo 协调器产生 HTTP 409。Chromium preflight 通过，129 个安装文件与 ZIP 相符，但没有启动 120 页浏览器矩阵，不能写为页面失败或资源超时。脱敏原始摘要见 [linux-preparation-failure.json](linux-preparation-failure.json)，原失败运行永久保留。

随后只修正 CI 插件状态准备：先读取目标状态，已启用则等待 STARTED；需要状态写入时，仅对 409 做有限重读重试，其他错误与启动超时仍失败。离线测试覆盖重复写入规避、冲突后重新读取、有限重试、非 409 错误和阶段等待。未来修正提交必须生成自己的 CI 和回归证据，不能把上述通过结果转移到新 SHA；主题构建输入与搜索断言未因这项准备修正改变。
