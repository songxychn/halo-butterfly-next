# AGENTS.md

## 项目概述
`halo-butterfly-next` 是一个 **Halo 2.x CMS 主题**（非独立 Web 应用），交付物为打包输出到 `dist/` 的可安装主题 ZIP。

- `src/` 是唯一源码目录（HTML 模板、SCSS 样式、TypeScript 脚本、静态资源）。
- `templates/` 和 `dist/` 是构建生成物，禁止手改或提交。
- 配置文件为根目录的 `theme.yaml`、`settings.yaml`、`annotation-setting.yaml` 及 `i18n/*.properties`。

## 运行环境与常用命令
需要 **Bun 1.4+** 和 **Python 3**：

- `bun install --frozen-lockfile --ignore-scripts` — 安装依赖。
- `bun run typecheck` — 运行 `tsc --noEmit` 严格类型检查。
- `bun run check` — 运行 `tests/` 下的单元与静态检查测试。
- `bun run build` — 构建 `templates/` 并打包 `dist/halo-butterfly-next-<version>.zip`。
- `bun run verify` — 串联 `typecheck`、`check`、`build` 与包完整性检查（主门禁）。
- `bun run dev` — 监听源码变动并自动重建 ZIP（不会启动 Halo）。
- `bun run site:check` — 校验 `site/` 演示站内容与主题配置映射。

## 本地 Halo 实机测试
使用 `scripts/lab/lab.py` 启动本地环回 Halo 实例（默认端口 `18091`，支持通过 `HALO_PORT` / `LAB_RUNTIME` / `HALO_VERSION` 覆盖，需 Java 21+）：

```sh
bun run build
python3 scripts/lab/lab.py bootstrap --package dist/halo-butterfly-next-<version>.zip --source-sha "$(git rev-parse HEAD)"
bun scripts/smoke.mjs --base http://127.0.0.1:18091
python3 scripts/lab/lab.py stop
```

- 运行产物全部保存在 git 忽略的 `.runtime/comparison/` 下，管理员随机凭据位于 `.runtime/comparison/halo/credentials.json`。
- `lab.py bootstrap` 可选启动上游 Hexo 参考站（端口 `14000`）；若 Hexo 侧因上游渲染差异返回非零退出码，Halo 侧通常已正常就绪，可直接通过 `smoke.mjs` 或访问 `http://127.0.0.1:18091` 验证主题效果。
