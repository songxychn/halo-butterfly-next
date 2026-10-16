# 推荐图库加载停滞的有界诊断

后续结论：[固定补丁/回滚因果对照与兼容方案](gallery-root-cause-and-options.md)已确认新一批捕获案例与既有连接读取缺陷同因，并完成官方公开配置的有限绕行验证。下文保留本轮官方原包诊断的原始范围和结果。

结论：在未经修改的官方 Halo 2.26.1 上，真实三资源的原生 HTTP 回放中，顺序发送有 2/3 次第三响应超时，主动排队有 3/3 次超时；随后固定三次图库手机浏览器观察中，两次图片请求已发送，却在服务端连接接收队列持续停留。本轮把这两次浏览器案例对应到了同一连接的服务端请求缓冲、排空及后续请求未继续读取路径。没有修改主题、官方插件或运行时，没有完成修复，也没有把全部历史失败归为同一根因。

机器记录：[gallery-loading-diagnosis.json](gallery-loading-diagnosis.json)。本轮为诊断，不替换[正式 160 次性能采样](performance-full-matrix.md)，不计入性能预算或把 2/3 推算为实际用户故障率。

## 固定环境与证据边界

- 工具源码：合并 PR418 的 `9c561390ab39228b840057cb2f325ebe2f32d398`；临时脚本各自绑定 SHA256。
- 实际安装产品仍为 `d678d3f839347554d7f100996f87b23b571888df`，ZIP SHA256 `93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e`。
- 官方 Halo 2.26.1 JAR SHA256 `7a1d6ea0800e8940672aab99a7328b7bd9520e297677169594328004a41991bc`；Chrome 153.0.8010.12、Lighthouse 13.4.1、Bun 1.4.0。
- 推荐九插件为 Links 2.3.0、Photos 2.1.2、Moments 1.18.0、layout-probe 0.0.1、SearchWidget 1.8.0、CommentWidget 3.3.2、KaTeX 3.0.0、Feed 1.5.0、Sitemap 1.3.0。layout-probe 为实验夹具；不把九项都称为官方插件。原冻结主题配置保持不变。
- 独占自有 Halo 18845；Hexo 14845 未启动。每次 JVM 启动后分别建立一个认证 Client，在该阶段内复用；前后真实读取包、内容、配置、插件及其 ConfigMap。先保存快照再断言；所有启用插件须为 STARTED，停用插件须为 DISABLED。
- 四份协议/浏览器前后快照完全相同；其身份摘要、原始路径和哈希见机器记录。仅浏览器阶段增加 DEBUG/access 日志，未改变配置、超时、资源、请求重试或产品字节。

初次 `run-01` 在资源准备阶段因采集脚本把已安装 Pace 路径写成 `theme/assets/...`、漏掉 `templates/` 而终止，协议与浏览器诊断案例均为零。这是工具准备错误，不能算页面失败；启动/认证已发生，不能称为零网络访问。原日志、脚本和清理结果保留。离线核对三份实际资源路径、预期字节及 ZIP 映射后，另开 `run-02`，未覆盖任何案例。

## 从旧图库样本提取的真实发送顺序

旧候选图库手机样本 socket 112/client 54262 的实际发送顺序为：

1. SearchWidget CSS `/plugins/PluginSearchWidget/assets/static/style.css?version=1.8.0`；Content-Length 1091，响应完整。
2. 主题 Pace `/themes/halo-butterfly-next/assets/plugins/pace/pace.min.js`；gzip/chunked，编码正文 4998 字节、解码正文 12962 字节，响应完整。
3. 图片 `/lab/cover-turquoise-coast.webp`；请求 686 字节，随后该 socket 没有接收事件。

Pace 的实际发送时刻比 CSS 的 CDP loadingFinished 晚约 0.155ms，图片又在 Pace 完成后约 32ms 发出。请求创建顺序与实际发送顺序不同，不能仅凭创建 ID 判定浏览器在主动 pipelining。

