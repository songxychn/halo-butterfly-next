# 参与贡献

Halo Butterfly Next 是独立的 Halo 社区维护主题项目。欢迎通过 Issue 和 Pull Request 提交问题修复或功能改进。

## 开发环境

需要 **Bun 1.4+** 和 **Python 3**（实机运行 Halo 需 **Java 21+**）：

```sh
bun install --frozen-lockfile --ignore-scripts
bun run verify
```

- 仅修改 `src/`、根目录配置文件（`settings.yaml`、`annotation-setting.yaml`、`theme.yaml`、`i18n/`）和构建脚本；`templates/` 与 `dist/` 为生成物，不手改、不提交。
- `bun run dev` 监听源码并重建 `dist/` 下的安装包，不会自动启动或覆盖运行中的 Halo 站点。
- 自维护浏览器代码统一使用 TypeScript，保持 `bun run typecheck` 通过。

## 提交与验收建议

1. 每个 PR 聚焦一个清晰的问题或需求，说明变更原因、影响页面及测试方式。
2. 涉及模板、样式或交互改动时，在本地 Halo 实例中验证桌面/移动端、亮暗配色切换，并运行 `bun run verify`。
3. 涉及配置项变更时，同步更新 `settings.yaml`、配置迁移脚本（`scripts/config-migration.mjs`）和相关使用文档。
4. 构建与本地实机测试说明见 [docs/SOURCE-BUILD.md](docs/SOURCE-BUILD.md)。
