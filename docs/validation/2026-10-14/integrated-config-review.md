# 集成配置审查与 A02 只读核对

审查者：`/root/moments`。审查范围：根工作区 `7582e3f..3624b5128fdfc2ea15f50a0a406de414a4ebf45b`，重点为A01与既有D05/D06字段的合并。当前安全构建器的作者也是本审查者，因此此记录仅为**合并组合审查**，不冒充自身A01实现的独立审查；A01编码链另由 `/root/pjax` 独立审查，根任务负责最终组合真实Halo。

## 组合结论

- `views/config.html` 保留国际化消息表、D06配置项，以及CSS的 `--message-pinned` / `--message-gallery-js`；20项CSS配置与cssSafe索引一致，没有以JS初始化替代原SSR。
- 全部35份HTML经最终safeInlineData在内存处理：15个内联JavaScript块、437个数据表达式，未发现裸插值或保留绑定冲突。该路径包含新增消息、逐篇字段、MainApp.data与全局配置；没有只保护baseScript而遗漏pageScript。
- `components.html` / `body-renderers.html` 的逐篇作用域仍在原fragment上下文；构建器仅追加script局部mapper，不移动作用域或覆盖配置优先级。
- `layout.html` 的contentLanguage/uiLanguage分工与原有日期格式校验保留。消息作为平台编码的JSON字符串恢复；本次没有改为innerHTML消费。
- Lighthouse zh-CN→zh为固定13.4.1支持locale规范化；没有放宽其他固定设置验证。根目录只读运行 i18n/listing-options/perf 三组测试，20/0，日志 `/private/tmp/a01-root-integration-review-tests.log`。
- 审查中补查实际发现的A01特殊键丢失与模板预解码问题已独立修复，见[后续36项](safe-embedding-followup.md)。该根快照仍需集成该修复，不对旧A01快照出具安全通过结论。

除已报告并修复的A01边界问题，未发现配置合并新增阻断。没有在此把静态审查等同最终候选验收。

## A02：已实现能力不应作为整块新开发

上游核对来源为本地固定Butterfly `f223b1888b42b2b336068e6c959ed90a3cd7c8f3`（5.7.0）。以下只给证据与建议，不改矩阵、不新加裁定、不自动NA。

| 项目 | 来源→当前消费者证据 | 建议与保留差异 |
| --- | --- | --- |
| `template:includes/additional-js`、`asset:source/js/main.js` / `utils.js` | 上游additional-js加载main/utils并条件加载正文、评论、特效等；当前 `scripts/build.mjs` 产生页面入口，`views/layout.html` 尾部引用页面入口、integrations/inject，`src/js/common`与各core模块承担同类消费。 | 不是缺少整套JS入口；归为聚合映射/验收项。子项评论/公式资源按需、外部SDK生命周期仍独立保留，不因入口存在全关闭。 |
| `helper:getArchiveLength` | 上游helper按年/月/日+archive_generator统计；当前 `archives.html` 使用Halo `archives.total` 渲染文章总览、原生年月分组及分页。 | 总数与原生归档已实现，不应重新开发归档模块；日归档与可配置generator行为没有等价证据，须分清具体差异。 |
| `helper:groupPosts` | 上游 `scripts/helpers/series.js` 只消费预建_seriesGroups，唯一查得模板消费者为 `includes/widget/card_post_series.pug`。 | 与已登记DEC-02系列活数据范围直接相关，建议复核原裁定边界后同步追踪；本次不新增延期裁定。 |
| `lifecycle-hook:...random_cover.js#generator:post` | 上游hook兼有封面类型识别、资源相对路径、随机历史避重与前后文；当前 `layout.html` 过滤default_cover_list，components/archives按文章稳定hash选封面，image-loading处理失败回退。 | 默认封面选取已实现；不等于上游随机避近邻、目录相对资源与cover_type全覆盖，不能整体标完成。 |
| 图片资产404/error-page/friend_404/butterfly-icon | 当前error/404.html有配图、首页背景/内置above.svg回退，components数据属性+image-loading对友链和正文失败图回退；矩阵error_404.background已记当前替代。 | 不要为同名上游素材缺失重新开发404或图片回退系统；精确素材替代、默认头像/图标需来源和消费者对账后登记。 |
| `site-config:prismjs` / `prismjs.enable`、`highlight.enable`、`syntax_highlighter` | 当前components代码fragment提供Prism资源/主题/逐篇折叠设置；prism-ready条件增强、首屏后加载、失败保留原始代码；已有固定本地Prism包。 | Prism高亮不是未开发整块功能；关闭高亮及不同provider的配置契约仍应逐项映射，不以Prism存在代替全部开关。 |
| `config:CDN.custom_format` | `docs/RESOURCE-SOURCES.md` 明确统一asset_base+单项URL优先，不再读旧custom_format；已有DEC-08记录。 | 保持原已接受替代方向，缺口是正式登记/验收，不恢复旧模板字符串。 |
| `page-data:top_img` | 当前layout明确原生文章/单页cover优先、逐篇top_img_enable覆盖、其他页背景和全局回退。 | 原生封面方案已实现；独立顶图字段是已明确不采用的方案差异，不能因此把整块顶图重新排名为最大开发缺口。 |

仍不可由当前证据关闭：error_404.enable本身没有对应主题开关；root/pretty_urls/urlNoIndex有站点路径与URL语义差异；encrypt、源文件full_source/origin/source、post_asset_folder与生成hook仍要保留。favicon/email/copyright及目录配置需要进一步核对Halo设置和真实输出，不能单凭主题同名文件缺失判定未实现，也不能由此自动NA。

因此A02应保留为**长尾语义映射/验收队列**，列出差异；本次没有证据把它整体排为新的大型开发模块，也没有证据整块清零。
