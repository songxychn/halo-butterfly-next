# 从原 Halo Butterfly 迁移

Next 的主题 ID、Setting 和 ConfigMap 都独立。安装 Next 不会改写原主题配置。先在测试站安装新主题，再迁移配置、检查页面，最后切换正式站点；保留原主题安装包和配置可用于回退。

## 导出与转换

输入支持原主题的 JSON 分组配置，以及 `kind: ConfigMap` 的 JSON/YAML（其中 `data` 的各组为 JSON 字符串）。分组配置可从 Halo 控制台开发者工具或经认证的 API `GET /apis/api.console.halo.run/v1alpha1/themes/theme-butterfly/json-config` 获取。不要把包含个人链接或自定义 HTML 的配置提交进仓库。

```bash
pnpm migrate --input old.json --from 2.0.5 --output next.json
# 如果来源是原仓库 2.0.7 源码版，改为 --from 2.0.7
# 需要 Halo ConfigMap 格式时追加 --format configmap
```

脚本只在本地生成新文件和 `next.json.report.json`，不会连接 Halo、修改输入或覆盖已有输出。报告只记录字段、动作和目标字段，不包含原始值。配置输出采用仅当前用户可读写的权限。

默认输出是 Next 的分组 JSON，核对后可通过已认证的 Halo API `PUT /apis/api.console.halo.run/v1alpha1/themes/theme-butterfly-next/json-config` 应用；该请求替换新主题整份配置，应用前也应导出 Next 当前配置。`--format configmap` 面向熟悉 Halo 自定义资源的维护者，不要将它当成分组 JSON 发送给上述接口。

## 自动转换范围

| 原字段 | 转换 |
| --- | --- |
| 2.0.5 的扁平图片加载配置 | `loading.img` |
| `code.*`、`post.enable_h_title` | `render.*` |
| `aside.button` 的 `&+&` 字符串 | 按钮名称/链接对象 |
| `socials.no_data` | `aside.social` 的名称、图标、链接列表 |
| 首页打字机 `&+&` 分隔文本 | `index.typewriter_custom_text`，改用 `\|&\|` 分隔 |
| 2.0.7 中仍有对应项的字段 | 保留值，包括 `false` 和空列表 |

原版字体重置为系统字体，已知的原版默认封面重置为 Next 内置 SVG；自定义封面链接保留。JS/CSS 的旧 CDN 配置重置为当前安装包资源，避免跨版本脚本混用。旧配置中的 Pro 专用图标需替换为 Font Awesome Free 图标。

没有对应项的选项会标记 `unsupported`；类型不符标记 `type-mismatch`，需要手动解析的内容标记 `manual-review`。例如原版打赏、过期提示、部分颜色/宽度、自定义标题没有直接对应项。`needsReview: true` 时必须逐项检查，不能将输出视为无损迁移。即使报告没有这些项，也要检查外链、图标、自定义 HTML 和默认值变化。

## 切换与回退

在 Next 中核对首页、文章、自定义页面、菜单和手机视图，检查原主题保留的配置仍可读取。随后在主题管理中切换。需要回退时重新启用原主题；不要把 Next 配置写到原主题的 ConfigMap。当前迁移仅覆盖 2.0.5 与 2.0.7 的配置结构，不处理文章内容或 Hexo 配置。