回放保留非凭证请求头，移除 Cookie、CSRF、Authorization 类字段，三条请求从 674/654/686 字节变为 601/581/613 字节；因此不是请求头逐字节相同的重放。原匿名浏览器日志仅在 ignored runtime 保留，不把凭证或原始 Cookie 值写入仓库。

## 六次原生 HTTP 回放

先分别在新连接上确认三资源 HTTP 200 且解码字节匹配安装文件。随后固定各三次，不重试：顺序组每次完整读完 CSS 再发送 Pace；排队组一起发送 CSS 和 Pace。两组都完整读完前两响应，再等待 32ms 发送图片；每个响应仍使用原 3 秒总截止时间。

解析器验证 Content-Length 或 chunked framing，消耗零长度终止块与 trailer、保留跨响应的过量读取缓冲，gzip 解码后比较原文件 SHA256。两项定向解析测试覆盖相邻响应/分段读取，以及歧义 framing、提前 EOF 和不受支持的连接关闭分帧。

| 模式/序号 | 客户端端口 | 结果 | 第三请求后 Java Recv-Q / Send-Q |
| --- | ---: | --- | --- |
| 顺序 0 | 52119 | 三响应完整且字节匹配 | 成功，不列为停滞 |
| 顺序 1 | 52120 | 第三响应 3s 超时 | 613 / 0 |
| 顺序 2 | 52131 | 第三响应 3s 超时 | 613 / 0 |
| 排队 0 | 52134 | 第三响应 3s 超时 | 613 / 0 |
| 排队 1 | 52147 | 第三响应 3s 超时 | 613 / 0 |
| 排队 2 | 52150 | 第三响应 3s 超时 | 613 / 0 |

全部六次前两响应都完整且字节匹配：CSS 1091 字节；Pace 编码 4998、解码 12962 字节，最后 chunk 为零、读后缓冲为空。成功组图片 165662 字节也匹配。五次失败都在第三条完整 613 字节请求到达服务器后发生，不能归为前两响应未读完或仅主动客户端排队能触发。

协议阶段没有执行主题或插件前端 JavaScript，但九项服务端插件仍然启用；不声称是无插件实验。该阶段未开启 DEBUG，因此五例各自没有服务端缓冲分支日志；下面的浏览器实验提供了真实浏览器与服务端队列之间的关联。

## 三次真实浏览器观察

保持原 Lighthouse 性能、视口、节流与 45 秒导航上限，每次启动同一固定 Chrome 的全新匿名自有进程；Lighthouse 返回后保留同一页面额外 20 秒。诊断使用 programmatic Lighthouse，`channel: node` 与输出序列化形式不同于正式 CLI；CDP、NetLog、每两秒 socket 观察及服务端日志仅用于归因，不作为正式预算样本。

| 序号 | LH 返回（导航后） | 观察截止 | 未完成请求 |
| --- | ---: | ---: | --- |
| 0 | 5.082s | 25.106s | 无；保留为负例 |
| 1 | 4.767s | 24.787s | `/lab/cover-turquoise-coast.webp` |
| 2 | 4.749s | 24.775s | `/lab/cover-misty-forest.webp` |

两次持续请求各自完成了独立关联，没有套用旧图库端口：

| 序号 | URL_REQUEST → stream job → socket | 客户端端口 / 服务端 channel | 第三 GET / Java Recv-Q | 同页队列观察 |
| --- | --- | --- | ---: | --- |
| 1 | 145 → 147 → 103 | 56895 / `10698384` | 686 / 686 字节 | 12 次，跨度 22.261s |
| 2 | 148 → 150 → 103 | 49211 / `0de69e8c` | 683 / 683 字节 | 12 次，跨度 22.261s |

两条连接的前序资源这次都是 **CommentWidget CSS → Pace → 图片**，不同于旧图库的 SearchWidget CSS。CSS 为 Content-Length 1302，Pace 为完整 gzip/chunked 响应；Pace 实际发送分别在 CSS loadingFinished 后约 0.188ms/0.214ms，图片分别在 Pace 完成后约 45ms/60ms 发出。不能认定固定某个官方插件或图库前端脚本必然触发。

