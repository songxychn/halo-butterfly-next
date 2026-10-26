# 正文扩展：可读 HTML 与渐进增强

文章和自定义页面共用同一实现。普通 Markdown 保持原有行为；需要提示、分组或卡片时，使用原生 HTML 与可选 `data-content-*` 属性。属性是主题的增强约定，不是 Markdown 的标准 Tabs 语法，也不保证其他主题会提供同样的外观。

正文必须保存真实标题、文字、列表、链接和图片，不保存运行期生成的按钮、`hidden`、ARIA 角色或空占位符。不解析 Hexo `{% %}`，不从 JSON 或远端服务生成正文。其他主题忽略这些属性时，全部内容仍有可读的原生结构；原生折叠仍可用摘要展开。

## 编辑方式

基础内容继续用 Markdown。以下增强样例应放进编辑器的 HTML 块或支持保留原始 HTML 的源码模式；HTML 容器内部也使用 HTML，避免不同 Markdown 渲染器对嵌套 Markdown 的解析差异。保存后检查文章预览。若编辑器去掉 `data-*`，增强会退回普通 HTML；若编辑器过滤结构或文字，则需调整编辑方式，主题不能恢复已被编辑器删除的内容。

### 已验收的 Halo 作者路径

Halo 2.26.1 默认编辑器配合官方 [Markdown / HTML 内容块扩展](https://github.com/halo-sigs/plugin-hybrid-edit-block) 1.7.0，已通过完整样例保存与重新打开检查：

1. 安装并启用官方扩展，在默认编辑器按 `/`（或点击 `+`），选择“HTML 编辑块”。
2. 将完整 HTML 放入该块的代码编辑区。容器中的文字、标题、链接和图片仍使用真实 HTML。
3. 点击块外标题区域，让编辑块完成同步，再点击“保存”。等待保存成功后重新打开，确认代码内容保留。

**不要把完整增强 HTML 直接粘贴进普通富文本段落。** 本次默认粘贴路径将样例中的17个`data-content-*`属性全部移除；重新打开后仍为0。HTML编辑块则保留17个属性以及完整结构和文字。此结论来自本地真实编辑器操作，不是绕过编辑器的内容API写入。

HTML块作者路径需要启用该官方扩展；主题增强不调用其运行时API。停用/卸载插件后的编辑与展示行为未在本轮验证，不能据此保证编辑器可逆转换。该验收仅保存未发布草稿，不包含前台公开渲染或发布。详见 [编辑器验收记录](validation/2026-10-14/content-editor.md)。

## 正文图片属性

需要保留 `loading="lazy"`、首屏显式 `eager` 或 `srcset` / `picture` 时，使用上述官方 HTML 编辑块。Halo 2.26.1 与内容块扩展 1.7.0 的三引擎限定验证中，这条路径在保存、重开和初始公开正文均保留测试属性。标准 Markdown 图片初始输出不会因此自动带上 loading。

普通富文本的“图片 → 输入链接”是另一条作者路径：[工具栏专项](validation/2026-10-17/image-toolbar-followup.md)记录真实插入、两次保存、重开和初始公开正文。已完成案例均保留图片 URL；最终正文含宽度，其中 WebKit 首次保存未带宽度、后续新增。初始 HTML 没有 `loading`；不能从编辑器内部预览的属性推断公开正文自动懒加载。需要显式 lazy/eager 或响应式结构时，仍使用上述 HTML 编辑块。

Markdown 编辑块不能等同于 HTML 块：输入原生 HTML 后，重开时可能转换为 Markdown 图片写法，无法完整保留图片元信息；[再次保存补证](validation/2026-10-16/content-editor-followup.md)确认三引擎在重开并修改后再次保存时，公开正文也会丢失这些属性。普通富文本粘贴也会过滤 loading 和响应式图片结构。不要依赖主题脚本恢复编辑器已经删除的属性，详细范围见[作者图片验收](validation/2026-10-16/authored-image-editor.md)。保存后的 HTML 经 API 复建，在官方编辑块插件启用、停用、重新启用时文字和图片属性均可读取；这不代表停用后仍可编辑。两项记录不将前述全部正文扩展自动记为已发布验收通过。

## 提示块

```html
<blockquote data-content-note="warning">
  <p><strong>注意：</strong>更换主题后，应保留完整正文。</p>
</blockquote>
```

支持 `info`（默认）、`success`、`warning`、`danger`。也可用 `<aside>`。含义由实际文字表达，配色只是辅助；普通 Markdown 引用不会被自动识别为警告。换主题后显示为普通引用或提示文字。

1.0 采用此通用提示块方案：默认显示边框、左侧强调线、6px 圆角及浅深色配色，不自动添加图标。外观通过自定义 CSS 调整，不提供旧 Hexo 的 `note.style`、`note.icons`、`note.border_radius`、`note.light_bg_offset` 四项全局配置。例如，自定义样式中可用 `article.render [data-content-note] { border-radius: 0; }` 改为直角；配色调整后需自行检查浅深色可读性。此处说明能力范围，不代表完整编辑器/可移植性验收已通过；见 [1.0 裁定](parity/DEC-02-PORTABLE-NOTES.md)。

## 折叠与查看答案

```html
<details>
  <summary>查看操作步骤</summary>
  <ol><li>创建文章。</li><li>保存并预览。</li></ol>
</details>

<details>
  <summary>查看答案</summary>
  <p>答案正文。</p>
</details>
```

直接使用浏览器原生折叠；加 `open` 可默认展开。不需要主题脚本。摘要始终是可操作入口；“查看答案”同样使用原生折叠，不实现按钮消失后无法再次收起的一次性揭示。未提供任何登录、收费或保密能力，折叠内容仍在网页 HTML 中。

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

- 默认选中第一组；`data-content-tabs="2"` 可指定第二组，非法或越界值回退第一组。
- 容器的直接元素子节点全部是 `section`，至少两组；每组用一个直接子级 `h2`～`h6` 提供标题。容器内除分组外不能有额外正文。
- 不完整、缺标题、重复面板 ID 或作者预设 `hidden` 的分组不增强，保留原文。标题内容按纯文本生成按钮，原标题节点不移动。
- 可以在面板内部嵌套另一组 `data-content-tabs`，不需要 `subtabs` 等别名。
- 成功创建按钮并绑定事件后才隐藏非选中面板。没有脚本、脚本被阻止、初始化失败或切换主题时，各组按顺序显示。
- 左右方向键、Home/End 切换；Enter/Space 使用原生按钮操作；Tab 可以进入面板。ARIA 角色与关联只在运行时生成，参照 [WAI Tabs 模式](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)。
- 文章目录、普通页内链接、初始 URL fragment 和历史导航会展开目标所在分组与原生折叠，支持嵌套目标。
- 打印时显示全部面板；脚本可用时还会临时展开原生折叠，打印结束恢复折叠状态。页面清理移除控件并恢复面板的原始属性，可重复初始化，接入现有 PJAX 页面生命周期。

## 时间线

```html
<ol data-content-timeline>
  <li>
    <time datetime="2026-10-10">10 月 10 日</time>
    <h3>准备</h3><p>整理需求。</p>
  </li>
  <li>
    <time datetime="2026-10-13">10 月 13 日</time>
    <h3>实现</h3><p>完成开发。</p>
  </li>
</ol>
```

主题用 CSS 增加竖线、圆点与内容背景；换主题后成为包含日期的有序列表。

## 链接按钮

```html
<a data-content-button href="/about">阅读说明</a>
<a data-content-button="success" href="/download">下载主题</a>
```

支持 `info`（默认）、`success`、`warning`、`danger`；实际节点始终是链接，换主题后可直接访问。正文中的普通 Markdown 链接不自动变成按钮。

## 图片网格与图库分组

```html
<div data-content-gallery>
  <figure>
    <a href="/images/coast.webp">
      <img src="/images/coast.webp" alt="海岸" width="1200" height="800">
    </a>
    <figcaption>海岸旅行。</figcaption>
  </figure>
  <figure>
    <a href="/images/forest.webp">
      <img src="/images/forest.webp" alt="森林" width="1200" height="800">
    </a>
    <figcaption>森林记忆。</figcaption>
  </figure>
</div>
```

主题提供响应式网格，并接入已有 Viewer 灯箱；同一图库独立分组。原图链接在其他主题或脚本不可用时仍有效。若链接指向文章、图库页面而非图片，保留普通跳转，不劫持为灯箱。

图库分组卡片使用 `data-content-gallery="cards"`，图片链接指向目标页面，`figcaption` 保存名称、描述和文字链接。封面按固定比例裁切，名称与描述始终可见，不依赖鼠标悬停。这里只提供静态网格与分组卡片；没有 InfiniteGrid 混排、远端图片 JSON 或加载更多，不把静态网格称为完整 Butterfly gallery 对齐。

## 系列与友链卡片

```html
<ul data-content-cards>
  <li><h3><a href="/posts/first">第一篇</a></h3><p>文章说明。</p></li>
  <li><h3><a href="https://example.com">朋友的网站</a></h3><p>网站说明。</p></li>
</ul>
```

换主题后是普通列表。也支持容器里的直接 `article` 或 `section`。所有数据由作者写入，不自动查询系列或 Links 插件。

## 范围与验收

样例真相源：[article.html](../fixtures/content-extensions/article.html)。正文渲染实现不引入第三方运行库；本轮已验收的编辑器作者路径使用上述官方HTML块扩展。扩展样式只作用于 `article.render`，包括亮暗、手机、键盘焦点与打印；基础 Markdown、评论区 Tabs 和旧上游 `.container` 样式不改写。

按 2026-10-14 [DEC-02 补充](parity/DEC-02-PORTABLE-CONTENT.md)，Hexo 专属语法、class、完整参数兼容及通用离线转换不属于默认目标。现有写法已完成上述限定编辑器保存重开检查；无脚本/增强失败、换主题阅读和完整 EXT-01 仍需各自证据，不能由编辑器检查代替；Note 外观、行内标记/图片按通用用户能力另行映射。图表、乐谱与完整图库按各自输入和合同验收，不能用本次可移植正文实现替代。真实 Halo API HTML 内容、各浏览器与编辑器验证边界记录在原验收说明中。

## 可重复验证

```sh
bun run verify
bun scripts/browser/install.mjs
bun scripts/content/check-browser.mjs

HALO_JAR_SOURCE=/path/to/official/halo-2.26.1.jar \
  python3 -B scripts/content/lab.py bootstrap \
  --package dist/halo-butterfly-next-0.1.0-alpha.4.zip \
  --source-sha "$(git rev-parse HEAD)"
bun scripts/content/check-halo.mjs
bun scripts/content/check-portability.mjs
python3 -B scripts/content/lab.py stop
```

正式安装证据要求实现已提交且当前源码干净；运行时记录安装包摘要和内容夹具摘要。默认端口 Halo `18531` / 保留 Hexo `14531`，但仅启动 Halo。端口冲突时必须使用全新 `LAB_RUNTIME` 并同时指定 `HALO_PORT` / `HEXO_PORT`，不停止或复用其他站点。`CONTENT_BROWSER_RUNTIME` 可显式指定已安装的固定 Playwright 三引擎缓存，浏览器 profile 与输出仍隔离在本次任务目录。已有内容实验站升级包使用 `lab.py install`，不会重播内容。

本次真实 Halo 与切换 Earth 主题的限定验证见[验收记录](validation/2026-10-13/content-extensions.md)。
