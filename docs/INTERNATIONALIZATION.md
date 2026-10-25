# 界面语言与正文语言

主题通过 Halo 原生消息解析加载根目录 `i18n/*.properties`，不依赖浏览器脚本翻译页面。提供 `default`（英文兜底）、英文、日文、韩文、简体中文、香港繁体中文和台湾繁体中文七套消息；`zh.properties` 额外提供中文地区缺省回退。当前覆盖主题页面、公共布局、导航/侧栏/页脚、无障碍标签、日期前缀、灯箱、代码、评论加载状态、分享、图表乐谱、图库及失败提示。站点名称、菜单、作者正文、管理员自定义文案和插件内部文案仍由各自拥有者维护。

## 选择语言

Halo 2.26.1 按 `language` 查询参数、`language` Cookie、站点基本设置的 `language`、浏览器 `Accept-Language` 选择界面语言（以前者优先）。例如 `/categories?language=ja`、`/archives?language=zh-TW`。主题没有增加重复的全局语言设置。支持语言的其他地区使用语言包回退，未知语言使用英文，`html lang` 同步为英文，避免将英语界面标注为另一种语言。

最低支持版本 Halo 2.20.2 的原生顺序为 `language` 查询参数、同名 Cookie、浏览器 `Accept-Language`，不读取站点基本设置语言。该差异已在真实 2.20.2 实例验证；需要跨版本稳定指定界面语言时使用查询参数或 Cookie。详见 [最低版本验收](validation/2026-10-14/minimum-halo-current.md)。

JavaScript 文案由 Thymeleaf 的 JavaScript 内联转义后注入 `MainApp.messages`；组件按需读取当前快照。UI 文案只作为文本、DOM 属性或已有静态控件标注使用，不把作者内容送入翻译器。站点默认中文内容不会被自动翻译成英语。

## 逐篇正文语言

文章和自定义页面新增 `language` 注解（控制台显示“正文语言”），可选择六种明确语言或跟随访问者。它控制正文 `<article lang>` 与 Open Graph `og:locale`，未知注解值回退界面语言。页面外壳、导航及控件继续使用访问者的 UI 语言，不把整页标记为正文语言，也不更改作者正文。

维护者已于 2026-10-25 确认 [1.0 原生语言方案](parity/DEC-08-NATIVE-LANGUAGE.md)，正文与界面语言分开，取消作者逐篇强制整页 UI 语言要求。这项实现是**逐篇内容语言覆盖**。它不强制改变 Halo 请求的 locale，不代表“逐篇切换全部 UI 文案”已经实现。需要整页 UI 切换时使用 Halo 原生 `language` 参数/偏好。默认模式下，一篇固定语言文章应显式设置正文语言，避免跟随不同访问者语言。

Halo 2.27.1 的[当前候选补验](validation/2026-10-25/native-language.md)覆盖 Post/SinglePage 18 个 HTTP 场景及 36 个浏览器例，确认上述优先级与正文/UI 分离。OG 使用 `language_TERRITORY`，例如 `ja_JP`、`ko_KR`；正文 `lang` 继续使用 `ja`、`ko` 等 BCP 47 值，不因 OG 格式改变。

## 简繁转换

原简繁转换是用户主动选择的中文字形转换，保留独立开关、按钮、配置与行为。国际化不是简繁转换：日文、韩文和英文由独立消息文件提供。简繁按钮不承担界面 locale、全文翻译或元数据语言切换。

## 迁移与维护

未设置正文语言的旧文章继承访问者语言，不需要迁移正文或恢复旧 Hexo 标签。此前固定中文的主题控件现在遵循 Halo 语言选择；在 Halo 2.26.1 已设置简中站点语言时，英语浏览器仍默认显示简中控件，需要英语 UI 的访问者可选择 `language=en`。自定义的菜单、公告、按钮说明等不会被覆盖。

新消息必须同步全部语言文件、按组件代码引用 `ui.*` 键。`bun run verify` 检查消息键、插值参数一致性、所有模板/脚本引用、安装包语言文件与原始字节一致性。空白值和缺失键视为错误，运行时缺失消息的 `??ui.*??` 标记不能作为通过验收。

真实 Halo 验收：在隔离的比较实验室安装当前 ZIP 并完成种子后，运行 `HALO_PORT=<port> HEXO_PORT=<port> python3 scripts/i18n/lab.py`。此 profile 仅允许实验室拥有的本机 Halo，将 `preview-1` 正文语言设为日文、`about-preview` 设为韩文并启用原生分享。随后运行 `BASE_URL=http://127.0.0.1:<port> bun scripts/i18n/check-browser.mjs`，可通过 `BROWSER=firefox` 或 `BROWSER=webkit` 切换独立无头引擎。输出位于 `.runtime/i18n-validation/<engine>/`。

固定版本的语言优先级以 [ThemeLocaleContextResolver](https://github.com/halo-dev/halo/blob/v2.26.1/application/src/main/java/run/halo/app/theme/ThemeLocaleContextResolver.java) 与 [UserLocaleRequestAttributeWriteFilter](https://github.com/halo-dev/halo/blob/v2.26.1/application/src/main/java/run/halo/app/theme/UserLocaleRequestAttributeWriteFilter.java) 为准。后者名字含 UserLocale，但写入的实际上是站点基本设置语言，并非登录用户个人偏好；本次实际验证了站点语言先于 Accept-Language。

依据：[Halo 国际化文档](https://docs.halo.run/developer-guide/theme/i18n)、固定 Butterfly 5.7.0 `languages/{default,en,ja,ko,zh-CN,zh-HK,zh-TW}.yml` 的语言范围。译文为主题适配新增内容，不宣称人工母语审校或所有插件本地化通过。
