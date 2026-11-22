# 版本发行

发版前需同步更新 `package.json`、`theme.yaml`、`site/manifest.json`、`site/config/theme-profile.json` 中的版本号，编写 `releases/v<version>.md` 发行说明并更新 `CHANGELOG.md`。

合并准备 PR 后，推送 `vX.Y.Z`（或 `vX.Y.Z-alpha.N` / `beta.N` / `rc.N`）标签，`release.yml` 会自动执行校验、构建并发布 GitHub Release（含主题 ZIP、源码归档与 `SHA256SUMS`）。预发行标签自动标记为 GitHub prerelease。

GitHub Release 发布成功后，`release.yml` 会调用 `deploy-demo.yml` 构建并测试同版本的演示镜像。镜像推送到 GHCR 后，Watchtower 会在发现 `:demo` 标签指向新镜像时更新线上演示站。正式版和预发行版都适用，只有版本号最新的已发布版本可以更新 `:demo`。

如果 Demo 构建失败，已发布的主题仍可下载。可重跑失败的构建任务，也可手动触发 `deploy-demo.yml` 并填写版本标签。
