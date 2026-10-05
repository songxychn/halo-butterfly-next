# 文档与演示站

真实 Halo 2.26.1 上运行的文档演示一体站，包含 10 篇教程、4 篇演示、5 个单页及 6 张 Pexels 摄影图片。采用主题现有导航、置顶文章和侧栏入口，不新增首屏双按钮。实施背景见[方案](../docs/DEMO-DOCS-SITE.md)。

当前交付是**独立本地样站**，默认地址 `http://127.0.0.1:18141`。工具不支持远程 URL，不部署服务器、DNS 或公开发行包。已启用固定版本的官方搜索插件；评论保持关闭。搜索关闭后的焦点恢复限制仍保留，不宣告公共 alpha 或完整插件验收通过。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| [manifest.json](manifest.json) | 稳定内容 ID、slug、标题、摘要、分类标签、封面、导航和预览状态 |
| `content/tutorials/`、`content/demos/`、`content/pages/` | 面向访客的 Markdown 内容；从[文档总览](content/pages/docs.md)阅读 |
| [素材清单](assets/sources.json) | 摄影图片的来源、许可与 SHA-256 |
| [配置样例](config/theme-profile.json) | 当前主题已有字段的局部设置及 URL 绑定 |
| [离线检查](check.mjs) | 内容、素材、链接与设置字段检查 |
| [渲染器](render.mjs) | Markdown 转 HTML、标题锚点及实际 URL 回填 |
| [本地命令](local.py)、`tools/` | 独立运行目录、内容同步、发布与配置合并 |

正文不重复维护 front matter，首行 H1 转为 Halo 的标题字段。ID 独立于 slug；默认 Halo 已有 `/about`，本站关于页使用 `/about-project`。`sourceFiles` 和 `sourceCommit` 是编写时核对来源，不代表未提交文件的提交身份。

## 建立样站

需要项目要求的 Node.js 24、Bun 1.4.0、Python 3、Java 21+、OpenSSL。先准备可信来源的 Halo 2.26.1 JAR；工具会按 `fixtures/comparison/versions.json` 固定 SHA-256 校验，不自动下载。

在仓库根目录运行：

```sh
bun install --frozen-lockfile --ignore-scripts
bun run verify
bun run site:check
bun run site:local init --jar-source /absolute/path/halo-2.26.1.jar --package dist/halo-butterfly-next-0.1.0-alpha.3.zip
bun run site:local plan
bun run site:local sync
bun run site:local publish
bun run site:local configure
bun run site:local search-enable
```

`init` 创建 `.runtime/docs-site/`，绑定回环地址 18141，安装指定包并记录摘要。首次初始化保存默认内容，保留并取消发布欢迎文章，停用该全新实例的可选插件；默认关于页、分类和标签不删除。初始化不会接管已有 Halo 或其他进程，也不静默升级已安装主题。

`--runtime` 可选择本工作树 `.runtime/` 下另一独立目录，`--port` 可选择另一个空闲端口；后续每条命令必须使用相同参数。它不使用对照实验室的数据目录。Java 首次启动可能需要约一分钟。

```sh
bun run site:local status
bun run site:local stop
bun run site:local start
```

保持服务运行即可从本机浏览器访问。管理员凭据位于 `.runtime/docs-site/credentials.json`（0600），控制台路径 `/console`；凭据、会话、数据库、日志与配置备份均留在忽略目录，不放进 Git 或网站正文。

## 搜索

`search-enable` 校验官方 SearchWidget 1.7.1 的实际 JAR、版本及本地路径后启用；`search-disable` 可暂时停用，并使主题搜索入口隐藏。命令只处理此插件，保存状态与修改前备份，后台修改插件后停止覆盖。

固定摘要来自 `fixtures/search-comment/versions.json`。Halo 首次初始化通常已预装该插件；如果没有，先在这个本地实例的控制台安装该锁文件所列官方 JAR，再执行命令。工具不会替换不同版本或自动下载插件。网站正文和清单记录的是这套样站的配置，新的 runtime 仍需执行初始化与启用步骤。

