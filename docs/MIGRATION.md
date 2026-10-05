# 从原 Halo Butterfly 迁移

Next 的主题 ID、Setting 和 ConfigMap 都独立。安装 Next 不会改写原主题配置。先在测试站安装新主题，再迁移配置、检查页面，最后切换正式站点；保留原主题安装包和配置可用于回退。

## 导出与转换

输入支持原主题的 JSON 分组配置，以及 `kind: ConfigMap` 的 JSON/YAML（其中 `data` 的各组为 JSON 字符串）。分组配置可从 Halo 控制台开发者工具或经认证的 API `GET /apis/api.console.halo.run/v1alpha1/themes/theme-butterfly/json-config` 获取。不要把包含个人链接或自定义 HTML 的配置提交进仓库。

```bash
bun run migrate --input old.json --from 2.0.5 --output next.json
# 如果来源是原仓库 2.0.7 源码版，改为 --from 2.0.7
# 需要 Halo ConfigMap 格式时追加 --format configmap
```

脚本只在本地生成新文件和 `next.json.report.json`，不会连接 Halo、修改输入或覆盖已有输出。报告只记录字段、动作和目标字段，不包含原始值。配置输出采用仅当前用户可读写的权限。

默认输出是 Next 的分组 JSON，核对后可通过已认证的 Halo API `PUT /apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config` 应用；该请求替换新主题整份配置，应用前也应导出 Next 当前配置。`--format configmap` 面向熟悉 Halo 自定义资源的维护者，不要将它当成分组 JSON 发送给上述接口。

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

首页字幕新增 `index.enable_subtitle` 与 `index.subtitle_effect`，均默认开启以保留旧站行为。原版迁移自动补齐缺项并保留显式 `false`；Next 直接升级时缺失的新开关也按开启处理。空文案不再循环显示配置警告；静态及远端文案按纯文本呈现，动态自定义文案保留 HTML 标记。完整映射与 API 失败回退见 [字幕说明](SUBTITLE.md)。

侧栏新增页面显示、卡片排序、分类层级、标签排序、归档和网站信息字段配置。原有 `enable_category`、`enable_tags`、`enable_archives`、`enable_webInfo` 开关继续有效；缺失新增字段时，分类 5 条、标签 25 条、归档 8 行和原卡片顺序保持不变。分类树和排序为脚本增强，无脚本仍有受数量限制的链接。配置明细及格式支持范围见 [侧栏配置](SIDEBAR-OPTIONS.md)。

移动菜单现在按上游默认展开分组。旧菜单没有 `hide` 注解时也采用此行为；需要保留旧版默认折叠时，请在菜单分组自定义属性中开启“移动菜单默认折叠”。该属性不隐藏菜单项，也不改变桌面初始收起行为。多层、长菜单和键盘行为见 [菜单配置](NAVIGATION-OPTIONS.md)。

字幕新增 `index.subtitle_source`，默认 `custom`，继续读取原随机开关、URL 和字段路径；选择“仅本地”时不发远端请求。`index.subtitle_typed_option` 默认留空（等效于 `{}`），保留原 200ms 打字速度，支持参数白名单内的速度、停顿、循环和光标等设置。内置来源动态模式会在远端文案后追加本地文案；旧自定义 API 成功时仍只展示返回文本。回退主题前保留原有配置备份，旧包不会识别这些新增选项。

导航新增 `nav.fixed`（默认 false，与升级前滚动显隐一致）、`nav.logo`（空）、`nav.display_title` / `nav.display_post_title`（默认 true）。首页新增 `index.top_img_height` 与 `index.site_info_top`，留空使用全屏高度和 43% 的标题区域顶部位置。旧配置缺这些字段时由主题表单默认值补齐，不改变原滚动导航行为。

首页定位修正后，`index.site_info_top` 与 Butterfly 5.7.0 一致，指定标题区域顶部的位置，不再叠加 `translateY(-50%)`。例如原值 `50%` 表示区域中心在首屏中线，升级后表示区域顶部在中线；清空该值可使用上游默认的 `43%`。自定义值会保留，升级后应复核位置。亮色顶图蒙版由 50% 改为 30%，移除导航区额外渐变；暗色仍为 60%，原蒙版开关和导航配色配置保留。需要恢复旧版外观时，可使用升级前的主题包及配置回退。

没有对应项的选项会标记 `unsupported`；类型不符标记 `type-mismatch`，需要手动解析的内容标记 `manual-review`。例如原版打赏、过期提示、部分颜色/宽度、自定义标题没有直接对应项。`needsReview: true` 时必须逐项检查，不能将输出视为无损迁移。即使报告没有这些项，也要检查外链、图标、自定义 HTML 和默认值变化。

## 切换与回退

可选 PWA 首期不修改旧主题配置，需单独安装 `butterfly-pwa` 插件并在插件设置中开启。回退旧主题或切换其他主题前，先关闭 PWA 并联网访问以清理注册及离线提示缓存；离线设备需要下次联网后才能完成清理。具体分工、默认值、启停与卸载边界见 [PWA 文档](PWA.md)。

在 Next 中核对首页、文章、自定义页面、菜单和手机视图，检查原主题保留的配置仍可读取。随后在主题管理中切换。需要回退时重新启用原主题；不要把 Next 配置写到原主题的 ConfigMap。当前迁移仅覆盖 2.0.5 与 2.0.7 的配置结构，不处理文章内容或 Hexo 配置。

Hexo Butterfly 的 `{% %}` 是生成期语法，主题运行时不解析（[DEC-02](https://github.com/songxychn/halo-butterfly-next/issues/45)）。1.0 计划另提供离线转换，把标签源变成与 Butterfly 生成结果一致的 HTML，在 EXT-01 验收；该能力尚未实现，不能把现有 `bun run migrate` 当成内容迁移。
