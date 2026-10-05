# 对应源码与构建（alpha.3 草稿）

安装 ZIP 与对应源码一起提供。实际运行候选源 SHA 已记录；最终发行源提交及对应源码归档摘要待发布材料冻结后填写，见[发行身份](RELEASE-alpha.3.md)。[本仓库](https://github.com/songxychn/halo-butterfly-next)已公开并保留完整 Git 历史，开发候选包仍不等同于最终发行物。

源码归档需包含当前完整 `src/`、主题/设置元数据、`package.json`、`bun.lock`、构建与检查脚本、相关测试/夹具、`LICENSE`、`third-party-licenses/` 和第三方来源说明。它不包含 `.git` 历史、凭据、数据库、运行缓存或 `node_modules`。这是发行附件的归档范围，仓库中的 Git 历史仍完整保留。保留已有作者及改写署名。安装包的 `templates/`、`dist/` 是生成物，由这些源码和锁定依赖生成。

准备 Node.js 24、Bun 1.4.0 和 Python 3；记录实际版本。解压对应源码，在源码根目录执行：

```sh
node --version
bun --version
python3 --version
bun install --frozen-lockfile --ignore-scripts
bun run verify
shasum -a 256 dist/halo-butterfly-next-0.1.0-alpha.3.zip
```

首次安装依赖需要能访问锁文件指定的包源。`bun run verify` 执行 TypeScript 严格类型检查、矩阵一致性、测试、构建和包检查；不启动 Halo。仅需构建可运行 `bun run build`。`bun run dev` 只监听重建，不启动服务器，也不自动安装主题。

最终发行前在干净源码目录执行两次构建，对比 ZIP 字节及 SHA-256，并在公开对应源码上独立重建。如果不一致，保留差异并排查，不用版本号相同代替内容一致。安装到 Halo 后再次逐文件核对 ZIP 和主题目录，下载发行附件后再核对摘要。具体冻结结果待填，不预先宣称可重复构建已通过。

运行验收记录绑定生成该 ZIP 的精确源码提交。后续只补证据或截图的文档提交可以具有不同 SHA；若对应源码归档使用较后的文档提交，须另外记录其 SHA 并独立重建，证明 ZIP 字节与已验候选一致。不能把报告中的源码 SHA 改成尚未运行过的新提交，也不要求把提交自身的 SHA 写进同一个提交。

Java 21+ 和 Halo 2.26.1 仅在真实运行主题/实验室时需要；固定实验室方法见[对照环境](COMPARISON-LAB.md)。实验室生成的凭据、数据库、会话、配置快照及浏览器缓存不属于公开源码或证据附件。

各依赖许可见[第三方说明](THIRD_PARTY.md)，保留的改写来源见[上游归属清单](../third-party-licenses/UPSTREAM-ATTRIBUTION.txt)。当前主题许可为[GPL-3.0](../LICENSE)；第三方许可原文随源码与安装包保留。
