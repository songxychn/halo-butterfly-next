# 正文图表与乐谱限定验证

实现提交 `6e44ebd9fef18d758a947b7ad8b0b86a671a6632`，基于 master `5622798dd06306c8b56b519581d807cd4f473b70`；最终材料提交只补证据与矩阵链接。开发包版本仍为 0.1.0-alpha.4，不是新的发行物，未发布/部署。[机器汇总](body-renderers.json)与每轮原始报告分别保留包身份。

ZIP SHA-256：`78c264f3e089a64731bf24f79bce1efa662ed0b75bd1cebe8badc46792d653bb`。Bun 1.4.0 的冻结安装和 `bun run verify` 通过 645 项测试、247 文件包检查；独立 Halo 2.26.1 安装的 247 文件逐字节一致。构建前后重复 ZIP 摘要一致。安装身份由调用方声明 SHA，并用包字节比对核实；不能仅凭安装记录宣称源码验收。

## 通过范围

| 检查 | 项数 | 环境与结果 |
| --- | ---: | --- |
| [合成正文](body-renderers/synthetic-6e44ebd.json) | 60 | Chromium / Firefox / WebKit；1440×1000、390×844；亮/暗；正常、空正文、关闭、格式错误和 Mermaid 交互关闭 |
| [边界检查](body-renderers/edges-6e44ebd.json) | 72 | 同三引擎/视口/模式；自定义资源 404、接口缺失、全部 SDK 不可用后重试恢复、并排说明、安全字段/指令、关闭 JavaScript |
| [原生 Halo 页面](body-renderers/halo-6e44ebd-native.json) | 32 | Chromium / WebKit；两视口/模式；文章、独立单页、单篇关闭与格式错误 |
| [Firefox Halo 传输对照](body-renderers/halo-6e44ebd-firefox.json) | 16 | 相同页面/视口/模式；本地代理对上游逐请求 `Connection: close`；属于对照，不计原生传输通过 |
| [配置覆盖](body-renderers/overrides.json) | 18 | 三引擎；390×844；全局关闭/单篇开启、ABC `per_page=false` opt-in、Mermaid `code_write=false`；同样使用独立连接对照，结束后恢复配置 |

上述浏览器报告共 198 项通过，传输对照明确单列。实现提交记录的 tracked dirty 为空；现有未跟踪 `.codegraph/` 未纳入实现。

正常夹具同时含三种等效 HTML 和三种语言代码块。检查实际 Mermaid `<text>` 标签、谱面音符和两个 Canvas；按钮/键盘/鼠标拖动、隔离新页、SVG 下载、乐谱源码复制和拒绝反馈（读回 `X:1` 前缀，未作整段字节比对）、图表数据表及系列显隐均验证。每页三轮模式切换保留系列状态；合成正文五轮清理/重新进入验证释放和去重。失败显示源码；禁用和空正文没有渲染器请求。无 JavaScript 时上游 hidden 源码仍可见。

[实际插件状态](body-renderers/plugin-state.json)包括 Shiki 1.3.2、SearchWidget 1.7.1、CommentWidget 3.1.2 等 Halo JAR 自带插件。此处只声明正文与高亮容器共存，不能把版本记录当作搜索/评论完整验收。[独立 agent-browser 元素快照](body-renderers/agent-browser-final-snapshot.txt)检查渲染完成后的原生页面。

[桌面亮色截图](body-renderers/desktop-light.png)、[手机暗色截图](body-renderers/mobile-dark.png)来自交互检查，包含人为拒绝复制后的反馈、隐藏的第一组数据以及滚动后的固定导航状态，不是默认冷启动展示图。

## 失败与修复证据

- [第一轮合成](body-renderers/synthetic-first.json)因清理残留状态/重复包裹而超时；该轮中断，不算整轮完成。修复后最终 60 项通过。
- [初期原生 Halo](body-renderers/halo-first.json)中 Firefox 的导航停在原有 Prism CSS 请求，未进入正文初始化；该轮中断，不能以已有通过项计整轮成功。
- [文字/插件集成检查](body-renderers/halo-visible-native.json)保留 16 失败/16 通过。截图发现 Mermaid 清理掉 HTML 标签导致节点字缺失，以及 Shiki 的服务端 `shiki-code` Shadow DOM 遮盖代码输入的绘制结果。分别固定 `htmlLabels=false` 和移出已识别渲染输入，最终实际 SVG 文字/高亮错误断言及截图通过。普通代码保留原高亮器。
- 配置探针曾在关闭 context 时使未完成的 `route.fetch` 报错，改为独立 HTTP 代理；随后重复建立登录会话出现登录失败，改为单一认证会话并恢复测试配置。相关本地日志在 `.runtime/body-renderers/overrides*.log`，不包含在通过报告中，也不作为产品通过材料。

Firefox 原生失败与既有 [#338](https://github.com/songxychn/halo-butterfly-next/issues/338)记录的持久连接现象相似。关闭上游持久连接后通过，支持传输条件相关的判断；但本次[直接排队/顺序 Prism 对照](body-renderers/transport-diagnostic.json)全部返回 200，未重现那个特定排队故障，不能确认此次与 #338 同根因。原生 Firefox 完整矩阵仍待验收；没有加重试或放宽断言把它计为通过。

## 交付边界

[配置与输入说明](../../BODY-CHARTS-SCORE.md)记录支持的 JSON、HTML/语言输入、失败与回退。Mermaid 11.16.0、Chart.js 4.5.1、ABCJS 6.6.4 与固定 Butterfly 5.7.0 供应版一致；DOMPurify 3.4.12 清理 SVG，许可随包分发。[包体记录](body-renderers/package-size.json)包含三类独立包尺寸：Mermaid 未压缩约 3.28 MiB，仅按内容加载，不声明已达性能预算。

矩阵 31 项为 `implemented-unverified`，0 项提升为 verified。未执行完整固定双站、全部图型/参数域、实际 Safari/真机双指、屏幕阅读器、性能预算、完整升级回退及独立审查。ABC 提供谱面阅读/复制/导出，不包含声音合成和播放。离线 Hexo 标签转换仍待开发。完整 1.0 继续按发布合同验收。
