# 版本发行

合并版本准备 PR 后，由维护者推送 `vX.Y.Z` 或 `vX.Y.Z-alpha.N/beta.N/rc.N` tag。`release.yml` 验证、构建、发布 Release，再调用 demo 工作流。master 合并不发布版本、不更新 demo。手动输入既有 tag 可以重试；不能改写已公开附件。

每次发版须同步 `package.json`、`theme.yaml`、`site/manifest.json` 与 `site/config/theme-profile.json` 的版本，以及文档内容。准备 `releases/<tag>.md` 发行说明和 `<tag>.json` 放行记录：

```json
{
  "tag": "v0.1.0-alpha.3",
  "sourceSha": "经独立审查的完整源码SHA",
  "themeSha256": "实际验收主题ZIP的SHA256",
  "decision": "approved",
  "reviewer": "独立审查者及证据引用",
  "gates": {
    "realHalo": "passed",
    "installUpgradeRollback": "passed",
    "resourcesAndLicenses": "passed",
    "sourceRebuild": "passed"
  },
  "knownLimitations": ["获准披露的限制及对应裁定"],
  "evidence": [{"path": "docs/validation/某份真实验收记录.json", "sha256": "该文件摘要"}]
}
```

此处是结构示例，不是任意候选的放行依据。alpha.3 的[实际批准记录](v0.1.0-alpha.3.json)与[发布完成记录](../docs/validation/2026-10-06/alpha3-publication.md)已归档；后续版本仍须取得对应候选的验收与维护者发布授权。补工作流不会自动放行已知失败。证据源码必须是 tag 的祖先，包摘要必须与本次构建完全一致；发行材料提交可以晚于实际验收源码。工作流另外从分发源码归档独立重建，确认同一 ZIP。

附件为主题 ZIP、对应源码 tar.gz、`release-validation.json`、`SHA256SUMS`。先上传草稿并下载校验，再公开，再下载校验。公开附件不覆盖。Release 发布成功但 demo 失败时保留 Release，修复部署后单独重跑 demo。

alpha/beta/rc 标记为 GitHub prerelease；demo 默认按语义版本跟随最新已发布版本（包括预发行），不使用忽略 prerelease 的 `/releases/latest` 接口。回退由 hk 显式执行，不允许旧发布覆盖新通道。
