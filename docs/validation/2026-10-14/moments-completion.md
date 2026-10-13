# 瞬间 D04 限定验收（2026-10-14）

实现提交：`73a56ec644e940a09eabb6e87441e843a4e45dae`，基于 `3138789f3cf6bbcad91bf4364aa2417d19985366`。实现契约见[瞬间](../../MOMENTS.md)，机器证据与源码摘要见[moments-completion.json](moments-completion.json)，交给主任务合并的[矩阵 delta](moments-completion-matrix-delta.json)不新增 verified。

## 范围

- 官方 Moment 作者/头像/日期/标签/稳定 key、详情页、评论 count/anchor/右侧跳转、立即及懒挂载、最新评论公开主体覆盖。
- 原生上一页/下一页保留；输入跳页保留 tag。每页数量归属官方插件。
- 可选独立 JSON 动态源，普通文本/净化 HTML、作者头像标签、含时区日期、num/date 过滤、真实分页、输入跳页和失败重试。本地瞬间始终保留；远端身份不绑定本地评论。
- 固定时区显示、无脚本 ISO 日期/原生链接回退；通用正文决定保持。

## 验证

- `bun run verify`：Bun 1.4.0，698 项测试、0 失败；typecheck、parity、255 文件安装包检查通过。
- 全新工作树实验室：Halo 2.26.1，Moments 1.18.0，CommentWidget 3.3.2（插件依赖自动启用 Feed 1.5.0）。仅 loopback `18431`，未访问共享站点或生产。
- `scripts/moments/check.mjs`：33 项检查通过。Chromium、Firefox、WebKit × 1440/390 × light/dark；实际 `data-color-scheme` 断言；标签保留跳页、净化和 XSS 检查、列表真实页数、精确 Moment 评论身份、焦点锚点、公开最新评论、私密/缺失详情、JSON 空/损坏/503 与重试、eager/lazy、禁用插件和无脚本回退。
- 查看了桌面深色与手机浅色详情截图；截图、原始报告保存在该工作树 `.runtime/moments-check-final/`。表单可见、无横向溢出。桌面和手机独立动态列表截图亦保存在同目录。
- 前期真实渲染发现 `~{::header}` 同时匹配作者 `<header>` 导致页头重复，已将原生作者栏改为 `<div>` 并在最终检查断言不再出现。
- 参数与安全回归包含 Moment 组名混淆拒绝、匿名公开请求、非法/重复 JSON key、日期过滤再数量裁剪、字节上限、危险协议及输入跳页边界。

## 保留边界

Hexo 参考站在 Bun 1.4.0 下因 `module.require is not a function` 启动失败。使用实验室已有 `start(halo_only=True)`、`seed(reference=False)` 继续真实 Halo；没有修改上游源或放宽比较断言，不声称双站验收。

Moments 1.18.0 将管理员 API 写入的 `approved=false` 样本在创建及后续 PUT 后重新置为 true，未能保持未审核 Moment。因此浏览器验证没有声称覆盖未审核 Moment 隐藏；真正 PUBLIC/PRIVATE 主体和待审核/隐藏评论已验证，主题仍显式过滤公开已审核未删除主体。该平台限制保留在机器记录。

评论计数采用插件 `stats.approvedComment`：本次样本里已审核隐藏评论计入该值，评论组件仅展示公开评论，二者可能不同。主题不虚构计数，也不把原生统计称为可见顶层评论数。

没有真实手机、Safari、屏幕阅读器、完整性能预算、外部服务可用性、CI、独立审查及完整 1.0 合同证据。瞬间时区不等于全站日期格式/时区完成。完整矩阵状态由主任务统一合并，本 lane 未改矩阵/路线图/剩余清单。
