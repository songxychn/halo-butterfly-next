# RSS 与站点地图

主题提供发现链接和页脚入口；XML 内容、公开性过滤与路由属于 Halo 官方插件。此接入与 PWA、离线缓存无关。

## 支持基线与设置

| 组件 | 本次锁定版本 | Halo 要求 | 官方发布 JAR SHA-256 |
| --- | --- | --- | --- |
| Halo | 2.26.1 | — | 使用 comparison lab 的锁定摘要 |
| [Feed](https://github.com/halo-dev/plugin-feed/releases/tag/v1.5.0) | 1.5.0 | >=2.21.0 | `d7e97df76e502c0f1bd0605d4f3a6dc8b047ed20e1de50fbbed992e95fd33a87` |
| [Sitemap](https://github.com/halo-dev/plugin-sitemap/releases/tag/v1.3.0) | 1.3.0 | >=2.22.7 | `06cccf55a6d6e9369c818de7a52049fddb4b7f20bb83af52ebc329f89a637c8e` |

安装并启用对应插件后，主题的“RSS 与站点地图”设置默认输出：

- RSS：`/rss.xml` 的 `<link rel="alternate" type="application/rss+xml">` 与页脚订阅链接。
- Sitemap：`/sitemap.xml` 的 `<link rel="sitemap" type="application/xml">` 与页脚链接。

`subscription.rss` 与 `subscription.sitemap` 可分别关闭；关闭仅隐藏主题生成的 head/页脚入口，插件路由继续由插件管理。通过 `pluginFinder.available` 检查插件处于 STARTED 且不低于上述最低版本；未安装、停用或版本不足时不输出链接、不发起探测请求。更高版本可显示入口，但并不据此声明已通过该版本验收。

主题的较低 Halo 兼容基线（例如 2.20.2）不等于插件兼容基线：上述插件在该版本不可作为受支持组合安装。主题的安全回退是隐藏不可用入口，不能将隐藏行为说成 RSS/Sitemap 已在低版本平台可用。

入口使用服务端 HTML，关闭 JavaScript 后仍可读；既有 PJAX/预取规则会排除 `.xml`，保留浏览器原生导航。标准主题布局与插件公共布局各调用一次共享 head 片段。锁定的 Feed/Sitemap 版本没有自动注入 head 的处理器；无需额外添加手写标签。管理员的主题注入或 Halo 全局/内容 head 是独立配置，手动添加同一发现链接会重复，应删去手写项，或关闭对应主题设置。

## 数据边界

- RSS 使用 `/rss.xml`。官方也提供 `/feed.xml`，但 Feed 1.5.0 的 [PostUpdatedEvent 缓存失效逻辑](https://github.com/halo-dev/plugin-feed/blob/v1.5.0/app/src/main/java/run/halo/feed/RssCacheManager.java)未清理 `/feed.xml` 与标签订阅缓存，最长可能保留 60 分钟旧数据。因此本次不发布这些别名/细分源的主题入口，也不把它们列为验收通过项。
- Feed 的 [文章查询](https://github.com/halo-dev/plugin-feed/blob/v1.5.0/app/src/main/java/run/halo/feed/service/PostServiceImpl.java)要求 published、未删除和 PUBLIC；输出数量与全文/摘要模式由 RSS 插件配置。更新验收检查已发布内容，不能拿编辑草稿代替已发布快照。
- Sitemap 的 [条目查询](https://github.com/halo-dev/plugin-sitemap/blob/v1.3.0/src/main/java/run/halo/sitemap/DefaultSitemapEntryLister.java)排除未发布、删除和非 PUBLIC 的文章/独立页面，并输出标签、分类和列表页。其 [缓存有效期为 30 秒](https://github.com/halo-dev/plugin-sitemap/blob/v1.3.0/src/main/java/run/halo/sitemap/CachedSitemapGetter.java)，发布、更新或转私密后的断言须允许此已知传播窗口；不承诺立即撤回。XML 不应作为私密数据载体。
- Sitemap 插件管理 `robots.txt`。其 robots 设置启用时才追加 `Sitemap:`；主题不覆盖 robots，也不借此改变已有抓取规则。
- RSS item link、Sitemap loc 与文章 canonical 使用 Halo 的 permalink/外部访问地址。部署时应将 Halo 的外部访问地址设为站点真实地址。主题不自行拼出第二套文章 URL，也不生成 XML。

## 可重复验收

在本工作树专属、已安装对应版本插件的 comparison lab 中运行：

```bash
python3 scripts/feed-sitemap/check.py --runtime .runtime/<owned-lab> --allow-synthetic-writes yes
```

脚本拒绝非本工作树 `.runtime`、ownership marker 不匹配、非受管进程、非锁定插件版本或未知 JAR 摘要。它保存原始设置与插件状态，创建带唯一 ownership 标记的合成公开、草稿、私密文章，使用**匿名 HTTP**验证 XML 和页面，再验证发布更新、公开转私密、主题设置开关及插件逐个停用/恢复。Sitemap 更新允许 30 秒缓存窗口；HTTP 错误、重定向、XML 解析错误和数据泄露均直接失败。正常结束或断言失败后，在 `finally` 中删除本次合成文章并恢复原设置/插件状态；进程被强制终止时保留 private 恢复快照。

结果写到该 runtime 的 `feed-sitemap-evidence.json`。仅有模板/单元检查不能代替真实 Halo 验收；未安装态若未独立运行，只能记录为待验收，不能用停用态冒充。完整 1.0、第三方手写 head、浏览器阅读器兼容及真实搜索引擎收录不由这份 HTTP 验收证明。
