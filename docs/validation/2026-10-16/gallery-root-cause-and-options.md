# 推荐图库页面停滞：原因确认与兼容方案

2026-10-16 的固定因果对照支持确认：**本次复现的图库页面图片请求停滞，与 #338 / Halo #10359 的连接读取恢复缺陷是同一原因。** 仅加入该读取恢复补丁后故障消失，撤回后再次出现。这个结论限定于本轮固定场景，不把全部历史失败归为同因；本地实验 JAR 不作为交付方案。

机器记录：[gallery-root-cause-and-options.json](gallery-root-cause-and-options.json)。此前官方原包的逐连接证据见[图库初步诊断](gallery-loading-diagnosis.md)。产品仍为 `d678d3f839347554d7f100996f87b23b571888df`，ZIP SHA256 `93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e`；本轮工具/文档起点为 `9d951b8125b580595e5d01cdec2a46b86f58745d`。没有修改主题源码、设置、官方插件或性能预算。

## 固定因果对照

最终有效批次为 `run-03`，A → B → A 各六次原生 HTTP 资源回放和三次冷启动 Chrome 图库手机观察，共 **18 次协议、9 次浏览器**；没有失败补跑，也没有拼入其他批次。A 为官方 Reactor Netty 1.3.7 同源码未修补重编译控制，B 使用相同编译器和依赖，只应用上游读取恢复补丁。外层包仅内嵌 reactor-netty-http JAR 不同，内层唯一类差异为 `HttpTrafficHandler.class`。编译器 javac 25、release target 8；实际类加载来源与每阶段 JAR 摘要均记录。

| 阶段 | 顺序请求完整返回 | 排队后第三请求完整返回 | 图库页面全部同源请求完成且图片有效 |
| --- | ---: | ---: | ---: |
| A：未修补 | 3/3 | 0/3 | 1/3 |
| B：仅读取恢复补丁 | 3/3 | 3/3 | 3/3 |
| A：撤回补丁 | 3/3 | 0/3 | 1/3 |

浏览器列同时要求主文档 200、图库图片非空且成功加载、无同源 pending/网络错误/HTTP 错误。**九例中网格内的 20 张图片其实都已加载；四个失败来自页面另外的 Image 请求持续 pending。** 挂起的 cover URL 不在采集到的网格当前 URL 集合中；CDP 只确定由 `/photos` HTML parser 发起，未保存当时 HTML 正文，因此不武断命名为侧栏或背景。这里确认的是图库页面网络完整性故障，不是证明 Photos 插件的网格渲染有 bug。

四个失败各自完成 NetLog 请求 → stream job → socket → 客户端端口 → 服务端 channel → 接收队列关联：

| 阶段/样本 | 挂起资源 | 客户端端口 / channel | 发送 GET 与持续 Recv-Q | 发送后队列观察 |
| --- | --- | --- | ---: | --- |
| 首个 A / 1 | `cover-misty-forest.webp` | 64048 / `d73ef12c` | 683 字节 | 12 次，22.250s |
| 首个 A / 2 | `cover-misty-forest.webp` | 50291 / `20392ac7` | 683 字节 | 12 次，22.248s |
| 撤回 A / 1 | `cover-turquoise-coast.webp` | 64958 / `0271213b` | 686 字节 | 12 次，22.238s |
| 撤回 A / 2 | `cover-turquoise-coast.webp` | 62987 / `a631dc92` | 686 字节 | 13 次，24.250s |

四例均先命中 `pendingResponses > 1` 缓冲，随后排空日志出现 `pending responses count: 0, queued: 1`；第三 GET 发出后服务端 Recv-Q 持续等于请求字节、Send-Q 为 0，浏览器该 socket 没有后续接收。队列观察按 NetLog 时钟偏移截取第三 GET 发送之后；首个 A / 2 的早期 698 字节瞬时队列另行保留，没有混入表中。

B 并非只因时序改变而没有进入排队路径：三例协议都记录了相同排空分支后，第三请求重新进入应用并完整返回；B 浏览器样本 1 的 `f7578dc4` 连接也经历相同缓冲/排空，随后 forest 图片返回 200，在导航后 547.771ms 完成。这与补丁恢复后续连接读取的机制一致。

