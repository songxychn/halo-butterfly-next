# 社交、页脚与友链配置

## 社交入口

沿用 `aside.social` 的名称、地址和图标；`aside.social_position` 可选 `aside`（默认）、`header`、`both`、`none`。`header` 指首页标题/副标题下方；关闭首页顶部大图时显示在内容标题下方。每项可填写 `color` / `dark_color`，分别控制亮色/深色主题，留空继承主题文字颜色。

图标可使用 Font Awesome 的 `i`，或不含脚本的内联 SVG 基础图形。主题使用允许列表净化，去除事件、任意样式及外部引用。链接允许 HTTP(S)、mailto、tel、站内路径及锚点；危险协议被移除。无 JavaScript 时保留通用链接图标及原生安全导航。

## 页脚分组

旧 `footer.nav` 平铺链接和 `footer.custom_text` 纯文本保持。新增 `footer.columns` 是列 → 分组 → 条目的结构：

- 列的 `width` 是 1–12 的相对伸展权重；小屏自动换行。
- 分组有 `title` 和 `items`；条目可以填写 `title` / `url`，也可以填写 `html`（优先于标题/链接）。地址为空或不支持时显示纯文本。
- `footer.custom_html` 是独立的可选富文本区。不要把 HTML 填入旧 `custom_text` 并期待其执行。

HTML 支持段落、换行、强调、链接、列表、图片、引用、代码、details/summary、mark 等通用元素。标签和属性按允许列表净化，不支持 script、iframe、style、事件、任意 data 属性、表单或任意组件；地址只允许公共网页/联系方式协议。图片使用懒加载，链接保留浏览器语义。模板先转义原始 HTML，JavaScript 初始化后净化并展示；禁用 JavaScript 时安全显示原始文本。

## 友链数据

原生链接来自官方 Links 插件。本次固定版本是 [Links 2.3.0](https://github.com/halo-sigs/plugin-links/tree/v2.3.0)。其 LinkGroup 没有组说明字段，因此 `links.group_descriptions` 使用原生分组的 `metadata.name` 作为 `group` 键，`description` 作为纯文本说明。不是以可变的展示名称关联。`links.random_order` 默认关闭，打开时每次页面初始化独立随机排序每个组里的卡片；不改变后台顺序，关闭脚本时保留原生顺序。

远程友链 JSON 已按 [DEC-10](parity/DEC-10-THEME-SCOPE.md) 删除。只使用 Halo Links 插件分组和链接；旧 links.source 在迁移报告中标为 removed-feature。
