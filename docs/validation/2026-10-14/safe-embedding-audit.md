# A01 安全嵌入审计（2026-10-14）

实现提交 `ddf473acdb954523d61043670d9846dd0d3dc669`。消费者/信任契约见[安全嵌入](../../SAFE-EMBEDDING.md)，逐表达式机器清单与运行证据见[safe-embedding-audit.json](safe-embedding-audit.json)。矩阵建议单独交[safe-embedding-matrix-delta.json](safe-embedding-matrix-delta.json)，不新增 verified。

## 发现及修复

1. **CSS style 结束标签逃逸**：旧 `card.radius` 输入 `12px;</style><script id="a01-css-probe">window.__a01Css=1</script><style>` 在真实 Halo 返回HTML中成为独立可执行script标签。相同原始插值路径覆盖20个旧样式值。修复为服务端字符串/长度/控制符/分隔符允许条件，危险或空值用原默认；有效颜色、圆角、阴影与偏移继续SSR输出，无脚本仍生效。
2. **JavaScript HTML tokenizer 双转义状态**：默认Thymeleaf序列化将结束标签的斜杠转义，但保留 `<!--<script>`。实测组合输入导致 `Unexpected token '<'` / `MainApp is not defined`，后续模板被吞进script。修复复用Halo JSON mapper，在JSON编码之后替换尖括号和行分隔符；不双编码原值，不使用eval。构建器同时保护新加入的消息与配置表达式。

前置失败记录来自本lane拥有的临时测试包（脚本问题记录是在第一版CSS试验之后、脚本边界修复之前），不冒充已发布版本渗透测试。原始HTML/失败报告保留在忽略的runtime及临时文件，机器记录存其摘要。最终实现保留无JS CSS能力，没有采用早期CSSOM-only方案。

## 覆盖与验证

- 静态盘点当前lane15个JavaScript脚本块、201条原始数据表达式；检查JSON-LD所有encoded字段、20个旧CSS值、配置/远端HTML及明确可执行注入边界。
- `bun run verify`：Bun 1.4.0，708项测试、0失败，typecheck/parity/build/256文件包检查通过。包检查逐脚本确认JSON保护包装；裸内联表达式/变量冲突失败关闭；ConfigMap解包保持数据且不污染原型。
- 精确提交包安装于自有loopback Halo 2.26.1 `18431`，已有Moments1.18.0、Links2.3.0和CommentWidget3.3.2为官方插件；所有外部浏览器请求被阻断。
- `scripts/security/check.mjs` **33项全部通过**：三引擎×首页/文章/单页/瞬间/友链/分类/归档共21项；8种CSS声明/块/注释/控制符/反斜杠/过长/类型/null输入SSR回退；4项正常CSS在JS/noJS与亮暗规则下保留。无脚本深色项仅由检查器切换HTML主题属性以检验服务端深色规则，不声称无脚本时主题自动切换。
- 断言包括原字符串精确值、布尔/null/整数/小数/emoji和ConfigMap嵌套对象保真、MainApp.data实际分类列表/归档年月文章对象、ISO日期字符串与计数类型、无恶意script/页面脚本错误、DOMPurify允许内容和危险HTML/地址剔除。普通JS/noJS CSS检查包含圆角、右侧偏移、亮暗文字色及阴影。
- 复用 `scripts/seo/check.py` **36项全部通过**：各核心路由canonical与JSON-LD范围、实体/引号/反斜杠/控制字符/行分隔符、WebSite字段、BlogPosting日期作者图片、插件公共布局合成模板、注入顺序、关闭/缺配置回退。此轮未调用其可选浏览器入口，脚本边界浏览器由上面的三引擎运行器覆盖。
- 所有合成配置、分类名称、文章标题、系统注入与公共布局临时模板在finally恢复；机器报告确认恢复成功。

最终原始证据目录 `.runtime/security-audit-final/` 与 `.runtime/moments-lab/seo-report.json`。未访问共享/生产站点，未创建外部issue/PR、未发布。

## 保留边界

本lane尚未纳入父任务新增语言/逐篇/PJAX全组合，静态所有消费者盘点与代表路由恶意输入不等于每种插件和页面组合都验收。没有真实设备、Safari应用、屏幕阅读器、完整性能预算、外部SDK生态及完整1.0发布验收。管理员明确代码注入和平台正文HTML保持原输入契约；本次不能声称它们经过统一净化。父任务独立审查及组合回归单独记录。
