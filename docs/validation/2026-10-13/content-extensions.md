# 可移植正文扩展限定验收

## 实现与包身份

- 实现提交：`eaf39b55cc69a8ded8f5dd88adc16226fc39ac80`。
- 主题包：`halo-butterfly-next-0.1.0-alpha.4.zip`，SHA-256 `e5f477a22bad5052f3501e9d535b621399ed1a880d0add5051c18b258d5b9539`。
- 内容夹具：`fixtures/content-extensions/article.html`，SHA-256 `4625c06d59f4362ec576fac2e6c37fd8dda6623a891b4b62b6f1928cf50155bf`。
- 平台：Halo 2.26.1，新建的 loopback-only 数据库，端口 `18541`；可选插件由实验室基础播种停用。浏览器使用固定 Playwright 1.63.0 的独立 Chromium / Firefox / WebKit；桌面 1440×1000、手机宽度 390×844，亮暗模式。
- 输入方式：通过 Halo 已认证内容 API 保存 `rawType=HTML`，发布文章和自定义页面；未操作已有站点或桌面浏览器。

## 已执行

| 范围 | 结果 |
| --- | --- |
| `bun run verify` | 类型检查、897 项矩阵覆盖检查、644 项测试、构建及 159 文件安装包检查通过 |
| 独立 HTML 浏览器回归 | 21 场景通过：桌面/手机、亮暗、ARIA 关联与 ID 唯一性、左右/Home/End/Enter/Space、面板键盘焦点、嵌套分组、页内链接/初始 fragment/历史导航、打印、清理与重复初始化、真实部分初始化失败、无脚本/脚本阻止、无主题样式 |
| 实际 Halo 文章与单页 | 27 场景通过：三引擎 × 两视口 × 两模式 × 两路由共 24 场景，另三引擎无脚本回退；实际 CSS/JS 响应字节与安装包一致，无页面 JS 异常或请求失败 |
| 真正切换另一主题 | 6 场景通过：新实例自带 Earth 1.15.3，三引擎的桌面文章与手机单页；Docker、本地、嵌套内容顺序可见，原生折叠可展开，原图链接、图库标题、时间线条目与系列链接保留；退出时恢复候选主题 |

图片网格的原图链接打开已有 Viewer 灯箱，图组内两张图片独立计数；指向文章的分组封面保留普通链接，没有被灯箱劫持。样例标题、文字、列表、图片和链接全部保存在文章 HTML 中，运行期才生成 Tabs 控件和隐藏状态。

原始报告与截图保存在 `.runtime/content/runs/eaf39b5`、`.runtime/content/halo-runs/eaf39b5` 和 `.runtime/content/portability-runs/eaf39b5`；候选主题代码与包的身份以各报告为准。新增实验室所有权/端口保护测试拒绝对不匹配的运行目录激活主题。

## 截图

[Halo 桌面亮色](content-halo-desktop-light.png) · [Halo 手机宽度暗色](content-halo-mobile-dark.png) · [切换 Earth 后的原生正文](content-earth-desktop.png)

截图为上列实现提交的实际页面，保留原始展示，不注入 CSS 隐藏差异。截图只覆盖所在视口，完整内容与交互由断言覆盖。

## 验收边界

没有进行 GUI 编辑器粘贴、保存、重开文章的往返测试；HTML 块/源码模式能否保留属性与结构仍需按具体编辑器验证。切换 Earth 已证明这一主题中的可读回退，不代表每个主题或编辑器都不改写内容。无头手机宽度不等于真机触摸、Safari 或屏幕阅读器。

本实现采用可移植 HTML 输入，不解析 Hexo 标签原文；不包含旧标签源离线转换、旧 class/完整参数域、InfiniteGrid 混排/加载更多、图表、音乐或活数据系列/友链。矩阵只记录新的适配事实，相关原合同状态不提升为 verified，也不宣布完整 1.0 验收完成。
