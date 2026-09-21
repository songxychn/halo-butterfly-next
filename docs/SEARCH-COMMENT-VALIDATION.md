# 官方搜索与评论验收

本轮固定 Halo 2.26.1；版本和 JAR SHA-256 见 [`fixtures/search-comment/versions.json`](../fixtures/search-comment/versions.json)。主题入口的支持基线为 SearchWidget >=1.7.1、CommentWidget >=3.3.2；低于基线、停用或未安装时不显示对应入口/挂载及评论计数。搜索 1.7.1 是本项目选定的已测支持基线，不代表已证明更早版本技术上不兼容；评论 3.3.2 提供已验证的编辑器可访问名称修复。此范围不表示所有更高版本已实测。

| 插件 | 实测版本 | 插件最低 Halo 要求 | 结论 |
| --- | --- | --- | --- |
| PluginSearchWidget | 1.7.1 | >=2.17.0 | 中文/英文、无结果、鼠标打开、键盘打开/命中、Escape 与遮罩关闭可用；关闭焦点恢复失败，见 [#313](https://github.com/songxychn/halo-butterfly-next/issues/313) |
| PluginCommentWidget | 3.3.2 | >=2.26.0 | 合成访客与登录维护者的文章/单页提交、回复、审核、错误提示和挂载开关已测；完整 PLG-03 仍未全部验收 |

## 评论适配与升级

3.1.2 的编辑器缺少可访问名称。3.3.2 的官方实现为其添加 `role="textbox"`、`aria-label` 和 `aria-multiline`，真实组件复测已消除 `aria-input-field-name`。主题要求至少 3.3.2；这不是主题替旧插件补写内部 DOM，也不会自动升级站点插件。

主题通过官方文档公开的 `--halo-cw-primary-1-color` 和 `--halo-cw-primary-3-color` 提供默认配色与焦点环。按钮使用白字且悬停整体透明度为 80%，必须同时验证正常/悬停/键盘焦点，不能只计算不透明色值。自定义样式仍可在 body/组件继承链上覆盖变量；自定义配色应自行重新验证。

官方依据：

- [3.3.2 发布与缓存更新说明](https://github.com/halo-dev/plugin-comment-widget/releases/tag/v3.3.2)
- [3.3.2 主题适配变量](https://github.com/halo-dev/plugin-comment-widget/blob/v3.3.2/dev/theme-integration.md)
- [3.3.2 编辑器实现](https://github.com/halo-dev/plugin-comment-widget/blob/v3.3.2/packages/comment-widget/src/comment-editor.ts)

使用 CDN 的真实站点升级插件后，应按官方说明刷新插件静态资源缓存；本轮使用直连 loopback 和全新浏览器上下文。不要把“插件升级成功”直接当作主题完整兼容通过。

## 可复验流程

只允许操作本仓库 comparison lab 生成、已播种合成内容的隔离站。不要对生产站执行。先按 [COMPARISON-LAB.md](COMPARISON-LAB.md) 构建安装主题，再安装并启用锁文件中的两个官方 JAR。使用独立浏览器运行目录和固定 Playwright：

```sh
node scripts/browser/install.mjs
pnpm --dir .runtime/plugin-a11y add --save-exact --ignore-scripts axe-core@4.12.1
python3 scripts/search-comment/auth.py --lab-runtime .runtime/release-readiness
BASE_URL=http://127.0.0.1:18121 node scripts/search-comment/check.mjs \
  --lab-runtime .runtime/release-readiness \
  --theme-package dist/halo-butterfly-next-0.1.0-alpha.2.zip \
  --theme-source-sha "$(git rev-parse HEAD)" \
  --output .evidence/search-comment/run-new \
  --allow-synthetic-writes yes
BASE_URL=http://127.0.0.1:18121 node scripts/search-comment/a11y.mjs \
  .runtime/release-readiness .evidence/search-comment/a11y-new
```

端口必须与目标 lab 的 owner 标识一致，主题声明与安装记录及 ZIP 哈希必须一致。文件 `plugin-auth.private.json` 是合成维护者的会话，权限必须为 0600；不要提交或上传，验收结束后删除。报告不包含该会话。

`check.mjs` 会写入带“合成验收/合成回复”标记的测试评论，记录资源 ID，临时改变评论权限、文章/单页的 `allowComment` 和插件开关，在 `finally` 中恢复原值。测试评论留在合成站供追溯。测试前两个插件必须启用；不要在运行期间改变该站配置或安装包。

每个输出目录只对应一次运行，使用新目录保留失败证据。`check.mjs` 如有任意失败会返回非零；当前固定搜索插件的焦点缺陷会使完整流程结果为 `failed`，不能删掉断言使总结果变绿。a11y 脚本有任何违规同样返回非零。脚本不进入默认无服务 CI；`pnpm verify` 通过并不等于这些真实场景通过。

## 场景范围

- 搜索：1440×1000 / 390×844 × 亮暗四组合，中文“排版”、英文“Butterfly”、唯一无结果词；鼠标/键盘入口、Enter 命中跳转、Escape/遮罩关闭、焦点恢复。
- 评论：匿名禁止时有登录提示；匿名允许时缺资料使用浏览器原生必填校验；匿名及登录合成维护者均覆盖文章/单页提交、真实回复，正文、主体映射与资源 ID 可追踪。
- 回复按插件的实际 `withReplies` 配置选择入口；默认 false 时，“显示回复”打开回复表单，不应误判没有“加入回复”按钮为功能缺失。
- 开启审核时匿名评论进入待审核并有提示；HTTP 503 使用明确标注的本地响应故障注入，验证错误提示和草稿保留，不能当成真实后端故障或正常提交成功。
- 逐篇、单页、全局以及插件开关检查服务端入口/挂载；等待 Halo 异步配置生效后断言，不以刚写入配置的瞬间判定产品失败。
- 评论区 axe-core 4.12.1，WCAG A/AA，四组合 × 正常/悬停/焦点 12 状态；另检查 body 上自定义主色继承。扫描不包含所有瞬时通知、完整屏幕阅读器行为或全部插件页面。

## 主题计数与 Loading

- `comments.count` 控制文章元信息评论数，`comments.card_post_count` 控制首页/分类/标签列表卡片评论数，均默认 false；使用 `post.stats.comment`，只在评论插件满足主题基线、全局评论启用且文章允许评论时显示。点击计数跳到文章评论区，不请求第三方计数服务。
- 评论计数链接使用常显下划线、白字深灰底色和内侧键盘焦点框；文字不再依赖封面或遮罩提供对比度。此前纯白封面下的文章计数对比度约为 3.43:1（亮色）/3.76:1（暗色）；axe 的 `incomplete` 不能视作通过。
- circle/dot/hourglass/cross_line 四种 Loading 在 DOMContentLoaded 后解除内容隐藏；脚本晚加载时立即退出。可选图片或插件请求未结束不再阻止正文阅读。延迟图片能确定复现此前等待 window.load 的隐藏路径；没有完整现场的旧偶发超时不能直接认定全部同因。

## 生命周期验收

```sh
BASE_URL=http://127.0.0.1:18121 node scripts/search-comment/lifecycle.mjs \
  --lab-runtime .runtime/release-readiness \
  --theme-package dist/halo-butterfly-next-0.1.0-alpha.2.zip \
  --theme-source-sha "$(git rev-parse HEAD)" \
  --output .evidence/search-comment/lifecycle-new \
  --allow-synthetic-writes yes
```

需要已安装固定官方 JAR、内置 theme-earth 和已有合成评论/回复；先执行前述 auth.py 和真实评论流程。仅在可恢复的自有合成站运行，不允许生产站。运行期间不要并发改变配置或激活主题。

脚本在变更前保存官方 JAR 及权限 0600 的 `restore.private.json`，再真实停用、卸载、重装插件，检查入口、浏览器请求与恢复。低版本场景使用**只修改 plugin.yaml / MANIFEST 版本字段的本地 JAR 契约夹具**，其余组件仍来自固定官方 JAR；这只证明主题版本拒绝条件，不能证明实际旧版插件兼容性。夹具不发布、不写入正式版本锁；结束恢复官方 JAR 并检查哈希。仅修改 Plugin 资源的 spec.version 不能可靠改变运行时版本，失败的早期尝试不计为通过。

此外核对三个列表与文章的计数及开关、全局/逐篇/插件禁止条件；切换内置 theme-earth 再返回，比较全部合成评论和回复的 ID/主体/内容；四种 Loading 各测桌面/手机视口 × 亮暗，并持续挂起图片响应，验证正文和评论编辑器在 window.load 之前可用。HTTP 状态、主题根节点和实际模式均有断言；新增计数在首页/文章、桌面/手机视口、亮暗八组合执行局部 axe 扫描。权限检查按精确文章路径定位，并覆盖所有匹配实例，避免把 preview-10 等路径前缀相同的文章误当成 preview-1。最终逐项恢复插件、主题配置、评论权限及活动主题并读回验证；任何失败、恢复错误或中断都不能记为通过。

输出含私有配置快照和本地测试 JAR，不可整体上传。常规退出由 finally 恢复；强制杀进程/机器掉电不会执行 finally，此时使用同目录快照与官方备份 JAR 恢复后，才能继续运行。没有实际旧版、真机或更多插件组合的通过声明。

计数局部扫描在首页/文章、桌面/手机视口、亮暗八组合上，分别使用原合成封面与纯白封面，再检查正常/悬停/键盘焦点，共 48 状态。纯白封面只在测试上下文替换所属实验站 `/lab/cover.svg` 响应，并断言实际请求发生，不修改站点附件或主题资源。等待有限动画完成后记录每个计数节点的前景、背景、祖先绘制效果、遮罩层级与截图；还检查持续下划线和实际 `:focus-visible` 焦点框。焦点用准备定位后的 Shift+Tab/Tab 进入，不代替整页 Tab 顺序、屏幕阅读器或真机验收。

保留全部 axe 规则及原始结果：违规、断言或恢复失败返回 1；存在 `incomplete` 时计数项与总报告标记 `needs-manual-review`，返回 2；只有无失败且无待人工项才返回 0。axe 4.12.1 会先检查祖先的大面积绝对定位伪元素，可能在读取链接不透明背景前就返回 `pseudoContent`。这类结果不能自动豁免：独立审查人需逐项核对最终 SHA/包的样式、实际截图和层级；只有确认白字、完全不透明 #333 底色，且没有透明度/滤镜/混合/覆盖影响时，才能以 12.63:1 的对比度单独签署。手工结论另存并绑定原始报告，不能改写自动结果；其他不能判定的情况独立处理。

## 未完成与下一步

- [#313](https://github.com/songxychn/halo-butterfly-next/issues/313)：SearchWidget 1.7.1 的 `close()` 仅改变 `open`，未恢复触发焦点，也没有主题可订阅的稳定关闭事件。应由插件保存/恢复触发元素，或提供正式关闭事件，再做主题回归。没有向上游自动发送 issue/PR，没有修改私有 Shadow DOM 或插件原型。
- 真机软键盘、真实 Safari、完整 Tab 焦点约束、屏幕阅读器及所有用户角色未验证。390px 无头视口不能替代手机设备。
- 生命周期脚本覆盖卸载重装、低版本契约、主题切换与列表计数；以对应提交的运行报告为通过依据。实际旧版兼容、所有用户角色、完整推荐插件组合仍未完成；不声称 PLG-01/02/03/06 全部通过。
- 矩阵记录精确依赖和已发现失败，不因此提升为 `verified`。完整合同仍见 [RELEASE-ACCEPTANCE.md](RELEASE-ACCEPTANCE.md)。
