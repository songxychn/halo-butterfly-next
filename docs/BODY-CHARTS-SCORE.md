# 正文图表与 ABC 乐谱

主题在文章和自定义页面中按需渲染 **Mermaid**、**Chart.js** 与 **ABC 乐谱**（默认全部关闭，可在主题设置中全局启用，并在单篇元数据中按篇覆盖）。

## 写法示例

支持标准代码块（`language-mermaid`、`language-chartjs`、`language-abc`）以及显式 HTML 容器（HTML 中 `<`、`>`、`&` 需转义）：

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

## Mermaid

- 支持独立配置浅色/深色主题（`default` / `forest` / `dark` / `neutral` / `base`），切换配色时自动重绘。
- `zoom_pan` 开启后支持拖动、Ctrl/Cmd 滚轮缩放、方向键平移、`+/-` 缩放与 `Home` 复位；支持新标签页查看与 SVG 下载。
- 固定以 strict 模式渲染并使用 DOMPurify 清理输出 SVG，禁用危险 HTML 标签与 `init` 指令。

## Chart.js

- 仅解析纯 JSON 配置（支持 `bar` / `line` / `pie` / `doughnut` / `radar` / `polarArea` / `scatter` / `bubble`），不执行任意 JS 表达式。
- 任意配色字段支持 `{"light-mode":"#2563eb","dark-mode":"#93c5fd"}` 表达亮暗双色；附带可折叠数据表与系列切换按钮。
- `data-width` 支持百分比宽度（手机视口自动占满）。

## ABC 乐谱

- `data-params` 支持传入 ABCJS JSON 谱面参数，自动适配亮暗前景色与响应式尺寸，支持查看/复制源码与下载 SVG。

## 按需加载与降级

三种渲染器各自独立打包，仅在页面包含对应内容且功能开启时才加载；渲染失败或禁用脚本时保留原始源码，不影响正文阅读。
