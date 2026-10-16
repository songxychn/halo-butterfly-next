# 作者图片编辑与初始 HTML 验收

本轮在官方 Halo 2.26.1、默认编辑器及官方 HTML/Markdown 内容块扩展 1.7.0 上，补齐图片输入路径的限定证据。**HTML 编辑块保留测试图片属性；标准 Markdown 图片不会自动获得初始 `loading`；Markdown 块内的 HTML 重开后会转换，普通富文本粘贴也不能保留所有属性。** 没有修改主题、Halo 或插件，也没有部署任何连接绕行方案。

机器记录：[authored-image-editor.json](authored-image-editor.json)。本轮不验证图片传输、加载时机或性能，不能用于关闭 #338、D03/EXT-03 或完整 1.0。

## 环境与方法

- 产品：PR #417 合并提交 `d678d3f839347554d7f100996f87b23b571888df`，ZIP SHA256 `93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e`。每次校验官方 Halo JAR、269 个已安装包文件及全部插件 JAR；新验收工具基于 PR #419 合并提交 `116a81ea471324f0414f1c24b70ca9585dd5cda5`，未改变产品包。
- 新建回环实验室 `.runtime/authored-images/halo-lab`，Halo 18865；不复制旧数据库。仅官方 `hybrid-edit-block` 1.7.0 启用，SHA256 `6706fd5ab80551577522756b81dbbc29427a46b1951bb925a8f1fb8f5900ef1f`；其他八个初始插件停用，不代表推荐插件组合验收。
- 四张固定图片分别声明 eager/high、lazy、未声明 loading、picture/source/srcset。HTML 与 Markdown 编辑块使用真实键盘输入，保存后刷新并读取完整 CodeMirror 文档；普通粘贴负例使用 Chromium 的合成 `text/html` 剪贴板事件，不冒充图片工具或系统剪贴板。
- 发布通过官方内容 API 完成，只操作本轮随机标识和 UID 核对过的新内容。发布后用无登录 Cookie 的独立 HTTP 请求获取原始 HTML，再离线解析唯一 `article.render`；不从主题 JS 修改后的 DOM 提取属性，不执行前台资源。
- API 控制分别创建文章和单页，以实际 `headSnapshot` 查询保存内容。它们不经过图形编辑器，与编辑器案例分开记录。

## 结果

| 输入路径 | 保存、重开或读取、初始正文结果 | 范围 |
| --- | --- | --- |
| HTML 编辑块 | 四张图片的 lazy/eager、fetchpriority、尺寸、alt、src/srcset、picture/source 均保留；HTML 格式可能变化，不声称原文字节一致 | Chromium、Firefox、WebKit 各一例 |
| Markdown 块内原生 HTML | 首次保存与本轮发布的初始正文保留四张图片属性；重开时源文本转成 Markdown 图片写法，图片 loading、尺寸、fetchpriority、srcset 及 picture 容器等不再完整保留 | 三引擎一致；没有执行重开后的再次保存，不能声称已测得再次保存后的公开页面结果 |
| 标准 Markdown 图片 | 图片 URL 与 alt 保留；重开 Markdown 源相同，初始正文没有自动添加 loading | 三引擎各一例；普通图片语义保留不等于懒加载要求全部通过 |
| 普通富文本 HTML 粘贴 | 四张图片保留 src、alt 与尺寸；保存、重开和初始正文均丢失 loading、fetchpriority、picture/source 与响应式 srcset | Chromium 合成粘贴一例，作为输入限制记录 |
| HTML 内容 API | 文章、单页的四张图片属性均在保存内容与初始正文保留 | Chromium 批次中的两个 API 控制，不算编辑器路径 |

有效采集共 12 例：8 例标为 `preserved`，4 例为 `observed-differences`（三个 Markdown HTML 重开案例和一个富文本粘贴案例）。`completed` 仅表示固定流程完成，不表示 12/12 属性保留通过。无 loading 的普通作者图片在初始正文中仍无 loading，不能以主题之后补属性证明初始下载已经延迟。

