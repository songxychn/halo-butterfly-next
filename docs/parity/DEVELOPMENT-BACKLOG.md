# 1.0 剩余开发需求（2026-10-14 主线对账）

基准：最新主线 [`44621d24914e`](https://github.com/songxychn/halo-butterfly-next/commit/44621d24914edea94a242350562af68870cf5b69)（已合并 #411）。本清单按用户能力归并，不把配置、模板、资源、helper 的重复追踪当成独立功能。状态真相源仍是 [matrix.json](matrix.json)，逐项更正见[对账报告](RECONCILIATION-2026-10-14.md)，完整 ID 归组见[机器清单](development-backlog-2026-10-14.json)。

**结论：基础页面和近期大批功能已有实现；剩余主要是正文迁移/参数、全页面导航、瞬间、多语言、少量作者配置，以及平台职责与完整验收。** 不能把所有 `implemented-unverified` 直接当作只剩测试，其中仍可能有明确参数缺口。

## 1. 已确认的开发缺口

| 编号 / 需求 | 已有实现 | 实际剩余 |
| --- | --- | --- |
| D01 / 正文扩展参数与离线迁移 | 可移植 HTML 的 Note、Tabs、折叠、按钮、时间线、静态系列/友链可用；图库和图表/乐谱已接入。 | 补 label/inlineImg 的实际 DOM 适配、Note 四项配置、旧标签参数与 hide 行为差异；完成图库之外的 Hexo 标签离线转换。新写法可用不代表旧标签全域兼容。 |
| D02 / 文章、单页与插件 PJAX | 列表 PJAX、预取、清理、历史、资源地址及 Pace 已实现。 | 补 Halo tracker 的内容身份/清理协议和插件/第三方 SDK 生命周期；当前这些页面完整导航是明确回退，不是完整 PJAX 已完成。 |
| D03 / 图片延迟处理与背景值域 | 主题图片与显式 data-lazy-src 延迟加载可用，URL 背景及错误回退可用，页脚遮罩已接入。 | 任意作者 HTML 的 src/srcset 在脚本前可能发请求；补内容处理映射。背景仍缺完整颜色/CSS 输入，footer_img=true 尚不复用顶图。候选封面支持颜色不等于所有背景入口支持。 |
| D04 / 瞬间评论与说说数据 | Moments 内容、媒体、原生分页可用；文章/单页评论与懒挂载已完成接入。 | 补 Moment 评论主体、计数/跳转与最新评论覆盖；补说说 author/avatar/date/tags/key、远端输入、num/date 限制和时区映射；输入跳页尚无，上游每页数量与插件设置的差异需确定。 |
| D05 / 国际化 | html lang/OG locale 读取 Halo locale，简繁转换可用。 | 主题仍有固定中文文案，缺完整消息键/七套语言映射；逐页语言覆盖尚未接入。不能把字形转换当成日/韩/英语等国际化。 |
| D06 / 作者逐篇覆盖与列表参数 | 已有全局侧栏、全局代码折叠、逐篇版权/过期提醒开关、全局版权详细配置、标签颜色/字号及 date/relative 模式。 | 缺逐篇 aside/highlight_shrink、逐篇版权详细字段；标签云完整排序/数量/字号参数还需映射，归档年/月/菜单标题尚无，任意站点日期格式未接入。 |
| D07 / 社交、页脚与友链输入 | 社交名称/图标/链接、扁平页脚导航、页脚纯文本、Links 基础组/卡片与正文静态卡片可用。 | 缺完整 header 社交位置/逐项颜色、页脚嵌套列/宽度/HTML、友链完整组说明/远端输入/随机顺序。不得从基础卡片存在推断完整上游数据模型完成。 |
| D08 / 外部资源连接提示 | 按需脚本、资源覆盖和 prefetch 可用。 | head 尚无按实际资源主机输出的统一 preconnect；需确定连接提示条件，prefetch 不替代此能力。 |

## 2. 先确定平台职责的需求

这些能力仍保留在 1.0 范围；未擅自裁定不适用、延期或缩减。

| 编号 / 需求 | 已有实现 | 下一步 |
| --- | --- | --- |
| P01 / PWA、离线、RSS 与站点地图 | PWA 第一阶段旧 PR 未合并；当前主线未交付完整安装/离线能力。DEC-03 已处理资源供应部分。 | PWA 安装入口、manifest/图标、离线缓存与更新恢复待实现；RSS/站点地图在合同 DEC-03 保留，先确定 Halo/插件/主题职责与成功条件。不能自动删除或延期。 |
| P02 / Umami 私有统计后端 | SDK 和公开只读 site_uv/site_pv/page_pv 接口已接入。 | 缺持有私有凭据的服务端代理；两项 token 属于同一需求。需确定后端承载，不把 token 放入公开页面。 |
| P03 / 评论/公式资源按需加载 | 评论接近视口时挂载、失败重试，KaTeX 阅读/复制/显示控制已有实现。 | CommentWidget head 预加载未取消；KaTeX 全站注入不受主题显示开关控制。需要插件侧能力或明确合同裁定，当前不满足首屏零评论资源/无公式页按需资源目标。 |

依据：[评论资源边界](../COMMENT-ENHANCEMENTS.md)、[KaTeX 边界](../MATH.md)、[DEC-03](DEC-03-RESOURCES-DECISION.md)、[1.0 合同](../RELEASE-ACCEPTANCE.md)。

## 3. 待映射/审计，不直接计为“缺代码”

- **A01 安全嵌入完整审计**：Thymeleaf 配置序列化与 JSON-LD 脚本边界转义已有实现。 补所有消费者和失败输入的清单/断言；当前是审计覆盖不足，不等于已确认漏洞，也不是重写一套序列化。
- **A02 其余平台/上游组成项映射**：已有 Halo 路由/SEO/Prism、构建入口、图片回退和组件模块；同名 Hexo 文件不存在不能直接判作缺失。 逐项确认 404 开关、路由/pretty URL、根路径、站点元数据、高亮提供方、封面类型/独立顶图、加密标记、源文件/目录来源、构建 hook/默认合并/资源图标等语义。尚无足够证据关闭；必须完成来源→消费者→保留用户能力映射后，才转成开发或有依据不适用。

A02 的全部 ID 如下，保留这些未决项，避免只列醒目功能而隐藏长尾：

`config:error_404.enable`, `template:includes/additional-js`, `helper:getArchiveLength`, `helper:groupPosts`, `helper:urlNoIndex`, `lifecycle-hook:scripts/events/404.js#generator:404`, `lifecycle-hook:scripts/events/init.js#filter:before_generate`, `lifecycle-hook:scripts/events/stylus.js#filter:stylus:renderer`, `lifecycle-hook:scripts/events/welcome.js#event:ready`, `lifecycle-hook:scripts/filters/random_cover.js#generator:post`, `asset:source/img/404.jpg`, `asset:source/img/butterfly-icon.png`, `asset:source/img/error-page.png`, `asset:source/img/favicon.ico`, `asset:source/img/friend_404.gif`, `asset:source/js/main.js`, `asset:source/js/utils.js`, `page-data:cover_type`, `page-data:encrypt`, `page-data:full_source`, `page-data:origin`, `page-data:source`, `page-data:top_img`, `site-config:archive_dir`, `site-config:archive_generator`, `site-config:category_dir`, `site-config:copyright`, `site-config:email`, `site-config:favicon`, `site-config:highlight.enable`, `site-config:post_asset_folder`, `site-config:pretty_urls.trailing_html`, `site-config:pretty_urls.trailing_index`, `site-config:prismjs`, `site-config:prismjs.enable`, `site-config:root`, `site-config:syntax_highlighter`, `site-config:tag_dir`, `site-config:theme`。

其中 `helper:groupPosts` 与系列活数据有关，但本次未新加延期裁定；应复核 DEC-02 的具体消费者后同步该追踪项。`page-data:top_img` 保留原生封面方案与原独立字段的差异，不建议重新添加已明确不采用的独立文章顶图字段。

## 4. 已实现，后续以验收为主

首页 1–7 布局、顶图、侧栏/外观、阅读分享统计、SEO/注入、分析/聊天/广告、正文图库、Mermaid/Chart.js/ABC 乐谱、可移植正文增强、评论懒挂载、统一资源地址与 Pace 已合并。上面单列的参数/资源缺口不能因此略过，但这些模块不应整体重新立项开发。

- 固定双站、逐值/组合、插件生命周期与真实外部服务联调。
- Safari、真实手机、屏幕阅读器、无障碍、最终包性能预算。
- 最终候选安装/升级/回退、精确提交独立审查、CI 与发布证据。
- 保留首页、文章、单页、归档、标签五类失败状态；[#338](https://github.com/songxychn/halo-butterfly-next/issues/338) 需在包含正式修复的 Halo 上复验，不能用局部通过抵消。
- 公开反馈和正式 1.0 的维护者确认。

## 5. 已延期或已裁定替代

12 条系列活数据/侧栏系列相关项按既有 DEC-02 延至 1.1；1.0 静态系列输入和离线转换仍保留。184 条不适用保持原裁定，不恢复第三方搜索/评论 SDK、MathJax 或 DEC-03 已退出的独立资源提供方。0 条新改为 verified。

## 建议推进顺序

先处理 D01 正文参数/转换与 D04 瞬间，再推进 D02 导航兼容；并行于普通开发流程明确 P01–P03 的平台职责。D03、D05–D08 按独立功能切分，A02 应先明确消费者再排开发。以上是工作排序建议，本次只交付对账文档，没有启动这些功能开发。
