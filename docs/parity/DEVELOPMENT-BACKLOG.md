# 1.0 剩余需求（2026-10-16 验收跟进；范围沿用 2026-10-15 裁定）

基准：PR #416 已合并主线 [`f4ecc75`](https://github.com/songxychn/halo-butterfly-next/commit/f4ecc75d46651cd8a2f3188799ae27737dfdfd36)，叠加维护者确认的 [1.0 延期决定](DEC-03-1.0-DEFERRALS.md)与 [DEC-03 平台补充](DEC-03-PLATFORM-DECISION.md)；[DEC-02 通用正文补充](DEC-02-PORTABLE-CONTENT.md)继续有效。本清单按用户能力归并；状态真相源为 [matrix.json](matrix.json)，最新归组见[机器清单](development-backlog-2026-10-15.json)。历史记录保留原提交与范围，本次范围与状态修订见[机器记录](scope-deferrals-reconciliation-2026-10-15.json)。

当前受测产品已推进到 PR #417 合并提交 [`d678d3f`](https://github.com/songxychn/halo-butterfly-next/commit/d678d3f839347554d7f100996f87b23b571888df)，ZIP `93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e`。2026-10-16 的工具和证据更新不改变延期范围、预算或矩阵状态；合并产品的[精确 CI 与两处独立构建](../validation/2026-10-16/build-reproducibility.md)已核对，完整 1.0 仍未通过。

**既有开发进展：D04/D06/D07/D08 的已确认代码缺口已补齐，D05 国际化主体已实现，D02 已覆盖核心内容与官方评论，D03 已补背景值域。** 完整 1.0 验收仍未完成。本轮依次推进 P0 页面加载可靠性、P1 性能/原生图片、P2 已实现组合/平台映射和最终完整验收。RSS/站点地图已实现，转剩余验收；评论/KaTeX 严格资源按需、Umami 私有统计及 PWA/离线均延期到 1.0 之后（版本未定）。评论、公式与 Umami 追踪继续验收并保持官方兼容。源码状态与限定证据见[本轮对账](confirmed-gap-reconciliation-2026-10-14.json)，不将测试通过自动记为 `verified`。

## 1. 已确认的开发缺口

| 编号 / 需求 | 已有实现 | 实际剩余 |
| --- | --- | --- |
| D02 / 文章、单页与插件 PJAX | 文章/单页统计身份、官方评论草稿保护、正文图表/图库、Share.js、默认Busuanzi、本地特效和GA4显式手动页面统计已接入；可选组合12/12与GA4协议15/15限定通过。 | AddToAny默认服务持久宿主已实现并限定27/27通过；扩展服务、其他分析/聊天/广告SDK及未知插件生命周期仍缺适配；默认完整导航保留功能，真实GA4账户与完整生态仍待验。最低Halo2.20.2不支持原生tracker停用，已防止重复统计并保留内容页完整导航。 |
| D03 / 图片原生懒加载与背景值域 | CSS 颜色/渐变/background 简写、安全图片 URL 及 footer_img=true 继承已实现。此前原生图片 24/24 的候选与范围见[原记录](../validation/2026-10-15/platform-acceptance.md)；当前合并产品补齐 [blur CSS 生命周期 9/9](../validation/2026-10-16/image-blur-followup.md)及[开关、site/post 范围、刷新对照](../validation/2026-10-16/image-blur-options.md)。 | 接受原生 loading="lazy"，不要求进入视口前零请求。普通作者图片的[初始 HTML 来源映射](../validation/2026-10-16/authored-image-mapping.md)已明确，仍缺编辑入口属性保留矩阵；不能以 JS 后补属性证明初始请求已延迟。Firefox/WebKit 缓存来源证据不足、非原生占位视觉、完整配置覆盖与实际 Safari/真机仍未完成；原生 blur 不生成低清缩略图。 |
| D04 / 瞬间评论与说说数据 | 原生 Moment 评论主体/计数/跳转/最新评论、作者/头像/时间/标签、输入跳页和独立 JSON 动态源已实现；过滤后分页、时区、错误重试和安全输入已限定验收。 | 完整插件组合/设备验收待执行；全站 timezone 与原生插件每页数量仍保留平台职责，不因动态源参数支持而关闭。 |
| D05 / 国际化 | 七套消息目录及地区回退、模板/浏览器文案与正文语言注解已接入；Halo locale 优先级已有实际证据。 | 界面保持请求 locale，逐页强制 UI 语言仍待合同映射；Moment/友链跨语言组合12/12已通过，母语审校和真机/完整合同未完成。 |
| D06 / 作者逐篇覆盖与列表参数 | 逐篇侧栏/代码折叠/版权详细字段、标签排序数量字号、归档年月及菜单标题、受控日期格式已实现；141 项实际 Halo 验收和独立审查通过。 | 最终组合回归、完整双站/设备/无障碍与性能门禁仍待；不实现 Hexo 路由生成器。 |
| D07 / 社交、页脚与友链输入 | 首页/侧栏社交位置与亮暗色、页脚分组列/宽度/净化 HTML、原生友链组说明及独立远端 JSON/组内随机已实现；29 项实际 Halo 检查通过，相对链接审查问题已修复。 | 与国际化/PJAX 组合的重入和待完成请求离页12/12已通过，完整验收继续；不保证旧 Hexo 配置原样兼容或任意 HTML 执行。 |
| D08 / 外部资源连接提示 | 实际所选 HTTPS 资源的 preconnect 已接入 bootstrap、管理资源、Prism、AddToAny 和标题字体，含同源跳过、凭据拒绝、CORS 去重与数量上限。 | 限定真实 Halo 资源配置及独立审查通过；最终组合性能预算仍待，连接提示不代替资源按需加载。 |

