# alpha.4 发布与 demo 完成记录

2026-10-09（Asia/Shanghai），[v0.1.0-alpha.4](https://github.com/songxychn/halo-butterfly-next/releases/tag/v0.1.0-alpha.4) 已公开，[demo](https://butterfly.baizhukui.com/) 已同步。发布时刻为 `2026-10-08T16:20:37Z`，预发行标记保留。

## 发行身份

- tag 源码：`307582a58f0eb6b4cf7561ee400d6df527cb9e1e`。
- 主题 ZIP SHA-256：`389f78ad60c2cf73195d3cf16ae967f967d64e510a70d679878d061a2f570953`。
- Release ID：`407034870`；主题附件 ID：`622349299`。
- ZIP、对应源码、`release-validation.json` 与 `SHA256SUMS` 四份公开附件均回下载校验；匿名 ZIP 下载摘要相同。完整附件身份见[机器记录](alpha4-publication.json)。

[候选验收](../2026-10-08/alpha4-acceptance.md)与独立审查保持原始源码/报告归属。真实 Halo 安装、alpha.3 升级回退、配置/内容保留、源码重建及许可资源检查通过；583 项工程检查通过。`4dd8e1a` 的实际产品测试不迁移到发行提交；`3c1d1e3` 的文案补充独立审查及同 ZIP 重建另有记录。发布工作流再次核验发行提交、重复构建及分发源码重建。

## CI 与重试边界

版本准备 [PR #382](https://github.com/songxychn/halo-butterfly-next/pull/382) 精确 head `b0a68c5` 的主题与 H2 CI 均通过，普通合并生成上述 tag 源码。[发行工作流](https://github.com/songxychn/halo-butterfly-next/actions/runs/37807508664) 第 2 次运行成功，发布及 demo 作业均成功。

第 1 次发行运行在创建空草稿后立即查询不到该 Release 而失败；未公开附件、未更新 demo。保持 tag 不变后安全重试，根因未确认。[master 主题 CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/37807446350) 第 1 次运行的 Bun 迁移 CLI 子进程测试超时，第 2 次同源码运行通过。原始失败与各次运行身份均保留。

部署作业的 artifact 上传步骤报告 `.runtime/demo-*.json` 无文件，API 列表也为空；上传动作默认排除了隐藏目录。不能宣称已下载该 CI artifact。后续工作流修正为显式允许三个公开 JSON 文件；本次部署结果另由主机与公网实际状态核验。

## demo 实际核验

公网回执为 `published:true`、`ready:true`，tag、发行源码、主题摘要及附件 ID 与 Release 一致。当前容器健康，镜像不可变 digest 为 `sha256:9b9aaad53918df4be87628d5b67879fb662e8f2358b9c7b07826931dbbb6eed1`。旧 alpha.3 容器已停止，数据与镜像保留供回退，五分钟更新检查仍启用，无 pending 或 paused 状态。见[主机核验](alpha4-demo-host.json)。

[公网核验](alpha4-public-resources.json)：24 个页面 HTTP 200，70 个主题 CSS/JS 与发行 ZIP 字节相同，14 张照片与清单一致；不存在地址及三个内部端点返回 404。实际搜索脚本版本为 SearchWidget 1.8.0；独立无头 Chromium 的一次公网搜索 Escape 关闭及焦点返回检查通过。此处不扩展为完整浏览器或无障碍验收。

## 验收状态对账

本次发布没有将任何功能矩阵项提升为 verified，`matrix.json` 与生成的 `MATRIX.md` 状态保持原样，PROGRESS 同步完成记录。#338 原生资源挂起、默认明亮顶图对比不足、手机 LCP 未达预算，以及真实 Safari、真机、屏幕阅读器、完整插件生态、市场整改与稳定 1.0 门禁继续保留。已公开 tag 与附件不覆盖。
