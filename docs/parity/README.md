# 固定上游功能矩阵维护

目标是完整保留 Butterfly **5.7.0** 的能力，逐项证明 Halo 适配达到 [1.0 工程验收合同](../RELEASE-ACCEPTANCE.md)。本目录完成需求盘点和可追踪检查，初始 **已验收为 0**。原 M0 证据不自动提升任何条目状态。

最近一次[功能矩阵与近期成果对账（2026-10-05）](RECONCILIATION-2026-10-05.md)核对 35 条记录，纠正 10 条状态：5 条已有实现转为待验收，5 类页面记录最新 Linux 验证失败，并补齐阅读配置等局部证据。`verified` 仍为 0。机器可读逐项差异及剩余验收见 [reconciliation-2026-10-05.json](reconciliation-2026-10-05.json)；此前 [2026-09-24 对账](RECONCILIATION-2026-09-24.md)作为历史记录保留。本轮没有重新审计全部 897 条，`gap` 可能包含部分实现，应结合 `halo.finding` 判断缺口，不能简单当作完全没有开发。

## 文件与覆盖边界

| 文件 | 职责 |
| --- | --- |
| [matrix.json](matrix.json) | 唯一可编辑的功能状态真相源：来源、当前 Halo 代码/配置、适配方向、依赖、合同场景、专属断言、issue/PR、证据与状态 |
| [MATRIX.md](MATRIX.md) | 从 JSON 生成的可读矩阵，不手改 |
| [upstream-5.7.0.json](upstream-5.7.0.json) | 从固定 Git 提交提取的上游索引，含每个跟踪文件 SHA-256、行数、配置与扩展接口；不是可随实现删减的待办清单 |
| [required-scenarios.json](required-scenarios.json) | 源码自动抽取之外必须保留的页面、交互、数据结构、正文场景索引；删除需求需要说明及维护者裁定 |

固定源码来自 `jerryc127/hexo-theme-butterfly` 的 `f223b1888b42b2b336068e6c959ed90a3cd7c8f3`，包版本 5.7.0。本目录保留派生索引与来源链接；主题源码中已有相应样式改写和字表提取，不能将其描述为仅参考、没有派生内容。具体归属、修改路径及单独许可的 normalize.css 见 [来源与许可证](../THIRD_PARTY.md)；上游 Hexo 构建系统及比较站资源不进入主题 ZIP。

| 覆盖面 | 数量 | 抽取方式 |
| --- | ---: | --- |
| `_config.yml` 活动叶子 | 387 | YAML 语法树；空值、空集合也是可配置叶子，数组作为一个配置值 |
| `default_config.js` 叶子 | 388 | Babel 静态语法树，只接受字面量，不执行上游 JS |
| 注释中公开的配置键 | 74 | `theme_color`、`Open_Graph_meta.option`、`CDN.option` 的明确配置区段 |
| 去重后的配置追踪条目 | 462 | 活动配置 + 默认配置独有项 + 注释公开键；例如 `artalk.vote` 只在默认配置出现 |
| Pug 模板 | 110 | 全部 `layout/**/*.pug`，包含每个 provider 的模板 |
| tag / helper 注册 | 19 / 18 | 包含 `subnote`、`subtabs`、`subsubtabs` 等别名，逐一保留 |
| filter / generator / event 注册 | 10 | 包括图片后处理、随机封面、404、CDN、默认值合并、Stylus、series 缓存 |
| 第三方资源 / 内部脚本与图片 | 45 / 10 | `plugins.yml` 全部资源名和 `source/js`、`source/img`；资源包版本保留在索引中 |
| 样式模块 / 语言包 | 48 / 7 | 全部 CSS/Stylus 模块与语言文件 |
| 页面数据 / Hexo 站点配置消费 | 54 / 36 | `page.*`、页面解构及实际 `config.*` 消费；区分作者 front-matter 与 Hexo 生成字段 |
| 页面 / 交互 / 动态数据 / 正文场景 | 15 / 38 / 14 / 11 | 对照源码人工归纳，交互项定位具体函数或符号 |

合计 **897 个追踪条目**。其中存在配置、实现组成和使用场景之间的交叉关系，不能把这个数字当成 897 个彼此独立的用户功能，也不能用配置覆盖率宣称完成比例。验收进度只按保留的矩阵条目状态和合同场景实际通过情况报告；未决项单列。

`page-data` 的生成属性（如 `current`、`posts`、`year`）映射为 Halo 模型/Finder；作者选项（如 `toc`、`top_img`、`copyright`、`flink_url`）映射为注解、编辑器或主题配置。两者都保持可追踪，不能把生成属性误说成作者必须填写的配置。任意名称的菜单、社交项、打赏 `img/link/text`、站点验证 `name/content`、友链、说说和侧栏卡片子字段放在 `data-schema`，没有因为 YAML 中只存在空父键而遗漏。

## 执行与更新

在仓库根目录安装固定依赖后执行：

```sh
bun install --frozen-lockfile --ignore-scripts
bun scripts/parity-render.mjs
bun scripts/check-parity.mjs
bun test --isolate --timeout 30000 tests/parity.test.mjs
```

检查器会拒绝漏掉任何固定清单条目、重复 ID、无效源码行号、已删除的 Halo 设置或代码文件、失效的合同场景 ID，以及未同步的 Markdown。默认检查使用入库的固定索引，可离线在 CI 运行；它不声称重新访问了上游。

如已有固定提交的干净源码 checkout，可同时校验索引确实对应其源码；不允许以新 tag 或 dirty checkout 悄悄改变基准：

```sh
bun scripts/check-parity.mjs --upstream /path/to/hexo-theme-butterfly
```

