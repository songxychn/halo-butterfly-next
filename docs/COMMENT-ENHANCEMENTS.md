# 评论增强首批

只使用 Halo 官方 CommentWidget，当前基线 >=3.3.2；不配置第三方评论提供方。文章及单页的评论挂载、提交、回复和计数沿用已有实现。需求跟踪 [#386](https://github.com/songxychn/halo-butterfly-next/issues/386)，范围服从 [DEC-01](https://github.com/songxychn/halo-butterfly-next/issues/46#issuecomment-5682055297)。

## 配置

| 字段 | 默认 | 行为 |
| --- | --- | --- |
| `aside.card_newest_comments.enable` | false | 普通完整侧栏和文章完整侧栏显示最新评论；简洁目录侧栏不显示 |
| `aside.card_newest_comments.limit` | 6 | 1–20 条公开顶层评论，回复不参与 |
| `aside.card_newest_comments.sort_order` | 25 | 卡片排序，默认位于最近文章之后 |
| `aside.card_newest_comments.avatar` | true | 显示头像；失败时移除图片，正文链接仍可用 |
| `aside.card_newest_comments.storage` | 10 | 当前标签页缓存分钟数，0 关闭，最多 60 |
| `comments.text` | true | 控制下方三种纯文本提示；HTML 字符按文字显示 |
| `comments.notice` | 空 | 可用评论区的说明，可换行 |
| `comments.closed_notice` | 空 | 全局或当前文章/单页禁止评论时显示 |
| `comments.unavailable_notice` | 空 | 全局与主体允许评论，但官方插件不可用或低于基线时显示 |
| `comments.jump` | true | 当前文章/单页实际挂载评论时提供右侧跳转入口 |

关闭评论的说明优先于插件不可用说明。留空不新增提示。`rightside.item_order` 支持 `comment`，可放到常驻或齿轮展开组，或从列表中省略以隐藏；功能条件不满足时不会创建空入口。原生 `#post-comment` 链接无脚本仍可跳转；增强脚本保留查询参数和浏览历史，把键盘焦点移到评论标题。章节自动追踪在阅读评论时保留评论片段。

## 最新评论的范围和成本

模板遍历 Halo Finder 的全部页面，只输出已发布、未删除、可见性 PUBLIC、允许评论且有评论统计的 Post / SinglePage 身份。浏览器在卡片接近视口时查询每个主体的公开评论 API，明确按 `spec.creationTime,desc` 排序，合并后取前 N 条。旧文章的新评论不会因文章发布时间而遗漏，也不沿用默认置顶/优先级排序。Moment 留给后续实现。

请求使用 `credentials: omit`，避免已登录管理员获得更多评论。响应仍校验审核、隐藏、删除和精确主体；缓存只保存 ID、主体、昵称、纯文本摘要、日期及头像 URL，不保存邮箱、IP、原始响应或凭证。HTML 中不嵌入评论内容。每次页面重新读取当前公开主体清单，缓存不能重新引入已转为私密、草稿或删除的主体；评论数、发布快照或开关改变也使对应缓存失效。审核/编辑后若上述值未改变，旧内容可能保留到缓存到期；需要及时刷新时设置 0 或缩短时间。

冷加载成本随有评论的公开内容数量增长：每个主体请求前 N 条，最多四个并发；每个请求含响应正文读取的超时为 10 秒。任一请求失败显示错误和重试，不把部分结果标为全站最新。sessionStorage 被拒绝或损坏时正常请求；无 JavaScript 时显示明确说明。大型站点可关闭卡片或考虑后续服务端聚合，当前没有安装新插件。

## 验证边界

`bun run verify` 包括排序、安全投影、缓存、权限筛选、设置兼容和工具栏排序回归。真实 Halo 检查使用任务专属合成站、固定 Halo 2.26.1 / CommentWidget 3.3.2 与独立无头浏览器，运行脚本为 `scripts/comment-enhancements/check.mjs`；需显式本地 origin、lab 归属、包/提交摘要及合成写入许可。每次使用新输出目录保存失败；配置和权限在 finally 恢复并读回。准备脚本创建的合成评论和内容留在该站供追溯。

评论组件懒挂载、首屏零评论资源下载、Moment 评论、真实 Safari/手机键盘/屏幕阅读器和完整双站合同均未在本批完成。矩阵只提升对应实现条目到 implemented-unverified，不提升 verified；设置默认快照重新冻结，旧性能结果不迁移到新包。

参考：[Halo 2.26.1 公开评论查询](https://github.com/halo-dev/halo/blob/v2.26.1/application/src/main/java/run/halo/app/core/endpoint/theme/CommentQueryEndpoint.java)、[Butterfly 5.7.0 最新评论模板](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/third-party/newest-comments/common.pug)。
