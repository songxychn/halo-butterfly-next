# 统一主题资源地址

当前范围以 [DEC-10](parity/DEC-10-THEME-SCOPE.md) 为准。资源默认随主题包分发；只保留完整 assets 根地址与本地版本缓存开关，不支持单项库替换、自定义渲染器适配包或第三方资源提供方。

```yaml
CDN:
  asset_base: https://assets.example.com/halo-butterfly-next/${version}/assets
  version: true
```

把当前构建生成的完整 `templates/assets/` 上传到静态服务器，保留目录、文件名及 CSS 引用的字体。`asset_base` 支持 HTTPS 或本站根路径，以及 `${name}`、`${version}`；不接受查询参数、fragment、认证信息或协议相对地址。无效地址回退安装包。主题不会上传资源或混用其他版本。

页面脚本、样式、Loading、Pace、Prism、特效、图库、图表/乐谱、Font Awesome 和默认插图使用统一地址。内联启动代码继续内联；用户图片、文章附件、自定义字体及 Halo 插件资源不改写。`CDN.version` 仅控制现有本地标签的版本查询参数。

动态资源发生明确加载错误时回退一次到随包文件；脚本仅超时不重复加载可能迟到执行的代码。默认插图失败回退本地。字体使用 CSS 相对路径，需完整托管；字体失败不等同于 CSS 文件失败。

`CDN.option` 和旧 `third_party_provider` 不再生效，离线迁移报告标记 `removed-feature` 并要求核对。旧配置中的统一目录可继续迁移；不能准确转换的模板报告人工核对。主题内部渲染器握手仅用于同版本包内代码，不是对外扩展接口。

`bun run verify` 检查当前源码及包。历史资源供应记录见 [2026-10-14 验证](validation/2026-10-14/resource-pr.md)，只对应当时的包与范围，不能证明当前候选通过。
