# 按 Release 重建的 H2 演示站

目标站点为 https://butterfly.baizhukui.com。`release.yml` 发布并核验主题附件后调用 `deploy-demo.yml`，后者下载同一 ZIP、打包同 tag 内容、构建并演练镜像，最后推送 GHCR。master 合并不触发发布或线上更新。发行门禁见 [releases](../../releases/README.md)。

## 镜像与运行

镜像基于固定摘要的 Halo 2.26.1，自带 H2、Python 初始化器、SearchWidget 1.7.1、主题 ZIP、19 篇内容和14张许可照片。只导出公开材料，不复制任何已运行实例的数据库、凭据、Cookie 或密钥。

启动时在 `/root/.halo2` 独立可写目录生成 H2 与管理员 `site-maintainer`。凭据保存在 `demo-operations/credentials.json`（0600）。同版本重启保留数据库与凭据；目录中的版本/源码/主题摘要不匹配时拒绝启动。初始化未完成时不报告健康，既有未完成导入按归属与快照核验恢复，否则停止等待检查。不要通过删除归属记录强制复用目录。

内容来源为仓库，后台手工修改不跨版本保留；新版本使用全新数据库，无需跨版本 SQL 迁移。H2 文件不供多个实例共享。正式博客有持续写入数据，应另行选择适当数据库及备份方案。

## hk 主动拉取

控制器固定部署在 `/root/docker/app/halo-butterfly-next/h2/tools/`，包括 `hk-update.py` 和 `scripts/release/common.py`（复制为同目录 `common.py`）。它不从镜像加载主机脚本，容器不挂 Docker socket，不获得宿主机管理权限。

初始化主机目录需先核对旧站容器归属、独立目录和 Caddy 路由；`owner.json` 固定为 `{ "host": "hk", "domain": "butterfly.baizhukui.com", "project": "halo-butterfly-next" }`，首次 `state.json` 为 `{ "container": "halo-butterfly-next", "database": "halo-butterfly-next-db" }`。这仅用于接入当前旧站，不是通用部署入口。

`hbn-demo-update.timer` 每五分钟执行一次：

1. 拉取 `ghcr-mirror.infra.baizhukui.com/songxychn/halo-butterfly-next/demo:demo`，解析为不可变 digest。
2. 拒绝自动降级、已发布同版本的不同镜像及重复失败镜像；管理员可显式加 `--retry` 重试。
3. 为候选创建 `instances/hbn-demo-<imageid>/`、独立容器和随机回环端口，连接现有 `reverse-proxy` 网络。
4. 候选健康且版本、源码、ZIP摘要正确后，只替换 Caddy 中本站的 upstream；校验共享文件未并发改动，保留 inode 并 reload。
5. 从公网核对部署回执后记录状态，再停止旧 Halo；数据和旧镜像保留，不执行自动清理。

切换前写入 pending 日志；脚本失败或进程中断后先恢复原路由。出现与本站无关的 Caddy 并发修改时停止，避免覆盖他人配置。手工回退：

```sh
python3 /root/docker/app/halo-butterfly-next/h2/tools/hk-update.py rollback
```

回退后自动更新暂停，排障后执行 `resume`；不修改 Release 和已公开镜像。旧 PostgreSQL 容器、数据与凭据保留为首次迁移的退路；切换后停用旧库以释放资源；回退到旧站时会先核对归属并启动保留的 PostgreSQL。

## GHCR 与部署结果

镜像位置为 `ghcr.io/songxychn/halo-butterfly-next/demo`，版本标签不可覆盖，`demo` 通道仅推进到最新已发布语义版本（包括 alpha/beta/rc）。镜像是公开演示材料：**首次创建 GHCR package 后，需在包设置中设为 Public**，hk 的镜像代理才能匿名拉取。仓库公开并不自动保证新 package 公开；若包仍私有，部署会明确失败，Release 保留，可完成设置后重跑。不要把管理员密码或个人访问令牌打进镜像。

`deploy-demo.yml` 发布镜像后等待 `/site-assets/demo-version.json` 返回相同 tag、源SHA和主题摘要；未收到 hk 回执就失败，不能把推送镜像当作部署成功。服务端错误查看 `journalctl -u hbn-demo-update.service` 和 `h2/failed.json`。该回执不包含凭据。

首次本地迁移演练可使用受限 `bootstrap --image halo-butterfly-demo:rehearsal-...`。它明确标为 `published: false`，不创建 Release、不推送 GHCR；一旦线上进入已发布版本，禁止再用此入口覆盖。

## 本地与 CI 验证

```sh
bun run verify
node site/demo/bundle.mjs dist/halo-butterfly-next-0.1.0-alpha.3.zip .runtime/demo-bundle
python3 site/demo/context.py .runtime/demo-bundle .runtime/demo-context
docker build -t demo-candidate .runtime/demo-context
python3 site/demo/smoke.py demo-candidate
```

PR 的 `Verify H2 demo image` 运行独立 H2 启动与重启检查。Release 流程另有精确版本的真实 Halo、安装回退、资源许可、独立审查和对应源码重建门禁；镜像 smoke 不替代完整产品验收。实际 hk 迁移和恢复结果见任务验收记录。
