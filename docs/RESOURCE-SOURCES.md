# 统一主题资源地址

主题默认完整随安装包分发。自定义来源只迁移 Next 的实际 assets，不替换已打包库或改变其版本。已打包的 Typed、LazyLoad、Viewer、InfiniteGrid 等继续使用承载它们的页面文件。

## 配置与托管

把构建后的完整 `templates/assets/` 上传到静态服务器，保留目录和文件名，包括 CSS 引用的字体。资源目录示例：

```yaml
CDN:
  internal_provider: custom
  asset_base: https://assets.example.com/halo-butterfly-next/0.1.0-alpha.4/assets
  third_party_provider: inherit
  version: true
```

`asset_base` 接受 HTTPS 或本站根路径，可使用 `${name}`、`${version}`，支持末尾斜杠。不接受查询参数、fragment、认证信息或协议相对地址。无效地址退回安装包。选择自定义来源时生效；留空继续使用原 `custom_format`，其中 `${file}` 是完整 assets 相对路径。单项地址覆盖优先于统一来源。部署前核对镜像目录与当前安装包一致；主题不上传资源，也不把普通公用 npm CDN 当作 Next 页面包。

新配置的 Font Awesome 默认 `inherit`，跟随统一地址；旧配置显式保存 `third_party_provider: local` 时仍使用安装包，需要改成 `inherit` 才跟随。显式 jsdelivr/unpkg/cdnjs 保留独立来源，全部固定 Font Awesome Free 6.7.2；显式 `custom` 兼容原字体包地址格式（`${name}` 为 `@fortawesome/fontawesome-free`，`${file}` 为 `css/all.min.css`）。统一主题地址使用 `plugins/fontawesome/css/all.min.css`，两种路径职责不同。

`CDN.version` 仅控制现有本地标签的 `?v=` 缓存参数。关闭它不去掉 npm CDN 的依赖版本。自定义地址中 `${version}` 继续展开为当前主题版本；不会自动修改站长填写的字面量版本。Prism、Share.js 及已打包库按当前 ZIP/锁文件供应；不提供任意版本混用承诺。分析、聊天、广告、AddToAny、不蒜子等在线服务脚本仍是服务方发布物，不能据此宣称内容哈希或服务版本已锁定。

## 覆盖范围

静态页面/插件公共布局脚本、样式、Loading 外置文件、Pace、Prism/代码配色、Share.js、特效脚本、Font Awesome 及默认 `images/above.svg` 使用统一来源。内联启动、内联 Loading、内联背景绘制继续内联。用户头像、自定义图片、文章附件、外部字体 URL、Halo 插件资源不改写。

除原有 `main`、`main_css`、`integrations`、`masonry`、`loading`、`fontawesome`、Prism/代码配色之外，新增：

| `CDN.option` 字段 | 范围 |
| --- | --- |
| pace_js | `plugins/pace/pace.min.js`，固定 Pace 1.2.4 |
| pace_default_css | `plugins/pace/pace-theme-minimal.css`；`loading.pace_css_url` 优先 |
| effects | 按需加载的 `js/effects.min.js` |
| sharejs | `plugins/sharejs/js/social-share.min.js` |
| sharejs_css | `plugins/sharejs/css/share.min.css`，字体仍按该 CSS 的相对目录加载 |
| busuanzi | 不蒜子服务入口；留空用官方地址，统一主题地址不改写它 |

Share.js 只有选择该分享方式并存在平台项时加载；不蒜子只有对应计数实际显示时加载。覆盖不蒜子入口不自动改写其内部数据端点。第三方服务初始化方式和原统计口径保持原样；本地桩计数不是正式服务联调通过。

Mermaid、Chart.js、ABCJS 随各自功能接入；本批没有新增空设置或渲染库。其他资源替代的范围见 [DEC-03 草案](parity/DEC-03-RESOURCES-DRAFT.md)，未据草案关闭矩阵条目。

## 回退与局部导航

动态主题脚本/样式发生原生加载错误时，回退一次到安装包。Share.js 必须有可用入口 API 才初始化；失败保留复制链接。仅超时不重复请求可能迟到执行的脚本。默认主题插图失败也回到本地插图。字体使用 CSS 相对路径；字体失败不等同样式文件的加载错误，需要托管时完整校验。

PJAX 只接纳当前配置解析出的具体页面脚本及其本地回退，不信任整个 CDN 域名，也不信任目标响应任意声明的回退脚本。原有文章/单页 tracker、插件和第三方 SDK 的完整导航边界保持；列表往返仍需通过初始化、清理和历史行为检查。未知脚本、超时或不兼容目标回退普通导航。

## 验证

`bun run verify` 包括解析优先级、无效地址、固定版本、重复请求、脚本/样式回退、超时和 PJAX 地址约束回归。真实 Halo 2.26.1 的本批限定结果见 [资源验证记录](validation/2026-10-13/resource-sources.md)。新设置的性能默认快照已重新冻结，旧性能结果不转移到新包。完整固定双站、真实 SDK、Safari/真机、独立审查和最终候选 CI 未据本批局部结果完成。

默认 `loading.mode: pace` 提供非阻塞进度，`animation` 才使用四种 Loading；缺少 mode 同样使用 Pace，不推断旧动画。`loading.enable: false` 关闭两种资源。Pace 的脚本和 CSS 必须均成功后启动；失败保留正文与 PJAX 普通忙碌提示。裁定和验证见 [DEC-03](parity/DEC-03-RESOURCES-DECISION.md)。
