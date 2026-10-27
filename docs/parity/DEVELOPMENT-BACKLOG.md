# 1.0 剩余需求（2026-10-26 范围跟进）

**2026-10-26 提示块决定**：按 [通用提示块方案](DEC-02-PORTABLE-NOTES.md)，保留四种语义和浅深色配色，以 CSS 调整外观，不复刻四项旧全局配置。四条转为 implemented-unverified，完整正文合同仍待验收，没有新增 verified。

**2026-10-25 语言决定**：按 [Halo 原生语言方案](DEC-08-NATIVE-LANGUAGE.md)，正文与界面分开，取消作者逐篇强制整页 UI 语言要求。`page-data:lang / language` 转为 implemented-unverified；固定 1eb27c3 包的 [18 个 HTTP / 36 个浏览器例](../validation/2026-10-25/native-language.md)通过，已修复 OG 地区格式，不新增 verified。

**2026-10-25 访问控制决定**：`page.encrypt / page.origin` 按 [Halo 原生权限映射](DEC-08-NATIVE-ACCESS.md)，不兼容 Hexo 密码解密协议。映射已裁定，Post/SinglePage 各 24 次 HTTP/公开 API 检查通过，见[实际记录](../validation/2026-10-25/native-access.md)。两条由 mapping-required 转为 implemented-unverified，完整权限/目录合同待验，未新增 verified。

**2026-10-25 最新范围决定**：维护者将 P3 整组（实际 Safari/手机、完整无障碍/辅助技术、真实外部账户联调）延期到 1.0 之后，版本未定；见 [延期登记](DEC-04-05-P3-DEFERRAL.md)。下文历史未覆盖项保留事实，但上述 P3 不再计作 1.0 阻碍，也不记为通过。继续 P0 剩余用户场景 → P1 原生图片与固定候选性能 → P2 平台/内容映射 → 最终候选集成验收；先不发布。

2026-10-27 后续：[自然到期回收](../validation/2026-10-27/natural-gc.md)已启动，四个生命周期场景仍在计时，尚未通过；[WebKit 独立矩阵](../validation/2026-10-27/webkit-file-transport.md)在新旧引擎和 Node/Bun 均复现恢复 File 的空 multipart，已准备未安装的上游兼容补丁。固定候选为合并后的 `2eb87df`，主题 ZIP 未变，不关闭 P0，也不发布。

2026-10-27 [评论上传补验](../validation/2026-10-27/comment-uploads.md)绑定合并候选 `586a14d`（ZIP 与 `64f5266` 相同）。直接上传的实际功能、WebKit 刷新未提交图片失败、受控 GC 和独立恢复分别记账；完整上传/附件合同仍未关闭，不新增 verified。

2026-10-25 [用户流程补验](../validation/2026-10-25/user-flows.md)补齐评论 Post/Moment/SinglePage 的限定匿名/登录使用与插件停用/恢复，WebKit 默认编辑器公式作者 2/2、四状态阅读 8/8。Post 六个身份为跨批覆盖，Moment/SinglePage 的 UI 与恢复补证分别归属；原失败不改判。本轮定位并修复代码延迟增强引起的原生/PJAX 历史滚动偏移，修复候选原生/PJAX 历史各 12/12 通过，详见同一记录。评论/公式证据属于 `28d6656`；导航修复产品为 `577cc42`，新包不自动继承旧包全量性能通过。

2026-10-24 [组合与性能记录](../validation/2026-10-24/halo-2271-acceptance.md)仍绑定 `28d6656` / ZIP `4b13dd85…`：官方组合 12/12、192/192，性能 160/160 有效、16/16 预算通过。#338 已按官方正式包原范围复验关闭。本轮发现的是延迟增强后的滚动问题，不重新归因于底层协议缺陷；先不发布 1.0。

范围沿用 [1.0 延期决定](DEC-03-1.0-DEFERRALS.md)、[DEC-03 平台补充](DEC-03-PLATFORM-DECISION.md)与 [DEC-02 通用正文补充](DEC-02-PORTABLE-CONTENT.md)。状态真相源仍为 [matrix.json](matrix.json)，完整合同与独立审查未完成前不新增 verified。以下旧候选限定证据保留原归属，未自动迁移为当前候选全量通过。

历史加载/组合失败与作者交互记录保留在 [2026-10-17 索引](../validation/2026-10-17/acceptance-followup.md)及各原始报告；当前推进顺序以本文末尾为准。

