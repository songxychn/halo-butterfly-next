# hk 文档与演示站（首次 PostgreSQL 部署记录）

后续 Release 驱动的 H2 整站机制见 [H2 demo](../demo/README.md)。本页保留首次导入与旧站恢复资料；`initialize.py` 的原 hk 入口不用于 H2 日常更新。

站点：<https://butterfly.baizhukui.com/>。本页记录 2026-10-05 首次 PostgreSQL 预览部署；当前站点已改用已发布 alpha.3 的 H2 镜像，详见[发布完成记录](../../docs/validation/2026-10-06/alpha3-publication.md)。

2026-10-05 首次 PostgreSQL 部署使用安装包 `4d76eec6be5ee53d639fef73bf10a5a14b63bde2cb8078738f02ea2b38ec515a`。2026-10-06 H2 迁移已改用包含阅读设置 PR #356 的安装包 `ad051bff7684fb4f91409f21dd9b07cf3a33178d4071dceb85759626ece0bcd1`；旧 PostgreSQL 部署保留并停止，仅用于回退。以下命令记录首次部署，不是活动 H2 站点的更新或备份入口。

## 首次 PostgreSQL 部署边界

- hk：`100.86.130.83`，部署根目录 `/root/docker/app/halo-butterfly-next/`。
- 独立 Compose 项目与数据目录；旧 `/root/docker/app/halo/` 未使用。
- Halo 2.26.1 + PostgreSQL 16.10，镜像经加速地址拉取并固定 digest，见 `docker-compose.yml`。
- Halo 仅映射回环 `127.0.0.1:18142`；数据库无宿主机端口。经现有 `reverse-proxy` 网络进入 Caddy。
- 域名使用 Cloudflare 代理；Caddy 自动申请源站证书。`/actuator` 和 API 文档不对公网开放。
- 两个新容器禁用 Watchtower，配置内存/CPU限制与日志轮转。
- 该工具只做首次导入。初始化与停止/备份命令都不是通用远程管理接口，不接受任意目标服务器。

## 初次安装与公开内容导入

先检查目标目录、容器名、回环端口和 Caddy 路由均未被占用，再创建专属目录及归属文件。`deployment-owner.json` 必须明确 project=`halo-butterfly-next`、host=`hk`、domain=`butterfly.baizhukui.com`、created=`2026-10-05`。`.env` 在服务器生成独立的随机 `POSTGRES_PASSWORD`，权限0600；目录0700。

复制本目录的 Compose/Caddy 配置到服务器部署根目录，执行 `docker compose config --quiet` 和 `docker compose up -d`。Caddy 片段暂不接入共享配置；先完成初始化和验收。

从已经验证真实路由的本地内容映射导出公开材料：

```sh
bun run verify
bun site/deploy/export.mjs .runtime/docs-site/permalinks.json
tar -C .runtime/hk-public-export -czf .runtime/hk-public-export.tar.gz .
```

导出白名单仅包括源码清单、配置、渲染正文、实际路径映射、许可照片、安装包和摘要。**不导出本地完整备份、数据库、用户、凭据、会话或密钥。**不要把整个 `.runtime` 上传到服务器。

将公开归档解压到服务器 `operations/public/`，将本仓 `site/tools/runtime.py` 与 `fixtures/comparison/versions.json` 分别复制到 `operations/source/site/tools/` 和 `operations/source/fixtures/comparison/`。将 `initialize.py` 复制到 `operations/`，在 hk 执行：

```sh
python3 -B /root/docker/app/halo-butterfly-next/operations/initialize.py
```

脚本在服务器现场生成管理员，检查容器归属、固定镜像、挂载和回环端口后，安装主题并导入19篇内容、14张照片、导航和搜索。只在首次初始化时处理默认欢迎文章及可选插件；中断后仅在导入包摘要未变、初始准备已完成且已有对象归属/字段匹配时继续。快照、正文或托管元数据变化会阻断发布。完成后禁止再次初始化；后续内容更新需另行审核，不能拿本地 `site/local.py` 连接远程实例。

管理员凭据仅位于 hk 的 `operations/credentials.json`（0600），账号 `site-maintainer`。控制台入口为 <https://butterfly.baizhukui.com/console>，不要把密码复制进 Git、日志或聊天。数据库密码在服务器 `.env`。

导入完成后逐项检查发布内容、封面与搜索，并保存上线前备份。把站点片段追加到共享 Caddyfile 前，先保留备份、校验原配置摘要及候选配置；保留单文件 bind mount 的 inode，使用 `caddy reload` 热加载。不要替换整个共享配置，也不要重建其他站点容器。

## 备份与恢复

服务器运行 `bash /root/docker/app/halo-butterfly-next/backup.sh`：只短暂停止该 Halo，导出 PostgreSQL、自有文件与恢复所需配置，然后恢复启动。资料保存在服务器 `backups/<UTC时间>/`，权限受0700目录及umask077保护。备份含账号/密钥，不发布到网站，不提交 Git。

当前实施的是手动备份，未配置定时或异机备份。`pg_restore --list` 和 tar 列表检查仅证明归档可读，**没有完成独立恢复演练**。

恢复时先另外保存当前数据库与文件，在独立目录/数据库恢复 `database.dump` 和 `halo-files.tar.gz`，使用备份对应的固定镜像与 `.env` 启动，验证19篇内容、图片、搜索及管理员后再切换。不要直接在运行中的 PostgreSQL 数据目录解压归档。

首次上线回退：只从共享 Caddy 配置撤下本域名片段并校验/reload，再停止本 Compose 项目；保留数据库、文件、`.env` 和备份，不执行 `down -v` 或删除目录。共享 Caddyfile 可能有后续改动，不能不经比较就整份覆盖旧备份。

## 验收范围

检查首页两页、19篇内容、14个不同文章封面、资源摘要、站内链接、桌面/手机视口与搜索。SearchWidget 1.7.1 的 Escape/遮罩关闭后焦点恢复限制继续披露；评论停用。源站上线不改变公开 alpha 或1.0发布门禁。
