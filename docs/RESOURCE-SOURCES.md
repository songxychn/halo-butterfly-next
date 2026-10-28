> 当前范围按 [DEC-10](parity/DEC-10-THEME-SCOPE.md) 收敛；下方历史验证仅对应其原包。

# 统一主题资源地址

主题默认完整随安装包分发。自定义来源只迁移 Next 的实际 assets，不替换已打包库或改变其版本。已打包的 Typed、LazyLoad、Viewer、InfiniteGrid 等继续使用承载它们的页面文件。

## 配置与托管

把构建后的完整 `templates/assets/` 上传到静态服务器，保留目录和文件名，包括 CSS 引用的字体。资源目录示例：

```yaml
CDN:
  asset_base: https://assets.example.com/halo-butterfly-next/0.1.0-alpha.4/assets
  version: true
```

`asset_base` 接受 HTTPS 或本站根路径，可使用 `${name}`、`${version}`，支持末尾斜杠。不接受查询参数、fragment、认证信息或协议相对地址。无效地址退回安装包。填写后直接生效，留空使用安装包；不再读取 `internal_provider`、`third_party_provider` 或 `custom_format`。单项地址覆盖优先于统一来源。部署前核对镜像目录与当前安装包一致；主题不上传资源，也不把普通公用 npm CDN 当作 Next 页面包。

Font Awesome 默认跟随统一地址，路径为 `plugins/fontawesome/css/all.min.css`。需要独立来源时填写 `CDN.option.fontawesome` 的完整 CSS URL；随包版本固定 6.7.2。所有单项占位符统一使用主题名称、主题版本和实际 assets 相对路径，字体不再使用 npm 包名/文件路径语义。旧来源和字体模板由[离线迁移工具](MIGRATION.md)转换，不在运行时解释。


`CDN.version` 仅控制现有本地标签的 `?v=` 缓存参数。关闭它不去掉 npm CDN 的依赖版本。自定义地址中 `${version}` 继续展开为当前主题版本；不会自动修改站长填写的字面量版本。Prism 及已打包库按当前 ZIP/锁文件供应；不提供任意版本混用承诺。在线服务 SDK 已按 DEC-10 移除。

## 覆盖范围

静态页面/插件公共布局脚本、样式、Loading 外置文件、Pace、Prism/代码配色、特效脚本、Font Awesome 及默认 `images/above.svg` 使用统一来源。内联启动、内联 Loading、内联背景绘制继续内联。用户头像、自定义图片、文章附件、外部字体 URL、Halo 插件资源不改写。

除原有 `main`、`main_css`、`integrations`、`masonry`、`loading`、`fontawesome`、Prism/代码配色之外，新增：

| `CDN.option` 字段 | 范围 |
| --- | --- |
| pace_js | `plugins/pace/pace.min.js`，固定 Pace 1.2.4 |
| pace_default_css | `plugins/pace/pace-theme-minimal.css`；`loading.pace_css_url` 优先 |
| charts | 按需加载的 `js/charts.min.js`，分类/标签/归档统计 |
| effects | 按需加载的 `js/effects.min.js` |
| sharejs | `plugins/sharejs/js/social-share.min.js` |
| sharejs_css | `plugins/sharejs/css/share.min.css`，字体仍按该 CSS 的相对目录加载 |


合并最新 master 后，Mermaid、Chart.js、ABCJS 已随正文功能接入，三个独立覆盖字段分别为 `mermaid`、`chartjs`、`abcjs_basic_js`，默认按统一地址供应 `renderers/*.min.js`；固定版本见 [正文图表与乐谱](BODY-CHARTS-SCORE.md)。本批资源供应裁定见 [DEC-03](parity/DEC-03-RESOURCES-DECISION.md)。

## 回退与局部导航

动态主题脚本/样式发生原生加载错误时，回退一次到安装包。仅超时不重复请求可能迟到执行的脚本。默认主题插图失败也回到本地插图。字体使用 CSS 相对路径；字体失败不等同样式文件的加载错误，需要托管时完整校验。


## 验证

`bun run verify` 包括解析优先级、无效地址、固定版本、重复请求、脚本/样式回退、超时回归。真实 Halo 2.26.1 的本批限定结果见 [资源验证记录](validation/2026-10-13/resource-sources.md)。新设置的性能默认快照已重新冻结，旧性能结果不转移到新包。完整固定双站、真实 SDK、Safari/真机和最终候选验收未据本批局部结果完成；本轮独立审查与配置简化记录见 [DEC-08](parity/DEC-08-CONFIG-DEFAULTS-DRAFT.md)。

默认 `loading.mode: pace` 提供非阻塞进度，`animation` 才使用四种 Loading；缺少 mode 同样使用 Pace，不推断旧动画。`loading.enable: false` 关闭两种资源。Pace 的脚本和 CSS 必须均成功后启动；失败保留正文。裁定和验证见 [DEC-03](parity/DEC-03-RESOURCES-DECISION.md)。

提交并合并最新 master 后的干净包验证、独立审查及修复证据见 [PR 验证记录](validation/2026-10-14/resource-pr.md)；最终精确提交的 CI 结果随 [草稿 PR #411](https://github.com/songxychn/halo-butterfly-next/pull/411) 登记。历史工作区报告保持原来源，不替代此 PR。
