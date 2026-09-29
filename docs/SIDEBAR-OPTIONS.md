# 侧栏常用配置

本轮围绕已有卡片补充显示、数量、排序和分类层级。对应 Butterfly 5.7.0 固定提交 `f223b1888b42b2b336068e6c959ed90a3cd7c8f3`；Finder 方法核实至 Halo 2.26.1。

## 配置与兼容

| 配置 | 默认 | 行为 |
| --- | --- | --- |
| `aside.display.archive` | `true` | 归档页面显示侧栏 |
| `aside.display.tag` | `true` | 标签列表和标签文章页显示侧栏 |
| `aside.display.category` | `true` | 分类列表和分类文章页显示侧栏 |
| `aside.card_author.enable` | `true` | 作者卡片开关 |
| `aside.card_announcement.enable` | `true` | 公告卡片开关 |
| `aside.card_categories.limit` | `5` | 分类总节点上限，包含子分类；0 为全部 |
| `aside.card_categories.expand` | `none` | `none` 始终显示；`true` 默认展开；`false` 默认收起根分类的子树 |
| `aside.card_tags.limit` | `25` | 有公开文章的标签数量；0 为全部 |
| `aside.card_tags.orderby` | `random` | `random` 随机、`name` 名称、`length` 公开文章数 |
| `aside.card_tags.order` | `1` | 1 升序、-1 降序；随机模式不使用该方向 |
| `aside.card_archives.type` | `monthly` | `monthly` 按月、`yearly` 按年 |
| `aside.card_archives.format` | 空 | 空时分别为 `YYYY年MM月`、`YYYY年` |
| `aside.card_archives.order` | `-1` | 1 升序、-1 降序 |
| `aside.card_archives.limit` | `8` | 年份／月份行数上限；0 为全部 |
| `aside.card_webinfo.post_count` | `true` | 文章总数开关 |
| `aside.card_webinfo.last_push_date` | `true` | 文章最近发布／修改时间开关 |
| `aside.card_webinfo.runtime` | `true` | 运行时间开关，沿用 `base.site_birthday` |

卡片排序使用 `card_author`、`card_announcement`、`card_recent_post`、`card_categories`、`card_tags`、`card_archives`、`card_webinfo` 各自的 `sort_order`。默认分别为 0、10、20、30、40、50、60；数值越小越靠前，同值保持原始顺序。增强脚本调整真实 DOM 顺序，键盘顺序与视觉顺序一致。此排序作用于普通页面的完整侧栏；文章页保留作者、公告、目录、最近文章的阅读布局，目录不参与重排。

原有 `enable_category`、`enable_tags`、`enable_archives`、`enable_webInfo` 保持为对应卡片开关，不以新嵌套默认值覆盖。作者按钮、社交链接、公告正文、全局显示、侧栏位置、初始隐藏和手机显示等旧配置键也不变。分类默认 5、标签默认 25 保留移植主题旧值，与 Butterfly 默认 8／40 的差异明确保留。新增分组缺失时模板采用同样回退。

全局 `aside.enable=false` 优先于上述页面类型开关。页面类型关闭时服务端不输出侧栏，并将主栏设为完整宽度。当前主题不存在已实现的逐文章侧栏元数据开关，本轮不宣称支持该覆盖。

## 分类、标签、日期

分类来自 `categoryFinder.listAsTree()`，保留 Halo 后台配置的层级（子分类通过 `spec.parent` 指向父分类），同层按名称排序。树节点计数采用 Halo 重算后的 `postCount`，包含允许父级级联查询的子分类文章，与分类页面一致；启用 `preventParentPostCascadeQuery` 的子分类不向父级累加。数量按深度优先遍历计数，与上游的总节点预算一致。根分类子树采用原生 `details/summary`，可用键盘展开；分类链接本身仍负责跳转。无公开文章且无有效子分类的空节点不展示。标签来自 `tagFinder.listAll()`，先在完整集合中排序，再截取数量，避免仅在旧的前 25 条中排序。

归档来自 `postFinder.archives(1, stats.post)`。Halo 的 size 是文章数量，因此不能以归档行数代替；不再截断到 1000 篇。月份计数是完整月份的文章数，年份计数为各月份总和。链接直接指向 Halo 年／月归档路由。大型站点的全量归档读取成本随文章数增长，本轮未引入缓存或统计插件。

日期格式支持 `YYYY`、`YY`、`MMMM`、`MMM`、`MM`、`M`，以及 `[原样文本]`；月份名称采用页面语言。例如 `YYYY/MM`、`MMMM YYYY`。这是年月归档需要的明确子集，不宣称支持 Moment 的全部日期／时间 token。格式以文本写入，不解释 HTML。

## 渐进增强及边界

页面显示、卡片启停、网站字段开关、归档按年／月分组、完整计数在服务端执行。分类和标签的服务端回退受数量限制；完整候选存放在惰性 `template` 中，脚本初始化后才替换展示。没有 JavaScript 时分类为 Halo 原顺序的平铺链接、标签使用 Halo 原顺序，数量限制仍有效；归档为倒序和默认中文年月格式，行数限制仍有效。浏览器脚本负责分类层级、分类／标签排序、归档排序和自定义格式、卡片重排，不额外发起网络请求。

本轮不新增最新评论卡片，不实现标签彩色云、自定义卡片、文章系列卡片。网站最后更新时间继续表示 Halo 公开文章的最近发布／修改时间，不等价于 Hexo 构建的最后推送时间；运行时间继续使用原 `base.site_birthday`，未引入上游 `runtime_date` 同名键。最近文章的 20 篇上限保持原有行为。

## 验证

`tests/aside-options.test.mjs` 覆盖全量标签排序后限量、0 全部、随机排序不修改原集合、日期 token 与文本、默认兼容及服务端回退约束。`cover-aside.test.mjs`、`list-aside-defaults.test.mjs` 保留封面、数量计数、文章布局和网站信息回归，将过去禁止新增排序的静态断言更新为实际功能约束。真实 Halo 渲染和浏览器配置组合由本轮统一实验记录给出。

参考源码：[Butterfly 配置](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/_config.yml)、[分类 helper](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/scripts/helpers/aside_categories.js)、[Halo CategoryFinder](https://github.com/halo-dev/halo/blob/v2.26.1/application/src/main/java/run/halo/app/theme/finders/CategoryFinder.java)、[TagFinder](https://github.com/halo-dev/halo/blob/v2.26.1/application/src/main/java/run/halo/app/theme/finders/TagFinder.java)、[PostFinderImpl](https://github.com/halo-dev/halo/blob/v2.26.1/application/src/main/java/run/halo/app/theme/finders/impl/PostFinderImpl.java)。
