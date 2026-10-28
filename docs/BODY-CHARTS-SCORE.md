# 正文图表与 ABC 乐谱

> 2026-10-28：本文包含历史验收过程。引用的部分一次性脚本已退休，下面的旧命令不是当前推荐入口；功能说明以当前源码为准。参见[维护范围](MAINTENANCE.md)及其中的历史源码链接。

主题在文章和自定义单页中渲染 Mermaid、Chart.js 与 ABC 乐谱。对应 Butterfly 5.7.0 的等效 HTML，跟踪 [#403](https://github.com/songxychn/halo-butterfly-next/issues/403)。不在运行时解析 Hexo `{% %}` 标签。归档/分类/标签页的 ECharts 统计图继续使用原实现。

## 开启与输入

“Mermaid 图表”“正文 Chart.js 图表”“ABC 乐谱”三个组默认关闭；原有配置缺字段时仍关闭，不新增外部请求。文章和单页的 `mermaid`、`chartjs`、`abcjs` 元数据有跟随全局/开启/关闭三态，显式设置优先。`abcjs.per_page=true` 表示全部文章和单页按内容识别，设为 false 时只渲染元数据显式开启的内容，与固定上游含义相同。

编辑器中插入等效 HTML，源码的 `<`、`>` 和 `&` 需要 HTML 转义。纯文本源码不作为 HTML 执行。

```html
<div class="mermaid-wrap">
  <pre class="mermaid-src" hidden>flowchart LR
    A[开始] --&gt; B[完成]</pre>
</div>

<div class="chartjs-container" data-width="80%">
  <pre class="chartjs-src" hidden>{"type":"bar","data":{"labels":["甲","乙"],"datasets":[{"label":"访问量","data":[12,8]}]}}</pre>
  <div class="chartjs-desc">数据说明</div>
</div>

<div class="abc-music-sheet" data-params="{&quot;scale&quot;:0.9}">X:1
T:示例
M:4/4
L:1/4
K:C
C D E F | G A B c |</div>
```

也支持编辑器输出的 `pre > code.language-mermaid`、`language-chartjs`、`language-abc`。Mermaid 代码块需要另外开启 `mermaid.code_write`；关闭时仍是普通代码，等效 HTML 容器继续按全局/单篇开关处理。已识别的渲染代码块从 Halo Shiki 的 `shiki-code` 容器移出，避免其 Shadow DOM 把图表源码当作未知高亮语言；普通代码仍交由原高亮器。已经有 SVG 或 Canvas 的插件输出不会被主题再次渲染。

## Mermaid

亮暗主题可分别选 default/forest/dark/neutral/base。主题模式改变后重新绘制。`mermaid-src` 的可选 `data-config` 是 JSON，支持 `theme`，`flowchart` 的 `curve/useMaxWidth/nodeSpacing/rankSpacing`，以及 `sequence` 的 `showSequenceNumbers/mirrorActors/useMaxWidth`。不接受安全配置覆盖、init 指令或配置 front matter；渲染固定 strict，关闭 HTML 标签，并清理输出 SVG。

`zoom_pan` 控制放大、缩小、复位按钮、拖动及双指缩放。聚焦 SVG 后方向键平移，加减键缩放，Home 复位。普通滚轮滚动页面，Ctrl/Command 滚轮缩放。`open_in_new_tab` 控制隔离的新页 SVG 查看；同时提供 SVG 下载。

## Chart.js

仅解析 JSON；不执行函数、脚本或表达式。支持 bar/line/pie/doughnut/radar/polarArea/scatter/bubble，以及 Chart.js 的 JSON 配置。需要 JavaScript 回调的高级选项不在此输入协议中。拒绝保留原型字段、超过 100KB 或过深的配置。

字体、边线和刻度背景有全局亮暗配色。配置内任意字段可用 `{"light-mode":"#2563eb","dark-mode":"#93c5fd"}` 表达双模式值；原始 JSON 保留，重绘不会覆盖源码。原生图例可点击，额外的数据系列按钮支持键盘操作，主题切换保留系列显示状态。图表附带“查看图表数据”表格供读取数值。

`data-width` 接受 0–100% 的有效宽度（0 不应用）；手机视口占满可用宽度。`chartjs-desc` 与 `chartjs-abreast` 保留上游说明/并排结构。自定义 `data-chartjs-id` 不作为全局 DOM 查询标识，重复 ID 输入不会覆盖其他图表。

## ABC 乐谱

`data-params` 为 ABCJS 的 JSON 谱面参数；主题固定响应式 resize、辅助样式类和当前亮暗前景色。每个谱面独立处理，支持源码查看/复制、SVG 下载。未输入有效音符或休止符时显示错误并保留源码。此项交付谱面阅读，不包含声音合成、音源下载或播放控件；固定上游对应的也是谱面渲染。

## 资源与失败回退

随包固定 Mermaid 11.16.0、Chart.js 4.5.1、ABCJS 6.6.4，与 Butterfly 5.7.0 的供应版本一致；SVG 清理使用 DOMPurify 3.4.12。每种渲染器独立打包，仅在当前正文有相应输入且启用时加载一次，不进入首页或正文基础包。许可正文随安装包分发。Mermaid 包较大，不能据此宣称已通过性能预算。

渲染器随主题固定版本打包，仅在相应正文内容启用时加载。`CDN.asset_base` 可以托管与当前安装包一致的完整 assets 目录；不再支持单独替换渲染器或自定义适配接口。资源加载错误时保留随包回退，失败时保留可读源码。

禁用 JavaScript、配置关闭、格式错误和资源加载失败均保留源码；一个块的错误不影响其他块或正文。错误提示使用纯文本。页面清理会释放 Chart 实例、图表手势、观察器与 Blob URL；模式切换串行重绘，过期渲染不写回页面。

## 复验

```bash
bun run verify
bun scripts/browser/install.mjs
bun scripts/body-renderers/check.mjs
bun scripts/body-renderers/check.mjs --edges
python3 scripts/body-renderers/lab.py bootstrap --jar /path/to/pinned-halo-2.26.1.jar --package dist/halo-butterfly-next-0.1.0-alpha.4.zip --source-sha "$(git rev-parse HEAD)"
bun scripts/body-renderers/check.mjs --halo
# 原生资源挂起时只作独立传输对照，不能替代原生验收
bun scripts/body-renderers/check.mjs --halo --close-upstream
bun scripts/body-renderers/overrides.mjs
python3 scripts/body-renderers/lab.py stop
```

实验室只使用本任务的 127.0.0.1:18531；准备脚本要求全新目录、固定 JAR 摘要和进程归属。浏览器报告逐项保留失败，运行前后包与提交身份独立记录。此批限定验收见 [记录](validation/2026-10-13/body-renderers.md)；完整固定双站、全部参数域、实际 Safari/真机、屏幕阅读器与 1.0 合同仍另行验收。

参考：[固定上游标签](https://github.com/jerryc127/hexo-theme-butterfly/tree/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/scripts/tag)、[Mermaid API](https://mermaid.js.org/config/usage)、[Chart.js API](https://www.chartjs.org/docs/latest/developers/api.html)、[ABCJS 参数](https://docs.abcjs.net/visual/render-abc-options.html)。
