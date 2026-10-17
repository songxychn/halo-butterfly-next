# 编辑器重存与插件关闭后的读取验收

采集日期：2026-10-16；最终审查与交付整理跨至 2026-10-17（Asia/Shanghai）。

本轮继续验收不依赖图片传输完成的正文行为：真实编辑器重开、修改、再次保存，以及关闭 HTML/Markdown 编辑块插件后已保存正文的公开读取。Halo 连接问题仍等待官方修复，不部署临时连接配置，不替换运行时或官方插件。

**限定验收已完成：身份校验增强后的三引擎再次保存共 9 例，6 例保留预期属性、3 例确认输入转换限制；插件启停后的已保存 HTML 读取共 6/6 次通过。不能据此宣布完整 1.0 验收通过。**

## 前置记录与环境

[PR420](https://github.com/songxychn/halo-butterfly-next/pull/420) 已由 `songxychn` 于 `2026-10-16T15:27:57Z` 合并，合并提交为 `5fec135dbf08d2ce852b386755e88f4a183cb63c`。本轮初次复审遗漏了原文中“UID 校验”的不实表述，后续编写读取生命周期工具时发现并在本轮更正，不能继续概括为审查无问题。[原编辑输入验收](authored-image-editor.md) 的图片保存与属性差异结论仍与归档数据一致；原始记录保留，不回填不存在的 UID 检查。

本轮使用已有、仅监听回环地址的自有实验实例，实验文章均为带随机 run 标记的合成内容，完成后删除并核对原有状态。实验记录的脚本提交与实际安装的产品提交分开归属：

| 项目 | 身份 |
| --- | --- |
| Halo | 官方 `2.26.1`；JAR SHA256 `7a1d6ea0800e8940672aab99a7328b7bd9520e297677169594328004a41991bc` |
| 实际安装主题源码 | `d678d3f839347554d7f100996f87b23b571888df` |
| 实际主题包 | `candidate-d678d3f.zip`；SHA256 `93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e` |
| 安装文件核验 | 包内 269 个文件逐字节对照实验实例中的主题文件 |
| HTML/Markdown 编辑块插件 | `hybrid-edit-block 1.7.0`；SHA256 `6706fd5ab80551577522756b81dbbc29427a46b1951bb925a8f1fb8f5900ef1f` |
| 实例目录 | 本工作树 `.runtime/authored-images/halo-lab` |
| 验收工具开发基点 | `5fec135dbf08d2ce852b386755e88f4a183cb63c`；运行时含本 PR 未提交改动，各批冻结脚本以 SHA256 归属，不代表安装产品变更 |

## 方法与结论边界

### 真实编辑器再次保存

使用无头浏览器与官方编辑器，创建合成文章，依次保存、重开、修改预定正文、再次保存，再核对发布内容和匿名初始正文。各步骤保存独立内容快照和请求证据。第二次保存核对实际 `/content` 请求、HTTP 响应和对应 head snapshot 的存储内容；追加唯一正文标记，分别在请求 raw/HTML、存储 raw/HTML、重开编辑块、编辑器文字和公开正文中查验。新批次还归档第二次重开时所有 CodeMirror 文档、编辑器 DOM 和文字，避免仅凭首个 `.cm-content` 的等待超时推断内容缺失。HTML 编辑块、Markdown 编辑块、Markdown 图片输入分别记录，不能将某一路径的结果推广到所有编辑器输入方式。

本项测试编辑和序列化行为；不以浏览器中全部图片下载完成或 `networkidle` 为通过条件。不包含真实移动设备、系统剪贴板、其他编辑器插件或性能结论。

### 插件启停后的已保存正文读取

使用 `scripts/content/block-lifecycle.py`，将已归档、可通过报告指纹核验的真实编辑器保存 HTML，通过官方内容 API 复建为两个独立合成公开文章。固定执行 `baseline-enabled → disabled → reenabled`，只通过官方 `plugin-state` API 改变 `hybrid-edit-block` 的启用状态。

逐阶段读取发布内容和匿名公开 HTML，只解析 `article.render` 的可读文字、图片与 `<source>` 语义。各阶段核对站点配置、主题、其他插件和原有正文身份；finally 恢复原插件状态，删除本 run 对象、核实 404，并再次核对包和插件文件。

**这是已保存 HTML 的读取生命周期控制实验，不是插件禁用后打开、编辑或再次保存内容的测试。** 不执行公开页 JavaScript、不下载图片，不验证 `picture` 父子结构或视觉样式，不覆盖图片连接可靠性、插件全部交互或完整性能。

## 保留的失败批次

首次再次保存批次 `8949a1110fe7df9f` 的三个 Chromium 案例均为工具失败，保留原始报告与全部已有快照，不将其改写成通过：

| 案例 | 首批结果 | 解释 |
| --- | --- | --- |
| HTML 编辑块 | 等待 `/content` 保存响应超时 | 官方 UI 在该请求之前先执行核心资源 metadata PUT；原测试路由 allowlist 不允许该前置请求（离线代码核对，首批未抓取该请求） |
| Markdown 编辑块 | 同上 | 同上 |
| Markdown 图片输入 | 同上 | 同上 |

这不是已证实的主题兼容问题，也不是 `/content` 接口已返回错误。官方保存调用顺序的源码证据归档于 `.runtime/editor-resave/tool-diagnosis/evidence.json`，来自本轮安装的官方 Halo JAR；其中包含编辑页面、设置窗口和 API 客户端片段指纹。这是离线源码与测试路由边界的核对，不能称为对首批失败请求的完整网络重放。修正测试工具的请求边界后须创建新批次，保留本批失败，不能覆盖或混合计数。

本批三篇合成文章均已清理，清理数为 `3/3`；归一化 `before` 与 `after` 状态一致。原始报告：`.runtime/authored-images/halo-lab/authored-images/8949a1110fe7df9f/report.json`。

### 第二批：保存完成，Markdown 编辑块第二次重开未完成

第二批 `8d74a37c091d4c7d` 修正前置请求边界后，记录了 8 次核心资源 metadata PUT，均为 HTTP 200，没有被测试路由阻断的请求。HTML 编辑块和 Markdown 图片输入完成第二次保存、重开、发布与匿名正文核验，均记录为 `preserved`。

Markdown 编辑块的第二次 `/content` 保存请求返回 HTTP 200；存储 raw/HTML 与提交内容一致，四项请求/存储标记检查均为真。该内容在重开转换和重存过程中已丢失部分初始图片属性。但随后等待首个 `.cm-content` 包含标记超时，该案例没有完成第二次重开或发布验收，状态仍为 `failed`。

**此次超时的具体原因尚未确认。** 本批没有归档失败时全部 CodeMirror 文档或编辑器 DOM，不能证明是多编辑块定位、字符转义、连接问题或其他原因，也不能称为已证实的工具 bug。后续新批增加观测，不撤销本批失败，不把本批汇总成三例通过。

本批三篇合成文章均已清理，`before`/`after` 状态一致，前后运行时及主题包/插件文件身份一致。原始报告：`.runtime/authored-images/halo-lab/authored-images/8d74a37c091d4c7d/report.json`。

### 第三批：三引擎完成，旧身份校验的限制保留

批次 `bb036d39b02d8389` 按 Chromium、Firefox、WebKit 各三种输入方式的固定计划完成 9 例，6 例 `preserved`、3 例 `observed-differences`：三个引擎的 HTML 编辑块和 Markdown 图片输入保留预期属性；三个 Markdown 编辑块均存在属性差异。

三例 Markdown 编辑块的新增标记七项检查均为真，第二次重开均捕获到一个 CodeMirror 文档，标记按原文保留；编辑后源文本与第二次重开文本逐字比较，仅末尾换行被移除。四张图片的 `src`、`alt` 保留，但第二次保存、存储和公开初始正文已缺少原始 `loading`、`fetchpriority`、尺寸、`srcset` 和 `picture` 结构。实际存储 raw/content 与捕获的第二次 PUT 内容逐字一致。这支持记录输入转换的属性保留限制，不能把第二批超时的原因反推为已解决。

本批记录 27 次 metadata PUT，全部 HTTP 200，没有被测试路由阻断的请求；9 篇合成文章全部清理，前后站点与运行时/包/插件身份一致。原始报告 SHA256 为 `44e1b8bf3031448197b2d6116261271c4cde4399e2a1ad4848ded5f267966716`。

本批运行时仍使用原 JavaScript 的缺省 UID 比较，身份校验能力不能按原声明计入；第四批使用实际 `creationTimestamp` 与所有权信息完成独立的固定 9 例计划。本批不删改、不与新批拼接计数。

### 第四批：实际创建时间身份校验下的固定 9 例

最终重存批次 `6143cc6543fec5ab` 使用实际响应中的 `creationTimestamp`，结合本 run 的精确文章名称、随机标记标题进行后续修改、发布与清理核对；若 UID 存在则额外核验，不再把缺省值相等当作身份保证。三个引擎的固定九例全部完成：

| 引擎 | HTML 编辑块 | Markdown 编辑块 | Markdown 图片输入 |
| --- | --- | --- | --- |
| Chromium | `preserved` | `observed-differences` | `preserved` |
| Firefox | `preserved` | `observed-differences` | `preserved` |
| WebKit | `preserved` | `observed-differences` | `preserved` |

结果为 **6 例保留预期属性、3 例确认差异**，不是 9 例无差异通过。九例第二次保存请求/存储 raw 与 HTML、第二次重开源文本/编辑器文字、公开正文中的七项标记检查全部为真。各例第二次重开均记录一个 CodeMirror 文档。三个 Markdown 编辑块的图片属性差异与第三批一致；差异已存在于第二次保存内容，存储和主题公开正文与提交内容一致。

本批 27 次核心资源 metadata PUT 均为 HTTP 200，没有被测试路由阻断的请求。九篇合成文章均带已记录的真实 `creationTimestamp` 完成清理；清理后前后站点状态一致，官方 Halo、主题包与插件文件身份一致。

- 工具 SHA256：`5563ef4694a8e5a3816b5e2667625f92290ad11c07133b82b9cad7c505b27286`。
- 原始报告：`.runtime/authored-images/halo-lab/authored-images/6143cc6543fec5ab/report.json`。
- 原始报告 SHA256：`061582eb635839b1e3b6b5c7575686b3c1a3f6104911f21ffd368ea4d22d3099`。

四批分别计数：首批三个工具失败；第二批两个完成、一个原因未明的重开超时；第三批九例完成但保留旧身份校验限制；第四批九例在增强后的身份校验下完成。后续通过不覆盖早期失败，也不扩大第三批原有证据范围。

## UID 声明纠正与读取生命周期结果

### 首轮工具前置失败

读取生命周期首轮 `ff45cf743fd8840583fc1eaf` 在建立 station 时发生 `KeyError: 'uid'`，尚未取得 before 快照、创建文章或启停插件，测量为零。首轮失败报告和冻结脚本保留。

核对当前 Halo `2.26.1` OpenAPI，`Metadata` schema 没有 `uid` 字段；真实主题、插件和文章响应也没有该字段。原 JavaScript 代码读取 `undefined`，随后执行 `undefined === undefined` 并不能验证身份，JSON 序列化还会省略该字段。这是原验收工具和文字说明的限制，不是 Halo API 的兼容性缺陷。

修正后的读取工具以预检名称不存在、随机 run 所有权标签、精确名称/标题和 `creationTimestamp` 保护合成文章；若实际返回 UID，则额外要求一致。主题和插件的状态比较允许 UID 缺省，同时继续核对名称、版本、配置、状态和文件字节。创建成功但响应未登记的恢复清理只允许相同随机 run 标签/名称/标题，并记录恢复登记事实。

### 三阶段读取完成

有效读取批次 `7775d994e88166f921ad7ef8` 使用第三批 Chromium 的 HTML/Markdown block `second-saved.html`，逐项核对其来源报告与 SHA256，再通过内容 API 复建两个合成文章。

| 插件阶段 | HTML 输入 | Markdown 输入 |
| --- | --- | --- |
| baseline-enabled | HTTP 200，发布 raw/content 与输入相同，正文语义相同 | 同左 |
| disabled | HTTP 200，发布 raw/content 与输入相同，正文语义相同 | 同左 |
| reenabled | HTTP 200，发布 raw/content 与输入相同，正文语义相同 | 同左 |

三阶段共 6/6 次公开正文检查完成，错误数为零。每阶段只允许目标插件的启用状态和 phase 改变，其余核对项一致。结束后插件恢复 `enabled=true`、`phase=STARTED`，两篇合成文章删除并确认 API 404；`stationRestored=true`，前后官方运行时、269 个主题文件和插件 JAR 身份相同。

上述结果表明本轮两份已保存 HTML 在插件关闭后仍可读取；Markdown 输入中的图片属性已经在前面的编辑器转换中丢失，读取通过不意味着属性恢复。此结论不包含插件关闭后的编辑、重存、主题切换或图像资源传输。

- 工具 SHA256：`6fc9a50738a029d9962a6141d241eb245e1cb80edbf1f0e1b5f133cf9d0f3f8d`。
- 读取报告：`.runtime/authored-images/halo-lab/block-lifecycle/7775d994e88166f921ad7ef8/report.json`。
- 读取报告 SHA256：`f1309d59acbee5aafee5db6529de3e15a9487de6c939511ef11e8209b0028cb6`。

## 最终记录与交付边界

机器可核对的批次摘要、源材料引用和证据清单见 [content-editor-followup.json](content-editor-followup.json)。原始 HTML、保存请求/响应、编辑器源文本、清理及脚本快照保存在本工作树忽略目录中；所有失败批次保留。最终独立复审通过：512 个文件、3,592,603 字节的清单指纹一致，独立重算四批 130 份阶段 HTML、140 项标记检查、62 次 metadata PUT，以及生命周期六份公开正文；未发现当前改动的阻断问题。清单 SHA256 为 `64f842a1633530a340ef2313a2cf6139bd9c7ef42e60d9d2f54a2cddcb77d657`，独立复审 SHA256 为 `f018629a06ed071a683e1aa9856ec2f1df9d7fb3041d2ff626c0e871ec8f603d`。另一路只读审查确认范围和兼容性边界。生命周期未单独归档创建/GET 资源原响应，其创建时间核验依据为脚本与运行报告，不能称作对该部分原始响应的独立重放。

最终运行状态记录为 `.runtime/editor-resave/final-runtime.json`：本轮实例端口 `18865` 已关闭，实验互斥锁不存在，官方 Halo JAR 与原主题 ZIP 指纹保持一致。生命周期实验已恢复插件为 `STARTED`；第四批重存最终九篇和生命周期两篇合成文章均完成清理，前后原有站点内容、配置和插件状态保持一致。

本地 `bun run verify` 在 `.runtime/editor-resave/verify-identity-final.log` 中记录 771 个测试通过、0 失败，构建及安装包的 269 文件检查通过。此构建和脚本验证不等于浏览器兼容性、生产部署或完整 1.0 验收。

本轮可确认：

- 这组三引擎样本中，HTML 编辑块和 Markdown 图片语法能够完成修改后再次保存；Markdown 编辑块的 HTML 图片属性在输入转换中存在明确保留限制，主题正文没有额外改变已提交内容。
- 两份已保存 HTML 经内容 API 复建后，在编辑块插件开启、关闭、重新开启三种状态均可匿名读取，文字和图片/source 属性语义保持一致；不包含关闭插件后的编辑/重存或视觉样式保证。
- 第二批 Markdown 编辑块第二次重开的单次超时原因仍未确认。没有据此归因为 Halo 连接问题，也没有因后续批次完成而删除这一未解决观测。

未修改官方 Halo 或插件以适应本主题，未部署临时连接缓解配置，未操作生产环境。Halo 连接可靠性、完整性能矩阵和完整 1.0 验收的未通过状态保持不变。

## 复跑入口

需先单独启动归属明确、安装上述官方版本与产品包的回环实验室；本轮实例已停止。固定三引擎再次保存使用原编辑器工具的新场景：

```sh
LAB_RUNTIME="$PWD/.runtime/authored-images/halo-lab" \
BASE_URL=http://127.0.0.1:18865 \
THEME_SOURCE_SHA=d678d3f839347554d7f100996f87b23b571888df \
PACKAGE="$PWD/.runtime/performance-followup/evidence/candidate-d678d3f.zip" \
ALLOW_SYNTHETIC_WRITES=yes EDITOR_SCENARIO=resave \
ENGINES=chromium,firefox,webkit bun scripts/images/check-editor.mjs
```

读取生命周期使用 `python3 scripts/content/block-lifecycle.py --help` 查看必需参数；`--html-content` 与 `--markdown-content` 必须指向真实已完成编辑器案例的 `saved` 或 `second-saved` HTML，并与同目录原始报告指纹吻合。两种工具共享独占锁，必须串行运行，且只允许本工作树 `.runtime` 内的自有实例；每次生成新 run，不覆盖上述记录。
