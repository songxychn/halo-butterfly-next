# 维护范围

主题交付物是安装 ZIP。持续维护构建、类型检查、单元回归、包检查，以及核心页面的真实 Halo 冒烟。官方插件的后台编辑器、安装/卸载生命周期、评论业务和历史传输故障诊断不属于主题持续验收范围。

## 当前入口

- `bun run verify`：类型、功能矩阵一致性、单元回归、构建和包检查。
- `bun run site:check`：随仓库的公开示例内容检查。
- [比较实验室](COMPARISON-LAB.md)：需要真实 Halo 页面验证时使用；Hexo 参照站不替代产品验收。
- `bun scripts/smoke.mjs --base http://127.0.0.1:18091`：已运行的本地 Halo 核心页面检查。
- [发行流程](../releases/README.md)：发布安装包和公开制品；Demo 镜像需另外手动执行，不随主题发行自动推广。

按修改影响选择浏览器检查；保留的专题脚本也不是每次发布都必须执行的全量矩阵。页面切换使用浏览器原生导航，没有主题页面作用域、PJAX 或第三方 SDK 加载平台。组件自身的监听取消、观察器和绘制资源管理仍按实际需要保留。

## 已退休工具

2026-10-28 删除以下一次性工具及只服务于它们的测试：

- `scripts/acceptance/combinations`、`scripts/acceptance/math-editor`：历史插件组合和官方编辑器内部操作。
- `scripts/search-comment` 中的登录、业务交互、a11y、focus 和生命周期工具；核心浏览器检查依赖的 `diagnostics.mjs` 仍保留。
- `scripts/config-defaults/validate.py`：仍断言已删除的 PJAX/单项 CDN 配置。
- `scripts/body-renderers`、`scripts/perf/fault-*`：旧候选包和传输故障专用验收。
- `scripts/images/check-editor.mjs`、编辑器签名助手、`scripts/content/check-editor.mjs` 与 `block-lifecycle.py`：编辑器内部业务验收。
- 原 JSON 图库的浏览器检查、夹具与前端数据加载器；依赖页面作用域的灯箱竞态脚本、固定旧 alpha 包的封面故障脚本。

历史源码固定保存在 [收缩前提交](https://github.com/songxychn/halo-butterfly-next/tree/4e097058b7343640a30106902260e881f7d88728)。历史报告继续留在 `docs/validation`，报告中的命令、文件数量和配置不能当作当前操作手册。不得把历史报告改成新候选的通过记录，也不应为运行旧脚本恢复已移除的产品能力。

## 运维归属

宿主机 Demo 更新器、systemd 定时器和共享 Caddy 回退测试迁至 `infra-ops/runbooks/halo-butterfly-demo/`。主题仓库保留通用镜像构建、初始化和启动冒烟。源码迁移不代表已部署；运维仓库记录的线上定制必须在未来获准部署时另行核对。
