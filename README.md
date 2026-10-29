# Halo Butterfly Next

Butterfly 的 Halo 社区维护版，继承[小红的 Halo 移植项目](https://github.com/dhjddcn/halo-theme-butterfly)，分阶段对齐 [Hexo Butterfly](https://github.com/jerryc127/hexo-theme-butterfly)。这是独立维护项目，不代表 Halo 或 Butterfly 官方。

[在线演示](https://butterfly.baizhukui.com/) · [使用文档](https://butterfly.baizhukui.com/docs) · [功能演示导览](https://butterfly.baizhukui.com/archives/demo-guide)

**[1.0.0 已正式发布](https://github.com/songxychn/halo-butterfly-next/releases/tag/v1.0.0)。** 安装包、对应源码、校验摘要及已知限制见[发行说明](releases/v1.0.0.md)。本版聚焦 Butterfly 的布局、视觉与阅读体验，不宣称完整对齐 Butterfly 5.7.0。

**Demo 与主题发行分别部署；本次 1.0.0 发布尚未更新公网 Demo。** 在线演示和下方历史截图不能作为 1.0.0 已上线的证明。

## 页面预览

以下截图采自 [在线演示站](https://butterfly.baizhukui.com/)（2026-10-05，Halo 2.26.1），展示默认全屏首页、摄影封面卡片及正文的亮暗配色。

![在线演示站首页，桌面亮色](docs/images/demo/home-desktop-light.jpg)

![在线演示站文章卡片与侧栏，桌面亮色](docs/images/demo/cards-desktop-light.jpg)

| 文章桌面暗色 | 文章手机宽度亮色 |
| --- | --- |
| <img src="docs/images/demo/article-desktop-dark.jpg" alt="正文排版演示，桌面暗色" width="720"> | <img src="docs/images/demo/article-mobile-light.jpg" alt="正文排版演示，手机宽度亮色" width="240"> |

截图保留 2026-10-05 预览站的采集时间，使用独立无头 Chromium；手机宽度预览不代表实机验收。Demo 需手动推广已发布版本，机制见[H2 演示站说明](site/demo/README.md)。alpha.4 的[历史部署记录](docs/validation/2026-10-09/alpha4-publication.md)仅对应当时的版本与部署。

## 安装与支持范围

1.0.0 的最低 Halo 版本为 **2.20.2**，主题元数据声明 `>=2.20.2`，不设上限。最终候选的固定运行验收使用 **Halo 2.27.1**，范围见[1.0 验证记录](docs/validation/2026-10-29/release-readiness.md)。声明不代表全部平台版本或插件组合均已验证；较早 Halo 版本的成功与失败保存在[历史兼容记录](docs/validation/2026-10-08/halo-earlier-compatibility.md)，不外推为当前包的完整矩阵。

搜索入口兼容基线仍为官方 **SearchWidget 1.7.1**，1.0 集成验收固定 **1.8.0**，建议升级以获得关闭焦点恢复修复；1.8.0 要求 **Halo ≥2.26.0**。评论入口及实测基线为官方 **CommentWidget 3.3.2**，也要求 **Halo ≥2.26.0**；较低 Halo 版本不提供该评论入口。仅承诺已登记的测试组合，未承诺未来版本组合。插件缺失、停用或低于入口基线时隐藏对应入口。文章及卡片评论数默认关闭。公共插件页面布局契约从 Halo 2.26.0 提供，不影响较低版本的主题核心页面。alpha.3 的历史实测使用搜索 1.7.1；历史 Demo 记录不代表 1.0 部署状态。

在 [1.0.0 发行页](https://github.com/songxychn/halo-butterfly-next/releases/tag/v1.0.0)下载 `halo-butterfly-next-1.0.0.zip`，核对 SHA-256 后通过 Halo 控制台主题管理上传、配置并启用。主题 ID 保持 `halo-butterfly-next`。GitHub 自动生成的 Source code 压缩包是构建源码，不能直接作为主题 ZIP 安装。

- [安装、备份、同 ID 升级及回退](docs/INSTALL-UPGRADE.md)
- [从原 theme-butterfly 迁移](docs/MIGRATION.md)
- [数学公式与 KaTeX 插件适配](docs/MATH.md)
- [SEO、站点验证与代码注入](docs/SEO-INJECTION.md)
- [侧栏、图片与外观配置](docs/APPEARANCE-OPTIONS.md)
- [1.0.0 发行说明](releases/v1.0.0.md)
- [应用市场上架差距与派生说明](docs/APP-STORE-READINESS.md)（首次审核暂未通过，整改中，尚不具备重新提交条件）

版本发行与单独授权的 Demo 部署流程见[发布说明](releases/README.md)和[H2 演示站机制](site/demo/README.md)。

完整更新见[变更记录](CHANGELOG.md)。最终安装包的整体验收状态以发行说明中绑定的包身份与证据为准。

正文提示、原生折叠、Tabs、时间线、链接按钮、图片网格与系列卡片采用可读 HTML 和渐进增强，写法见[正文扩展](docs/CONTENT-EXTENSIONS.md)。换主题后保留分组标题、文字、图片和真实链接；可选属性只负责当前主题的样式与交互。

## 已知限制

1.0 已完成 [有限发布门禁](docs/parity/DEC-09-RELEASE-CLOSURE.md)要求的核心使用、安装/升级/回退、构建/许可、独立审查及 CI，实际范围见[最终验证记录](docs/validation/2026-10-29/release-readiness.md)。矩阵保留未验证状态，完整生态和长尾覆盖列为后续改进；历史 alpha 记录仍只对应其原版本。

- 所测 Playwright WebKit 中，刷新后恢复的评论图片草稿可能上传失败；新选图片直接上传对照正常。[复现证据](docs/validation/2026-10-27/webkit-file-transport.md)不外推实际 Safari。未交付插件修复，1.0 不承诺图片草稿刷新后可靠续传。
- 普通图片入口不保证初始 HTML 带原生懒加载属性；不同编辑器保存增强属性的行为有差异。不承诺全部编辑器、插件版本或外部 SDK 组合已验证；Hexo 的 `{% %}` 标签不能直接在 Halo 中解析。
- 保留 Butterfly 默认浅色顶图文字时，明亮封面上的导航和标题可能对比不足。自定义 CSS、配色和额外注入代码也会改变颜色、焦点或布局；应按实际内容检查可读性，不宣称完整无障碍通过。
- 实际 Safari、真实手机、屏幕阅读器、全量插件业务与长尾组合尚无完整覆盖。PWA、评论/公式严格零资源按需仍延期；旧性能报告不作为本版性能达标结论。
- 较早版本的搜索焦点、资源加载及性能结果继续保存在[alpha.3](releases/v0.1.0-alpha.3.md)、[alpha.4](releases/v0.1.0-alpha.4.md)和[平台资源加载记录](docs/RESOURCE-LOADING-DECISION.md)中，保留各自的受测版本边界。

测试反馈请附主题/平台/插件版本、浏览器与复现步骤，并先移除日志中的 Cookie、Token、密码、个人信息和私有站点配置。不要上传数据库或凭据文件。

## 源码与构建

需要 Bun 1.4.0，以及 Python 3（本地守卫检查）。Bun 负责依赖管理、脚本执行和测试运行；当前源码不要求安装 Node.js。使用 `bun run build`，避免与 Bun 自带的 `bun build` 打包命令混淆。

```sh
bun install --frozen-lockfile --ignore-scripts
bun run verify
```

**1.0.0 已正式发布**，发行范围与限制见[1.0 发行说明](releases/v1.0.0.md)。复现发行包请使用该版本的对应源码附件，master 后续提交可能继续变化。构建输出 `dist/halo-butterfly-next-1.0.0.zip`。源码在 `src/`；`templates/` 与 `dist/` 为生成物，不手工修改。详见[对应源码与构建说明](docs/SOURCE-BUILD.md)、[双站实验室](docs/COMPARISON-LAB.md)和[贡献流程](CONTRIBUTING.md)。无服务 CI 通过不能替代真实 Halo 安装与插件交互验证。

## 许可与后续计划

主题沿用 [GPL-3.0](LICENSE)，保留小红及历史贡献者署名；其他组件许可见[第三方资源说明](docs/THIRD_PARTY.md)和[改写来源清单](third-party-licenses/UPSTREAM-ATTRIBUTION.txt)。旧 Font Awesome Pro、旧字体和旧默认照片不属于当前安装包；公开范围不为旧历史资源追加授权。

主题范围已按 [DEC-10](docs/parity/DEC-10-THEME-SCOPE.md) 收敛：原生整页导航、Halo 阅读量、本地字幕与原生分享；不再内置分析、聊天、广告和第三方分享 SDK。

[历史 alpha 计划](docs/PUBLIC-ALPHA.md)、[完整功能矩阵](docs/parity/MATRIX.md)和[1.0 验收要求](docs/RELEASE-ACCEPTANCE.md)保留历史范围及未覆盖项目；最终发行结论以[1.0 发行说明](releases/v1.0.0.md)和对应证据为准。

自维护浏览器代码统一使用 TypeScript（`src/js/**/*.ts`、`src/plugins/loading/*.ts`），运行 `bun run typecheck` 做严格类型检查；`bun run verify` 已包含此步骤。Bun 直接执行测试引用的 TypeScript，测试使用 `bun:test` 并隔离各文件的全局环境；类型检查仍由 `tsc --noEmit` 独立完成。第三方压缩库保留 JS，使用声明文件描述调用边界。模板只注入 Halo 数据，首屏逻辑由 `src/js/bootstrap.ts` 构建后同步内联，页面资源仍输出原有 `.min.js` 文件名。
