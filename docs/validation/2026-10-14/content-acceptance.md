# 通用正文复验

候选 `bd914e4f057f6df0aa4a4a4f0936cc0175cf5b35`；输入为 `fixtures/content-extensions/article.html`。精确包、源码、CSS、脚本与夹具摘要在各报告中记录。

| 环境 | 结果 | 原始记录 |
| --- | --- | --- |
| 独立 HTML、Chromium/Firefox/WebKit，桌面/手机、明暗、无JS/阻止JS/无主题样式 | 21/21通过 | [报告](content-browser.json) |
| 实际 Halo 2.26.1 文章与单页，三引擎两视口两模式与无JS回退 | 27/27通过 | [报告](content-halo.json) |
| 真实切换 Earth 1.15.3，三引擎桌面文章/手机单页 | 6/6通过，候选主题恢复 | [报告](content-portability.json) |

覆盖 Tabs 键盘/嵌套/锚点/打印/清理、图片网格灯箱、原生折叠，以及换主题后的正文、图库说明、时间线和静态链接保留。以上内容经已认证 HTML API 保存；不代表任意编辑器保存重开、其他主题外观、真实Safari/手机或屏幕阅读器验证。后续[真实编辑器检查](content-editor.md)已完成默认编辑器与官方HTML块的三引擎保存重开；普通富文本粘贴不保留增强属性。

按 DEC-02 使用通用 Markdown/HTML 能力，不恢复 Hexo 标签解析、class/完整参数兼容或通用转换器义务。D01保留合同验收边界，矩阵不因局部浏览器通过升级 verified。
