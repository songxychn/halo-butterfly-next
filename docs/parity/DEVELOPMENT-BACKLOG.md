# 1.0 剩余需求（2026-10-14 通用正文决定修订）

基准：最新主线 [`362beb61d61a`](https://github.com/songxychn/halo-butterfly-next/commit/362beb61d61ad3910719af52edd79f0b323a1354)（已合并 #413），叠加本次维护者确认的 [DEC-02 通用正文补充](DEC-02-PORTABLE-CONTENT.md)。本清单按用户能力归并；状态真相源为 [matrix.json](matrix.json)，完整归组见[机器清单](development-backlog-2026-10-14.json)。[原对账报告](RECONCILIATION-2026-10-14.md)保留历史基线，本次状态修订见[机器记录](portable-content-reconciliation-2026-10-14.json)。

**本分支开发进展：D04/D06/D07/D08 的已确认代码缺口已补齐，D05 国际化主体已实现，D02 已覆盖核心内容与官方评论，D03 已补背景值域。** 尚未合并/发布；平台职责和完整 1.0 验收仍保留。最大剩余功能缺口现为 PWA/离线、插件资源按需加载、第三方 PJAX 生命周期、图片预扫描前处理及 Umami 私有代理。源码状态与限定证据见[本轮对账](confirmed-gap-reconciliation-2026-10-14.json)，不将测试通过自动记为 `verified`。

## 1. 已确认的开发缺口

| 编号 / 需求 | 已有实现 | 实际剩余 |
| --- | --- | --- |
| D02 / 文章、单页与插件 PJAX | 文章/单页统计身份、官方评论草稿保护、正文图表/图库、Share.js、默认Busuanzi、本地特效和GA4显式手动页面统计已接入；可选组合12/12与GA4协议15/15限定通过。 | AddToAny默认服务持久宿主已实现并限定27/27通过；扩展服务、其他分析/聊天/广告SDK及未知插件生命周期仍缺适配；默认完整导航保留功能，真实GA4账户与完整生态仍待验。 |
| D03 / 图片延迟处理与背景值域 | CSS 颜色/渐变/background 简写、安全图片 URL 及 footer_img=true 继承已实现；16 组真实 Halo 检查通过。 | 任意作者 HTML 的 src/srcset 在浏览器解析前处理仍缺平台内容处理映射；不得以 JS 后改属性或隐藏正文冒充预扫描前延迟。 |
| D04 / 瞬间评论与说说数据 | 原生 Moment 评论主体/计数/跳转/最新评论、作者/头像/时间/标签、输入跳页和独立 JSON 动态源已实现；过滤后分页、时区、错误重试和安全输入已限定验收。 | 完整插件组合/设备验收待执行；全站 timezone 与原生插件每页数量仍保留平台职责，不因动态源参数支持而关闭。 |
| D05 / 国际化 | 七套消息目录及地区回退、模板/浏览器文案与正文语言注解已接入；Halo locale 优先级已有实际证据。 | 界面保持请求 locale，逐页强制 UI 语言仍待合同映射；Moment/友链跨语言组合12/12已通过，母语审校和真机/完整合同未完成。 |
| D06 / 作者逐篇覆盖与列表参数 | 逐篇侧栏/代码折叠/版权详细字段、标签排序数量字号、归档年月及菜单标题、受控日期格式已实现；141 项实际 Halo 验收和独立审查通过。 | 最终组合回归、完整双站/设备/无障碍与性能门禁仍待；不实现 Hexo 路由生成器。 |
| D07 / 社交、页脚与友链输入 | 首页/侧栏社交位置与亮暗色、页脚分组列/宽度/净化 HTML、原生友链组说明及独立远端 JSON/组内随机已实现；29 项实际 Halo 检查通过，相对链接审查问题已修复。 | 与国际化/PJAX 组合的重入和待完成请求离页12/12已通过，完整验收继续；不保证旧 Hexo 配置原样兼容或任意 HTML 执行。 |
| D08 / 外部资源连接提示 | 实际所选 HTTPS 资源的 preconnect 已接入 bootstrap、管理资源、Prism、AddToAny 和标题字体，含同源跳过、凭据拒绝、CORS 去重与数量上限。 | 限定真实 Halo 资源配置及独立审查通过；最终组合性能预算仍待，连接提示不代替资源按需加载。 |

## 2. 先确定平台职责的需求

以下平台能力仍保留在 1.0 范围；通用正文决定不改变它们的职责与成功条件。

| 编号 / 需求 | 已有实现 | 下一步 |
| --- | --- | --- |
| P01 / PWA、离线、RSS 与站点地图 | PWA 第一阶段 [PR #359](https://github.com/songxychn/halo-butterfly-next/pull/359) 已关闭且未合并（2026-10-14 核对）；当前主线未交付完整安装/离线能力。DEC-03 已处理资源供应部分。 | PWA 安装入口、manifest/图标、离线缓存与更新恢复待实现；RSS/站点地图在合同 DEC-03 保留，先确定 Halo/插件/主题职责与成功条件。不能自动删除或延期。 |
| P02 / Umami 私有统计后端 | SDK 和公开只读 site_uv/site_pv/page_pv 接口已接入。 | 缺持有私有凭据的服务端代理；两项 token 属于同一需求。需确定后端承载，不把 token 放入公开页面。 |
| P03 / 评论/公式资源按需加载 | 评论接近视口时挂载、失败重试，KaTeX 阅读/复制/显示控制已有实现。 | CommentWidget head 预加载未取消；KaTeX 全站注入不受主题显示开关控制。需要插件侧能力或明确合同裁定，当前不满足首屏零评论资源/无公式页按需资源目标。 |

依据：[评论资源边界](../COMMENT-ENHANCEMENTS.md)、[KaTeX 边界](../MATH.md)、[DEC-03](DEC-03-RESOURCES-DECISION.md)、[1.0 合同](../RELEASE-ACCEPTANCE.md)。

## 3. 待映射/审计，不直接计为“缺代码”

- **D01 通用正文能力映射与可移植性验收**：PR #408 的提示、Tabs、原生折叠、按钮、时间线和静态卡片已有实现。Note 外观、行内标记/图片还需核对通用能力映射；无脚本/增强失败和切换 Earth 阅读已有限定证据；[真实编辑器验收](../validation/2026-10-14/content-editor.md)已确认官方 HTML 块在三引擎保存重开保留全部17个增强属性，普通富文本粘贴不能保留这些增强属性，完整 EXT-01 仍待验收。原生折叠替代旧 hide 的一次性/行内揭示；不要求旧标签语法、class、完整参数或通用离线转换。既有图库专用转换保留其范围，不扩大成其他标签的转换义务。

- **A01 安全嵌入审计与修复**：已盘点脚本、JSON-LD、20项CSS及远端/配置HTML消费者，实际发现并修复CSS标签突破和JS注释/脚本组合破坏HTML边界的问题。复用Halo JSON mapper并保护编码后输出，保留正常CSS的服务端渲染；[最终安全36项限定通过](../validation/2026-10-14/safe-embedding-followup.md)（旧33项的HTML边界证明不足结论已更正）。已转为最终组合和完整合同验收，不将明确允许的注入/已发布HTML宣称已净化。
- **A02 其余平台/上游组成项映射**：已有 Halo 路由/SEO/Prism、构建入口、图片回退和组件模块；同名 Hexo 文件不存在不能直接判作缺失。 逐项确认 404 开关、路由/pretty URL、根路径、站点元数据、高亮提供方、封面类型/独立顶图、加密标记、源文件/目录来源、构建 hook/默认合并/资源图标等语义。尚无足够证据关闭；必须完成来源→消费者→保留用户能力映射后，才转成开发或有依据不适用。

A02 的全部 ID 如下，保留这些未决项，避免只列醒目功能而隐藏长尾：

`config:error_404.enable`, `template:includes/additional-js`, `helper:getArchiveLength`, `helper:groupPosts`, `helper:urlNoIndex`, `lifecycle-hook:scripts/events/404.js#generator:404`, `lifecycle-hook:scripts/events/init.js#filter:before_generate`, `lifecycle-hook:scripts/events/stylus.js#filter:stylus:renderer`, `lifecycle-hook:scripts/events/welcome.js#event:ready`, `lifecycle-hook:scripts/filters/random_cover.js#generator:post`, `asset:source/img/404.jpg`, `asset:source/img/butterfly-icon.png`, `asset:source/img/error-page.png`, `asset:source/img/favicon.ico`, `asset:source/img/friend_404.gif`, `asset:source/js/main.js`, `asset:source/js/utils.js`, `page-data:cover_type`, `page-data:encrypt`, `page-data:full_source`, `page-data:origin`, `page-data:source`, `page-data:top_img`, `site-config:archive_dir`, `site-config:archive_generator`, `site-config:category_dir`, `site-config:copyright`, `site-config:email`, `site-config:favicon`, `site-config:highlight.enable`, `site-config:post_asset_folder`, `site-config:pretty_urls.trailing_html`, `site-config:pretty_urls.trailing_index`, `site-config:prismjs`, `site-config:prismjs.enable`, `site-config:root`, `site-config:syntax_highlighter`, `site-config:tag_dir`, `config:CDN.custom_format`。

[A02局部变量映射核对](a02-mermaid-theme-reconciliation-2026-10-14.json)确认盘点ID `site-config:theme` 实际来自 Mermaid 块级JSON参数，已有对应消费者，已转 implemented-unverified；不再计作缺少站点主题名。其余未决项继续保留。

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

以下按剩余缺失范围和跨平台成本排序；已实现但未满足完整门禁的功能单独继续验收：

| 排名 | 剩余缺口 | 下一步与边界 |
| --- | --- | --- |
| 1 | P01 PWA、离线，RSS/站点地图职责 | 安装、manifest/图标、离线缓存、更新恢复仍未交付完整方案。确认 Halo/插件/主题承担关系，不自行取消。 |
| 2 | P03 评论/公式资源按需 | 主题懒挂载已实现；CommentWidget head 预加载和 KaTeX 全站资源注入需要插件能力或合同决定。 |
| 3 | D02 第三方 PJAX 生命周期 | 核心内容、Share.js/默认Busuanzi/特效、GA4手动模式及默认AddToAny已补；其余SDK宿主/会话生命周期需适配与账户验证，未知页面保留完整导航。 |
| 4 | D03 任意作者图片预扫描前处理 | 颜色/CSS 背景不再是缺口；普通 src/srcset 必须由内容处理层转换，保留无脚本可读回退。 |
| 5 | P02 Umami 私有代理 | 公开只读统计已实现；私有 token 需要服务端承载，不能下发浏览器。 |

D05 的逐页界面语言和全站时区、A02 长尾仍需映射，不能以主题中的近似字段关闭。D04/D06/D07/D08 已转向最终组合和完整验收；真实外部账户、Safari/真机、屏幕阅读器、性能、升级回退、精确提交 CI 与发布决定保持独立门禁。Hexo 专属标签兼容和通用转换不重新进入开发清单。

平台职责已整理为[具体实施提案](PLATFORM-WORK-PROPOSAL.md)，供维护者集中决定；本轮没有据此删除需求或修改其他仓库。

最新组合证据见[集成记录](../validation/2026-10-14/confirmed-gaps-integration.md)：安全36/36、正文27/27、跨功能导航12/12；另有最低Halo2.20.2核心模板/语言限定验证。首页双站317/318、核心页面119/120保留失败，性能预算仍未满足，完整1.0门禁不变。
