# 页面加载失败：协议复现与原场景复核

2026-10-16，在独占回环 Halo `18835` 上排查。机器记录见 [loading-followup.json](loading-followup.json)。本轮没有修改主题、Halo 或官方插件，也没有增加原导航/资源等待阈值。

候选为已合并 PR #417 的 `d678d3f839347554d7f100996f87b23b571888df`，安装包 SHA-256 `93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e`。Halo 为官方 2.26.1 JAR（`7a1d6ea0800e8940672aab99a7328b7bd9520e297677169594328004a41991bc`），浏览器为 Firefox 155.0。该诊断的包身份来自安装记录与 ZIP 摘要，不独立认证所有安装文件。

## 已知底层协议问题仍可复现

按 [Halo #10359](https://github.com/halo-dev/halo/issues/10359) 已公开的原步骤，固定执行三次队列请求和三次顺序请求，不重试：

| 路径 | 完整通过 | 结果 |
| --- | --- | --- |
| 同一连接一次发前两个 GET，完整读完两个响应，再发第三个 GET | 0/3 | 三次均在第三响应的原 3 秒等待阈值超时 |
| 同一连接每次完整读取响应后再发下一个 GET | 3/3 | 三个资源全部返回 200，正文 SHA-256 与独立预检一致 |

采集器正确消费 `Content-Length` 或 chunked 响应边界并保留多读字节；提前关闭连接、缺失 framing 和正文不符不会当作成功。三条失败连接均已完整收到前两个响应。每次都捕获到 `Draining next pipelined HTTP request, pending responses count: 0, queued: 1`；第三个 GET 已由客户端发送，长度为 125 字节，超时前服务端对应连接的接收队列也恰为 125 字节，连接仍是 `ESTABLISHED`。相关访问日志只含前两个已完成请求。

这与已有 #338 的读取恢复缺陷吻合，证明该问题在当前官方 Halo 2.26.1 与本主题包组合下仍存在。它不依赖执行主题或评论前端脚本；本轮协议阶段服务端官方 CommentWidget 仍启用，因此不声称本批是无服务端插件实验。主动 pipelining 用于稳定触发队列路径，不意味着 Firefox 使用了 pipelining，也不能据此把所有历史浏览器失败归于同一个根因。

本轮只读核对最新正式 release 仍为 Halo **2.27.0**、Reactor Netty **1.3.7**；没有重新下载相同 Halo 包。昨日对官方 2.27.0 实物包内依赖的核对仍见 [loading-reliability.md](../2026-10-15/loading-reliability.md)。后续应在 Halo 正式包引入完整上游修复后复放协议及受影响浏览器场景，不用前端重试、关闭长连接或实验替换类来宣称主题已修复。

## 浏览器诊断与采集器边界

先固定复放三条原失败导航：`preview-2` 的 `domcontentloaded` 30 秒、首页 `networkidle` 30 秒、`preview-1?language=en` 的 `networkidle` 20 秒。各做 native / `route.continue()`，分为全部八插件停用及官方 CommentWidget 3.3.2 启用两种配置；均为 1440×1000 深色，共 12 例。

- 原批次结果 **11/12**，不改成全通过。八个 `networkidle` 场景均完成，无关闭前 pending。
- 原批失败是 `domcontentloaded` 后约 1.35 秒采集器已准备关闭时，新字体请求刚发出约 6 毫秒；没有触发 30 秒导航或 5 秒资源等待超时，不能写成原资源停滞再次出现。
- 调整采集顺序并调用项目既有 `finishPage` 门禁后，仅复核四个 DCL 场景，结果 **1/4**。三个失败的关闭前 pending 为空，但关闭期间出现新图片/avatar/计数请求或 `Target ... closed` 正文捕获错误。该精简采集器缺少完整核心运行器的页面就绪与交互流程，仍不足以复核原核心失败。

上述两批均保留原始 JSON、浏览器网络日志、服务端日志和采集脚本摘要。没有改写结果，没有把采集器不足归为主题缺陷，也没有继续反复调试此精简采集器以取得绿色结果。随后改用未经修改的正式核心 `scripts/browser/run.mjs`，一次固定 Firefox 40 场景，按原来的就绪、键盘交互、reload 与资源完成门禁执行；**40/40 通过，750 个响应，关闭前没有 pending，安装记录前后不变**。这批工具报告仍为 `incomplete`（退出码 2）：只选了 Firefox，未运行 Chromium/WebKit，不是完整三引擎矩阵通过。原核心 DCL 超时本次未复现，不能因此抹去旧候选的失败。

本轮仍不能关闭历史 119/120、28/29、11/12 等资源失败，不能将单一环境局部成功升级为完整 1.0 验收。DEBUG、访问日志和 Firefox nsHttp 日志可能影响时序；所有 raw 保留在 `.runtime/loading-followup/`，逐文件指纹见机器记录的 `rawManifest`。

结束时完整主题配置和官方评论插件原启用状态已恢复并回读，自有 Halo 18835 已停止；Hexo 14835 未启动。停机脚本第一次误用不存在的 Python `lab.stop` 函数，在配置已恢复后报错；随后使用现有 CLI `stop` 成功。为按原核心工具复核曾重启一次，最终再次恢复并停止，其他实例未动。

## 可复用协议采集器

为避免复验依赖本机临时文件，已将本轮原始脚本整理为 [queued-http-diagnostic.py](../../../scripts/browser/queued-http-diagnostic.py)。该工具是在批次后抽取并加归属/路径守卫，**没有声称新工具已重新执行本轮协议批次**；原始采集脚本及运行指纹继续独立保留。两个 [framing 回归测试](../../../tests/queued-http-diagnostic.test.mjs) 验证逐字节/分片/整段读取、相邻响应、chunk trailer，以及提前 EOF、close/歧义 framing 等错误路径。

在已准备、独占、记录了插件与 JVM 配置的实验室运行：

```sh
python3 scripts/browser/queued-http-diagnostic.py \
  --lab-runtime .runtime/my-owned-lab \
  --base http://127.0.0.1:18835 \
  --source-sha <完整安装源码提交> \
  --theme-package dist/halo-butterfly-next-0.1.0-alpha.4.zip \
  --output .runtime/my-owned-lab/queued-probe-new \
  --allow-synthetic-writes yes
```

它固定执行三次队列与三次顺序请求，第三响应仍以原 3 秒为界，不重试；创建固定合成 HTML 附件时拒绝覆盖不同内容。输出目录必须新建，拒绝非回环、非归属进程、路径符号链接和资源重定向。HTTP 失败保留非零退出；socket 快照当前使用 macOS `netstat` 参数，其他平台若不可用会明确记录采集错误，不将缺失快照当作故障归因依据。抽取工具不修改服务器日志等级，建议启动实验室时独立设置现有 DEBUG/访问日志并保留启动配置。