每阶段使用同一固定实验室绝对路径、新 JVM、同 DEBUG/class-load 日志、同 Chrome 153.0.8010.12 / Lighthouse 13.4.1、主题包和九插件组合。保留原 3 秒协议响应上限与 45 秒导航上限，Lighthouse 返回后仅额外被动观察 20 秒。没有修改正式性能工具或将此诊断计入预算。插件、主题、附件文件摘要以及配置/内容/插件 API 语义身份在前后及跨阶段一致；数据库和插件 SQLite 存储可正常写入，不声称数据库逐字节一致。所有进程已停止，官方 Halo JAR `7a1d6ea…` 已恢复。

## 官方原包的临时配置验证

在同一主题包、配置和官方 Halo 2.26.1 上，单独设置 `-Dserver.netty.max-keep-alive-requests=1`：

- 三轮、每轮三种实际资源，各使用新连接；**9/9** 正文长度与摘要匹配，客户端仍请求 keep-alive，服务端返回 `Connection: close` 并正常结束连接，响应后无多余缓冲字节。
- 三次固定图库手机观察，**3/3** 达到网络完整性检查；每次 **22 个同源请求**均完成、**20 张网格图片**完整加载，无网络或 HTTP 错误。
- 首页、图库、RSS、Sitemap **4/4** 返回正确的页面/文档结构。前后完整站点身份一致，官方原包摘要和官方插件字节保持不变。
- 独立审查重新核对了 CDP、图片状态、真实请求/响应记录、服务端关闭连接日志和快照。公开路由正文只记录摘要及断言，未归档完整响应，因此不声称独立重放了这四份正文。

配置已撤销，实验站已停止。这只说明当前官方组合下的有限绕行可行性，不是全生态兼容保证或正式性能通过。

## 保持 Halo 与官方插件兼容的方案

| 方案 | 当前证据 | 维护成本与代价 | 对 1.0 的影响 |
| --- | --- | --- | --- |
| 官方 Halo 集成完整上游修复后升级 | 当前尚无包含该修复的正式 Halo 包 | 长期成本最低，不维护 fork、替换类或定制插件；仍须按官方升级路径验收 | 推荐正式收口路径；确认实际包含修复后，重放协议、受影响页面和完整性能矩阵 |
| 临时使用官方公开配置 `server.netty.max-keep-alive-requests=1` | 本地官方 Halo 2.26.1、固定九插件组合已完成有界验证 | 一项配置、需要重启和记录撤销；每条 HTTP/1.1 连接只处理一个请求，增加 TCP 建连，高并发/直接 TLS 场景需测成本 | 可作为明确标注的部署应急选项；不能据此关闭 #338、修改默认主题或宣称完整 1.0 通过 |
| 已有反向代理仅对 Halo 上游关闭连接复用 | Caddy 提供 `transport http { keepalive off }`，本轮未运行代理试验 | 配置集中在部署层，不改 Halo/插件包，保留客户端到代理的连接复用；仍有代理到 Halo 建连开销 | 可评估的替代方案，须在真实代理配置下验证；不直接进入主题默认配置 |

本轮实际测试的 JVM 参数为 `-Dserver.netty.max-keep-alive-requests=1`，只在实验进程中生效，结束后已移除。不要据此声称这一项配置覆盖所有插件：本轮检查图库资源、首页/图库 HTML、RSS/Sitemap XML、认证后真实状态与内容读取；没有验证评论提交、管理端上传、所有 WebSocket/SSE/流式响应或完整设备矩阵，也没有把诊断 Lighthouse 数值纳入性能预算。正式部署应分别验收实际使用的接口和并发负载。

这个配置减少每条连接可处理的请求数，不是缩短超时或自动重试。它绕开有问题的持久连接状态，不修复 Reactor Netty 代码。若站点前面已有反向代理，应区分浏览器到代理和代理到 Halo 两段连接，避免无谓地关闭客户端侧的连接复用。

不建议主题脚本重试、替换官方插件资源、取消评论/公式功能、降级成不同插件组合，或部署本地实验 JAR/SNAPSHOT 来交付 1.0。`lastFlushWhenNoRead=true` 也不是当前路径的可靠兜底：上游讨论明确它不能覆盖此次命中的 `pendingResponses > 1` 分支。

## 官方修复进度（2026-10-16 核验）

