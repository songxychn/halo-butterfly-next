# 评论懒加载限定验收（2026-10-13）

需求 [#407](https://github.com/songxychn/halo-butterfly-next/issues/407)。仅实现文章/单页 `comments.lazyload`；默认关闭，邻近 300px 自动挂载，评论跳转、直接锚点和历史导航立即挂载。模块 8 秒超时和失败重试；无 IntersectionObserver 时立即加载。挂载后不因滚动或重建主题作用域替换编辑器。

## 独立提交与最新 master 验证

[草稿 PR #409](https://github.com/songxychn/halo-butterfly-next/pull/409) 创建期间 master 又合入正文扩展，因此再普通合并 `1db37701135c444887f7e83aa0541e837ab940af`。当前产品提交 `95cb290beb3d4b45ab5e9f692d3f4120ff69757f` 完整验证 663/663、真实 Halo 三引擎桌面/手机亮暗 81/81、安装文件 249/249 一致，0 设置恢复错误。包 SHA-256 `9d926430cc20fa5f1dc763ec1d256d00778c04de1adcda437dd180f8ec9e3939`。本次 runner 从干净产品检出读取源码摘要，记录见 `committedValidation.latestMaster`；相对当前 master 仍为评论相关 20 个文件，原工作区五个正文扩展文件未提交且摘要不变。后续验证材料提交只更新文档。

评论实现独立提交 `c79b55806602301564ba60c50ff8a8f41b6fd5f2`，干净检出不包含原工作区的五个正文扩展文件改动，完整验证 647/647、真实 Halo 浏览器 81/81、安装文件 160/160 全部通过。原工作区文件摘要比对一致。

随后普通 merge 最新 master `6112374fc177fdcd4ad2a88ca0c543f560e78e77`，产品提交 `d5705e14a73e05b99c7b6f1b59e549e36164e9f2`：完整验证 659/659、真实 Halo 三引擎桌面/手机亮暗模式 81/81、安装文件 249/249 逐字节一致，0 设置恢复错误。相对 master 的 PR 差异仍只有评论源代码、测试与文档 20 个文件。下方保留首次混合工作区验证的历史身份；当前独立/合并记录及安装包摘要见机器记录 `committedValidation`。后续材料提交只更新文档，产品源码及安装包身份不变。

独立验证准备阶段先遇到导出目录缺 Git 元数据（646/647），改用准确提交的干净 Git 检出后全部通过；实验室重启令旧私有会话重定向到登录 HTML，首个浏览器尝试在场景执行前退出，刷新专属测试会话并另存报告后 81/81 通过。浏览器 runner 使用原检出的独立缓存，因此原报告 `sourceDigests` 描述 runner 文件；测试产品身份由干净提交、包摘要和安装字节比对绑定，合并源码摘要另记 `testedSourceDigests`。

## 首次工作区候选身份

这是 master `5622798dd06306c8b56b519581d807cd4f473b70` 上的工作区候选，**不是该提交的原始源码**，尚未提交、发布或部署。工作区原有正文扩展改动保留，并进入本地构建；不把它们算作本批交付。产品源树摘要、本批文件摘要、包 SHA-256 及检查明细见 [机器记录](comment-lazy.json)。实验室 `installed-package.json` 的 sourceCommit 是调用方声明的基线；实际候选由 ZIP 和源快照摘要识别。

## 首次工作区候选结果

- Bun 1.4.0 的完整 `bun run verify`：647 项测试通过、0 失败；TypeScript、parity、构建和 160 文件包检查通过。
- 独立真实 Halo 2.26.1，CommentWidget 3.3.2 官方 JAR SHA-256 `e569a4bd8aade89383c8c7fee169fd822cfa80ff01341fdaa292cd2cd9db8f3f`。最终安装的 160 个文件与候选 ZIP 全部字节相同。
- Playwright 1.63.0 独立 Chromium/Firefox/WebKit，1440/390px、亮/暗模式；实际长文章和长单页，81/81 通过。
- 到达邻近范围前无组件及评论配置/列表请求；组件在尚未进入视口时挂载，主体 group/kind/name/version 正确。反复滚动后输入保留且只有一个组件。
- 禁止自动观察器回调的专项夹具证明鼠标/键盘跳转和直接评论锚点主动挂载；查询参数、焦点及 fragment 正确。官方模块网络错误后显示重试，重试成功；浏览器缺少 IntersectionObserver 仍挂载。
- 显式关闭与旧配置缺字段都走原官方 `<halo:comment>`；全局评论关闭后评论区和跳转入口消失。主题/系统临时设置均恢复并读回一致，0 恢复错误。

## 原失败及范围

首轮使用未安装的 Chromium headless shell；随后修正为项目安装的独立 Chromium。第二轮在 WebKit 尚未就绪时失败；当时脚本误报 0 checks passed，该文字无效，实际退出 1，不计通过。浏览器下载中断后停止本任务安装进程，并使用同版已缓存 WebKit。

第三轮 77/81：三个模块重试场景因测试在顶部隐藏工具栏处点击而超时，另有 Firefox 文章直接锚点导航资源超时。后者保留原失败，不据后续通过声称 #338 已修复。修正点击场景先滚动显示工具栏；补上设置实际亮暗模式的断言、运行错误捕获及完整场景数校验。再安装最终工作区包并另开报告，81/81 通过，旧报告不覆盖。

主题加载完成仅指官方模块可用、组件已挂载；内部数据请求、权限、提交和回复错误由官方 UI 管理。插件在 head 中的 JS modulepreload 和 CSS 保留，**首屏零评论资源下载仍未完成**。矩阵仅把三条懒挂载实现改为 implemented-unverified，0 条 verified；不改变原资源断言来制造验收通过。Moment 评论不在本批。

真实 Safari/设备/屏幕阅读器、独立审查和最终 PR CI、完整双站/1.0 合同另行验收。

## 复验

在全新专属 lab 按现有比较站流程安装主题和固定官方评论插件，用 `scripts/comment-enhancements/fixture.py` 准备合成评论及私有会话；该脚本不支持覆盖既有夹具。浏览器检查仅接受已核实 PID/cwd、`lab.json`、安装摘要及私有会话的回环合成站，创建两条专属带 owner label 的长内容并保留供追溯。

```sh
BASE_URL=http://127.0.0.1:18631 bun scripts/comment-lazy/check.mjs \
  --lab-runtime .runtime/comment-lazy-halo \
  --theme-package dist/halo-butterfly-next-0.1.0-alpha.4.zip \
  --theme-source-sha 95cb290beb3d4b45ab5e9f692d3f4120ff69757f \
  --output .runtime/comment-lazy-runs/NEW-UNIQUE-DIRECTORY \
  --allow-synthetic-writes yes
```

运行材料在 git-ignored `.runtime/comment-lazy-runs/`，恢复快照和认证文件为 0600，不入库。记录的实验室端口和 caller-supplied SHA 需随实际复验环境调整。