## 1. 已确认的开发缺口

| 编号 / 需求 | 已有实现 | 实际剩余 |
| --- | --- | --- |
| D02 / 文章、单页与插件 PJAX | 文章/单页统计身份、官方评论草稿保护、正文图表/图库、Share.js、默认Busuanzi、本地特效和GA4显式手动页面统计已接入；可选组合12/12与GA4协议15/15限定通过。 | AddToAny默认服务持久宿主已实现并限定27/27通过；扩展服务、其他分析/聊天/广告SDK及未知插件生命周期仍缺适配；默认完整导航保留功能，真实GA4账户与完整生态仍待验。最低Halo2.20.2不支持原生tracker停用，已防止重复统计并保留内容页完整导航。[修复候选核心导航](../validation/2026-10-17/lightbox-load-race.md)在全部插件停用、390px 浅色范围下三引擎 42/42、36 次 PJAX、3 次完整导航已补齐；桌面／深色／历史滚动已在[本轮记录](../validation/2026-10-25/user-flows.md)按修复候选单列补证；实际设备、未知插件/SDK 与完整合同仍缺。旧包官方组合 12/12、192/192 保留原归属。原 d678 首批失败继续保留且根因未定，不抵消插件启用时的完整导航边界。 |
| D03 / 图片原生懒加载与背景值域 | CSS 颜色/渐变/background 简写、安全图片 URL 及 footer_img=true 继承已实现。此前原生图片 24/24 的候选与范围见[原记录](../validation/2026-10-15/platform-acceptance.md)；当前合并产品补齐 [blur CSS 生命周期 9/9](../validation/2026-10-16/image-blur-followup.md)及[开关、site/post 范围、刷新对照](../validation/2026-10-16/image-blur-options.md)。 | 接受原生 loading="lazy"，不要求进入视口前零请求。普通作者图片的[初始 HTML 来源映射](../validation/2026-10-16/authored-image-mapping.md)已明确，[编辑入口专项](../validation/2026-10-16/authored-image-editor.md)已补三引擎 HTML/Markdown 块和 Chromium 合成粘贴、文章/单页 API：12 例中 8 例保留、4 例输入限制分开登记；[再次保存与插件读取补证](../validation/2026-10-16/content-editor-followup.md)确认 HTML 块保留属性、Markdown 块内原生 HTML 再次保存后的公开正文丢失部分属性；停用插件仅验证已存 HTML 的读取；[普通图片工具补证](../validation/2026-10-17/image-toolbar-followup.md)已完成三引擎双保存和公开正文采集，2 例属性一致、1 例后续新增宽度，普通入口不自动输出 loading；不能以 JS 后补属性证明初始请求已延迟。[当前包缓存补证](../validation/2026-10-25/images-faults.md)已区分 WebKit 明确缓存事件与 Firefox 对照推断；非原生占位视觉和完整配置覆盖仍未完成；实际 Safari/真机按 P3 延期；原生 blur 不生成低清缩略图。 |
| D04 / 瞬间评论与说说数据 | 原生 Moment 评论主体/计数/跳转/最新评论、作者/头像/时间/标签、输入跳页和独立 JSON 动态源已实现；过滤后分页、时区、错误重试和安全输入已限定验收。 | [旧 d678 官方插件组合](../validation/2026-10-17/combination-followup.md)已完成六例原生导航及评论主体读取；[本轮 Moment](../validation/2026-10-25/user-flows.md) 六例 UI 提交/回复通过；原恢复失败保留，独立修复工具后停用/恢复读取 3+3 自动恢复通过，不将 API 阅读夹具计为 UI 提交。[当前策略补证](../validation/2026-10-25/comment-policies.md)已覆盖审核/私密实际提交及其他配置表面；[算术验证码主表单 18 例](../validation/2026-10-25/comment-captcha.md)已补，开启上传/附件清理与完整合同仍待；全站 timezone 与原生插件每页数量仍保留平台职责，不因动态源参数支持而关闭。 |
| D05 / 国际化 | 七套消息目录及地区回退、模板/浏览器文案与正文语言注解已接入；Halo locale 优先级已有实际证据。 | 界面保持请求 locale，逐页强制 UI 语言要求已由原生方案替代，当前包原生优先级/回退已按 18 个 HTTP / 36 个浏览器例补验；Moment/友链跨语言组合12/12已通过，母语审校和真机/完整合同未完成。 |
| D06 / 作者逐篇覆盖与列表参数 | 逐篇侧栏/代码折叠/版权详细字段、标签排序数量字号、归档年月及菜单标题、受控日期格式已实现；141 项实际 Halo 验收和独立审查通过。 | 固定组合与性能预算已补；完整双站/设备/无障碍及最终 RC 仍待；不实现 Hexo 路由生成器。 |
| D07 / 社交、页脚与友链输入 | 首页/侧栏社交位置与亮暗色、页脚分组列/宽度/净化 HTML、原生友链组说明及独立远端 JSON/组内随机已实现；29 项实际 Halo 检查通过，相对链接审查问题已修复。 | 与国际化/PJAX 组合的重入和待完成请求离页12/12已通过，完整验收继续；不保证旧 Hexo 配置原样兼容或任意 HTML 执行。 |
| D08 / 外部资源连接提示 | 实际所选 HTTPS 资源的 preconnect 已接入 bootstrap、管理资源、Prism、AddToAny 和标题字体，含同源跳过、凭据拒绝、CORS 去重与数量上限。 | 限定真实 Halo 资源配置及独立审查通过；固定候选默认/推荐组合性能预算已通过，最终 RC 继续核验，连接提示不代替资源按需加载。 |