每次实现或验收落档时，同步核对相关配置、模板、交互、页面条目，把局部通过和失败写入 `halo.finding` 与 `evidence`；不必等完整合同通过才更新矩阵。先编辑 `matrix.json`，再生成 `MATRIX.md`，并在进度记录中链接本次对账。

修改某项时先关联单功能 issue/PR，补充具体 Halo 设置/模型、依赖版本和专属断言，再开发和验证。`halo.code` 是当前代码或预期适配入口，`halo.finding` 说明已知差异；文件存在本身不表示相应功能已实现。未来添加的新设置只在实现后写入 `halo.settings`，检查器会验证它真实存在。

共享 `acceptanceProfiles` 描述合成夹具、空值/失败状态和跨页面条件；每项 `acceptance.cases` 给出自身断言，`contractScenarios` 绑定合同 ID。已列出枚举域的配置另有 `acceptance.values`，需逐值执行；执行时发现更详细的参数域或组合，应补充现有条目，不能只测试默认值。

共享依赖分为 Halo 2.26.1 数据契约、双站夹具、公共布局、编辑器、插件、合成后端和资源许可证。插件尚未选定的条目保留待映射状态；选定时记录确切版本、来源与包哈希。`plugins.yml` 中的上游版本是参考，不是 Halo 已安装依赖的版本。

## 状态与合同对应

| JSON 状态 | 合同状态 / 使用方式 |
| --- | --- |
| `mapping-required` | 未盘点 / 待决策：已保留上游来源，但 Halo 技术映射或实质取舍尚未解决 |
| `gap` | 待实现：没有逐项完成的实现 |
| `in-progress` | 进行中：明确作者与工作 issue/PR 后推进 |
| `implemented-unverified` | 待验证：有相关实现或候选接入，但缺少固定上游对照证明 |
| `verification-failed` | 验证失败：断言未通过，保留失败证据和后续修复事项 |
| `review-required` | 待独立审查：作者验证通过，仍不可关闭条目 |
| `ci-required` | 待 CI：独立审查通过，等待当前提交检查 |
| `verified` | 已验收：专属断言、合同场景、独立审查和对应提交 CI 全部通过 |
| `blocked` | 按合同阻塞处理：用 `blocker.phase/reason/nextAction` 记录阻塞原因及下一步，原范围保留 |
| `not-applicable` | 不适用（有依据）：须含 `decision.id/option/issue/date/reason/replacement`；仅用于维护者已裁定的提供方缩减/平台替代，或确属 Hexo 构建机制的条目 |

`not-applicable` 不计入 1.0 进度分母，但仍保留上游来源，不能删除条目。没有 `decision` 的条目不得使用该状态。删减可见能力、减少 provider 或用不同能力替代，在对应 DEC 写入 issue 与合同修订之前，不得标为不适用。经 DEC 裁定延期到后续版本的条目使用 `blocked`（`blocker.phase` 为目标版本），保留在矩阵中，不计入当前工程终点分母。

DEC-02（[#45](https://github.com/songxychn/halo-butterfly-next/issues/45)）：`tag:*` 的 Halo 输入是与 Butterfly 生成结果一致的 HTML，主题不解析 `{% %}`。

## 已验收证据

状态改为 `verified` 时，条目必须包含 `author`、完整 `verifiedCommit`，以及 `runtime`、`review`、`ci` 三种证据。每条证据为：

```json
{
  "kind": "runtime",
  "path": "docs/parity/evidence/example-runtime.json",
  "sha256": "完整 64 位文件 SHA-256",
  "date": "2026-09-06T12:00:00+08:00",
  "commit": "完整 40 位被验收提交",
  "actor": "执行者",
  "outcome": "passed"
}
```

`path` 必须是可共享的仓库相对 JSON 路径，不能仅留临时绝对路径或任意字符串。检查器读取文件并验证 SHA-256、通过结论、提交、执行者、时间和能力 ID。证据清单至少含：

- 通用：`kind`、`sourceSha`、`upstreamSha`、`result: "passed"`、`actor`、`testedAt`、`matrixIds`、`commandsAndReports`、`limitations`。
- 运行：`artifactSha256`、`fixtureSha`、`haloVersion: "2.26.1"`、可定位的 `runtimeManifest`，以及覆盖该条目全部合同 ID 的 `scenarioIds`。
- 独立审查：`reviewedSha` 等于被验收提交，`actor` 与条目 `author` 不同。
- CI：`headSha` 等于被验收提交、`conclusion: "success"` 和本仓库的实际 `runUrl`。

这些结构检查只验证证据的完整性和关联，不能证明作者填写的内容真实。集成负责人及独立审查者仍须读取报告、复核实际 GitHub CI 与运行结果；无断言、失败报告或过期 SHA 不能被人工改成通过。大截图/trace 留在私有附件，清单记录哈希和持久位置，遵循合同的脱敏要求。

合成/桩后端只能证明本地契约和失败回退。搜索索引、评论、分析、广告、聊天及字幕提供方的真实联调仍按合同 DEC-04 与对应场景单独留证；不能用 mock 结果关闭要求真实服务的能力。缺少账户、真机或 Safari 时保留阻塞，继续其他可执行事项。

`implementation-reconciliation` 是源码与历史局部证据的对账记录，不能替代 `runtime`、`review` 或 `ci`。其中 `commit/sourceSha` 指被检查的源码快照；历史运行和性能记录保持各自提交及安装包身份。每条对账说明应列出实际实现、保留差异和下一步验收，不把“文件存在”作为功能已完成的依据。新增引用的文件路径与 SHA-256 需人工或独立脚本复核；现有检查器仅对 `verified` 强制完整证据校验。
