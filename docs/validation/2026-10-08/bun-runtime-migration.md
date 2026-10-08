# Bun JS 运行时迁移：本地验证

当前开发源码使用 Bun 1.4.0 安装依赖、执行 JS/TS 脚本、运行测试及依赖 CLI。保留 Vite、Sass、PostCSS、JSZip 和独立 `tsc --noEmit`；Python 与 Java 的职责不变。测试迁移到 `bun:test`，采用 4 个 worker、各文件隔离及 30 秒单项超时；原有 583 项测试名称逐项一致。三处 Node 专有 TS 擦除 API 改用 Bun 转译器，临时目录清理改为 Bun 的 `afterEach`。

## 源码与范围

基线提交为 `6dc64a6d1491c98b741a04959b2b9151663c6539`，验证对象是其上的未提交工作区，不把该提交冒充改动后的源码 SHA。[机器记录](bun-runtime-migration.json)保存验证输入快照 SHA-256 `a3084b01df2c69f662ebcea0ae8212cfdc9c9ba3ce417b0ff06c1460805478ae`；逐文件摘要、原始命令日志、Node 基线 ZIP 与测试名称清单保存在本地忽略目录 `.runtime/bun-migration/`。快照在加入本验证叙述和进度记录前生成，不是发行验收。

当前源码的常规 CI 不再安装 Node。Linux 对照、Release 与 demo 的历史源码路径按 `engines.node` 按需安装 Node 24；Linux 测试覆盖历史 pnpm、历史 Bun+Node、当前 Bun 三类源码及缺锁/不支持包管理器的拒绝行为。alpha.3 发布源码复现仍保留原 Node 24 要求与原发行证据。当前浏览器/性能报告记录 Bun 运行时，不将旧 Node 性能样本改成新基线。

## 验证结果

- 冻结安装通过，依赖版本与锁文件不变。
- PATH 中放置调用即退出 97 的 `node` 拦截脚本后，最终 `bun run verify` 通过：类型检查、矩阵一致性、583/583 测试、构建及 129 文件安装包检查。依赖 CLI 的 Node shebang 通过 `bunfig.toml` 指向 Bun。
- Node 24.11.0 基线与 Bun 1.4.0 构建 ZIP 逐字节一致；后续 Bun 重建也一致，ZIP CRC 通过。安装包为 2,805,341 字节，SHA-256 `abdae98d37799f616cd36d215b632dd177491123d3c889b6344769e052518998`。这不是已发布 alpha.3 包的摘要。
- Bun 执行 Playwright 安装器及 `scripts/typescript/smoke.mjs`：Chromium、Firefox、WebKit 各 26 项，合计 78 项合成页面检查通过。
- 浏览器 CDN 大文件下载发生连接中断后，复制本机相同 Playwright 1.63.0 的固定分发包到本任务独立目录；比较 `browsers.json`，核对完成标记，并重跑 Bun 安装器。未连接其他会话或用户浏览器。
- Bun 性能安装器通过固定 Chrome 可执行文件与应用树摘要检查，Lighthouse 13.4.1 CLI 版本命令通过；未采集性能样本。
- `bun run site:check` 与 `git diff --check` 通过。

测试耗时的单次观测为 Node 14.17 秒、Bun 首次完整通过 6.96 秒、Bun 最终运行 10.43 秒；最终运行与浏览器验证重叠，且并发配置不同，不作为受控性能基准或稳定提速承诺。

## 限定

本记录描述提交前源码快照的本地验证；最终提交与远程 CI 在 PR 中另行记录，未完成独立审查。浏览器检查为合成页面，未新建真实 Halo 安装、未验证物理设备，也不提升功能矩阵、性能合同或发行验收状态。原有 `.codegraph/` 未跟踪目录未纳入构建输入或修改。
