# 首页字幕

字幕只使用站长填写的本地文案。`index.enable_subtitle` 控制显示，`index.subtitle_effect` 控制打字效果；`index.typewriter_custom_text` 使用 `|&|` 分隔多条文案，留空回退站点副标题。两者皆空时不显示字幕。

关闭打字效果或偏好减少动态效果时显示首条纯文本。动态模式保留作者配置的 HTML 与经过白名单校验的 `subtitle_typed_option` 参数。

一言、今日诗词和自定义远程 API 已按 [DEC-10](parity/DEC-10-THEME-SCOPE.md) 移除。旧来源及 API 字段由迁移报告标记为 `removed-feature`，不会继续发出请求。
