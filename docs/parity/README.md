# 固定上游功能矩阵维护

## 当前范围补充（2026-10-14）

维护者结合 [PR #408](https://github.com/songxychn/halo-butterfly-next/pull/408) 确认正文优先通用 Markdown / 原生 HTML；[DEC-02 补充](DEC-02-PORTABLE-CONTENT.md)取消 Hexo 专属 DOM/class、完整参数兼容和通用离线转换的默认要求，保留用户能力与可移植性验收。最新基线为已合并 #413 的 `362beb61d61a`；14 条已实现通用能力从 gap 转为 implemented-unverified，6 条转为通用能力待映射，完整记录见[机器修订](portable-content-reconciliation-2026-10-14.json)。

当前 897 条中：**599 条已有实现待验收、65 条缺口、32 条待映射、5 条验证失败、12 条延期、184 条不适用、0 条 verified**。正文不是整体待开发；最大缺口的重新排序见[剩余需求](DEVELOPMENT-BACKLOG.md#建议推进顺序)。以下对账与限定验证叙述保留各自历史基线，旧转换/结构要求以本补充为准。

目标是按已确认的平台替代与范围裁定保留 Butterfly **5.7.0** 的适用用户能力，逐项证明 Halo 适配达到 [1.0 工程验收合同](../RELEASE-ACCEPTANCE.md)。本目录完成需求盘点和可追踪检查，初始 **已验收为 0**。原 M0 证据不自动提升任何条目状态。

此前[主线对账（2026-10-14）](RECONCILIATION-2026-10-14.md)以已合并 #411 的 `44621d24914e` 为基准，枚举 897 个状态，修正 171 条记录、61 条状态；60 条转为已有实现待验收，1 条私有 token 转为待平台映射。该次对账为 586 条已有实现待验收、84 条缺口、26 条待映射、5 条验证失败、12 条延期、184 条不适用，`verified` 仍为 0。源码对账不替代运行验收；未变更条目保留原证据边界。

排期看 [1.0 剩余开发需求](DEVELOPMENT-BACKLOG.md)，逐项原值/新值和源码哈希看 [机器对账](reconciliation-2026-10-14.json)。旧 [2026-10-05 对账](RECONCILIATION-2026-10-05.md)与 [2026-09-24 对账](RECONCILIATION-2026-09-24.md)保留历史含义。`gap` 可能包含部分实现、`implemented-unverified` 也可能保留参数缺口，不能仅按状态统计独立功能数量。

2026-10-13 [正文图表与乐谱](../BODY-CHARTS-SCORE.md)补齐渲染与阅读交互，更新 31 项为 `implemented-unverified`；更正 score 为 ABC 乐谱。原生 Halo Firefox 资源挂起与完整双站、1.0 合同保持待验；当时列出的通用离线转换要求已由本次 DEC-02 补充取消。

2026-10-13 [导航与加载限定实现](../NAVIGATION-LOADING.md)更新 12 项配置为 `implemented-unverified`，同步记录列表 PJAX、图片配置及清理协议。文章/插件 PJAX 和任意作者 HTML 图片过滤器仍保留 `gap`；[限定验证](../validation/2026-10-13/navigation-loading.md)不替代 1.0 完整合同。

2026-10-13 [统一资源地址](../RESOURCE-SOURCES.md)补齐实际静态/动态资源、Share.js、不蒜子覆盖及 PJAX 精确地址识别；随后 #406/#411 已接入图表/乐谱适配包和 Pace 覆盖。2026-10-14 对账将资源总项同步为已有实现待验收；全部组合、回退和真实 SDK 仍待完整验证。[DEC-03 草案](DEC-03-RESOURCES-DRAFT.md)作为历史材料，当前以[正式裁定](DEC-03-RESOURCES-DECISION.md)为准。

2026-10-14 [DEC-03 #410](https://github.com/songxychn/halo-butterfly-next/issues/410) 与 [资源裁定](DEC-03-RESOURCES-DECISION.md)正式登记已确认方案：导航/特效承载包、Viewer.js、Prism 整包、默认 Pace、动画显式选择及评论 MD5 消费方退出。39 个原供应/专属条目转有依据的不适用，6 个 Pace 条目具备实现；0 条提升 verified。当前工作区通过 652 项测试、162 文件包检查和实际安装比对，22 组 Pace + 8 组资源真实 Halo/Chromium 回归通过；[限定验证](../validation/2026-10-14/dec03-pace.md)保留来源与失败边界。PWA/离线、RSS/站点地图仍待裁定，随后合并 master，Mermaid/Chart.js/ABCJS 已随正文功能接入，保留已实现待验。先前草案、源码审计与历史验证不自动背书当前完整合同。

2026-10-13 [评论懒加载](../COMMENT-ENHANCEMENTS.md)更新三条懒挂载实现为 `implemented-unverified`。官方插件 head 预加载保留；首屏零评论资源未实现，该子要求现按[1.0 延期决定](DEC-03-1.0-DEFERRALS.md)移出 1.0；[限定真实 Halo 验证](../validation/2026-10-13/comment-lazy.md)不替代完整合同。

2026-10-13 [统一资源地址](../RESOURCE-SOURCES.md)补齐实际静态/动态资源、Share.js、不蒜子覆盖及 PJAX 精确地址识别；3 个独立覆盖配置转为 `implemented-unverified`，其余相关记录同步限定结果。全量 CDN 映射仍待完成，0 条提升为 verified。[DEC-03 资源供应草案](DEC-03-RESOURCES-DRAFT.md)保留未决替代项与原 ID，尚未正式裁定。

DEC-03 后续方案已由维护者确认导航/特效的主题承载包供应、Viewer.js 唯一灯箱及 Prism 整包延迟加载。固定上游 217 文件哈希核对后，[Pace / Loading 与 MD5 消费方](DEC-03-PACE-MD5.md)完成源码对照：维护者随后确认默认 Pace、四种动画显式可选，不保留旧动画默认迁移分支；blueimp-md5 唯一直接消费方是 Valine 最新评论，同名 Node helper 仅供 Gitalk。MD5 处理建议仍待裁定，Pace 待开发；40 条记录只补充方向与审计证据，不改状态或适用性。

## 文件与覆盖边界

最新候选基于已合入 Pace PR #411 的 master，保留其实现。独立复审无阻塞项；[最终限定验证](../validation/2026-10-14/config-defaults-reviewed.md)记录 691 项测试、253 文件包与安装比对、真实 Halo 40 组、封面 16 项、真实 SDK/图库资源 3 组通过。35 条补充限定证据；旧 `config:CDN.custom_format` 因运行模板移除降为 gap，其余状态不变，verified 仍为 0、无新增 N/A；最终提交 CI 随草稿 PR 跟踪。以下是首次实施的历史结果。

2026-10-14 维护者批准按[配置简化与默认体验清单（拟 DEC-08）](DEC-08-CONFIG-DEFAULTS-DRAFT.md)实施九项调整。新配置、离线转换、默认夹具及矩阵映射已同步；[限定验证](../validation/2026-10-14/config-defaults.md)记录 657 项测试、160 个安装文件、真实 Halo 40 组及顶图补充 16 项通过。28 条相关记录加入工作区证据，保留原状态，0 条提升为 verified、无新增 N/A。资源简化归入 DEC-03；Pace 由另一个分叉开发。公开裁定登记和完整 1.0 合同仍待完成。

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

DEC-07（2026-10-11）：维护者确认数学公式采用 Halo KaTeX 插件平台替代。公开裁定 [#387](https://github.com/songxychn/halo-butterfly-next/issues/387) 已登记；MathJax 专属与主题自带数学资源供应共 10 条附完整 `decision` 后转为 `not-applicable`，不计作已验收。已固定 KaTeX 3.0.0，7 条公式保留项加入主题适配并转为 `implemented-unverified`；严格资源按需现按[1.0 延期决定](DEC-03-1.0-DEFERRALS.md)移出 1.0（版本未定）；公式用户能力及完整运行/设备/审查门禁仍未完成。使用和证据边界见 [数学公式](../MATH.md)。边界见 [数学裁定](../MATH-RENDERING-DECISION.md)，已发布正文见 [issue 正文存档](DEC-07-ISSUE.md)。

DEC-02（原记录 [#45](https://github.com/songxychn/halo-butterfly-next/issues/45)，[2026-10-14 补充](DEC-02-PORTABLE-CONTENT.md)）：`tag:*` 保留为来源和用户能力索引，Halo 使用通用 Markdown / 原生 HTML，不要求与 Butterfly 生成结果相同的结构；主题不解析 `{% %}`，通用离线转换不是默认义务。

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

2026-10-15 [1.0 延期决定](DEC-03-1.0-DEFERRALS.md)：评论/KaTeX 严格资源按需仅延期混合条目的资源子要求，其他能力保留；Umami 私有统计的两个 token 项改为 blocked / post-1.0，访问追踪保留。897 条中 184 不适用、22 延期单列，当前适用分母 691；0 verified，5 条页面失败不变。当前工作顺序为页面加载可靠性、性能/原生图片、已有组合/映射和最终完整验收。