查询、无结果、导航和关闭行为的证据与焦点恢复失败分别记录。SearchWidget 1.7.1 在 Escape/遮罩关闭后不恢复入口焦点；这是已披露的上游限制，没有改成通过，也没有注入插件私有 DOM 补丁。评论插件仍停用，文章与单页不允许评论。

## 更新流程与保护边界

修改 Git 内容后运行 `site:check → plan → sync → publish`；修改外观或导航后再运行 `configure`。

- `plan` 不写 Halo，列出每篇内容的创建或更新计划；它可能更新本地链接缓存，不预演配置差异。
- `sync` 先检查归属、ID/slug 冲突和上次同步指纹，再保存内容。正文与快照版本一起核验，写入时沿用已检查版本，不在核验后刷新版本或自动重试冲突。新内容保持草稿；已发布正文的修改先保存为草稿快照，已有未发布草稿可能原地更新。**已发布文章的标题、摘要等元数据可能立即生效**，这不是整个网站的原子草稿事务。
- `publish` 要求全部保存内容与当前源文件一致，然后按刚核验的资源版本和正文快照逐项显式发布，遇到版本冲突停止，不重试发布后台新快照；中途失败可重试，但不提供跨 19 个对象的事务回滚。
- `configure` 先解析已发布对象的入口，读取完整配置并备份，再合并审核过的字段，保留其他字段。后台修改配置会触发冲突，不静默覆盖。
- 清单、归属标记和本地台账共同限定管理范围。后台修改文章会阻断后续操作；缺失台账不自动接管。删除清单条目不会删除 Halo 内容，而是停止要求明确处理。
- 写入前记录 pending 意图，重试仅在实际对象完整匹配该意图或旧指纹时恢复；创建或首次发布若在服务端写入后中断，新增默认值/发布时间不能从旧意图确定，工具会停止要求人工核对；不要通过删台账消除冲突。

源清单中的 `status: draft`、空 `publishTime` 表达这批材料的源状态，不作为定时发布指令。上述 `publish` 明确将它们发布到私有本地实例，并由 Halo 记录实际发布时间；不改变 `publicRelease: false`。

正文使用相对 Markdown 链接。渲染器以 Halo 返回的 `status.permalink` 生成站内链接，移除重复 H1，生成中文标题锚点，保留 GFM 表格与代码语言，转义原始 HTML，拒绝未解析及危险 URL。代码围栏里的路径是示例，不重写。

图片使用带内容摘要的不可变文件名，写入本地独立实例的 `attachments/site-assets/`，通过受限资源映射访问；**不创建 Halo 附件管理记录**。这是本地样站实现，不能当作远程附件上传工具。照片按 Pexels License 使用，版权归摄影师，不改用仓库 GPL-3.0；替换后需更新来源与摘要。

主题升级与内容发布分开。目前 `init` 仅接受与已记录摘要一致的主题包；测试其他包时使用新的 runtime 和端口，保留旧实例用于对照。主题 ZIP 不包含网站内容。

## 验证与记录

```sh
node --test tests/site-content.test.mjs tests/site-publish.test.mjs
bun run verify
```

本地实测覆盖重复同步、后台冲突阻断与恢复、19 项发布内容、导航和常用归档、桌面/手机视口及图片灯箱。初始样站检查见[样站记录](../docs/validation/2026-10-05/site-local.json)；当前搜索、重复同步及审查修复记录见[搜索交付记录](../docs/validation/2026-10-05/site-search.json)。无头浏览器结果不等于真机或全面无障碍验收。

同步台账 `sync-state.json`、操作报告、配置写入前备份和 `halo.log` 位于独立运行目录。遇到冲突先保留文件并核对后台修改，再决定如何合并；工具不提供强制覆盖、删除或远程部署开关。
