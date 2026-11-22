# 正文扩展与可移植 HTML 写法

本主题采用标准 Markdown 与可读的原生 HTML 配合可选 `data-content-*` 属性来增强文章排版；即使未来切换其他主题或禁用脚本，正文内容与结构仍然完整可读。

> 在 Halo 默认编辑器中插入原生 HTML 属性时，建议使用官方 Markdown / HTML 内容块扩展。

## 提示块

```html
<blockquote data-content-note="warning">
  <p><strong>注意：</strong>更换主题后，应保留完整正文。</p>
</blockquote>
```

支持 `info`（默认）、`success`、`warning`、`danger`，也可用 `<aside>`。

## 折叠与查看答案

```html
<details>
  <summary>查看操作步骤</summary>
  <ol><li>创建文章。</li><li>保存并预览。</li></ol>
</details>
```

直接使用浏览器原生 `<details>/<summary>`，添加 `open` 属性可默认展开。

## 标签页 Tabs

```html
<div data-content-tabs aria-label="部署方式">
  <section>
    <h3>Docker 部署</h3>
    <p>使用容器启动服务。</p>
  </section>
  <section>
    <h3>本地运行</h3>
    <p>直接启动程序，适合开发调试。</p>
  </section>
</div>
```

- 默认选中第一组，`data-content-tabs="2"` 可指定默认激活项；支持面板内嵌套 Tabs。
- 每个直接子节点须为 `<section>` 并包含一个直接子级标题（`h2`–`h6`）。
- 支持左右方向键、Home/End 键盘切换；打印时自动展示全部面板；锚点跳转会自动展开对应面板与折叠块。

## 时间线

```html
<ol data-content-timeline>
  <li>
    <time datetime="2026-10-10">10 月 10 日</time>
    <h3>准备</h3><p>整理需求。</p>
  </li>
</ol>
```

## 链接按钮

```html
<a data-content-button href="/about">阅读说明</a>
<a data-content-button="success" href="/download">下载主题</a>
```

支持 `info`（默认）、`success`、`warning`、`danger`。

## 图片网格与图库分组

```html
<div data-content-gallery>
  <figure>
    <a href="/images/coast.webp">
      <img src="/images/coast.webp" alt="海岸" width="1200" height="800">
    </a>
    <figcaption>海岸旅行。</figcaption>
  </figure>
</div>
```

- 默认渲染响应式网格并自动接入 Viewer.js 灯箱，同一图库内图片独立分组。
- 使用 `data-content-gallery="cards"` 可渲染带固定裁切比例封面的分组卡片。

## 系列与卡片列表

```html
<ul data-content-cards>
  <li><h3><a href="/posts/first">第一篇</a></h3><p>文章说明。</p></li>
  <li><h3><a href="https://example.com">朋友的网站</a></h3><p>网站说明。</p></li>
</ul>
```