## 2. 平台能力与延期边界

RSS/站点地图与现有评论/公式用户能力保留在 1.0；下表明确区分延期部分。PWA/离线另列延期。

| 编号 / 需求 | 已有实现 | 下一步 |
| --- | --- | --- |
| P01 / RSS 与站点地图 | 已接入官方 Feed 1.5.0 `/rss.xml` 与 Sitemap 1.3.0 `/sitemap.xml`，主题提供 head/页脚入口、独立开关和版本/启用检查。匿名 HTTP 11 阶段及实际卸载/重装 4 阶段通过。 | [当前包补证](../validation/2026-10-17/rss-sitemap-followup.md)已完成 11 个 HTTP、4 个 reader 库和 4 个真实卸载／重装阶段；旧浏览器记录保留原候选归属。其他插件版本、GUI 阅读器、已有订阅转私密后再刷新及完整 1.0 门禁未覆盖，不再将 reader 库订阅列为未验。 |
| P02 / Umami 私有统计后端（延期） | 访问追踪和可选公开只读 site_uv/site_pv/page_pv 接口已接入，保持其安全与回退验收。 | 私有凭据代理和认证报表读取移出 1.0，版本与承载未定；两个 token 项延期，不擅自另建服务或把 token 放入公开页面。 |
| P03 / 评论/公式用户能力与官方兼容 | 评论延迟挂载、重试、草稿和公式阅读/复制/控制已有实现；[评论真实使用](../validation/2026-10-17/comment-usage-followup.md)严格 2/6、功能检查点 5/6，停用/恢复读取 3+3；[默认编辑器公式](../validation/2026-10-17/math-editor-followup.md)C/F 作者 4/4、前台四状态 16/16。 | [Halo 2.27.1 补证](../validation/2026-10-25/user-flows.md)已覆盖 Post 六身份（跨批）、Moment/SinglePage 各六例 UI，三主体插件停用/恢复读取补证完成；旧失败和恢复边界保留。WebKit 默认编辑器行内/块级作者 2/2、四状态阅读 8/8 通过。[策略补证](../validation/2026-10-25/comment-policies.md)已覆盖审核/私密实际提交、成员权限等 138 项；算术验证码主表单已补；[图片上传补证](../validation/2026-10-27/comment-uploads.md)保留 WebKit 未提交图片刷新与附件 GC 边界，其他编辑器及完整 PLG-03/06、EXT-02 继续验收；真实剪贴板/设备按 P3 延期。已完成的限定生命周期不再整体列待验。官方资源语义保持：CommentWidget head 预加载、KaTeX 全站注入未改；严格资源按需延期，不改上游或安装定制插件，不提高主题最低 Halo 版本，详见[资源调查](PLUGIN-RESOURCE-FOLLOWUP.md)。 |

依据：[评论资源边界](../COMMENT-ENHANCEMENTS.md)、[KaTeX 边界](../MATH.md)、[DEC-03](DEC-03-RESOURCES-DECISION.md)、[1.0 合同](../RELEASE-ACCEPTANCE.md)。

