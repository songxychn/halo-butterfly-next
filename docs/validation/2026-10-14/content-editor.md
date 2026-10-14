# 通用正文的真实编辑器保存重开验收

2026-10-14；独占本地 Halo 2.26.1；默认富文本编辑器 + 官方 [HTML/Markdown 内容块扩展](https://github.com/halo-sigs/plugin-hybrid-edit-block) 1.7.0（已启用）。插件 JAR SHA-256：`6706fd5ab80551577522756b81dbbc29427a46b1951bb925a8f1fb8f5900ef1f`。

## 结论与方法

完整 `fixtures/content-extensions/article.html` 经过真实编辑器的“HTML 编辑块”输入、点击块外使其同步、点击保存、刷新重新打开，三个无头引擎均保留全部17个`data-content-*`属性与完整正文结构。比较包含每个元素、全部属性和非空文本节点，只归一化空白；编辑器会调整HTML格式，因此不宣称逐字节原样保留。

| 引擎 | 版本 | HTML块保存重开 | 普通富文本HTML粘贴 |
| --- | --- | --- | --- |
| Chromium | 153.0.8010.12 | 17→17→17，通过 | 17→0→0，检测到丢失增强属性 |
| Firefox | 155.0 | 17→17→17，通过 | 合成剪贴板路径未限定验收 |
| WebKit | 26.6 | 17→17→17，通过 | 未测 |

保存使用真实表单按钮，不通过API写入正文。保存请求内容与重开后CodeMirror完整文档均用于断言，避免长文档仅验证屏幕可见行；只读API另确认草稿`spec.publish=false`。包含提示、原生折叠、嵌套Tabs、时间线、链接、图库/卡片、不完整分组及代码示例。

Chromium负面对照使用带`text/html`的ClipboardEvent进入普通编辑器粘贴处理，保存后重开仍无增强属性；它不等于真实操作系统剪贴板验收。Firefox尝试该合成路径时，未能重开预期正文，因此不将其记为产品缺陷，也不以此宣称Firefox普通粘贴能力。正式脚本将负面对照限定于已验证的Chromium；HTML块输入使用真实键盘插入，在三个引擎独立通过。

## 环境与边界

- 已安装主题记录为 `bd914e4f057f6df0aa4a4a4f0936cc0175cf5b35`，包SHA-256为 `4f65e69630f68b0b0ca3d0336d0a6b7e423a88f3812f152904711306b80321f7`。这是当时的实验室环境记录；编辑器结论独立于该主题提交，不证明新主题前台渲染。
- 本轮只创建自己的本地未发布草稿；未发布、未编辑既有文章、未改变主题配置或插件。验收草稿ID见JSON；另有探索草稿保留在隔离实例。
- 官方插件提供HTML/Markdown编辑块的作者路径。不能把普通富文本粘贴描述为受支持的增强输入。插件停用/卸载后的编辑与展示、公开发布、实际手机/Safari应用均未验收。
- `bun run verify`：698测试通过、0失败，类型/矩阵/构建及261文件安装包检查通过。本次只新增验收脚本与文档，没有主题产品修改。

## 复跑

使用已有、带拥有标记的独占本地实验室，先启用官方扩展。脚本验证BASE_URL只允许匹配标记的127.0.0.1端口；从该实例的0600凭据文件私下读取登录信息，不输出凭据。

```sh
BASE_URL=http://127.0.0.1:18911 \
LAB_RUNTIME=/absolute/path/to/owned/halo-lab \
CONTENT_BROWSER_RUNTIME=/absolute/path/to/browser-matrix \
bun scripts/content/check-editor.mjs
```

可用`CONTENT_EDITOR_ENGINES=chromium`限定引擎。输出在忽略的`.runtime/content/editor/<timestamp>`，包含报告、保存/重开的HTML和截图；不保存登录态。每次运行创建新的未发布草稿，不清除既有内容，不修改实例设置。案例与内容哈希保存在同名JSON。
