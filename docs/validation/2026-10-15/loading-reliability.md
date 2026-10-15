# 页面资源请求停滞：有界诊断与正式版本核对

日期：2026-10-15。结果：**未复现，不是已修复**。既有核心、首页、社交/页脚与组合导航的失败继续保留，未改变矩阵状态。机器记录见 [loading-reliability.json](loading-reliability.json)。

## 本轮结果

在新建独占 Halo 2.26.1 合成站（回环端口 18815）安装主线 `f4ecc75d46651cd8a2f3188799ae27737dfdfd36` 对应主题包，ZIP SHA-256 为 `2733dc6380c727682d15ad7491d09c89b53bde2441affb937700e7b4fbd3d0ce`。启用官方 CommentWidget 3.3.2；其余七个预置插件经 API 确认全部 `DISABLED`。没有改造 Halo、插件或主题产品代码。

固定 Firefox 155.0 无头诊断覆盖首页、文章、单页、归档、标签五类页面，桌面/手机视口、明暗配色、原生请求/Playwright `route.continue` 两种路径，共 40 场景。每场景仅执行一次，导航等待仍为 20 秒；没有重试或增加等待阈值。

- 40/40 场景完成；851 个请求均返回 200，正文捕获和 SHA-256 计算均完成。
- 关闭浏览器前没有未完成请求，没有页面 JS 异常。
- 浏览器开启 `nsHttp` 和 socket 日志；服务端开启 Reactor Netty HTTP DEBUG 和完成访问日志。本批没有出现 `Draining next pipelined HTTP request` 路径。
- 安装记录运行前后保持一致。源码提交为调用方声明，本诊断不替代完整源码构建/安装文件一致性验收。

日志会影响时序；以上只能证明这批受控观察没有复现。不能用它覆盖 [existing-feature-acceptance.json](existing-feature-acceptance.json) 中的失败，也不能将全部旧失败归因为同一个底层缺陷。完成访问日志没有记录某个请求，并不单独证明请求未到达服务端。

## 正式修复版本现状

本轮通过 GitHub API 核对：[主题 #338](https://github.com/songxychn/halo-butterfly-next/issues/338) 和 [Halo #10359](https://github.com/halo-dev/halo/issues/10359) 仍开放。已确认的底层协议缺陷已有上游修复，但正式交付状态需要分别看：

- 最新正式 [Halo 2.27.0](https://github.com/halo-dev/halo/releases/tag/v2.27.0) 发布于 10 月 14 日。实际官方 JAR 的 SHA-256 与 release asset digest 一致；包内仍是 Spring Boot 4.1.1、Reactor Netty HTTP/Core **1.3.7**。本轮只检查该包，没有启动它。
- Reactor Netty 最新正式 release 仍为 **1.3.7**；包含修复的 [1.3.8 里程碑](https://github.com/reactor/reactor-netty/milestone/234) 仍开放，计划日期为 **2026-10-22**。计划可能调整，也不是 Halo 的发版承诺。
- 因此升级 Halo 2.27.0 不能视为已获得本缺陷的正式修复。主题不以 JS 重试、增加超时、替换底层类或维护插件分叉来掩盖问题，也不提高最低 Halo 版本。

下一步是在 Halo 官方包实际包含完整修复后重放已知协议复现及原失败浏览器场景；新增失败仍须逐个关联浏览器请求与服务端证据。没有稳定复现和修复证据前，P0 保持未关闭。

## 可复用工具与证据

新增 [loading-diagnostics.mjs](../../../scripts/browser/loading-diagnostics.mjs) 固定执行上述 40 场景：拒绝远端站点、错误端口、符号链接和非归属进程，核对安装记录与传入 ZIP 的哈希；输出目录必须新建，防止覆盖已有证据。每条请求按对象身份追踪，关闭前单独保存 pending 快照；HTTP 错误、正文捕获失败、导航失败均保留为失败。导航门禁不变；关闭 context/browser 和正文收集各自限制为 5 秒，超时也记失败，浏览器无法关闭时停止继续创建实例并记录不完整批次。

在新建并已准备的独占实验室中运行示例：

```sh
BASE_URL=http://127.0.0.1:18815 bun scripts/browser/loading-diagnostics.mjs \
  --lab-runtime .runtime/loading-reliability/halo-lab \
  --theme-package dist/halo-butterfly-next-0.1.0-alpha.4.zip \
  --theme-source-sha <该实验室安装记录中的完整提交号> \
  --output .runtime/loading-reliability/halo-lab/new-diagnostic
```

服务端应在启动独占 Halo 前设置 `JAVA_TOOL_OPTIONS='-Dreactor.netty.http.server.accessLogEnabled=true -Dlogging.level.reactor.netty.http.server=DEBUG'`；不要修改生产实例或其他实验室。工具只声明“安装记录与提供的 ZIP 相符”，不认证活动主题或完整安装文件。

本轮 40 场景由 `.runtime/loading-reliability/probe.mjs` 执行；通用工具是在批次后整理，没有把单元测试冒充通用工具的完整浏览器验收。六项 [回归测试](../../../tests/loading-diagnostics.test.mjs) 覆盖固定场景、请求身份、迟到关闭事件、错误/空结果/不完整批次判定、实验室守卫和有界清理。真实实验室的进程归属守卫也已执行。原始 JSON、服务端日志及 Firefox 日志保留在 `.runtime/loading-reliability/browser-batch/`；逐文件清单位于 `.runtime/loading-reliability/raw-manifest.json`，本页配套 JSON 保存其摘要及每场景日志指纹。

结束时独占 Halo 18815 已停止；Hexo 14815 未启动，其他实验室未动。浏览器批次没有改变主题或插件配置；合成内容与访问计数保留在隔离目录，未部署或发布。
