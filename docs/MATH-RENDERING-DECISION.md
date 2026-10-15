# DEC-07：数学公式采用 Halo KaTeX 插件

## 裁定与依据

2026-10-11（Asia/Shanghai），维护者在本任务中先选择“安装推荐插件，主题提供完整适配”，随后确认“按你的建议来，开干”：1.0 数学公式以 Halo KaTeX 插件提供能力，取消 MathJax 专属验收要求。维护者随后明确允许将已审阅的草稿公开创建为裁定 issue：[DEC-07 / #387](https://github.com/songxychn/halo-butterfly-next/issues/387)。

原要求来自完整对齐 Butterfly 5.7.0 的盘点：`math.use` 包含关闭、MathJax、KaTeX，并保留 MathJax 菜单与公式编号配置。此处将数学提供方改为平台替代；没有把缺少实现或缺少证据当作通过。

依据：[Halo KaTeX 插件](https://github.com/halo-sigs/plugin-katex)支持默认编辑器的行内/块级公式，也可按选择器处理其他编辑器输出；[KaTeX 支持表](https://katex.org/docs/support_table.html)用于确定实际语法边界。版本、`metadata.name`、JAR SHA-256、最低 Halo 版本和具体编辑器输出必须在实际联调时固定。实际适配已锁定 KaTeX 3.0.0（内置 0.16.25，Halo >=2.22.2），版本与职责边界见 [数学公式](MATH.md)；不能据项目名称推断整个 Halo 兼容区间已通过。

## 1.0 成功条件

- 插件负责编辑器录入、公式渲染及其 JS/CSS/字体供应；主题适配文章与自定义单页中的字号、行距、亮暗颜色和容器布局。同一公式只有一个渲染负责人，已渲染节点不得被主题再次扫描渲染。
- 保留行内/块级公式、长公式局部横向滚动、编号展示和复制 TeX 的用户能力。编号验收以作者显式编号及所选插件实际输出为准；MathJax 的自动编号策略 `all/ams/none` 和右键菜单不进入 1.0。复制 TeX 仍待实现或证明；插件没有提供时不能直接关闭对应条目。
- 保留公式启用/关闭、全局与逐页控制的需求，配置可以映射为插件设置或主题注解，须记录优先级和实际可实现范围；无法满足时保持未完成，不能因替代提供方自动取消。
- 默认编辑器和明确登记的其他编辑器分别验收原始内容、保存后 HTML 和前台结果；覆盖多公式、中文混排、空内容、非法命令及超长公式。按最终锁定的 KaTeX 版本公开支持边界，无法转换的内容须报告，不能静默丢弃或宣称 MathJax 内容无损兼容。
- 验证插件未安装、安装停用、满足版本启用和不满足最低版本；恢复启用后功能恢复。缺失/停用时保留可恢复内容和明确回退结果，不允许隐藏正文或无限阻塞 Loading；回退不是公式增强通过。
- 资源严格按需已按[1.0 延期补充](parity/DEC-03-1.0-DEFERRALS.md)延期（版本未定）；仍验证无公式页无多余渲染、资源失败不破坏阅读，并完成亮暗、桌面/手机、键盘、屏幕阅读器及最终候选的独立审查与 CI。具体版本和真实运行证据仍按 PLG-01、PLG-06、EXT-02、CFG-01、NET-01 及适用 A11Y/BROWSER/DEVICE 场景记录。

## 矩阵变更边界

以下 6 条 MathJax 专属条目已随公开裁定登记转为 `not-applicable`，保留来源并附 DEC-07：

- `config:math.mathjax.enableMenu`
- `config:math.mathjax.tags`
- `config:CDN.option.mathjax`
- `template:includes/third-party/math/mathjax`
- `resource:mathjax`
- `page-data:mathjax`

以下 4 条主题自带 KaTeX/CopyTeX 资源及 CDN 覆盖条目已随公开裁定登记按平台替代转为 `not-applicable`。这是资源供应职责迁移到插件，公式渲染与复制能力仍由下列保留项验收：

- `config:CDN.option.katex`
- `config:CDN.option.katex_copytex`
- `resource:katex`
- `resource:katex_copytex`

以下 7 条保留为待平台映射，绑定 KaTeX 插件职责和上述成功条件：`config:math.use`、`config:math.per_page`、`config:math.hide_scrollbar`、`config:math.katex.copy_tex`、`template:includes/third-party/math/index`、`template:includes/third-party/math/katex`、`page-data:katex`。`math.use` 的 Halo 验收域改为关闭/KaTeX 插件，不再要求 MathJax 引擎选择；上游来源仍完整保留。

Mermaid、Chart.js、ABC 乐谱及其他提供方不在本裁定中删减或改为已支持。MathJax 不作为默认后续版本承诺；如有实际需求，另行立项和验收。

## 交付与剩余工作

公开裁定正文保留在 [issue 正文存档](parity/DEC-07-ISSUE.md)。897 个 ID、固定上游来源和原有证据保留，10 条提供方/资源供应项为 `not-applicable`。后续实际适配将 7 条公式保留项更新为 `implemented-unverified`，0 条提升为完整已验收。

主题现已实现保留 MathML 的布局、滚动、复制和全局/逐篇显示控制，见 [使用说明](MATH.md)与[验证记录](validation/2026-10-11/katex.md)。显示开关只切换公式/TeX 阅读表示，不关闭插件资源。插件 3.0.0 的全站 CSS 注入、前台渲染模式的全站 JS 注入仍不满足严格按需加载目标，该目标已由维护者延期到 1.0 之后；编辑器 UI、多编辑器、最低版本拒绝、真实设备/辅助技术及独立审查等成功条件保留。
