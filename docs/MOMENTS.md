# 瞬间

原生瞬间使用官方 Moments >=1.18.0 和 Halo 2.26.1 的数据模型；评论使用官方 CommentWidget >=3.3.2。正文继续保存为普通文本/HTML，不解析 Hexo 标签。

## 原生瞬间

`/moments` 列表显示 `owner.displayName/avatar`、`spec.releaseTime`（无值回退创建时间）、`spec.tags` 和正文/媒体；稳定身份使用 `metadata.name`。日期链接进入 `/moments/{name}`。图片保留灯箱，视频和音频有原生播放控件。

详情页以 `moment.halo.run / Moment / metadata.name / v1alpha1` 接入官方评论。评论锚点、右侧跳转、加载和挂载交给官方插件；缺插件、全站关闭评论或没有可见主体时不输出可操作评论入口。列表评论数使用官方 `stats.approvedComment`，这是插件审批统计口径，不自行把它改成主题估算的可见顶层评论数。

全站最新评论聚合卡片已删除；评论接入边界见[评论说明](COMMENT-ENHANCEMENTS.md)。

本地分页继续采用插件返回的上一页/下一页链接；输入跳页遵循官方 `/moments/page/{page}` 路由，保留标签筛选。每页数量在**瞬间插件设置**中调整；主题不会在客户端隐藏原生条目而制造分页总数不一致。无 JavaScript 时真实内容、ISO 日期/时区、详情链接和上一页/下一页仍可用。

远程动态 JSON 已按 [DEC-10](parity/DEC-10-THEME-SCOPE.md) 删除。仅显示 Halo Moments 插件数据，日期时区和原生分页保留。旧 source/title/page_size/limit/since 字段在迁移报告中标为 removed-feature。
