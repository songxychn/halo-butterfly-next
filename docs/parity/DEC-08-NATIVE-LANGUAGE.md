# DEC-08 补充：正文语言与界面语言分开

日期：2026-10-25。维护者明确确认：「1.0 采用 Halo 原生语言方案，正文与界面语言分开」。这是 1.0 能力映射决定，不是运行验收通过记录。

1. 文章/单页的 `language` 注解控制正文 `<article lang>` 和 Open Graph `og:locale`；支持已声明语言，空值或未知值按现有回退规则处理。
2. 页面外壳、菜单、控件和浏览器交互文案遵循 Halo 原生请求 locale，使用其语言查询参数、Cookie/站点设置与访客偏好；不同 Halo 版本的原生优先级分别记录，不宣称所有版本完全相同。
3. 1.0 取消「作者逐篇强制切换整页 UI 语言」要求；不增加重复全局语言设置，不用前端翻译器改写作者正文，不用正文注解覆盖访问者界面语言。原简繁字形转换保持其独立职责。

固定 Butterfly `f223b1888b42b2b336068e6c959ed90a3cd7c8f3` 的 `scripts/helpers/aside_archives.js` 读取 `page.lang || page.language || config.language` 来决定归档日期标签的 locale。`page-data:lang` 与 `page-data:language` 保留来源和 ID，按上述 Halo 原生方案验收，不要求复刻 Hexo 的整页语言覆盖方式。

已有实现见 `src/html/views/layout.html`、`src/html/views/seo.html`、`src/html/views/config.html`、`annotation-setting.yaml`、`i18n/` 与 `src/js/core/i18n.ts`；使用说明及版本边界见[国际化文档](../INTERNATIONALIZATION.md)。两条实质映射已解决，转为 implemented-unverified，不删除能力、不扣减适用分母、不新增 verified。固定当前包上的正文/UI 不同语言、空/非法值回退、原生优先级及浏览器交互仍按实际补验记录；人工母语审校不由程序测试冒充。