## 3. 待映射/审计，不直接计为“缺代码”

- **D01 通用正文能力映射与可移植性验收**：PR #408 的提示、Tabs、原生折叠、按钮、时间线和静态卡片已有实现。Note 外观已按通用提示块方案裁定；行内标记/图片还需核对通用能力映射；无脚本/增强失败和切换 Earth 阅读已有限定证据；[真实编辑器验收](../validation/2026-10-14/content-editor.md)已确认官方 HTML 块在三引擎保存重开保留全部17个增强属性，普通富文本粘贴不能保留这些增强属性，完整 EXT-01 仍待验收。原生折叠替代旧 hide 的一次性/行内揭示；不要求旧标签语法、class、完整参数或通用离线转换。既有图库专用转换保留其范围，不扩大成其他标签的转换义务。

- **A01 安全嵌入审计与修复**：已盘点脚本、JSON-LD、20项CSS及远端/配置HTML消费者，实际发现并修复CSS标签突破和JS注释/脚本组合破坏HTML边界的问题。复用Halo JSON mapper并保护编码后输出，保留正常CSS的服务端渲染；[最终安全36项限定通过](../validation/2026-10-14/safe-embedding-followup.md)（旧33项的HTML边界证明不足结论已更正）。已转为最终组合和完整合同验收，不将明确允许的注入/已发布HTML宣称已净化。
- **A02 其余平台/上游组成项映射**：已有 Halo 路由/SEO/Prism、构建入口、图片回退和组件模块；同名 Hexo 文件不存在不能直接判作缺失。 逐项确认 404 开关、路由/pretty URL、根路径、站点元数据、高亮提供方、封面类型/独立顶图、加密标记、源文件/目录来源、构建 hook/默认合并/资源图标等语义。尚无足够证据关闭；必须完成来源→消费者→保留用户能力映射后，才转成开发或有依据不适用。

A02 的全部 ID 如下，保留这些未决项，避免只列醒目功能而隐藏长尾：

`config:error_404.enable`, `template:includes/additional-js`, `helper:getArchiveLength`, `helper:urlNoIndex`, `lifecycle-hook:scripts/events/404.js#generator:404`, `lifecycle-hook:scripts/events/init.js#filter:before_generate`, `lifecycle-hook:scripts/events/stylus.js#filter:stylus:renderer`, `lifecycle-hook:scripts/events/welcome.js#event:ready`, `lifecycle-hook:scripts/filters/random_cover.js#generator:post`, `asset:source/img/404.jpg`, `asset:source/img/butterfly-icon.png`, `asset:source/img/error-page.png`, `asset:source/img/favicon.ico`, `asset:source/img/friend_404.gif`, `asset:source/js/main.js`, `asset:source/js/utils.js`, `page-data:cover_type`, `site-config:archive_dir`, `site-config:archive_generator`, `site-config:category_dir`, `site-config:copyright`, `site-config:email`, `site-config:favicon`, `site-config:highlight.enable`, `site-config:post_asset_folder`, `site-config:pretty_urls.trailing_html`, `site-config:pretty_urls.trailing_index`, `site-config:prismjs`, `site-config:prismjs.enable`, `site-config:root`, `site-config:syntax_highlighter`, `site-config:tag_dir`。

[A02局部变量映射核对](a02-mermaid-theme-reconciliation-2026-10-14.json)确认盘点ID `site-config:theme` 实际来自 Mermaid 块级JSON参数，已有对应消费者，已转 implemented-unverified；不再计作缺少站点主题名。其余未决项继续保留。

已在 [DEC-08 正式登记](DEC-08-CONFIG-DEFAULTS.md)归档既有配置决定；`CDN.custom_format` 按根地址/单项 URL 替代能力转 implemented-unverified。A01 `interaction:data-safe` 依据已有 36 项限定记录纠正滞后状态，未新增当前包运行通过。

固定上游核对确认 `helper:groupPosts` 的唯一调用者为已延期的侧栏系列模板，按同一 DEC-02 补齐遗漏追踪项；13 条系列延期、总延期 23 条，适用分母 690。来源哈希与状态变更见[对账记录](a02-reconciliation-2026-10-25.json)。`page-data:source / top_img` 已核对为原生控制台编辑入口 / 原生封面与显示三态，按既有决定转 implemented-unverified；[消费者与源码哈希](a02-native-content-2026-10-25.json)保留原独立字段差异，未新增运行通过。

