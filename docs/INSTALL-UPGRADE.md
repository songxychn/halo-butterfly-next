# 安装、升级与回退（alpha.3）

本文针对 Halo 2.26.1、主题 ID `halo-butterfly-next`。[alpha.3 已公开发行](https://github.com/songxychn/halo-butterfly-next/releases/tag/v0.1.0-alpha.3)，主题 ZIP 与 `SHA256SUMS` 均可从发行页下载。安装升级回退的证据范围见[最终验收](validation/2026-10-06/alpha3-final-acceptance.md)；资源加载超时等已知限制仍保留，详见[发行说明](RELEASE-alpha.3.md)。旧 `theme-butterfly` 迁移是另一条流程，见[迁移说明](MIGRATION.md)。

## 安装前保存恢复材料

1. 在测试站先演练。按自己的 Halo 部署方式创建并下载可恢复的站点备份，确认数据库、附件及配置的覆盖范围；保留运行中的 Halo 和插件版本信息。只有主题 ZIP 不能恢复整站内容。
2. 单独保存当前主题安装 ZIP、它的 SHA-256，以及主题配置。通过已认证 Halo API `GET /apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config` 导出完整分组 JSON，或使用已确认可覆盖该配置的备份流程。文件留在个人安全存储，不提交 Git、issue 或截图；包含自定义链接与文本时先脱敏。
3. 记录活动主题、关键开关、菜单、合成测试页面和评论数量。保留至少一个可登录控制台的恢复入口。
4. 对下载 ZIP 使用 `shasum -a 256 halo-butterfly-next-0.1.0-alpha.3.zip`（或等效 SHA-256 工具）核对发行页公布的摘要。摘要未发布或不一致时不要使用。

## 全新安装

在 Halo 控制台主题管理上传主题 ZIP，然后配置并启用。主题名称和 ID 是 `halo-butterfly-next`；可与原 `theme-butterfly` 分开安装。不要上传 GitHub 的 Source code 压缩包。

默认状态先检查首页、空归档/分类/标签和 404；添加测试文章及单页后，检查目录、代码块、图片、分类标签和手机菜单。搜索/评论按需要安装并启用固定支持插件，配置其权限，再检查入口和实际交互。未安装插件时入口隐藏是预期行为。

## Next 同 ID 升级

先完成备份，再在主题管理中上传新 ZIP，执行同 ID 主题更新。保留 `halo-butterfly-next` 的 ID、Setting 与 ConfigMap；不要先删除旧主题，也不要将新主题作为不同 ID 导入。旧 `theme-butterfly` 配置不能直接写入 Next ConfigMap。

升级后核对主题版本、关键自定义设置、菜单、文章/单页正文与评论。分别检查桌面和窄屏、亮暗模式及插件开关。新评论计数开关缺失时有效默认应为关闭；候选已验证缺少这两个旧配置字段时均有效默认为关闭，见[验收记录](ALPHA3-VERIFICATION.md)。

## 回退旧包

1. 停止继续调整主题配置，保留故障日志和当前配置的额外副本。
2. 在主题管理中上传之前保存的**同 ID 原始旧 ZIP**，更新回旧版，清理浏览器缓存后复查。避免把两个同名 alpha.2 开发包误当成同一包；以 SHA-256 区分。
3. 先比较旧版配置。若需恢复升级前配置，只对相同主题 ID 使用已核对的完整备份；`PUT /apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config` 会替换整份配置，适合已理解该操作的维护者，不要直接发送不完整 JSON 或 ConfigMap 文档。
4. 检查内容/评论和关键页面。如暂时不能恢复主题显示，可在控制台启用此前保留、已验证可用的主题，并按站点备份流程恢复；主题包回退本身不会回退升级后新增的文章或评论。

**已发布 alpha.2 的旧版限制：** `post.enable_above=false`（关闭文章顶图）会让旧文章元信息脚本访问不存在的字数/时长节点并报错。需要回退原始 alpha.2 时，主演练使用顶图开启的受支持配置；请在该旧版使用开启顶图的设置。新候选已另行验证关闭顶图，但不能把旧包缺陷称为已修复，也不能将此配置差异混入等配置升级回退结论。

真实原始 alpha.2 ZIP 摘要为 `a1bbbb13fa61c07e9500fc228941b4e9d759f0f1d1bc042c22621a5d55afaa42`。这是本轮演练使用的原始发行附件；[alpha.2 Release](https://github.com/songxychn/halo-butterfly-next/releases/tag/v0.1.0-alpha.2) 及安装附件现已公开，2026-10-05 匿名请求附件返回 HTTP 200。该旧版仍有上述限制，不能把它当作 alpha.3 候选或最新推荐安装包；回退前应核对包摘要、资源说明及配置适用范围。

候选 `776958ad`（ZIP SHA-256 `c6fae909b8d74b23c39bdcc6b85b6ae46e4d95a305f7d7f4f8e3a9eb834d6944`）已完成真正全新数据库安装，以及上述原始 alpha.2 → 候选 → alpha.2 → 候选演练；配置、13 篇文章、4 个单页、29 条评论和 16 条回复保留。升级克隆中的插件停用，此结果只覆盖安装和数据保留；搜索/评论交互另行验收。完整边界见[历史候选验收记录](ALPHA3-VERIFICATION.md)。最终包的复用关系与全新安装检查另见[最终验收](validation/2026-10-06/alpha3-final-acceptance.md)，实际公开状态见[发布完成记录](validation/2026-10-06/alpha3-publication.md)；历史候选通过不等于当前包所有场景均重新执行。