## 首轮错误与分析修正

首批 `286b60b4b2f241e2` 的六例均保留为工具失败：五例在保存后额外 PUT 归属标签时与 Halo 后台协调发生版本冲突；另一例读取内容遗漏了官方接口必需的 `snapshotName`。核对该实例实际 OpenAPI 后，工具去掉无必要的 metadata PUT，以新对象 UID/唯一标题证明归属，并显式读取 `headSnapshot`。没有把这两个工具错误认定为 Halo 新缺陷。

修正工具后，Chromium 使用新批次 `e34cc700779171f1` 完整执行六例。最初分析器扫描整页，同批文章的侧栏/推荐图片也被计入（整页 5–10 张）。原 HTTP 响应和报告保持不变，后续使用共享解析器限定唯一正文离线重算，正文实际为四张或标准 Markdown 的一张；同时保留整页计数。这次重算没有发出 Halo 请求或增加运行样本。

Firefox/WebKit 使用新批次 `26181868052b82be`，各执行三种编辑块案例，直接使用修正后的正文解析范围。它们用于新增引擎覆盖，不补跑或替换前两批。所有脚本版本、输入、保存/重开文本、初始响应和报告都有独立摘要。

## 清理与边界

三批各六个自有内容对象均已删除并确认 404，前后已有内容、主题配置、插件状态/配置及运行包身份一致。实验进程已停止，18865 不再监听，无残留验收锁。官方原包保持不变，未使用 max-keep-alive 配置、代理绕行或实验 JAR。

本轮只验证固定版本、字段和值；不覆盖普通“插入图片”工具、其他编辑器、重开后的再次保存、编辑块停用/卸载、单页图形编辑器、真实 Safari/手机、图片下载/解码与完整插件组合。选择 HTML 编辑块是已有官方作者路径，不要求修改官方插件。正文属性缺失的来源边界见[初始 HTML 映射](authored-image-mapping.md)。

原始记录只保存在本地忽略的 `.runtime/authored-images/`；机器报告列出清单和指纹，不声称原始响应已公开归档。独立审查、工程门禁与范围说明分别记录，不提升矩阵状态或降低合同要求。

原始清单覆盖 93 个文件、2,114,377 字节，SHA256 `cb9ce677bd3b6445ae7f5862c6d2260bb5fa0f15acb4457b79f3f35a3cae32f9`，不包含凭据、数据库、JAR 或可变 PR 文案。独立审查另用 Python HTMLParser 重算 12 例的 36 份阶段 HTML 与摘要，结论一致、无阻断问题。`bun run verify` 通过：771 测试、类型与矩阵检查、构建和 269 文件包检查；重建 ZIP 摘要仍与受测产品一致。

## 复跑入口

只允许归属明确且已启动的本地实验室，准备上述官方插件、包与固定图片。脚本验证源提交与产品文件无差异、安装包内容、官方运行时、插件及凭据权限；每次使用新随机 runId。浏览器运行时沿用 `.runtime/browser-matrix`。

```sh
LAB_RUNTIME="$PWD/.runtime/authored-images/halo-lab" \
BASE_URL=http://127.0.0.1:18865 \
THEME_SOURCE_SHA=d678d3f839347554d7f100996f87b23b571888df \
PACKAGE="$PWD/.runtime/performance-followup/evidence/candidate-d678d3f.zip" \
ALLOW_SYNTHETIC_WRITES=yes ENGINES=chromium \
bun scripts/images/check-editor.mjs
```

`ENGINES=firefox,webkit` 运行两引擎的三种编辑块路径；不会把 Chromium 专用合成粘贴扩展为跨浏览器结论。此命令会创建、发布并最终删除本轮合成内容，不能指向真实站点。实验室本轮已停止，复跑需先单独启动 owned Halo，不能把旧报告当作新运行结果。
