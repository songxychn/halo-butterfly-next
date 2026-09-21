# Halo Butterfly Next

Butterfly 的 Halo 社区维护版，继承[小红的 Halo 移植项目](https://github.com/dhjddcn/halo-theme-butterfly)，分阶段对齐 [Hexo Butterfly](https://github.com/jerryc127/hexo-theme-butterfly)。这是独立维护项目，不代表 Halo 或 Butterfly 官方。

**0.1.0-alpha.3 公开测试版正在准备；当前项目仍为私有预览，尚未公开发行。** 这一版本面向测试站试用，尚未全面对齐 Butterfly 5.7.0，也不是稳定 1.0。最终包身份与验证状态集中记录在[发行说明](docs/RELEASE-alpha.3.md)，当前尚无正式公开的 alpha.3 附件。

原项目及本维护项目的完整开发历史保留在私有维护仓库。拟公开仓库只包含经过资源与敏感信息检查的当前源码快照，同时保留上游署名、许可证及来源说明；公开快照不携带旧资源的 Git 历史。此方案仍待维护者确认。

## 安装与支持范围

实际验证平台为 **Halo 2.26.1**。主题元数据声明 `>=2.26.1 & <2.27.0`，不代表其中所有版本已经测试。搜索入口最低基线为官方 **SearchWidget 1.7.1**，评论入口最低基线为官方 **CommentWidget 3.3.2**；固定实测也是这两个版本，未承诺未来版本组合。插件缺失、停用或低于基线时隐藏对应入口。文章及卡片评论数默认关闭。

发布后，在发行页下载 `halo-butterfly-next-0.1.0-alpha.3.zip`，核对 SHA-256 后通过 Halo 控制台主题管理上传、配置并启用。主题 ID 保持 `halo-butterfly-next`。GitHub 自动生成的 Source code 压缩包是构建源码，不能直接作为主题 ZIP 安装。

- [安装、备份、同 ID 升级及回退](docs/INSTALL-UPGRADE.md)
- [从原 theme-butterfly 迁移](docs/MIGRATION.md)
- [alpha.3 发行说明草稿](docs/RELEASE-alpha.3.md)

## 本轮变化

- 修复明亮文章封面下元信息、评论计数，以及卡片、页脚、标签云的对比度；增加或保留可见键盘焦点。
- 开启顶图遮罩时增强导航区域的局部渐隐遮罩；提高分页当前页、悬停及焦点对比度，列表标题和元信息链接提供可读的悬停颜色、常驻下划线或焦点提示。
- 将 Fancyapps 灯箱替换为 **MIT Viewer.js 1.14.0**，支持多图、缩放、旋转、翻转、幻灯片及缩略图，并处理键盘入口和关闭后的焦点恢复。
- 提高正文链接、引用、版权字段及默认 One Light/One Dark 代码高亮的对比度，为可滚动代码块提供键盘入口。
- 修复无分类新站的统计图初始化异常、代码折叠后按钮被裁剪、慢图片阻塞 Loading 等核心路径。
- 改用系统光标，清理不再使用且来源未核实的继承素材；随源码和安装包提供第三方许可及改写来源说明。

完整更新见[变更记录](CHANGELOG.md)。最终安装包的整体验收状态以发行说明中绑定的包身份与证据为准。

## 已知限制

- SearchWidget 1.7.1 通过 Escape 或遮罩关闭后，焦点不会返回搜索入口，键盘用户需重新使用 Tab 导航。用户已允许公开 alpha 明示此限制后放行；缺陷没有修复，原检查继续记录失败，完整无障碍和 1.0 门禁不豁免。详见[搜索焦点裁定](docs/SEARCH-FOCUS-DECISION.md)。
- 关闭 `mask.header` 时，明亮顶图上的导航和大标题仍可能对比不足。文章元信息的局部底板不覆盖导航和大标题。建议保留顶图遮罩，或选择与文字有足够对比度的封面；不宣称任意图片/遮罩组合均符合可访问性要求。
- 自定义 CSS、第三方代码高亮主题和用户额外注入代码可能改变颜色、焦点或布局，不包含在默认配色的通过范围中。
- 友链、图库、瞬间和正文扩展，以及完整插件生态仍按各自证据标注实验性或未验证；有模板不等于已经通过端到端验收。Hexo 的 `{% %}` 标签不能直接在 Halo 中解析。
- 无头 Chromium/Firefox/WebKit 与手机宽度测试不能替代实际 Safari、真机触摸/软键盘或屏幕阅读器。真实 Safari、真实手机、完整性能合同和完整 1.0 验收尚未完成。

测试反馈请附主题/平台/插件版本、浏览器与复现步骤，并先移除日志中的 Cookie、Token、密码、个人信息和私有站点配置。不要上传数据库或凭据文件。

## 源码与构建

需要 Node.js 24、pnpm 11.19.0，以及 Python 3（本地守卫检查）。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm verify
```

输出 `dist/halo-butterfly-next-0.1.0-alpha.3.zip`。源码在 `src/`；`templates/` 与 `dist/` 为生成物，不手工修改。详见[对应源码与构建说明](docs/SOURCE-BUILD.md)、[双站实验室](docs/COMPARISON-LAB.md)和[贡献流程](CONTRIBUTING.md)。无服务 CI 通过不能替代真实 Halo 安装与插件交互验证。

## 许可与后续计划

主题沿用 [GPL-3.0](LICENSE)，保留小红及历史贡献者署名；其他组件许可见[第三方资源说明](docs/THIRD_PARTY.md)和[改写来源清单](third-party-licenses/UPSTREAM-ATTRIBUTION.txt)。旧 Font Awesome Pro、旧字体和旧默认照片不属于当前安装包；公开范围不为旧历史资源追加授权。

[公开 alpha 计划](docs/PUBLIC-ALPHA.md)、[完整功能矩阵](docs/parity/MATRIX.md)和[1.0 验收合同](docs/RELEASE-ACCEPTANCE.md)继续保留各项未完成状态。
