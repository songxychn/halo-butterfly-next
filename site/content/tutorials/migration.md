# 从旧 Butterfly 主题迁移

适用：原 Halo Butterfly 2.0.5 或源码结构 2.0.7 的配置，迁移目标为 Halo Butterfly Next 0.1.0-alpha.4 测试版。本文不处理 Hexo 内容导入。

原主题 ID 为 `theme-butterfly`，Next 为 `halo-butterfly-next`。两个主题的设置分别保存。先安装 Next 并在测试站核对结果，再决定是否切换正式站点。

## 导出旧配置

备份当前站点、原主题包与配置。熟悉 API 的维护者可以通过已认证请求读取 `GET /apis/api.console.halo.run/v1alpha1/themes/theme-butterfly/json-config`，保存为本地文件。

转换工具支持分组 JSON，也支持 `kind: ConfigMap` 的 JSON/YAML。不要把包含私人链接、自定义 HTML 或访问凭据的文件提交到仓库。

## 本地转换

在与目标版本对应的源码目录中，按构建说明准备 Bun 1.4.0 和依赖，然后执行：

```bash
bun run migrate --input old.json --from 2.0.5 --output next.json
```

如果来源确实是 2.0.7 源码结构，改用 `--from 2.0.7`。这条命令只生成本地输出及 `next.json.report.json` 报告，不连接 Halo，不修改输入，也不覆盖已有输出文件。

## 阅读转换报告

工具可以映射旧图片加载、代码设置、侧栏按钮、社交链接和字幕分隔格式等字段。旧默认字体会改为系统字体，旧脚本与样式 CDN 配置会转向当前包资源。

自定义封面仍需要检查可访问性，Pro 专用图标需要改用现有 Free 图标。出现 `unsupported`、`type-mismatch` 或 `manual-review` 时逐项处理；`needsReview` 不为真也不等于可以跳过页面检查。

字幕分隔符、菜单初始展开方式和首页标题定位可能与旧版不同。先检查[首页配置](homepage.md)与[导航配置](navigation.md)，保留旧配置以便对照。

## 应用到 Next

先保存 Next 当前配置。经检查的分组 JSON 可以通过已认证的 `PUT /apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config` 应用；该接口替换整份主题配置，不适合直接提交一个零散分组。

使用 `--format configmap` 得到的是资源格式，不能当作分组 JSON 发给上面的接口。不熟悉 API 时，可以参照报告在控制台逐项填写，避免一次性替换。

## 切换与检查

确认首页、文章、单页、手机菜单、侧栏和插件入口正常，再切换活动主题。保留原主题与它的配置，出现问题时可以重新启用原主题，不要把 Next 的配置写回旧主题。

Hexo 的 `{% %}` 标签不会被 Halo 主题直接解析；`bun run migrate` 也不是正文转换工具。文章中的这类语法需要单独处理，不能用配置转换成功来推断内容迁移完成。