## 2. 平台能力与延期边界

RSS/站点地图与现有评论/公式用户能力保留在 1.0；下表明确区分延期部分。PWA/离线另列延期。

| 编号 / 需求 | 已有实现 | 下一步 |
| --- | --- | --- |
| P01 / RSS 与站点地图 | 已接入官方 Feed 1.5.0 `/rss.xml` 与 Sitemap 1.3.0 `/sitemap.xml`，主题提供 head/页脚入口、独立开关和版本/启用检查。匿名 HTTP 11 阶段及实际卸载/重装 4 阶段通过。 | [接入说明](../RSS-SITEMAP.md)与[本轮验收](../validation/2026-10-15/platform-acceptance.md)分别登记浏览器、隐私、更新与生命周期证据；旧版插件、实际阅读器和完整 1.0 门禁未自动通过。 |
| P02 / Umami 私有统计后端（延期） | 访问追踪和可选公开只读 site_uv/site_pv/page_pv 接口已接入，保持其安全与回退验收。 | 私有凭据代理和认证报表读取移出 1.0，版本与承载未定；两个 token 项延期，不擅自另建服务或把 token 放入公开页面。 |
| P03 / 评论/公式用户能力与官方兼容 | 评论接近视口时挂载、失败重试，KaTeX 阅读/复制/显示控制已有实现；已完成[官方插件能力与最小后续范围调查](PLUGIN-RESOURCE-FOLLOWUP.md)。 | CommentWidget head 预加载未取消；KaTeX 全站注入不受主题显示开关控制。当前官方接口没有所需能力；不提交本次上游功能改造或强制安装定制插件。最新 CommentWidget 3.4.0 自身要求 Halo >=2.27.0，不提升主题最低版本。严格资源按需移出 1.0，版本未定；现有延迟挂载/数据、公式阅读/复制/控制、MathML 与插件生命周期继续验收，不将整条能力延期。 |

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
- 保留首页、文章、单页、归档、标签五类失败状态；[#338](https://github.com/songxychn/halo-butterfly-next/issues/338) 需在包含正式修复的 Halo 上复验，不能用局部通过抵消。2026-10-16 [协议与原核心运行器复核](../validation/2026-10-16/loading-followup.md)：队列第三响应 0/3、顺序控制 3/3；此前 Firefox 核心场景 40/40、750 响应，彼时报告因缺两引擎为 incomplete；随后[独立完整核心批次](../validation/2026-10-16/core-browser-followup.md)三引擎 120/120、环境前后稳定，早一批准备失败的 120/120 仅保留为诊断。底层缺陷存在与浏览器本次未复现分别登记，不把全部历史失败归于同一根因；最新已核对正式 Halo 仍未包含完整修复。
- 公开反馈和正式 1.0 的维护者确认。

## 5. 已延期或已裁定替代

8 条 PWA/离线相关项按 DEC-03 平台补充延期到 1.0 之后，`blocked` / `phase=post-1.0`，目标版本与是否实施待评估，不自动排入 1.1。12 条系列活数据/侧栏系列相关项按既有 DEC-02 延至 1.1；1.0 保留通用 HTML 静态系列能力，通用离线转换不再是默认义务。184 条不适用保持原裁定，不恢复第三方搜索/评论 SDK、MathJax 或 DEC-03 已退出的独立资源提供方。新增 2 条 Umami 私有凭据项延期（post-1.0、版本未定）；评论/KaTeX 只延期严格资源子要求，混合条目仍留在 1.0。22 条延期单列；当前适用矩阵分母为 691，RSS/站点地图的 PLG-07 合同场景仍为必需。0 条新改为 verified。

## 已确认推进顺序

维护者已于 2026-10-15 确认以下新顺序，详见[延期决定](DEC-03-1.0-DEFERRALS.md)：

| 优先级 | 剩余工作 | 下一步与边界 |
| --- | --- | --- |
| P0 | 页面加载可靠性 | 当前合并产品的正式性能候选 70/80 有效；优先推荐图库（2/10 有效）、长文和公共页的图片/字体停滞，再对账历史首页/文章/单页/归档/标签失败。结合浏览器与服务端证据，不以加超时或一次重跑关闭；见[本轮汇总](../validation/2026-10-16/acceptance-followup.md)。 |
| P1 | 性能与原生图片 | 常用图标字体子集已完成：固定候选在默认手机配置下首页/长文 LCP 中位数降至 2.03s/2.03s，见[限定测量](../validation/2026-10-15/loading-performance-next.md)。继续阻塞 CSS/脚本及图片初始 HTML/正文加载、响应式图片、首屏例外、blur 和无脚本回退；本轮同站基线/候选正式 160 次得到 142 个有效样本，候选 12/16 预算组合及双方 9/16 配对组合达标，其余缺口保留；完整性能门禁仍未完成。 |
| P2 | 已实现组合与平台映射 | PJAX、评论/公式、瞬间、友链、国际化与正文/平台长尾；RSS/站点地图按 PLG-07 完成剩余验收。 |
| 最终 | 完整候选验收 | 固定候选完成全部合同门禁、独立审查、CI 和发行准备，不合并不同候选的通过结果。 |

D02 默认服务之外的 SDK 与真实账户边界仍保留；未知 SDK 使用可靠完整导航。PWA/离线、Umami 私有统计与评论/KaTeX 严格资源懒加载不进入本轮 1.0 开发队列，后续版本未定。

D05 的逐页界面语言和全站时区、A02 长尾仍需映射，不能以主题中的近似字段关闭。D04/D06/D07/D08 已转向最终组合和完整验收；真实外部账户、Safari/真机、屏幕阅读器、性能、升级回退、精确提交 CI 与发布决定保持独立门禁。Hexo 专属标签兼容和通用转换不重新进入开发清单。

平台职责与本次批准范围见[实施提案](PLATFORM-WORK-PROPOSAL.md)；其他仓库修改、生产操作与正式发行仍需相应授权，必要审批集中留到最后。

最新组合证据见[集成记录](../validation/2026-10-14/confirmed-gaps-integration.md)：安全36/36、正文27/27、跨功能导航12/12；另有最低Halo2.20.2核心模板/语言限定验证。首页双站317/318、核心页面119/120保留失败，性能预算仍未满足，完整1.0门禁不变。
