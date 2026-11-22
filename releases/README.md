# 版本发行

发版前需同步更新 `package.json`、`theme.yaml`、`site/manifest.json`、`site/config/theme-profile.json` 中的版本号，编写 `releases/v<version>.md` 发行说明并更新 `CHANGELOG.md`。

合并准备 PR 后，推送 `vX.Y.Z`（或 `vX.Y.Z-alpha.N` / `beta.N` / `rc.N`）标签，`release.yml` 会自动执行校验、构建并发布 GitHub Release（含主题 ZIP、源码归档与 `SHA256SUMS`）。预发行标签自动标记为 GitHub prerelease。

演示站镜像发布独立于主题发行，可通过手动触发 `deploy-demo.yml` 工作流构建并推送指定已发布版本的容器镜像。
