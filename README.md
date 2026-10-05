# Halo Butterfly Next

Butterfly 的 Halo 社区维护版，继承[小红的 Halo 移植项目](https://github.com/dhjddcn/halo-theme-butterfly)，分阶段对齐 [Hexo Butterfly](https://github.com/jerryc127/hexo-theme-butterfly)。这是独立维护项目，不代表 Halo 或 Butterfly 官方。

[在线演示](https://butterfly.baizhukui.com/) · [使用文档](https://butterfly.baizhukui.com/docs) · [功能演示导览](https://butterfly.baizhukui.com/archives/demo-guide)

**文档与演示站已上线；0.1.0-alpha.3 主题安装包仍在准备，尚未公开发行。** 这一版本面向测试站试用，尚未全面对齐 Butterfly 5.7.0，也不是稳定 1.0。最终包身份与验证状态集中记录在[发行说明](docs/RELEASE-alpha.3.md)，当前尚无正式公开的 alpha.3 附件。

## 页面预览

以下截图采自 [在线演示站](https://butterfly.baizhukui.com/)（2026-10-05，Halo 2.26.1），展示默认全屏首页、摄影封面卡片及正文的亮暗配色。

![在线演示站首页，桌面亮色](docs/images/demo/home-desktop-light.jpg)

![在线演示站文章卡片与侧栏，桌面亮色](docs/images/demo/cards-desktop-light.jpg)

| 文章桌面暗色 | 文章手机宽度亮色 |
| --- | --- |
| <img src="docs/images/demo/article-desktop-dark.jpg" alt="正文排版演示，桌面暗色" width="720"> | <img src="docs/images/demo/article-mobile-light.jpg" alt="正文排版演示，手机宽度亮色" width="240"> |

截图使用独立无头 Chromium；手机宽度预览不代表实机验收。站点沿用此前验收的 demo 主题包，可能与最新源码存在差异；部署版本、验证范围与已知限制见[站点部署说明](site/deploy/README.md)。主题安装包的发行验收仍见[候选验收记录](docs/ALPHA3-VERIFICATION.md)。

## 安装与支持范围

实际验证平台为 **Halo 2.26.1**。主题元数据声明 `>=2.26.1 & <2.27.0`，不代表其中所有版本已经测试。搜索入口最低基线为官方 **SearchWidget 1.7.1**，评论入口最低基线为官方 **CommentWidget 3.3.2**；固定实测也是这两个版本，未承诺未来版本组合。插件缺失、停用或低于基线时隐藏对应入口。文章及卡片评论数默认关闭。

发布后，在发行页下载 `halo-butterfly-next-0.1.0-alpha.3.zip`，核对 SHA-256 后通过 Halo 控制台主题管理上传、配置并启用。主题 ID 保持 `halo-butterfly-next`。GitHub 自动生成的 Source code 压缩包是构建源码，不能直接作为主题 ZIP 安装。

- [安装、备份、同 ID 升级及回退](docs/INSTALL-UPGRADE.md)
- [从原 theme-butterfly 迁移](docs/MIGRATION.md)
- [alpha.3 发行说明草稿](docs/RELEASE-alpha.3.md)
- [应用市场上架差距与派生说明](docs/APP-STORE-READINESS.md)（准备中，尚不具备提交条件）

## 本轮变化

- 修复明亮文章封面下元信息、评论计数，以及卡片、页脚、标签云的对比度；增加或保留可见键盘焦点。
- 提高分页当前页、悬停及焦点对比度，列表标题和元信息链接提供可读的悬停颜色、常驻下划线或焦点提示。
- 将 Fancyapps 灯箱替换为 **MIT Viewer.js 1.14.0**，支持多图、缩放、旋转、翻转、幻灯片及缩略图，并处理键盘入口和关闭后的焦点恢复。
- 提高正文链接、引用、版权字段及默认 One Light/One Dark 代码高亮的对比度，为可滚动代码块提供键盘入口。
- 修复无分类新站的统计图初始化异常、代码折叠后按钮被裁剪、慢图片阻塞 Loading 等核心路径。
- 改用系统光标，清理不再使用且来源未核实的继承素材；随源码和安装包提供第三方许可及改写来源说明。

版本发行与发布后 demo 更新流程见[发布说明](releases/README.md)和[H2 演示站机制](site/demo/README.md)。

完整更新见[变更记录](CHANGELOG.md)。最终安装包的整体验收状态以发行说明中绑定的包身份与证据为准。

## 已知限制

- SearchWidget 1.7.1 通过 Escape 或遮罩关闭后，焦点不会返回搜索入口，键盘用户需重新使用 Tab 导航。用户已允许公开 alpha 明示此限制后放行；缺陷没有修复，原检查继续记录失败，完整无障碍和 1.0 门禁不豁免。详见[搜索焦点裁定](docs/SEARCH-FOCUS-DECISION.md)。
- 关闭 `mask.header` 时，明亮顶图上的导航和大标题仍可能对比不足。文章元信息的局部底板不覆盖导航和大标题。建议保留顶图遮罩，或选择与文字有足够对比度的封面；不宣称任意图片/遮罩组合均符合可访问性要求。
- Halo 2.26.1 的原生连接测试仍出现静态资源无响应和页面就绪超时，涉及 macOS Firefox、插件导航及 Linux 浏览器测试，尚未解决或获准放行。它可能影响页面加载，详情见[候选验收记录](docs/ALPHA3-VERIFICATION.md)；当前候选仍未达到待公开确认状态。
- 移动长文章的单次 Lighthouse 模拟结果在本轮优化后 LCP 仍约 4.65 秒；这不是实机等待时间或性能达标声明，完整性能合同仍未完成。
- 自定义 CSS、第三方代码高亮主题和用户额外注入代码可能改变颜色、焦点或布局，不包含在默认配色的通过范围中。
- 友链、图库、瞬间和正文扩展，以及完整插件生态仍按各自证据标注实验性或未验证；有模板不等于已经通过端到端验收。Hexo 的 `{% %}` 标签不能直接在 Halo 中解析。
- 无头 Chromium/Firefox/WebKit 与手机宽度测试不能替代实际 Safari、真机触摸/软键盘或屏幕阅读器。真实 Safari、真实手机、完整性能合同和完整 1.0 验收尚未完成。

测试反馈请附主题/平台/插件版本、浏览器与复现步骤，并先移除日志中的 Cookie、Token、密码、个人信息和私有站点配置。不要上传数据库或凭据文件。

## 源码与构建

需要 Node.js 24、Bun 1.4.0，以及 Python 3（本地守卫检查）。Bun 负责依赖管理和脚本入口，构建与测试仍由 Node 24 执行。使用 `bun run build`，避免与 Bun 自带的 `bun build` 打包命令混淆。

```sh
bun install --frozen-lockfile --ignore-scripts
bun run verify
```

输出 `dist/halo-butterfly-next-0.1.0-alpha.3.zip`。源码在 `src/`；`templates/` 与 `dist/` 为生成物，不手工修改。详见[对应源码与构建说明](docs/SOURCE-BUILD.md)、[双站实验室](docs/COMPARISON-LAB.md)和[贡献流程](CONTRIBUTING.md)。无服务 CI 通过不能替代真实 Halo 安装与插件交互验证。

## 许可与后续计划

主题沿用 [GPL-3.0](LICENSE)，保留小红及历史贡献者署名；其他组件许可见[第三方资源说明](docs/THIRD_PARTY.md)和[改写来源清单](third-party-licenses/UPSTREAM-ATTRIBUTION.txt)。旧 Font Awesome Pro、旧字体和旧默认照片不属于当前安装包；公开范围不为旧历史资源追加授权。

[公开 alpha 计划](docs/PUBLIC-ALPHA.md)、[完整功能矩阵](docs/parity/MATRIX.md)和[1.0 验收合同](docs/RELEASE-ACCEPTANCE.md)继续保留各项未完成状态。

自维护浏览器代码统一使用 TypeScript（`src/js/**/*.ts`、`src/plugins/loading/*.ts`），运行 `bun run typecheck` 做严格类型检查；`bun run verify` 已包含此步骤。Node 24 直接加载测试引用的可擦除 TS 语法，测试脚本仍使用 `node:test`。第三方压缩库保留 JS，使用声明文件描述调用边界。模板只注入 Halo 数据，首屏逻辑由 `src/js/bootstrap.ts` 构建后同步内联，页面资源仍输出原有 `.min.js` 文件名。
