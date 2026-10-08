# 对应源码与构建

alpha.4 使用 **Bun 1.4.0 + Python 3**。从[对应发行页](https://github.com/songxychn/halo-butterfly-next/releases/tag/v0.1.0-alpha.4)取得源码附件，在源码根目录执行：

```sh
bun install --frozen-lockfile --ignore-scripts
bun run verify
shasum -a 256 dist/halo-butterfly-next-0.1.0-alpha.4.zip
```

核对随版 `SHA256SUMS` 和 `release-validation.json` 的源码与包身份。alpha.4 实测新包 SHA-256 为 `389f78ad60c2cf73195d3cf16ae967f967d64e510a70d679878d061a2f570953`；独立源码归档重建一致。源码归档不能直接作为主题安装包上传。完整门禁范围见[alpha.4 验收](validation/2026-10-08/alpha4-acceptance.json)。

## alpha.3 历史源码复现

安装 ZIP 与对应源码已在 [alpha.3 发行页](https://github.com/songxychn/halo-butterfly-next/releases/tag/v0.1.0-alpha.3)一起提供。发行 tag 对应提交 `7fc8d49a9069d44c4740eac4daaa59b843f87567`；实际产品验收源码为 `8e53148a8c84996d091e2792e8a4651522690a0a`，后续发行材料提交未改变已验 ZIP。附件身份与全部摘要见[发布完成记录](validation/2026-10-06/alpha3-publication.md)。[本仓库](https://github.com/songxychn/halo-butterfly-next)保留完整 Git 历史；复现已发布版本应使用该 tag 的源码附件，不能以最新 master 代替。

源码归档需包含当前完整 `src/`、主题/设置元数据、`package.json`、`bun.lock`、构建与检查脚本、相关测试/夹具、`LICENSE`、`third-party-licenses/` 和第三方来源说明。它不包含 `.git` 历史、凭据、数据库、运行缓存或 `node_modules`。这是发行附件的归档范围，仓库中的 Git 历史仍完整保留。保留已有作者及改写署名。安装包的 `templates/`、`dist/` 是生成物，由这些源码和锁定依赖生成。

复现已发布 alpha.3 源码需准备 Node.js 24、Bun 1.4.0 和 Python 3；记录实际版本。解压对应源码，在源码根目录执行：

```sh
node --version
bun --version
python3 --version
bun install --frozen-lockfile --ignore-scripts
bun run verify
shasum -a 256 dist/halo-butterfly-next-0.1.0-alpha.3.zip
```

当前开发源码已将 JS 运行时迁移到 Bun 1.4.0，只需 Bun 与 Python 3 执行安装和验证命令（省略 `node --version`）；Node 24 是已发布 alpha.3 源码的历史要求。当前源码生成的 ZIP 应绑定当前源码及实测摘要，不沿用下方发布包摘要。

首次安装依赖需要能访问锁文件指定的包源。`bun run verify` 执行 TypeScript 严格类型检查、矩阵一致性、测试、构建和包检查；不启动 Halo。仅需构建可运行 `bun run build`。`bun run dev` 只监听重建，不启动服务器，也不自动安装主题。

alpha.3 发布工作流已完成重复构建，并从实际分发的源码归档独立重建，ZIP SHA-256 均为 `c0c73dedbf7b2c98d1936991470d5f80a38319cbe31a5815a217e3d071dc2be2`。公开附件回下载也已核验一致；最终候选全新 Halo 安装的 129 个文件已逐字节检查。复现时仍应比对摘要；若不一致，保留差异并排查，不用版本号相同代替内容一致。

运行验收记录绑定生成该 ZIP 的精确源码提交。后续只补证据或截图的文档提交可以具有不同 SHA；若对应源码归档使用较后的文档提交，须另外记录其 SHA 并独立重建，证明 ZIP 字节与已验候选一致。不能把报告中的源码 SHA 改成尚未运行过的新提交，也不要求把提交自身的 SHA 写进同一个提交。

Java 21+ 和 Halo 2.26.1 仅在真实运行主题/实验室时需要；固定实验室方法见[对照环境](COMPARISON-LAB.md)。实验室生成的凭据、数据库、会话、配置快照及浏览器缓存不属于公开源码或证据附件。

各依赖许可见[第三方说明](THIRD_PARTY.md)，保留的改写来源见[上游归属清单](../third-party-licenses/UPSTREAM-ATTRIBUTION.txt)。当前主题许可为[GPL-3.0](../LICENSE)；第三方许可原文随源码与安装包保留。
