# Demo 镜像

主题仓库维护可移植的公开示例内容、镜像构建、H2 初始化与启动/重启冒烟。正式发行工作流 `release.yml` 只发布主题附件，不调用 Demo 工作流。

`deploy-demo.yml` 需要维护者单独手动指定已发布 tag。它下载校验后的 ZIP，构建对应镜像并运行启动冒烟，再推广到 GHCR 的 `demo` 通道。**通道推广可能触发现有宿主机更新器，是独立部署操作**；合并 PR、主题发版都不代表已授权推广。镜像成功不代表线上部署完成。

## 镜像与运行

镜像基于固定摘要的 Halo 2.26.1，包含 Python 初始化器、SearchWidget 1.8.0、主题 ZIP 和公开示例内容。只打包公开材料，不复制现有实例的数据库、凭据、Cookie 或密钥。

首次启动在 `/root/.halo2` 独立可写目录生成 H2 和管理员凭据（`demo-operations/credentials.json`，0600）。同版本重启保留数据库，版本/源码/主题摘要不匹配则拒绝复用。初始化未完成时不报告健康；不得通过删除归属记录绕过检查。H2 文件不能由多个实例共享。

Demo 内容来自仓库，新版本使用新数据库；后台手工修改不跨版本保留。正式博客的备份、升级和恢复需另外规划。

## 构建验证

```sh
bun run verify
bun site/demo/bundle.mjs dist/halo-butterfly-next-1.0.0.zip .runtime/demo-bundle
python3 site/demo/context.py .runtime/demo-bundle .runtime/demo-context
docker build -t demo-candidate .runtime/demo-context
python3 site/demo/smoke.py demo-candidate
```

输出目录须为新目录。PR 的 `Verify H2 demo image` 检查独立 H2 启动和重启；它不连接现有线上服务，也不替代主题最终候选验收。

GHCR 镜像位于 `ghcr.io/songxychn/halo-butterfly-next/demo`，版本标签不可覆盖，`demo` 通道只接受最新已发布语义版本。首次创建 package 后须另行设为 Public，不能假定仓库公开就使镜像公开。

## 宿主机运维

主机更新器、systemd 配置、Caddy 切换和回退测试已迁至 `infra-ops/runbooks/halo-butterfly-demo/`。源码迁移不等于线上脚本更新；线上 CA/JVM 等定制需在单独授权部署时核对。部署后由运维流程校验公网版本回执的 tag、sourceSha、themeSha256 和 ready。

旧发布与迁移报告仍在 `docs/validation` 保存；报告是历史证据，不是当前主机状态或安装指令。