- [Halo 2.27.0](https://github.com/halo-dev/halo/releases/tag/v2.27.0) 仍包含 Spring Boot 4.1.1、Reactor Netty 1.3.7。它的 `reactor-netty-http-1.3.7.jar` 与官方 2.26.1 完全同字节，`HttpTrafficHandler.class` 也同 SHA256 `20ea9779511eb20f18cfc2d7d36c32f3f63bce7ccc07c16243c6a74ccf4c4b2a`。这是包内容核验，未新增 2.27.0 浏览器验收。
- [PR4347](https://github.com/reactor/reactor-netty/pull/4347) 状态为 closed、merged=false；维护者将修复手工应用到 1.3.x，不能写成“该 PR 已合并”。读取恢复提交为 [a115965](https://github.com/reactor/reactor-netty/commit/a11596502249de3cc3c68123c3cbc47831bb33d0)，随后还有 [ec483d](https://github.com/reactor/reactor-netty/commit/ec483d0701b4298b3f4d8abc45b5ea31f1136600) 的 handler/连接/活动请求保护。实验 B 仅使用前一个补丁确认因果，不是完整正式修复包。
- 最新正式 Reactor Netty 仍为 [1.3.7](https://github.com/reactor/reactor-netty/releases/tag/v1.3.7)。[1.3.8](https://github.com/reactor/reactor-netty/milestone/234) 与 [Spring Boot 4.1.2](https://github.com/spring-projects/spring-boot/milestone/432) 里程碑计划为 2026-10-22；计划不是已发布事实，也不是 Halo 发布承诺。[Halo #10359](https://github.com/halo-dev/halo/issues/10359) 仍开放。
- 配置依据：[Spring Boot 4.1.1 属性](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-reactor-netty/src/main/java/org/springframework/boot/reactor/netty/autoconfigure/NettyServerProperties.java#L77)及[绑定实现](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-reactor-netty/src/main/java/org/springframework/boot/reactor/netty/autoconfigure/NettyReactiveWebServerFactoryCustomizer.java#L111)、[Caddy 上游连接配置](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)、[lastFlushWhenNoRead 局限](https://github.com/reactor/reactor-netty/pull/4347#issuecomment-5355985704)。

## 保留的实验错误与验收边界

- `run-01` 虽完成 A/B/A 的固定观察，但复制 Halo 数据库到新目录保留了插件旧 `loadLocation`。Halo 正常迁移逻辑在第一阶段启动时删除了原实验站 13 个插件 JAR，最终隔离检查失败；该轮保持 `incomplete`，不用于上表或最终因果验收。13 个文件随后从冻结 seed 恢复并逐个校验摘要，其他 seed 覆盖文件一致。没有把此正常平台行为提交为上游 bug。
- `run-02` 改为固定路径后，启动前的资源不可变断言误把 Links 的正常 `links.sqlite` 写入计为资源变化。它在任何 JVM、协议或浏览器启动之前终止，案例数均为零。日志与失败记录保留。
- `run-03` 将不可变资源范围限定为插件 JAR、主题及附件；数据库/插件存储由真实 API 语义核对。它完整执行独立的新固定批次，资源、身份与恢复检查通过，不从前两轮挑选成功样本。
- 原始脚本、变体、类加载、网络/服务端日志、输入身份、首轮失败与恢复记录保留于 `.runtime/gallery-causal-followup/`；临时配置记录在 `.runtime/gallery-compatible-followup/`。仓库只提交精简报告与指纹，未上传原始文件或实验二进制。
- NetLog 部分文件尾部容器未闭合；分析仅在内存去掉尾逗号并补闭合符，使用已完整记录事件，原始字节不变。逐例状态、事件数和证据摘要保留。

原始证据清单 `.runtime/gallery-causal-followup/raw-manifest.json` 覆盖 313 个诊断文件、237,734,345 字节，SHA256 `3e42f68e2436900acef90921243a93a31e01065c3430fd12242a13d4420a07fb`。清单不包含 JAR、编译类、依赖或完整 seed，二进制身份另有摘要。因果对照与临时配置均经过独立原始证据审查，无阻塞问题；审查记录的路径和指纹保存在机器报告中。

页面加载可靠性仍是 1.0 阻塞项。正式收口需要 Halo 正式包集成完整修复、重放固定协议和受影响浏览器场景，再执行独立完整性能与合同验收；本轮没有提升功能矩阵状态、关闭 #338、修改主题默认配置或部署任何方案。