`page-data:full_source` 的唯一消费者为 Hexo 说说渲染临时对象，已按既有原生瞬间/纯文本与 HTML 动态源决定完成[来源映射](a02-full-source-2026-10-25.json)，转 implemented-unverified；没有新增运行通过。

## 4. 已实现，后续以验收为主

首页 1–7 布局、顶图、侧栏/外观、阅读分享统计、SEO/注入、分析/聊天/广告、正文图库、Mermaid/Chart.js/ABC 乐谱、可移植正文增强、评论懒挂载、统一资源地址与 Pace 已合并。上面单列的参数/资源缺口不能因此略过，但这些模块不应整体重新立项开发。

- 固定双站、逐值/组合、插件生命周期与真实外部服务联调。
- Safari、真实手机、屏幕阅读器、无障碍、最终包性能预算。
- 最终候选安装/升级/回退、精确提交独立审查、CI 与发布证据。
- 首页、文章、单页、归档、标签五类历史失败保留原候选归属；当前候选在官方 Halo 2.27.1 上完成三引擎各 40 页核心检查，五条矩阵项回到 implemented-unverified，完整合同与独立审查仍待。#338 正式包协议与历史矩阵复验已关闭；当前补证见 [本轮记录](../validation/2026-10-24/halo-2271-acceptance.md)，不把全部历史失败归于同一原因。
- 公开反馈和正式 1.0 的维护者确认。

## 5. 已延期或已裁定替代

8 条 PWA/离线相关项按 DEC-03 平台补充延期到 1.0 之后，`blocked` / `phase=post-1.0`，目标版本与是否实施待评估，不自动排入 1.1。13 条系列活数据/侧栏系列相关项按既有 DEC-02 延至 1.1；1.0 保留通用 HTML 静态系列能力，通用离线转换不再是默认义务。184 条不适用保持原裁定，不恢复第三方搜索/评论 SDK、MathJax 或 DEC-03 已退出的独立资源提供方。新增 2 条 Umami 私有凭据项延期（post-1.0、版本未定）；评论/KaTeX 只延期严格资源子要求，混合条目仍留在 1.0。23 条延期单列；当前适用矩阵分母为 690，RSS/站点地图的 PLG-07 合同场景仍为必需。0 条新改为 verified。

## 已确认推进顺序

PR #429 独立审查发现的验收工具缺口与加严复验见[审查记录](../validation/2026-10-25/pr429-review.md)。后续按下表补剩余范围；先不发布 1.0。历史“等待 Halo 官方修复”已被 2.27.1 正式包复验取代，主题和官方插件兼容要求、原始超时与预算均不变。

| 优先级 | 剩余工作 | 已完成与边界 |
| --- | --- | --- |
| P0 / P2a | 上传草稿刷新、完整附件回收及完整 PLG-03/06、EXT-02/03 | Post/Moment/SinglePage 限定 UI 与生命周期、138 项策略、三主体算术验证码主表单 18 例、WebKit 默认编辑器作者已补；原生/PJAX 历史修复结果见[本轮证据](../validation/2026-10-25/user-flows.md)。原始失败、跨批和恢复语义分别保留。 |
| P1 | 原生图片剩余配置、初始 HTML 与缓存来源；本地固定机当前包性能验收 | `64f5266` 首页文字直接显示修复后，80/80 新候选样本有效，与本轮 80 个基线严格配对，绝对/回归/体积预算各 16/16 通过；旧包超标保留，[最新记录](../validation/2026-10-25/performance-hero.md)。故障与按需控制保留各自包归属。维护者确认先完成本地固定机验收，固定执行机 CI 接入单列待办；仓库当前无自托管 runner。 |
| P2b | A02 平台长尾映射、全站时区、其他编辑器与内容可移植性 | 访问控制及正文/UI 语言的原生方案已裁定并限定补验；配置决定登记完成。RSS/图片入口等旧候选证据保留，其他映射和完整合同继续补证。 |
| 最终 | 当前候选安装/升级/回退、全量适用合同映射、精确 CI 与独立审查 | P3 整组已移出 1.0；无头引擎/手机视口仍不冒充真机。局部组合/性能通过不构成发布决定。 |

PWA/离线、Umami 私有统计、评论/KaTeX 严格零资源按需仍延期；不恢复 Hexo 专属标签/通用转换义务，不扩大主题最低 Halo 版本。
