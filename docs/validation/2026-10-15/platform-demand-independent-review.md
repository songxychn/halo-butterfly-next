# Halo 2.27 平台改造独立审查

> **已撤回方案的历史证据，非当前安装或交付方案。** 维护者于 2026-10-15 澄清兼容边界并拒绝本次上游功能改造；定制插件补丁及依赖已从当前源码移除。以下结果只归属于文中固定的历史候选，不转用为恢复后的官方插件组合验收。源码、补丁与当时 runner 可在 [2d6fbad 历史快照](https://github.com/songxychn/halo-butterfly-next/tree/2d6fbadb6b07fa38e330dde66b01d198b723d8cc)查阅；当前决定见[更正记录](../../parity/PLATFORM-COMPATIBILITY-CORRECTION.md)。

日期：2026-10-15。审查者为独立 subagent；未编写产品代码、未改变共享实验站状态。

## 审查范围与身份

审查从主题基线 `57e7b698517528bc5525c593e68cd28dc9453a89` 的未提交工作区开始，最终复核实现提交 `946d63d7d512c7f50167060b55217b5e0292c27b`，覆盖评论主题资源加载、KaTeX PJAX 契约、三项插件源码补丁、实验室版本/进程归属及 CI 评论插件源码构建流程。此记录不等同于最终提交已通过 CI 或完整 1.0 验收。

已核对的补丁 SHA-256：

| 补丁 | SHA-256 |
| --- | --- |
| CommentWidget `0001-theme-managed-resources.patch` | `6ca10d8198a7fa55bbdf3f8601099d644b2146325f363b3ffff666b31a11f355` |
| KaTeX `0001-content-aware-resources.patch` | `85fa5d08ba350a767b060e1b82767da748ad027ec39f5806b9438ab4a2c6981a` |
| Umami `0001-public-statistics.patch` | `329ca3664544dde40c050c00d26f9405074acd5c72e03ceaf39e261c3d0a4e06` |

三份导出补丁均在对应本地插件源码上通过 `git apply --check --reverse`。最终 KaTeX JAR `e9bc80d62cc8c045144e3aea8229783557c7af3dbd64fecd8456c45bb7f8ef4c` 内的 `frontend/on-demand.js` 与修复后的源码逐字节一致。Umami 最终 JAR SHA-256 为 `3ddc802851c2f62a718df506f1d820b6c411eb0f270a8b952f40696579133cbb`，对应外仓提交 `f6d3c8d954a78d298276bfbb2149556be3be9e48`；已独立核对产物哈希、最终补丁逆向应用检查和 tracker 空配置保护入包。此前已检查 Endpoint/Service 类与匿名 RBAC 入包。

## 发现与处理

| 发现 | 影响 | 复核结果 |
| --- | --- | --- |
| KaTeX 旧页面 CSS 请求迟到失败时，无条件删除相同 URL 的新页面缓存 | PJAX 后再次 refresh 重复插入 CSS；独立 VM 复现活动样式从 1 增为 2 | 已修复：仅请求仍拥有该 URL 的 element 时删除缓存。原始复现变为 1→1，error/timeout 两个回归用例通过，补丁和 JAR 均包含修复 |
| 搜索/评论正向组合锁定原版 CommentWidget 3.4.0 | 原版没有资源契约，主题进入 unsupported，无法作为评论正向验收组合 | 已改为 `3.4.0-theme-demand.1`，锁定上游提交和补丁；CI 源码构建并核验来源及当次产物 SHA，不冒充官方发行 |
| 已升级实验室的检查器仍把新报告写成 Halo 2.26.1；README 评论基线仍为 3.3.2 | 新旧平台证据混淆、安装指导与实现不一致 | 已更新本轮对应的正文/渲染器/图片报告及 README；历史证据保留原样 |
| 只核对目录内的新 JAR，不能证明正在运行新平台；启动器可以继续复用旧进程 | 同目录放入新 JAR 后，可能把旧运行结果错误登记为 2.27 | 已核对修复：版本报告校验进程记录、实际 PID 命令和 JAR SHA；启动器拒绝复用不同版本的已运行 Halo |
| CI 新增评论插件前端构建，但 Node 设置仅随主题 engines 条件启用 | Bun 主题下插件构建依赖 runner 偶然预装的 Node | 已显式设置 Node 24；实际 Linux 构建结果仍须以 CI 为准 |

此外，主验收发现 KaTeX 从宿主线程上下文 classloader 读取插件资源失败；已独立核对最终代码显式使用 `KaTeXOnDemand.class.getClassLoader()`，隔离宿主 classloader 的回归测试与最终补丁均包含此修复。Umami 作者修复了 Halo 2.27 Jackson codec 自动选择导致的解析失败；独立复核最终实现保留 16 KiB 响应限制，先读取字符串再显式严格解析 JSON，并拒绝非 2xx 响应。

主验收随后发现并修复以下两项，已完成独立复核：

- Halo 的版本范围表达式不接受 `>=3.4.0-theme-demand.1`，导致评论所在页面 HTML 流中断。Post/SinglePage/Moment 的六处判断改用 `pluginFinder.available('PluginCommentWidget')`；主题前端仍严格校验资源协议 v1、同源精确资源路径和 CSS/JS 版本一致性，不把插件存在等同于协议可用。回归断言拒绝重新引入评论版本范围表达式，独立重跑相关 23 项测试通过。
- `URI.normalize()` 保留前导 `/../`，不足以拒绝全部点段。Umami 现逐段拒绝 `.`、`..` 及大小写 `%2e`/混合写法，保留其他百分号编码原值；源码、八个新增非法路径参数与一个实际编码路由回归均已审阅。作者测试总数为 42；主验收真实 Halo 匿名接口 5 组通过，报告确认配置恢复。本审查核对了该报告，未将合成上游响应记作真实 Umami 账号验收。
- Umami 未配置时原有 tracker 会注入相对地址 `null/umami.js`，发起无效请求并干扰主题 PJAX 支持判断。最终补丁仅在 endpoint、websiteId、scriptName 均非空白且 `disableTracker=false` 时注入；已审阅 null/空字符串/空白和缺失设置组共 10 个新增用例，并确认禁用开关测试使用完整有效配置。最终构建 XML 独立核对为 52 项、0 失败、0 错误、0 跳过；该修改已包含在上述最新补丁及 JAR 中。

## 独立执行的验证

- 主题评论、评论样式、导航定向测试：23 通过、0 失败。
- 实验室 Python 单元测试：28 通过、0 失败。
- KaTeX 迟到 CSS error/timeout 竞态：2 通过；另运行独立原始复现确认修复。
- 三项插件补丁反向应用检查，以及上述 KaTeX/Umami JAR 身份与内容比对。

最终 CI 可运行性静态复核确认：Linux 工作流显式提供 Node 24 与 Java 21；评论构建器检出精确上游提交、应用固定补丁、使用锁文件完整构建前端并执行 Gradle 测试/封装；CI 校验基线、补丁 SHA、版本、当次 JAR SHA 和实际安装字节，记录每次源码构建来源。未发现新的阻断问题，但本审查未执行远端 Linux CI，不能据静态审查宣称其已通过。

## 边界

截至上述补丁身份与工作区复核，已报告问题均已处理，未发现其他阻断问题。审查覆盖评论资源契约、资源同源/版本校验、CSS 失败重试、PJAX 清理及 KaTeX 严格脚本放行路径；Umami 覆盖固定站点与路径查询、环境变量凭据、有限响应体、严格 JSON/数值校验、缓存与上游限流、非 2xx 拒绝、通用错误及匿名只读路由。

真实 Halo 浏览器网络与匿名 RBAC 由主验收记录提供，本审查没有自行操作共享实验站。合成 Umami 响应不能替代真实账号、统计口径与权限核对；未执行生产升级、真实 Safari/物理设备/屏幕阅读器、完整性能或编辑器保存重开验收。插件是本地集成候选，上游接收和发行仍未完成。

## 新增验收脚本范围复核

对 `scripts/platform-demand/lifecycle-check.py`、`umami-check.py`、`umami-browser.mjs` 和 `integrations/patches/SUBMISSION-PLAN.md` 做了只读复核，未运行这些脚本或操作共享实验站。提交计划明确区分已准备补丁与尚未提交上游 PR，且保留真实 Umami 账号与完整 1.0 验收缺口，没有扩大授权或把合成响应当成真实账号结果。

新增脚本初审发现并已修复两项问题：两项 Python 检查器在恢复布尔值为 false 时仍可报告 passed，且单项恢复异常会阻断后续清理；Umami 浏览器子脚本硬编码默认 runtime/端口，与父脚本支持的 `LAB_RUNTIME`/`HALO_PORT` 覆盖不一致。修复后已只读复核：各项主题/插件恢复独立尝试，失败或核对不一致会写入 `failed` 并抛异常使进程非零退出；父脚本显式传递实际 `LAB_RUNTIME`/`BASE_URL`，浏览器子脚本要求两者存在并结合 lab marker 校验目标地址。未发现新的误报或授权范围问题。错误分支结论来自代码审查，没有执行故障注入；成功路径复跑由主验收记录提供。

初审对生命周期脚本进程守卫提出的疑问已撤回：其调用的 `lab.Client.__init__` 已在登录前检查 `owned_process('halo')`，不存在该项遗漏；现增加的显式重复检查仅改善入口一致性。
