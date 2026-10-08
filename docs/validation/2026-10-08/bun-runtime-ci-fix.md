# Bun 迁移的 CI 修复

PR #381 初始提交 `07a72b70f78ca9cfc833c98ddefaa9217377de5f` 的 H2 demo 镜像检查通过，但出现两个独立问题：

- [Linux Halo 运行 37789183381](https://github.com/songxychn/halo-butterfly-next/actions/runs/37789183381) 在全新实验站初始化插件时，`PluginSearchWidget/plugin-state` 的 PUT 返回 HTTP 409；主题安装、13 个内容对象播种及 Chromium preflight 已通过，尚未开始 120 页浏览器检查。
- [主题检查 37789183164](https://github.com/songxychn/halo-butterfly-next/actions/runs/37789183164) 的 Bun 并行测试输出停留在 581/583 项；缺失的两项来自 `linux-halo-package-manager.test.mjs`，该文件同步启动 Bash，再由 Bash 调用 Bun。持续挂起超过 15 分钟后主动取消取得完整日志。该运行是取消状态，不能当作通过。

插件启停仅对 HTTP 409 做最多 3 次重试（共 4 次请求），每次发送相同目标状态而非重放插件资源快照；401、404、500、传输异常以及超限 409 都保持失败。固定插件 JAR 摘要、启用状态、STARTED 阶段、配置回读和 120 页完整通过要求均保留。离线测试覆盖启用/停用冲突后成功、重试耗尽以及其他错误不重试。

包管理器选择测试改为异步 `execFile`，每次子进程有 10 秒超时，避免同步等待阻塞 Bun 测试 worker。原有历史 pnpm、历史 Bun+Node、当前 Bun、缺锁文件与不支持包管理器的检查继续执行；失败分支明确要求退出码 1，不能将超时当成预期拒绝。异步方式是否解决 Linux 挂起由新提交的远程 CI 确认，不将本机通过当作 Linux 结论。

本地 `GITHUB_ACTIONS=true` 的并行定向测试通过 3 项，Python CI 守卫测试通过 9 项。最终提交上的完整本地门禁、ZIP 摘要与远程 CI 结果在 PR 中绑定新的 head SHA；不改写初始运行证据或提升功能矩阵、独立审查及发行验收状态。
