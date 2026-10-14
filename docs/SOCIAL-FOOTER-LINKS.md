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

`links.source` 留空时仅显示原生友链。可配置独立公开 JSON 数据源，要求 HTTPS 地址或同源路径；跨源服务须允许浏览器 CORS。匿名请求不携带凭据或 Referer，10 秒超时、最多 1 MiB。JSON 支持数组或 `{ "groups": [...] }` 包装：

```json
[
  {
    "name": "朋友们",
    "description": "这一组的说明（纯文本）",
    "links": [
      {
        "name": "Halo",
        "url": "https://halo.run/",
        "logo": "https://halo.run/logo.svg",
        "description": "站点说明（纯文本）"
      }
    ]
  }
]
```

最多 50 个组、合计 500 个链接。链接名称必填且最长 200 字符，网页地址必须有效且不含用户名密码。组名最长 200 字符；组说明保留前 5000 字符，链接说明保留前 2000 字符。图片可选，危险地址、缺图或坏图显示名称首字符。组及卡片的说明均按文字处理，HTML 不会执行。

远端内容显示在原生列表之前，空数据有空状态，网络/格式错误可重试；原生分组与链接始终保留。远端来源不写入 Halo，不使用 Hexo 特殊标签、Hexo 数据文件或兼容解析器。限制与真实验收见 `docs/validation/2026-10-14/site-content-completion.md`。
