# SEO 与代码注入

本批对齐 Butterfly 5.7.0 的 Open Graph、站点验证、WebSite/BlogPosting 结构化数据及 head/bottom 列表注入。配置在 Halo 主题设置的「基本设置」「SEO 与站点验证」「代码注入」中。核心页面在服务端生成标签，无需 JavaScript 执行。

## SEO 开关与页面范围

`base.enable_seo` 沿用原总开关，控制 canonical、OG、Twitter/Facebook 元数据和结构化数据。关闭后，Halo 的描述、关键词和全局注入继续由平台处理，站点验证和主题注入仍可使用。

canonical 使用 Halo 配置的站点地址与当前路由路径；文章/单页使用原生 permalink。首页第二页、归档、分类、标签及插件页面模板保留各自路径，不归一到首页；查询参数不进入 canonical。404 保留 noindex，不输出主题 canonical、OG 或结构化数据。站点语言与 `og:locale` 使用 Halo 当前 locale。

OG 图片优先文章/单页的原生封面，再使用文章作者头像或站点 Logo。图片相对路径转成绝对 URL；支持 http/https 绝对地址与协议相对地址。OG 描述优先内容摘要，再用 Halo SEO 描述或站点副标题。普通描述和关键词由 Halo 生成，主题不重复输出。Twitter 默认复用 OG 图片，可以单独指定图片、卡片类型、作者与站点账号；Facebook admins/app_id 留空不输出。Google+ 仅保留上游显式配置的 publisher 链接，不默认启用。

`seo.structured_data` 默认关闭，启用后同时受 SEO 总开关控制：文章输出 BlogPosting（标题、URL、图片、日期、作者），域名根首页第一页输出 WebSite（站名、配置别名、副标题、域名）。其他列表、单页和首页分页不输出这两类结构化数据；子目录首页不声明域名根 WebSite。作者采用 Halo 文章贡献者；作者 URL 复用文章版权设置 `post.post_copyright.author_href` 或站点地址。日期使用 Halo 原生 ISO 时间值。

JSON-LD 通过 Thymeleaf 自带的 unbescape Unicode 字符串转义构建纯 JSON，标签在服务端输出。引号、反斜杠、尖括号、脚本结束符和 U+2028/U+2029 都编码，避免 HTML script tokenizer 的双重转义状态；属性使用 `th:content` 转义。普通站点/文章数据不作为可执行 HTML 输出。

## 站点验证与代码注入

- `seo.site_verification` 是 `{name, content}` 列表；忽略空项和空名称/值，与 SEO 总开关独立。主题列表自行按 name 保留最后一条；多个验证平台使用各自 name。Halo 的重复标签处理不保证在主题表达式展开后再去重，因此避免与平台全局注入或插件重复配置。
- `inject.head` 和 `inject.bottom` 是 `{html}` 列表。保持非空条目的顺序，默认均为空；无需从 Halo 旧版全局注入复制代码。
- 代码由管理员填写并原样输出，可以包含 HTML、CSS、脚本；不解析注入内容里的 Thymeleaf 表达式。只把可信代码放在这里。
- head 列表在主题/页面 head 之后输出；随后 Halo 追加自身全局 head、内容 head、插件资源并按平台规则处理重复 `meta[name]`。
- bottom 列表位于 `</body>` 之前、主题页面脚本标签之后。页面增强脚本使用 defer，故 bottom 中的同步脚本仍可能早于 defer 执行；需要增强初始化结果时自行使用 DOMContentLoaded。Halo 全局页脚和插件页脚仍位于已有站点 footer 位置，先于主题 bottom。

公共布局 `layout.html :: html(head, content)` 支持站点验证和两处注入，页面标题、canonical、OG、JSON-LD 由提供 head 的插件决定，主题不追加竞争页面元数据。

使用 SEO 插件时，关闭主题 SEO 总开关，或者关闭双方重叠的能力。Halo 的重复标签处理不保证 canonical、`meta[property]` 和 JSON-LD 自动去重；不能假设任意插件组合都无冲突。

## 上游配置映射与旧配置

| Butterfly 5.7.0 | Halo Next |
| --- | --- |
| `Open_Graph_meta.enable` | `base.enable_seo` |
| `Open_Graph_meta.option.twitter_* / google_plus / fb_*` | `seo` 同名字段 |
| `structured_data.enable / alternate_name` | `seo.structured_data / alternate_name`，别名条目使用 `{name}` |
| `site_verification` | `seo.site_verification` |
| `inject.head / bottom` | `inject.head / bottom`，HTML 条目使用 `{html}` |

旧配置缺少 `seo` / `inject` 时正常渲染，注入为空、结构化数据关闭；保留原 SEO 总开关。新增 Twitter 元数据默认开启并受总开关控制。升级不会把 Halo 平台全局注入迁移到主题，停用主题后平台注入仍由原主题/插件契约处理。

## 验证

先构建并安装到本工作区拥有的隔离 Halo 实例，播种固定比较夹具，再执行：

```bash
bun run verify
python3 scripts/seo/check.py --runtime .runtime/seo --port 18107 \
  --package dist/halo-butterfly-next-0.1.0-alpha.4.zip --browser
```

运行器只接受当前仓库 `.runtime/` 内、ownership marker 和进程匹配的本地实验室。检查核心路由、分页、开关、特殊字符、图片 URL、注入顺序，以及真实服务端公共布局合成模板；桌面 1440×1000、手机 390×844、亮暗通过独立 headless Chromium 检查。临时配置、系统注入和单页模板在 finally 中恢复，浏览器关闭。报告和截图写入该 runtime，不含凭据。

本批不宣称完成全部 SEO-01/PLG-06 或 1.0 验收。真实生态 SEO 插件组合、全部浏览器/真机和最低 Halo 版本仍待专门验收。
