# 源码构建与本地开发

## 前置条件

- **Bun 1.4+**
- **Python 3**（仅运行本地 Halo 实验室或发布脚本时需要）
- **Java 21+**（仅启动本地 Halo 实机环境时需要）

## 构建主题安装包

```sh
bun install --frozen-lockfile --ignore-scripts
bun run verify
```

`bun run verify` 会依次执行 TypeScript 严格类型检查、单元测试、源码构建和安装包完整性检查，最终输出可安装 ZIP 至 `dist/halo-butterfly-next-<version>.zip`。

日常开发可使用监听模式自动重建：

```sh
bun run dev
```

`src/` 为源码目录，`templates/` 与 `dist/` 为构建产物，不手改也不提交到 Git。

## 本地 Halo 实机调试

可使用内置脚本在本地环回地址（默认 `http://127.0.0.1:18091`）一键拉起干净的 Halo 实例并安装当前主题包：

```sh
bun run build
python3 scripts/lab/lab.py bootstrap --package dist/halo-butterfly-next-<version>.zip --source-sha "$(git rev-parse HEAD)"
bun scripts/smoke.mjs --base http://127.0.0.1:18091
```

调试结束后停止本地实例：

```sh
python3 scripts/lab/lab.py stop
```

所有运行时文件与随机管理员凭据均保存在 git 忽略的 `.runtime/` 目录下，不会污染源码树。
