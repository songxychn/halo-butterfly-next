# 当前候选在最低 Halo 2.20.2 的限定验收

2026-10-14，在全新、独占回环端口 18125 的 H2 实例安装 root `59fee484037c14d6a87aa2b71cc893da708add8c` 对应主题包。ZIP SHA-256 为 `6cc08bdb52a18055e9ddde55f77180394c182cf17e59aa20813cfcdb3c823d03`。源码归属为调用者提供，包字节以哈希为准；本记录不覆盖后续候选。

官方 [Halo 2.20.2 JAR](https://github.com/halo-dev/halo/releases/download/v2.20.2/halo-2.20.2.jar) SHA-256 为 `521e2a1492fb70c27e3759f36a058849cbab38008ddab109cb7f3ba78cb18179`，与既有固定版本记录相同。未使用历史服务、数据库或生产数据。禁用此新实例的可选插件，仅验主题核心；本机 Basic Auth 只为合成实例测试启用。

## 结果

- 默认配置 HTTP 24/24：首页、归档、合成文章 × `en/ja/ko/zh/zh-CN/zh-HK/zh-TW/fr`。全部 HTTP 200，无未解析消息键；`fr` 回退英文；文章独立 `lang=ja` 与 `og:locale=ja`，不强制切换外壳语言。
- 恶意配置真实 Chromium 移动端 24/24：同一路由/语言矩阵，实际消息与语言包相同、无脚本错误；含 `<!--<script>`、闭合 script、引号、反斜线、U+2028/U+2029、emoji 的字符串完整往返。数字、布尔、null、数组、对象和自有 `__proto__` 保留类型，原型不污染，探针未执行且无注入 script。JSON-LD 可解析且不包含危险原始分隔字符，归档数据仍为原生数组。
- 语言优先级 4/4：站点基本设置为韩文时，英文请求头仍得到英文；日文 Cookie 覆盖英文请求头；韩文 query 覆盖日文 Cookie；简中请求头选择简中。
- 主题配置及 system ConfigMap 的 `data` 均恢复至测试前值并回读比较；只停止明确拥有的 PID 44431 / 18125。原始响应、测试脚本、失败报告及日志保留于 `.runtime/minimum-halo/`。

## 最低版本 API 与语言边界

官方 [JsonUtils.java](https://github.com/halo-dev/halo/blob/v2.20.2/api/src/main/java/run/halo/app/infra/utils/JsonUtils.java) 提供公开静态 `mapper()`；从上述 JAR 提取 `api-2.20.2.jar` 后用 `javap` 也确认该入口。当前主题实际渲染验证了 `JsonUtils.mapper()` 与双重 `writeValueAsString` 模板调用，并非仅依据方法存在推断兼容。

官方 [ThemeLocaleContextResolver.java](https://github.com/halo-dev/halo/blob/v2.20.2/application/src/main/java/run/halo/app/theme/ThemeLocaleContextResolver.java) 的顺序为 query → Cookie → Accept-Language，**不含 Halo 2.26.1 的站点默认语言步骤**。主题沿用各版本原生机制，不修改最低版本声明；国际化文档同步注明此差异。

## 修正与限制

保留的初次 HTTP 报告含 7 次文章 404：合成文章时间最初设在当前 UTC 时间之后，改为 2026-10-13 后重跑全部 24 页通过。另有测试预期修正：OG 使用 `ja`；Playwright 对象传输不保留自有 `__proto__`，改在页面内 JSON.stringify 再解析；JSON-LD alternateName 同时含配置值及站点域名，断言精确核对配置项。原失败未删除或重标为通过。

这是最低版本核心模板、消息解析与内联数据边界的验收。仅 Chromium 移动端，无可选插件，不等于完整功能矩阵、三引擎、真实 Safari/设备、屏幕阅读器或 1.0 已验收。结构化逐项结果见 [JSON](minimum-halo-current.json)。
