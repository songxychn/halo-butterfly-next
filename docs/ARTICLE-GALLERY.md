# 正文图库

正文图库使用普通 HTML 图片与 CSS 网格，无需 Photos 插件或专用图库脚本。禁用 JavaScript、切换主题或资源加载失败时，图片和替代文本仍保留。独立 Photos 页面继续使用官方插件的数据与服务端分页。

```html
<div class="gallery-container">
  <div class="gallery-items">
    <img src="/upload/landscape.jpg" alt="海边" loading="lazy" decoding="async">
    <img src="/upload/portrait.jpg" alt="山间" loading="lazy" decoding="async">
  </div>
</div>
```

网格按容器宽度自动换列，保留图片比例。加载时机交给浏览器；启用主题灯箱时复用正文图片的 Viewer.js 行为。没有“加载更多”、自动追加批次或远端 JSON 请求。图片可使用正常的站内或 HTTPS 地址；图片链接不等于图库数据接口。

相册分组仍使用真实封面和链接：

```html
<div class="gallery-group-main">
  <figure class="gallery-group">
    <img class="gallery-group-img no-lightbox" src="/upload/cover.jpg" alt="旅行相册">
    <figcaption>
      <div class="gallery-group-name">旅行相册</div>
      <p>海边与山间</p>
      <a href="/albums/travel/" aria-label="旅行相册"></a>
    </figcaption>
  </figure>
</div>
```

## 迁移旧内容

预发布版本的 `.gallery-items` JSON 数组需要改写成上述 `<img>`。`data-type="url"` 不再读取远端数据，应将图片保存为正文内容；主题不提供运行时兼容适配器。修改文章前保留原稿，先预览再发布。旧批次参数 `data-button`、`data-first`、`data-limit` 可删除。

Hexo `gallery` / `galleryGroup` 标签可离线转换：

```sh
bun scripts/gallery/convert.mjs article.md article-gallery.md
```

只转换这两种标签，保留其余 Markdown、Hexo 标签和代码块。输出是含普通 HTML 图片的文章源，新文件权限为 0600，不覆盖已有文件、不修改输入、不请求远端地址。旧本地 `gallery true,10,5` 参数接受并忽略批次行为；远端 `gallery url,...` 明确报错，需先把图片改写为普通 Markdown。主题运行时不解析 Hexo 标签。

旧 JSON 图库的浏览器报告仅作为历史记录保留，不作为当前实现的验收证据。当前门禁与历史工具边界见 [维护范围](MAINTENANCE.md)。
