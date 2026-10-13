# 资源配置 / Pace PR 限定验证

[草稿 PR #411](https://github.com/songxychn/halo-butterfly-next/pull/411)，关联 [DEC-03 #410](https://github.com/songxychn/halo-butterfly-next/issues/410)。产品提交 `17ddb987f273b5bd97c57626610511ddfa435490`，通过普通 merge 纳入 master `fb4b152088ab687a2e4bfe73d372beeb2e9187fc`；本次差异只提交资源/Pace与其审查修复，原 9417 工作区五个正文扩展文件保持字节不变。Master 已有 Mermaid/Chart.js/ABCJS 等功能保留，资源文档同步其已接入状态。

干净检出 `bun run verify`：**678 项测试、0 失败、252 文件包检查通过**。固定 Butterfly 源核对通过，重复构建包字节一致。ZIP SHA-256：`754429758f859bebcf87e95626a725f96c443282420a55546fa6de1cd348c314`。

真实 Halo 2.26.1 专属 headless Chromium **22 组 Pace + 8 组资源检查通过**：包含默认与显式动画/关闭、连续 PJAX 和历史、取消竞争、原生条互斥、XHR 与 fetch、自定义 CSS、移动视口/减少动态效果、资源与 API 回退、超时、SSR 先可读、完整导航降级及真实 30 秒 watchdog。252 个实际安装文件逐字节匹配 ZIP，配置恢复后读回确认。机器记录见 [resource-pr.json](resource-pr.json)。

独立 reviewer 在 `213ac9b` 确认一个 P2：PJAX 脚本取消或 8 秒超时后，迟到 native error 仍追加本地脚本。原生 HTTP / headless Chrome 复现结果均执行 1 次；修复后均 0 次，正常错误仍回退 1 次。修复同时固定节点身份、结束状态并清理处理器，新增三项回归。原始 [独立报告](resource-pr-initial-review.json)、[失败复现](resource-pr-native-before.json)、修复提交 [独立复审](resource-pr-review-fixed.json)、[原生复验](resource-pr-native-fixed.json)均保留，复审无剩余已确认 P0/P1/P2。

随后仅添加本轮文档/证据，产品、依赖、测试和构建输入不变。最终交付提交会再次运行完整 verify 并比较包哈希，独立 reviewer 核对增量与最终 SHA，GitHub CI 也绑定最终 SHA；精确 HEAD、最终审查与 CI 链接登记在 PR 正文。

历史未提交工作区包与初始审查的来源继续独立保留，不能冒充最终包。此处的作者 Halo 回归使用本地镜像和桩；独立审查另用原生 HTTP 夹具，未独立安装 Halo。线上 SDK/公用 CDN、物理设备/Safari、固定完整双站和插件组合以及完整 1.0 验收仍未完成；矩阵没有提升 verified。未合并或发布。
