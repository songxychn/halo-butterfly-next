# 正文图库

文章和单页支持 Butterfly 5.7.0 的 `gallery` / `galleryGroup` 等效 HTML。按 [DEC-02](https://github.com/songxychn/halo-butterfly-next/issues/45) 输入 HTML；主题不在运行期解析 `{% %}`。无需 Photos 插件，独立 Photos 页面保持自己的数据与分页。

## 本地图片

在编辑器的 HTML 内容中写入：

```html
<div class="gallery-container" data-type="data" data-button="true" data-limit="10" data-first="10">
  <div class="gallery-items">[{"url":"/upload/landscape.jpg","alt":"海边","title":"旅行照片"},{"url":"/upload/portrait.jpg","alt":"山间"}]</div>
</div>
```

`gallery-items` 内为 JSON 数组，每张图片有 `url`、可选纯文本 `alt` / `title`。在 HTML 中将 JSON 文本的 `&` / `<` / `>` 转为 `&amp;` / `&lt;` / `&gt;`，或使用下方转换工具。图片地址支持 HTTP(S)、站内绝对路径和相对路径；HTTPS 页面不加载 HTTP 图片，含凭据或执行协议的地址会拒绝。相对地址与 Butterfly 一样基于文章 URL。

| 属性 | 默认 | 行为 |
| --- | --- | --- |
| `data-type` | `data` | `data` 为本地 JSON；`url` 为 JSON 地址 |
| `data-button` | `false` | `true` 点击按钮加载；`false` 滚动接近末尾自动加载，同时保留可操作按钮 |
| `data-limit` | 10 | 后续每批数量，1–200 |
| `data-first` | 每批数量 | 首批数量，1–200 |

只请求已进入批次的图片，按宽高比例排列为等高行，行距 5px；复用 InfiniteGrid 4.13.0，参考行高范围 150–600px，窄容器可缩小。窗口尺寸、侧栏或隐藏容器显示变化会重新排版。图片点击或键盘激活后使用 Viewer.js，仅浏览当前图库中的可用图片；最后一批后键盘焦点留在新图片。错误图片显示占位与原 alt，不进入灯箱。

## 远端 JSON

```html
<div class="gallery-container" data-type="url" data-button="true" data-limit="10" data-first="5">
  <div class="gallery-items">/upload/gallery.json</div>
</div>
```

返回相同图片数组。跨域接口需要允许匿名 CORS；主题不发送 Cookie、认证头或 Referer。远端 JSON 内的相对图片 URL 仍基于文章地址，建议使用站内绝对路径或完整 HTTPS 地址。每份数据最多 1MiB、5000 张图片，单批最多 200 张；不静默截断非法数据。8 秒请求超时、HTTP/JSON/格式错误显示重试按钮，空数组显示“暂无图片”。单张坏图或 8 秒未完成的图片显示失败占位；重载页面可以重新请求。

远端数组一次读取，图片按批加载；当前没有服务端分页 API，也不需要远端脚本。切页时取消请求和图片等待，销毁排版及观察器。无 JavaScript 时显示图库说明，分组卡片的链接仍可使用。

## 相册分组卡片

```html
<div class="gallery-group-main">
  <figure class="gallery-group">
    <img class="gallery-group-img no-lightbox" src="/upload/cover.jpg" alt="旅行相册">
    <figcaption>
      <div class="gallery-group-name">旅行相册</div>
      <p>海边与山间</p>
      <a href="/travel/" aria-label="旅行相册"></a>
    </figcaption>
  </figure>
</div>
```

封面卡片使用原生链接，标题与描述纯文本；支持键盘焦点和手机单列。直接放入正文也会包住卡片浮动。覆盖图片不参加灯箱。

## Hexo 图库源转换

```sh
bun scripts/gallery/convert.mjs article.md article-gallery.md
```

只转换 `gallery` / `galleryGroup`，保留其余 Markdown、Hexo 标签和代码块；输出是包含 HTML 片段的文章源，不是完整文章 HTML。新文件使用 0600 权限，不覆盖已有输出、不修改输入、不上传内容。再经 Markdown 编辑器或转换流程导入 Halo，确认发布正文保留这些 class、data 属性和 HTML 结构。

支持 `{% gallery true,10,5 %}` 内的 Markdown 图片、`{% gallery url,/upload/gallery.json,true,10,5 %}` 和 `{% galleryGroup "名称" "含空格描述" /album/ /cover.jpg %}`。对应结束标签为 `{% endgallery %}`；图库嵌套、无效参数和危险 URL 会报错，不输出半成品。本工具不承担其他 17 种正文扩展的转换。

## 资源与验证

只有正文出现图库时请求随包 `assets/js/gallery.min.js`；普通文章不增加排版引擎下载。继承统一主题资源地址，加载失败回退随包脚本；脚本最终不可用时显示刷新提示。旧配置缺少新增字段时继续使用本地资源。

验证命令：`bun run verify`、`bun scripts/gallery/check-browser.mjs`。真实 Halo 夹具仅允许本项目独立回环实验室：`scripts/gallery/fixture.py` 安装候选并创建合成文章/单页，再用记录的 `gallery-fixture.json` 执行检查；图库数据服务器端口通过 `GALLERY_DATA_PORT` 明确指定。有限浏览器结果不等于完整双站、实际 Safari/设备或 1.0 验收，参见[本批记录](validation/2026-10-13/article-gallery.md)。
