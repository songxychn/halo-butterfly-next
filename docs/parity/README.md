> 2026-10-28：当前产品范围以 [DEC-10](DEC-10-THEME-SCOPE.md) 为准。以下旧进度和任务条目保留作历史，不要求恢复已删除的能力。

# 功能矩阵维护说明

发布判定以 [DEC-09](DEC-09-RELEASE-CLOSURE.md) 和[当前收口清单](DEVELOPMENT-BACKLOG.md)为准。矩阵是来源、实现及证据索引，不是自动执行队列；不要求所有适用项 verified 后才发布。

保留 897 个稳定 ID，其中 184 个不适用、23 个既有延期，其余 690 个继续追踪。不得因减少发布门禁删除条目、改写失败或提高 verified 状态。状态统计不能当成独立功能数或发布完成率。

## 文件与覆盖边界

| 文件 | 职责 |
| --- | --- |
| [matrix.json](matrix.json) | 唯一可编辑的功能状态真相源：来源、当前 Halo 代码/配置、适配方向、依赖、合同场景、专属断言、issue/PR、证据与状态 |
| [MATRIX.md](MATRIX.md) | 从 JSON 生成的可读矩阵，不手改 |
| [upstream-5.7.0.json](upstream-5.7.0.json) | 从固定 Git 提交提取的上游索引，含每个跟踪文件 SHA-256、行数、配置与扩展接口；不是可随实现删减的待办清单 |
| [required-scenarios.json](required-scenarios.json) | 源码自动抽取之外必须保留的页面、交互、数据结构、正文场景索引；删除需求需要说明及维护者裁定 |
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

固定上游为 Hexo Butterfly 5.7.0 / `f223b1888b42b2b336068e6c959ed90a3cd7c8f3`，不自动跟随新版本。来源、修改和许可证见 [THIRD_PARTY](../THIRD_PARTY.md)；上游比较站和构建工具不进入主题 ZIP。

修改条目时记录具体实现/配置、来源、范围和证据。`halo.code` 文件存在不代表功能已完成；`halo.settings` 必须对应实际设置。合同场景 ID 保持稳定，历史断言索引见[验收要求](../RELEASE-ACCEPTANCE.md#历史场景-id-索引)。没有具体需求或当前发布缺口时，不因发现更多参数域而扩展执行矩阵。

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

`not-applicable` 必须有原裁定依据；延期项继续用 blocked / blocker.phase 追踪。以上状态描述条目事实，是否阻塞发布另按 DEC-09 判定，不使用全量完成百分比替代发布判断。

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
- 运行：`artifactSha256`、`fixtureSha`、实际受测 `haloVersion`（现有 verified 清单检查器的历史格式固定为 `2.26.1`；新记录不得伪填版本）、可定位的 `runtimeManifest`，以及覆盖该条目全部合同 ID 的 `scenarioIds`。
- 独立审查：`reviewedSha` 等于被验收提交，`actor` 与条目 `author` 不同。
- CI：`headSha` 等于被验收提交、`conclusion: "success"` 和本仓库的实际 `runUrl`。

这些结构检查只验证证据的完整性和关联，不能证明作者填写的内容真实。集成负责人及独立审查者仍须读取报告、复核实际 GitHub CI 与运行结果；无断言、失败报告或过期 SHA 不能被人工改成通过。大截图/trace 留在私有附件，清单记录哈希和持久位置，遵循合同的脱敏要求。

合成/桩后端只能证明本地契约和失败回退。搜索索引、评论、分析、广告、聊天及字幕提供方的真实联调仍按合同 DEC-04 与对应场景单独留证；不能用 mock 结果关闭要求真实服务的能力。缺少账户、真机或 Safari 时保留未验证事实；这些范围按既有 P3 决定延期，不自动阻塞发布或启动补验。

`implementation-reconciliation` 是源码与历史局部证据的对账记录，不能替代 `runtime`、`review` 或 `ci`。其中 `commit/sourceSha` 指被检查的源码快照；历史运行和性能记录保持各自提交及安装包身份。每条对账说明应列出实际实现、保留差异和下一步验收，不把“文件存在”作为功能已完成的依据。新增引用的文件路径与 SHA-256 需人工或独立脚本复核；现有检查器仅对 `verified` 强制完整证据校验。


## 历史对账

历史逐轮统计、旧排期和裁定沿革见[清理前快照](https://github.com/songxychn/halo-butterfly-next/blob/409e79cc6e4bc027b35d2972b8854efcfbc61b28/docs/parity/README.md)及原始 reconciliation JSON；当前取舍按 DEC-09，已有 DEC-01/02/03/07/08 的平台替代和延期决定继续有效。