同一 Java PID 91776、各自 channel 的 DEBUG 日志都依次显示：pending responses 达到 2，缓冲请求与内容；随后第一次排空为 `pending responses count: 1, queued: 2`，第二次排空为 `pending responses count: 0, queued: 1`。序号 1 两次排空在本地 06:51:28.440/.444；序号 2 在 06:51:54.914/.919。精确日志行号及原文本保存在 JSON。

实际命中的是 **`pendingResponses > 1`** 分支，并非调查前考虑的 `existingOps` keep-alive 分支。Chrome 顺序发送不保证服务端异步响应完成计数已清零。后续第三 GET 在浏览器 socket 已发送，Java 对应连接 Recv-Q 持续恰好等于完整请求长度、Send-Q 为零；整个同页观察内没有响应头、完成事件或该 socket 接收事件。这些联合证据支持：服务端在缓冲和排空后未继续读取该连接的后续请求。

[官方 Reactor Netty v1.3.7 的 HttpTrafficHandler](https://github.com/reactor/reactor-netty/blob/v1.3.7/reactor-netty-http/src/main/java/reactor/netty/http/server/HttpTrafficHandler.java) 中，`resumeRead()` 在队列非空时安排排空，空队列时才直接调用 `ctx.read()`；排空结束路径与已知读取恢复缺陷一致。这是结合源码的机制解释。`ctx.read()` 本身并非每次都打日志，本轮没有直接跟踪方法调用，也没有补丁/回滚因果对照；不能单凭没有“下一次读取”日志断言某方法未被调用。

相对[已有 #338 协议复核](loading-followup.md)及[上一批图库 socket 观察](performance-navigation-observations.md)，本轮增加了两项证据：真实资源在顺序回放也会停滞；真实 Chrome 图片停滞可逐连接对应到服务端缓冲、排空与后续 Recv-Q。它没有证明所有历史 18 个正式性能失败同因，也未验证任何修复有效。

## 原始证据、复放与清理

原始目录 `.runtime/gallery-loading-followup/`，完整清单 `raw-manifest.json` 覆盖 **63 个文件、28,368,155 字节**，SHA256 `ea88b8b7715152159960563cd99ab01355c9a719469730fdefb9d443d621cf3a`。包括 run-01、run-02、两版脚本副本、HTTP 回放、三份浏览器 NetLog/CDP/LHR/trace、服务端日志、socket 队列、前后快照及离线分析脚本。报告只提供本地路径和指纹，不声称已经公开上传 raw。

三份新 NetLog 均保留完整事件行但尾部有逗号、JSON 容器未闭合；完整已记录事件分别为 **6097 / 5945 / 5937**。解析只在内存移除尾逗号并补 `]}`，不恢复缺失事件、不修改原始字节；逐样本截断状态、完整事件数与 raw 哈希在 JSON 中。关键发送/绑定事件来自原有完整事件，同页请求截止状态另由完整 CDP 日志交叉验证。

原执行命令为 `python3 .runtime/gallery-loading-followup/preparation/run-diagnosis.py`。脚本硬性拒绝覆盖已有 `run-02`；不能直接重复运行这条命令。未来经授权复放须准备相同 owned fixture、包、版本锁和独占 CPU，使用新目录并记录相应脚本哈希变化，保持固定六加三案例；脚本实际测量版本归档于 `run-02/scripts/`，SHA256 列于 JSON。离线 `preparation/summarize.py` 只读取证据并生成机器报告，不启动服务或浏览器。

四份完整站点快照一致。结束时原始 JVM PID 91398 与 DEBUG JVM PID 91776 都已停止，18845 不再监听，JAVA_TOOL_OPTIONS 已撤销；保留候选 d678/93b6、冻结默认配置、推荐九插件及夹具供复验。没有改动其他实验站，没有新增上游提交，也未提高任何 1.0 验收状态。
