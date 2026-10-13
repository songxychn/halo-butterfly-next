# 1.0 剩余需求（2026-10-14 通用正文决定修订）

基准：最新主线 [`362beb61d61a`](https://github.com/songxychn/halo-butterfly-next/commit/362beb61d61ad3910719af52edd79f0b323a1354)（已合并 #413），叠加本次维护者确认的 [DEC-02 通用正文补充](DEC-02-PORTABLE-CONTENT.md)。本清单按用户能力归并；状态真相源为 [matrix.json](matrix.json)，完整归组见[机器清单](development-backlog-2026-10-14.json)。[原对账报告](RECONCILIATION-2026-10-14.md)保留历史基线，本次状态修订见[机器记录](portable-content-reconciliation-2026-10-14.json)。

**结论：最大的功能缺口集中在全页面 PJAX、PWA/离线、国际化、瞬间及插件资源按需加载。** 已有通用 Markdown / HTML 正文能力以映射和验收为主；Hexo 专属标签兼容与通用离线转换退出默认开发清单。当前为 7 组明确开发缺口（D02–D08）、3 组平台职责需求（P01–P03），D01 转入映射/验收；组数不是独立功能数量。

## 1. 已确认的开发缺口

| 编号 / 需求 | 已有实现 | 实际剩余 |
| --- | --- | --- |
| D02 / 文章、单页与插件 PJAX | 列表 PJAX、预取、清理、历史、资源地址及 Pace 已实现。 | 补 Halo tracker 的内容身份/清理协议和插件/第三方 SDK 生命周期；当前这些页面完整导航是明确回退，不是完整 PJAX 已完成。 |
| D03 / 图片延迟处理与背景值域 | 主题图片与显式 data-lazy-src 延迟加载可用，URL 背景及错误回退可用，页脚遮罩已接入。 | 任意作者 HTML 的 src/srcset 在脚本前可能发请求；补内容处理映射。背景仍缺完整颜色/CSS 输入，footer_img=true 尚不复用顶图。候选封面支持颜色不等于所有背景入口支持。 |
| D04 / 瞬间评论与说说数据 | Moments 内容、媒体、原生分页可用；文章/单页评论与懒挂载已完成接入。 | 补 Moment 评论主体、计数/跳转与最新评论覆盖；补说说 author/avatar/date/tags/key、远端输入、num/date 限制和时区映射；输入跳页尚无，上游每页数量与插件设置的差异需确定。 |
| D05 / 国际化 | html lang/OG locale 读取 Halo locale，简繁转换可用。 | 主题仍有固定中文文案，缺完整消息键/七套语言映射；逐页语言覆盖尚未接入。不能把字形转换当成日/韩/英语等国际化。 |
| D06 / 作者逐篇覆盖与列表参数 | 已有全局侧栏、全局代码折叠、逐篇版权/过期提醒开关、全局版权详细配置、标签颜色/字号及 date/relative 模式。 | 缺逐篇 aside/highlight_shrink、逐篇版权详细字段；标签云完整排序/数量/字号参数还需映射，归档年/月/菜单标题尚无，任意站点日期格式未接入。 |
| D07 / 社交、页脚与友链输入 | 社交名称/图标/链接、扁平页脚导航、页脚纯文本、Links 基础组/卡片与正文静态卡片可用。 | 缺完整 header 社交位置/逐项颜色、页脚嵌套列/宽度/HTML、友链完整组说明/远端输入/随机顺序。不得从基础卡片存在推断完整上游数据模型完成。 |
| D08 / 外部资源连接提示 | 按需脚本、资源覆盖和 prefetch 可用。 | head 尚无按实际资源主机输出的统一 preconnect；需确定连接提示条件，prefetch 不替代此能力。 |

## 2. 先确定平台职责的需求

以下平台能力仍保留在 1.0 范围；通用正文决定不改变它们的职责与成功条件。

| 编号 / 需求 | 已有实现 | 下一步 |
| --- | --- | --- |
| P01 / PWA、离线、RSS 与站点地图 | PWA 第一阶段旧 PR 未合并；当前主线未交付完整安装/离线能力。DEC-03 已处理资源供应部分。 | PWA 安装入口、manifest/图标、离线缓存与更新恢复待实现；RSS/站点地图在合同 DEC-03 保留，先确定 Halo/插件/主题职责与成功条件。不能自动删除或延期。 |
| P02 / Umami 私有统计后端 | SDK 和公开只读 site_uv/site_pv/page_pv 接口已接入。 | 缺持有私有凭据的服务端代理；两项 token 属于同一需求。需确定后端承载，不把 token 放入公开页面。 |
| P03 / 评论/公式资源按需加载 | 评论接近视口时挂载、失败重试，KaTeX 阅读/复制/显示控制已有实现。 | CommentWidget head 预加载未取消；KaTeX 全站注入不受主题显示开关控制。需要插件侧能力或明确合同裁定，当前不满足首屏零评论资源/无公式页按需资源目标。 |

依据：[评论资源边界](../COMMENT-ENHANCEMENTS.md)、[KaTeX 边界](../MATH.md)、[DEC-03](DEC-03-RESOURCES-DECISION.md)、[1.0 合同](../RELEASE-ACCEPTANCE.md)。

## 3. 待映射/审计，不直接计为“缺代码”

- **D01 通用正文能力映射与可移植性验收**：PR #408 的提示、Tabs、原生折叠、按钮、时间线和静态卡片已有实现。Note 外观、行内标记/图片还需核对通用能力映射；编辑器保存重开、无脚本/增强失败、换主题内容保留以及完整 EXT-01 仍待验证。原生折叠替代旧 hide 的一次性/行内揭示；不要求旧标签语法、class、完整参数或通用离线转换。既有图库专用转换保留其范围，不扩大成其他标签的转换义务。

- **A01 安全嵌入完整审计**：Thymeleaf 配置序列化与 JSON-LD 脚本边界转义已有实现。 补所有消费者和失败输入的清单/断言；当前是审计覆盖不足，不等于已确认漏洞，也不是重写一套序列化。
- **A02 其余平台/上游组成项映射**：已有 Halo 路由/SEO/Prism、构建入口、图片回退和组件模块；同名 Hexo 文件不存在不能直接判作缺失。 逐项确认 404 开关、路由/pretty URL、根路径、站点元数据、高亮提供方、封面类型/独立顶图、加密标记、源文件/目录来源、构建 hook/默认合并/资源图标等语义。尚无足够证据关闭；必须完成来源→消费者→保留用户能力映射后，才转成开发或有依据不适用。

A02 的全部 ID 如下，保留这些未决项，避免只列醒目功能而隐藏长尾：

`config:error_404.enable`, `template:includes/additional-js`, `helper:getArchiveLength`, `helper:groupPosts`, `helper:urlNoIndex`, `lifecycle-hook:scripts/events/404.js#generator:404`, `lifecycle-hook:scripts/events/init.js#filter:before_generate`, `lifecycle-hook:scripts/events/stylus.js#filter:stylus:renderer`, `lifecycle-hook:scripts/events/welcome.js#event:ready`, `lifecycle-hook:scripts/filters/random_cover.js#generator:post`, `asset:source/img/404.jpg`, `asset:source/img/butterfly-icon.png`, `asset:source/img/error-page.png`, `asset:source/img/favicon.ico`, `asset:source/img/friend_404.gif`, `asset:source/js/main.js`, `asset:source/js/utils.js`, `page-data:cover_type`, `page-data:encrypt`, `page-data:full_source`, `page-data:origin`, `page-data:source`, `page-data:top_img`, `site-config:archive_dir`, `site-config:archive_generator`, `site-config:category_dir`, `site-config:copyright`, `site-config:email`, `site-config:favicon`, `site-config:highlight.enable`, `site-config:post_asset_folder`, `site-config:pretty_urls.trailing_html`, `site-config:pretty_urls.trailing_index`, `site-config:prismjs`, `site-config:prismjs.enable`, `site-config:root`, `site-config:syntax_highlighter`, `site-config:tag_dir`, `site-config:theme`, `config:CDN.custom_format`。

PR #413 已用统一资源根地址与单项 URL 替代 `CDN.custom_format`；该项仍为 gap 是因为正式裁定登记未完成，不应重新开发旧模板。DEC-08 公开登记也仍待完成。

其中 `helper:groupPosts` 与系列活数据有关，但本次未新加延期裁定；应复核 DEC-02 的具体消费者后同步该追踪项。`page-data:top_img` 保留原生封面方案与原独立字段的差异，不建议重新添加已明确不采用的独立文章顶图字段。

## 4. 已实现，后续以验收为主

首页 1–7 布局、顶图、侧栏/外观、阅读分享统计、SEO/注入、分析/聊天/广告、正文图库、Mermaid/Chart.js/ABC 乐谱、可移植正文增强、评论懒挂载、统一资源地址与 Pace 已合并。上面单列的参数/资源缺口不能因此略过，但这些模块不应整体重新立项开发。

- 固定双站、逐值/组合、插件生命周期与真实外部服务联调。
- Safari、真实手机、屏幕阅读器、无障碍、最终包性能预算。
- 最终候选安装/升级/回退、精确提交独立审查、CI 与发布证据。
- 保留首页、文章、单页、归档、标签五类失败状态；[#338](https://github.com/songxychn/halo-butterfly-next/issues/338) 需在包含正式修复的 Halo 上复验，不能用局部通过抵消。
- 公开反馈和正式 1.0 的维护者确认。

## 5. 已延期或已裁定替代

12 条系列活数据/侧栏系列相关项按既有 DEC-02 延至 1.1；1.0 保留通用 HTML 静态系列能力，通用离线转换不再是默认义务。184 条不适用保持原裁定，不恢复第三方搜索/评论 SDK、MathJax 或 DEC-03 已退出的独立资源提供方。0 条新改为 verified。

## 建议推进顺序

以下按缺失范围、实现复杂度和 1.0 影响排序，是排期判断，不是工期估算：

| 排名 | 缺口 | 判断依据 |
| --- | --- | --- |
| 1 | D02 文章、单页与插件 PJAX | 需统合统计身份、评论、图表、插件及外部 SDK 的初始化/销毁/历史状态；当前只有列表局部导航，跨模块复杂度最高。 |
| 2 | P01 PWA 与离线 | 当前主线尚未完整交付安装、manifest/图标、缓存、断网访问及更新恢复，先明确平台职责；RSS/站点地图另行映射。 |
| 3 | D05 国际化 | 消息键、七套语言及逐页覆盖尚未接入，影响各页面与交互文案。 |
| 4 | D04 瞬间评论与说说 | 内容/媒体基础已有，评论主体、计数/跳转/最新评论、远端数据/数量/日期/时区和跳页仍不完整。 |
| 5 | P03 评论/公式资源按需加载 | 主题已有懒挂载/显示控制，但 head 预加载和全站注入需插件侧配合，是跨平台阻塞。 |

实际推进可先做 D04 瞬间与 D05 国际化，尽早确定 P01/P03 的平台方案，再集中集成 D02 PJAX。D03 图片/背景、D06 逐篇/列表配置、D07 社交/页脚/友链、D08 preconnect 和 P02 Umami 代理按独立功能推进；D01 与 A01/A02 按映射/审计结果补必要能力。完整验收单独持续推进，不用功能开发完成代替发布门禁。本次仅修正文档与矩阵，没有启动上述功能开发。
