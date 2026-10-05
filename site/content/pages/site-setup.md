# 演示站配置

本页记录第一版样站的复现方案，内容面向 Halo Butterfly Next 0.1.0-alpha.3。内容已在独立的本地 Halo 2.26.1 实例中发布，下面记录本地样站的配置；它不是公网站点运行清单。

## 版本与内容

样站以 Halo 2.26.1 为验证基线，本地样站已启用官方 SearchWidget 1.7.1；使用 Escape 或遮罩关闭后焦点不自动返回入口的已知限制，见[搜索与评论说明](../tutorials/search-comments.md)。评论教程描述 CommentWidget 3.3.2，但首版文章和单页默认关闭评论提交。

内容包含 10 篇教程、4 篇演示文章和 5 个信息单页。文章分类使用“使用文档”和“功能演示”；“更新日志”保留为后续真实发行记录，暂不展示空入口。

## 外观配置起点

| 设置 | 样例值 |
| --- | --- |
| 站点标题 | Halo Butterfly Next |
| 首页高度 | 留空，使用主题默认 `100vh` |
| 标题区域顶部位置 | 留空，使用主题默认 `43%` |
| 字幕 | 开启，静态显示，仅本地文案 |
| 简介 | Hexo Butterfly 主题在 Halo 的移植版本 |
| 首页文章布局 | 列表 |
| 首页摘要 | 优先手动摘要，否则截取 120 字符 |
| 主题模式 | 用户切换 |
| 侧栏位置 | 右侧 |
| 标签排序 | 按名称升序 |

首页大图采用主题默认的全屏高度，向下滚动后进入文章列表；手机与横屏需要检查文字是否重叠。站点采用现有主题配置，不额外新增首屏操作按钮。

## 内容与导航

置顶“第一次使用 Halo Butterfly Next”和“功能演示导览”，检查它们在实际首页的顺序。顶栏提供首页、文档、演示、预览说明与 GitHub；页脚提供问题反馈入口。有实际发行日志后再补充日志入口。

侧栏作者按钮指向文档总览，公告提供版本和预览状态。页脚放置下载说明、常见问题和关于项目，保留主题与框架署名。

菜单和正文链接使用 Halo 发布后得到的实际访问地址。不要把本地 Markdown 路径或尚未解析的内容标识直接粘贴到公开菜单中。

## 图片来源

首页大图、文章封面和演示正文使用有来源记录的 Pexels 摄影图片，14 篇文章分别使用不同的封面。图片以 WebP 保存在样站本地，浏览页面不会向外部图片服务请求素材。

- [首页山湖](https://www.pexels.com/photo/scenic-mountain-lake-in-a-serene-landscape-36328259/) — Jacob Postuma
- [湖畔群山](https://www.pexels.com/photo/serene-mountain-lake-in-banff-national-park-36328290/) — Jacob Postuma
- [雾中森林](https://www.pexels.com/photo/misty-forest-trees-in-foggy-woodland-scene-34169562/) — Raul Ling
- [山间星空](https://www.pexels.com/photo/silhouette-of-mountains-and-trees-under-the-blue-night-sky-4974694/) — Joshua Woroniecki
- [碧色海岸](https://www.pexels.com/photo/turquoise-water-on-ocean-shore-with-sandy-beach-25430526/) — Daniel Lepădatu
- [金色山峦](https://www.pexels.com/photo/serene-mountain-landscape-at-golden-hour-35022938/) — Havvanur

照片按 [Pexels License](https://www.pexels.com/license/) 使用，不属于本项目的原创作品，也不随项目代码改用 GPL-3.0。来源与文件摘要记录在源码的 `site/assets/sources.json`。

## 如何复现

1. 准备独立 Halo 测试实例，安装经确认的主题包。
2. 按[快速开始](../tutorials/getting-started.md)检查基本页面。
3. 导入或编写本站的教程、演示与单页，上传配套素材。
4. 将菜单和内容链接替换为实际地址，再按本页配置外观。
5. 检查两种主题模式、手机菜单、正文目录、代码、灯箱和已启用插件。

源码中的配置样例是局部设置，不可当作完整配置直接发送给替换整份配置的 API。仓库提供 `site/local.py`，按 `init → plan → sync → publish → configure → search-enable` 建立本地样站；具体参数见源码中的 `site/README.md`。工具只连接自己创建的回环地址实例，不能用于远程服务器。重复同步不会新增相同内容，后台修改会触发冲突保护。
