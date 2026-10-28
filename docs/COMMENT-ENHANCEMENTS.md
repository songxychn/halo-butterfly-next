# 评论接入

当前范围以 [DEC-10](parity/DEC-10-THEME-SCOPE.md) 为准。文章、独立页面和瞬间均使用
[Halo 官方 `<halo:comment>` 扩展点](https://docs.halo.run/developer-guide/theme/template-tag)，
传递各自的 group、kind 和 metadata.name。组件加载、数据请求、表单及错误处理由官方评论插件负责。
主题保留评论开关、计数、提示、跳转及样式，不再动态导入插件模块或自行创建 `comment-widget`。

`comments.lazyload` 与 `aside.card_newest_comments` 已移除。不会枚举全站内容或由访客浏览器逐项聚合评论。
已有配置中的这些字段不再生效；离线迁移报告为 `removed-feature`，需要核对后应用。

当前集成验收关注文章、单页、瞬间的主体标识、插件可用/停用、整页导航与锚点、深浅色及窄屏显示。
评论插件的验证码、审核、通知、上传过期与存储回收不属于主题发布门禁。
历史验收及尚存缺口见 [删减前说明](https://github.com/songxychn/halo-butterfly-next/blob/742b1d4b4702d91ef909a2d5976267665c3de6e5/docs/COMMENT-ENHANCEMENTS.md)；
旧报告不表示删减后包已通过，已有观察须使用原运行目录和原工具完成或恢复。
