# 安全嵌入边界与消费者

这份清单记录主题自身的数据嵌入边界，不把管理员明确配置的代码注入或已发布正文改成纯文本。基线为 Halo 2.26.1；实际运行证据见 [A01 审计](validation/2026-10-14/safe-embedding-audit.md)。

## JavaScript 配置与页面数据

源码中的自然模板表达式仍使用 `/*[[${...}]]*/`；消息可用 `/*[[#{ui.key}]]*/`。构建器 `scripts/safe-inline-data.mjs` 只处理 `th:inline="javascript"` 的 script：

1. 在 `th:with` 绑定 Halo `JsonUtils.mapper()`，使用平台 JSON 编码器处理原值。
2. 对**编码后的 JSON**将 `<`、`>`、U+2028、U+2029 替换为 JSON Unicode 转义。
3. 输出编码结果，不使用 eval，不先对原值转义，因此保留对象、数组、布尔、null、数字、原始反斜杠与 Unicode。

仅转义 `</script>` 中的斜杠还不够：`<!--<script>` 可以使 HTML tokenizer 进入 double-escaped 状态，吞掉真实 script 结束标签及后续页面。必须防止编码结果出现字面 `<`。本次使用 Halo 已有 JSON mapper，没有另写 JSON 序列化器。

构建器拒绝未包自然模板注释的 `[[...]]` / `[(...)]`、原始未受保护的内联数据和保留变量名 `scriptJsonMapper` 冲突。带参数的消息须使用显式 `${#messages.msg(...)}` 表达式。安装包检查逐个检查 JavaScript 内联 script 均经过保护，不能跳过构建而手写 `templates/`。

当前 lane 包含 15 个脚本块、201 个数据表达式；机器清单逐项列出表达式。父任务合并的语言消息/逐篇字段通过同一构建路径处理，实际组合包另行验收。

| 消费者 | 数据与后续用途 |
| --- | --- |
| `views/config.html` | 全局配置、appearance/effects/标签配色、CDN及第三方服务配置；bootstrap按原规则解包 ConfigMap，CSS/资源/集成模块各自再校验用途。 |
| `index.html` | 字幕配置和文字、顶部背景、原生分页；纯文本字幕及相应资源入口。 |
| `archives.html` / `categories.html` | `MainApp.data` 的真实归档年月/文章嵌套列表与分类对象，用于图表；分页元数据。 |
| `post.html` / `page.html` | 正文增强、TOC、分享/版权、文章或单页配置；未把正文HTML塞进配置字符串。 |
| `views/components.html` / `views/body-renderers.html` | 代码增强及Mermaid/Chart.js/ABC逐篇配置。 |
| `tag.html` / `tags.html` / `category.html` | 顶部图片、分页等页面配置。 |
| `photos.html` / `links.html` / `moments.html` / `moment.html` | 官方插件页面配置；远端数据不以可执行脚本注入。 |

平台 mapper 的对象表示仍由 Halo 决定；`haloSetting` 只解包单字段 `realNode` 包装，不把任意同名字段丢掉。升级 Halo/Thymeleaf/Jackson 后应复跑该回归。

## JSON-LD、属性与 CSS

`views/seo-json.html` 的 WebSite / BlogPosting 使用现有 unbescape Unicode JSON 字符串编码：站名、别名、副标题、域名、标题、URL、图片、日期、作者名称/地址都经过同一 `encoded` 列表。模板拼接的仅是固定 JSON 结构和已编码值；没有普通HTML插值。无结构化数据开关、非适用路由或404不生成该JSON-LD。

元数据 `th:content`、标题 `th:text`、URL/数据 `th:attr` 使用 HTML 属性/文字编码，不以可执行代码解释。URL是否可用由对应消费者的协议/来源限制处理；安全编码不等于信任任意目标URL。

`views/config.html` 的20个旧CSS设置（圆角、阴影、右侧偏移、浅色背景、导航八组亮暗值）保留服务端渲染。进入style之前统一要求字符串、最长200字符，拒绝 `< > ; { }`、控制字符、反斜杠和CSS注释边界；拒绝或空值用原模板默认，通过值保留原CSS语义。无需脚本即可应用正常配置，浏览器仍负责判断具体CSS属性语法。安全边界不再允许配置值关闭style标签或拼接另一个声明。

## 远端及配置 HTML

- 独立瞬间JSON：1 MiB/1000项、10秒、匿名无Referer；字段按文字写入，HTML正文经过DOMPurify允许列表后再校验图片/链接URL。远端记录不绑定本地评论身份。
- 独立友链JSON：1 MiB/50组/500卡片、10秒、匿名无Referer；名称/说明全部textContent，网页地址与图片分别校验，错误保留原生友链。
- 新页脚HTML：模板先 `th:text`，脚本取textContent再DOMPurify允许列表，保留原生安全链接/图片；无脚本显示安全文字。
- 社交图标：模板仅存转义的数据属性，DOMPurify只允许基础图标/SVG图形，移除事件/脚本/外部引用；名称与提示为普通文本。

四类边界已覆盖脚本闭合、HTML注释组合、svg/onload、img/onerror、iframe/srcdoc、字符实体编码的javascript地址及危险协议。DOMPurify是既有固定依赖；本次没有自制HTML净化器。

## 明确允许执行的输入

`inject.head/bottom`、平台全局注入、广告HTML、自定义侧栏HTML/公告/作者按钮HTML，以及平台已发布的文章/单页/Moment正文属于明确的HTML/代码输入边界，沿用现有权限与编辑契约。它们不是上述“远端JSON或普通配置文本”，不能把这些 `th:utext` 全部宣称已净化。本次没有降低或扩展其权限，也没有声称所有第三方HTML/SDK无风险。
