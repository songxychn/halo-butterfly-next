# 第三方组件与开源许可

本主题采用 [GPL-3.0](../LICENSE) 开源许可。

## 上游项目致谢

- [Hexo Butterfly](https://github.com/jerryc127/hexo-theme-butterfly)（Apache-2.0）：视觉风格与布局参考来源。
- [halo-theme-butterfly](https://github.com/dhjddcn/halo-theme-butterfly)（GPL-3.0）：原始 Halo 移植基础。

## 打包随附的主要第三方库

构建时会自动收集运行时依赖的开源许可文本并打包至 `templates/assets/licenses/`：

| 组件 | 用途 | 许可 |
|---|---|---|
| Font Awesome Free | 图标字体与样式 | CC BY 4.0 / SIL OFL 1.1 / MIT |
| Prism.js & Prism Themes | 代码语法高亮与配色 | MIT |
| Viewer.js | 正文与图库图片灯箱 | MIT |
| Tocbot | 文章目录生成与滚动联动 | MIT |
| Typed.js | 首页打字机字幕 | MIT |
| Pace.js | 顶部加载进度条 | MIT |
| `@egjs/infinitegrid` | 首页瀑布流布局 | MIT |
| ECharts | 归档/分类/标签统计图（按需加载） | Apache-2.0 |
| Mermaid | 正文流程图渲染（按需加载） | MIT |
| Chart.js | 正文图表渲染（按需加载） | MIT |
| ABCJS | 正文乐谱渲染（按需加载） | MIT |
| DOMPurify | HTML/SVG 净化（按需加载） | Apache-2.0 / MPL-2.0 |

完整上游归属说明见 [third-party-licenses/UPSTREAM-ATTRIBUTION.txt](../third-party-licenses/UPSTREAM-ATTRIBUTION.txt)。
