# 瞬间与独立动态源

原生瞬间使用官方 Moments >=1.18.0 和 Halo 2.26.1 的数据模型；评论使用官方 CommentWidget >=3.3.2。正文继续保存为普通文本/HTML，不解析 Hexo 标签。

## 原生瞬间

`/moments` 列表显示 `owner.displayName/avatar`、`spec.releaseTime`（无值回退创建时间）、`spec.tags` 和正文/媒体；稳定身份使用 `metadata.name`。日期链接进入 `/moments/{name}`。图片保留灯箱，视频和音频有原生播放控件。

详情页以 `moment.halo.run / Moment / metadata.name / v1alpha1` 接入官方评论。评论锚点、右侧跳转、默认立即挂载及可选懒挂载复用文章/单页协议；缺插件、全站关闭评论或没有可见主体时不输出可操作评论入口。列表评论数使用官方 `stats.approvedComment`，这是插件审批统计口径，不自行把它改成主题估算的可见顶层评论数。

最新评论同时覆盖文章、单页和原生 Moment。Moments Finder 即使在管理员登录时也会显式过滤 PUBLIC、approved、未删除主体，避免将作者私密内容身份输出到聚合清单；公开请求不携带凭据，响应继续排除待审核、隐藏和删除评论。大型站点的逐主体请求成本与缓存边界见[评论增强](COMMENT-ENHANCEMENTS.md)。

本地分页继续采用插件返回的上一页/下一页链接；输入跳页遵循官方 `/moments/page/{page}` 路由，保留标签筛选。每页数量在**瞬间插件设置**中调整；主题不会在客户端隐藏原生条目而制造分页总数不一致。无 JavaScript 时真实内容、ISO 日期/时区、详情链接和上一页/下一页仍可用。

## 独立 JSON 动态源

在主题「瞬间与动态」填写 `moments.source`，便可在原生瞬间列表之前显示一个独立列表。它不替代本地瞬间，不伪造本地 Moment 身份，不向外部条目挂载本地评论。

支持本站路径或 HTTPS JSON 地址，跨域服务需提供匿名 CORS；主题不发送登录凭据或 Referer。请求最长 10 秒，正文最多 1 MiB，最多 1000 条。空结果显示「暂无动态」；非成功响应、非法 JSON、无效字段、超时及跨域失败显示错误与重试，本地内容保持可读。默认 source 为空，不产生请求。

输入为数组，或 `{ "items": [...] }`：

```json
[
  {
    "key": "update-2026-10-14",
    "author": "作者",
    "avatar": "/upload/avatar.png",
    "date": "2026-10-14T12:30:00+08:00",
    "content": "普通文本，不执行 HTML",
    "tags": ["开发", "日常"]
  }
]
```

`key` 是非空唯一标识，最长 200 字符；`date` 必须是含 `Z` 或时区偏移的 ISO 日期时间。`author/avatar/tags` 可省略。`content` 是纯文本，亦可用 `html` 提供普通 HTML（同时存在时 html 优先）；单条正文上限 100000 字符。HTML 仅允许常见段落、列表、强调、代码、链接、图片、折叠和标记标签，使用 DOMPurify 净化，再约束链接和图片 URL；脚本、事件属性、样式、iframe、表单和危险协议不会进入页面。标签文字始终按文本渲染。

| 设置 | 默认 | 语义 |
| --- | --- | --- |
| `moments.source` | 空 | 独立动态 JSON 来源 |
| `moments.title` | 更多动态 | 独立列表标题 |
| `moments.page_size` | 10 | 外部动态每页 1–50 条 |
| `moments.limit` | 100 | 外部动态最多显示 1–1000 条 |
| `moments.since` | 空 | 起始日期（包含当天时间点），含时区的 ISO 日期时间 |
| `moments.timezone` | UTC | 原生瞬间和外部动态共用的 IANA 显示时区，例如 Asia/Shanghai；无效值回退 UTC |

先按起始日期筛选，再按发布时间倒序、key 稳定排序，取数量上限，最后分页。外部列表有上一页/下一页和输入跳页，页数基于筛选后数据真实计算；不改变本地列表的地址或分页。这些 JSON 配置属于主题增强输入，不声称换主题后仍自动渲染；要永久保留内容，应将其导入 Halo 原生瞬间或保存为普通正文。

本轮完整记录见[限定验收](validation/2026-10-14/moments-completion.md)。时区配置只覆盖瞬间/独立动态，不代表全站日期格式与时区合同已完成。
