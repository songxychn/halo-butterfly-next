# 逐篇覆盖与列表参数

本批补齐 D06：文章/自定义页侧栏和代码初始折叠、文章版权详细字段、标签云参数、归档年月标题/分组/菜单名称和站点日期格式。所有内容继续使用 Halo 元数据、标准 HTML 和消息系统，不引入 Hexo 专属正文标签。

## 作者逐篇覆盖

文章和自定义页面的注解支持：

| 字段 | 值与优先级 |
| --- | --- |
| `aside` | `inherit`（默认）跟随全局；`true` 显示；`false` 隐藏。显式逐篇值优先于全局侧栏开关，隐藏后工具栏不出现无效侧栏按钮。 |
| `highlight_shrink` | `inherit`（默认）跟随 `render.code_shrink`；`expanded` 初始展开；`collapsed` 初始折叠；`disabled` 隐藏折叠按钮、完整显示代码。未知值继承全局；不绕过代码增强总开关。 |

注解只控制本篇，不重写全局设置或读者的其他页面。独立页面适用同样模型；不恢复 DEC-08 已删除的旧全局配置或布尔/字符串混合解释。

## 文章版权详细字段

文章新增 `copyright_author`、`copyright_author_href`、`copyright_url`、`copyright_info`，另有本篇许可证名称与链接 `copyright_license`、`copyright_license_url`。空白值继承全局版权配置、作者或当前文章。已有 `copyright` 三态仍控制是否显示版权块。

作者和声明使用 `th:text`。`copyright_info` 是纯文本，`<b>` 等标记显示为文字；需要丰富内容时可在正文使用通用 HTML。默认声明仍包含许可证和站点链接。链接允许 HTTP(S) 或单斜杠开头的站内根路径，拒绝 javascript/data/协议相对地址；非法作者链接回退 `/`，非法许可证链接回退默认 Creative Commons，非法原文链接回退 canonical。

版权链接由服务端填入，因此无脚本仍可阅读/复制。浏览器增强只处理配置要求的URI文字解码，保留服务端原文链接；不会用带查询参数或锚点的当前浏览器地址覆盖作者声明。

## 标签云

标签设置新增 `tags.cloud`：

| 字段 | 默认 | 行为 |
| --- | --- | --- |
| `orderby` | `native` | Halo 原顺序；可选 `name`、`length`（文章数）、`random`。名称排序遵循界面语言。 |
| `order` | `1` | `1` 升序、`-1` 降序；随机和原顺序不受影响。 |
| `amount` | `0` | `0` 全部，正整数先完整排序再截断，上限10000；非法值显示全部。 |
| `min_font` / `max_font` | `12` / `21` | 按文章数量的不同排名插值；相同数量同字号，倒置范围自动交换。 |
| `unit` | `px` | 另支持 em/rem。px限8～96，em/rem限0.5～6，非法单位回退px。 |

原有标签亮暗颜色、自定义颜色和图表选择保留。无脚本时提供全部真实标签链接，不以未排序的前N个假冒配置结果；完整排序/截断/字号是渐进增强。图表使用增强后实际显示的标签集。

## 归档

- `archives.year` 默认true、`archives.month` 默认false，控制年月分组标题；不改变 Halo 原生路由和分页对象。
- `/archives/<年>` 与 `/archives/<年>/<月>` 服务端直接使用年月标题，包括无脚本状态。无数据仍有准确标题和空状态。
- `archives.title` 可设置无日期归档页的标题，默认空，服务端回退当前界面语言的“归档”。
- 未显式设置标题时，浏览器会从主导航（包含嵌套项）寻找同站 `/archives` 或 `/archives/`，使用其名称同步页面标题、浏览器标题、OG/Twitter标题。跨站归档和年月详情链接不参与；没有匹配则保留本地化默认。自动菜单匹配需要JavaScript，显式标题不需要。

`archive_dir` 和 archive_generator 路由/每页数量由 Halo 内容设置与控制器承担，不新增主题路由生成器，也不宣称 Hexo 路由生成配置已经实现。

## 日期格式

`base.date_format` 默认空，保留各页面原格式。可设置 `yyyy/MM/dd`、`dd MMM yyyy`、`yyyy年MM月dd日 HH:mm` 等 Java `SimpleDateFormat` 写法；应用于文章和列表日期、最近文章、相关文章、网站更新时间及归档条目。机器可读datetime和排序仍保留原时间值；relative模式仍显示相对时间。

允许 yyyy/yy、MMMM/MMM/MM/M、dd/d、EEEE/EEE、HH/H/hh/h、mm/m、ss/s、a、XXX/Z 和 `- / : . , 年 月 日`及空格。未知标记、HTML、引号或超过80字符的配置在服务端回退原格式，不让整页因非法格式报错。它不是 Moment 的格式解释器；日期时区沿用 Halo 环境。

## 升级与验收

新增设置缺省保留原有布局、顺序和日期。回退旧主题后新增注解/配置会被忽略，不修改正文。性能默认快照已随字段变更重新冻结，旧性能测量不能冒充新候选结果。

`bun run verify` 包括类型、矩阵、测试、构建和包检查。真实Halo验收脚本 `scripts/author-options/check-browser.mjs` 要求显式 `BASE_URL`、`HALO_PORT`、`HEXO_PORT` 和拥有标识的比较实验室；在该隔离实例运行configured/inherit/unsafe三种profile，修改固定fixture文章、单页及配置，并保留最终unsafe测试状态。不得对生产使用。可通过 `BROWSER=firefox`/`webkit`切换独立无头引擎。完整证据见 [限定验收](validation/2026-10-14/author-listing-options.md)。
