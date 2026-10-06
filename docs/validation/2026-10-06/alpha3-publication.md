# alpha.3 发布完成记录

记录日期：2026-10-06（Asia/Shanghai）。[v0.1.0-alpha.3](https://github.com/songxychn/halo-butterfly-next/releases/tag/v0.1.0-alpha.3) 已公开，GitHub `publishedAt` 为 `2026-10-05T18:57:40Z`，北京时间为 2026-10-06 02:57:40。[demo](https://butterfly.baizhukui.com/) 已同步该发行版本。本记录补充发布后的结果，不改写发布前的原始验收与失败记录。

## 身份与公开附件

- 实际产品验收源码：`8e53148a8c84996d091e2792e8a4651522690a0a`。
- 发行 tag 与对应源码归档提交：`7fc8d49a9069d44c4740eac4daaa59b843f87567`，包括后续发行文档及授权记录。
- Release ID：`404026801`；主题附件 ID：`613413645`。
- 固定验收平台：Halo 2.26.1；主题 ZIP 包含 129 个文件，2,798,306 字节。

[发行页](https://github.com/songxychn/halo-butterfly-next/releases/tag/v0.1.0-alpha.3)包含以下四份附件。下载主题 ZIP 用于安装，源码 tar.gz 用于构建；GitHub 自动生成的 Source code 链接不属于下面的四份上传附件。

| 附件 | SHA-256 |
| --- | --- |
| `halo-butterfly-next-0.1.0-alpha.3.zip` | `c0c73dedbf7b2c98d1936991470d5f80a38319cbe31a5815a217e3d071dc2be2` |
| `halo-butterfly-next-0.1.0-alpha.3-source.tar.gz` | `b4155b66a80c57f72088dc54d55d0429725bf9f147a052341fa3e138d00c1644` |
| `release-validation.json` | `f32052b710406f93779653e9f5862bb67152906bc91bec6bc206ab2be114d9f1` |
| `SHA256SUMS` | `d04f61761fc982e2eeaf922f7a51cbc5b3d9e6f22caf194e6a669fce6adc9d4a` |

`SHA256SUMS` 校验前三份附件；上表同时记录摘要清单自身的摘要。公开附件均已回下载，与准备目录逐字节比较一致。发布工作流从分发源码归档独立重建，ZIP 摘要与实际验收包一致。

## 发布、恢复与 CI

- [PR #372](https://github.com/songxychn/halo-butterfly-next/pull/372)完成最终候选验收与限制披露；[PR #373](https://github.com/songxychn/halo-butterfly-next/pull/373)记录维护者明确的“发布”授权。
- 首次工作流在创建草稿后用 tag API 读取草稿，返回 404，尚未上传附件。恢复时固定草稿 ID 并检查 tag 身份，保留原脚本的缺失附件上传、公开前后回下载比较；没有改写 tag 或覆盖附件。
- [Release theme 工作流 37359293227](https://github.com/songxychn/halo-butterfly-next/actions/runs/37359293227)第二次执行成功，发行提交为 `7fc8d49…`。发布校验、对应源码重建、demo 镜像构建、全新 H2 初始化与重启、镜像推送及 hk 回执检查均通过。
- 后续 [PR #374](https://github.com/songxychn/halo-butterfly-next/pull/374)已合并草稿读取修复；该改动不在已发布 tag 内，也未改变本次发行附件。[准备任务 #368](https://github.com/songxychn/halo-butterfly-next/issues/368)已按完成关闭。

## demo 与公网检查

公开回执位于 [`/site-assets/demo-version.json`](https://butterfly.baizhukui.com/site-assets/demo-version.json)，发布后及本次文档收尾复查均为：

```json
{
  "tag": "v0.1.0-alpha.3",
  "sourceSha": "7fc8d49a9069d44c4740eac4daaa59b843f87567",
  "themeSha256": "c0c73dedbf7b2c98d1936991470d5f80a38319cbe31a5815a217e3d071dc2be2",
  "published": true,
  "ready": true,
  "contentCount": 19,
  "database": "h2"
}
```

发布后检查 24 个公开页面均返回 HTTP 200，页面未带旧回环地址；下载页指向本次 Release。26 个主题 CSS/JS 使用原版本 URL 下载，与公开 ZIP 中对应文件的 SHA-256 全部一致。`/actuator/health`、`/v3/api-docs` 和 `/swagger-ui/index.html` 均返回 404。

当时 hk 新容器健康、旧预览容器停止，更新定时器开启，无 pending 或暂停标记；旧数据与容器保留作为回退材料。此为发布时检查，不承诺之后的持续运行状态。本次文档收尾只复查公开回执，没有修改服务器。

首次本地公网探测遇到连接超时与 TLS 连接错误，保留失败日志；限定超时并重试后完整 HTTP/资源检查通过。GitHub 部署 artifact 下载未找到可下载归档，未将其计为有效证据；工作流状态、公开回执与主机状态另行核验。本地脱敏检查明细保存在 `.runtime/alpha3-publication/`（不提交运行目录、凭据或数据库）。

## 放行边界

原始产品失败、未完成项与复用证据边界以[最终验收](alpha3-final-acceptance.md)及[发行说明](../../../releases/v0.1.0-alpha.3.md)为准。#313 搜索焦点、#338 资源挂起和默认明亮顶图对比度按维护者批准作为 alpha 限制保留。手机 LCP 未达目标，真机、Safari、屏幕阅读器和完整 1.0 范围仍未完成。

本记录中的公网 HTTP 与资源摘要检查不替代完整浏览器交互、无障碍、性能或用户站点安装升级回退测试。历史验收中“待发布授权”“尚未发布”的文字保留其记录时点，当前发行状态以上述 Release 和发布完成记录为准。
