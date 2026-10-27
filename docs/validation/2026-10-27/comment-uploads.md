# 官方评论图片上传补验

候选为已合并 PR #430 的 `586a14dc8e471df8aea91190a9eec9b6c088cea3`。
重新构建、安装核对的 alpha.4 ZIP SHA-256 为
`594c6fb24714c9e9de14b608f87741c4c88129660b997e4d9c7042297f2883e6`，
269 文件，与此前固定机性能候选 `64f5266` 字节相同。合并提交的
[CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/40336563385) 已通过。
本批只增加验收工具和证据，不修改产品、官方模块、最低 Halo 版本或发布版本。

运行使用官方 Halo 2.27.1、CommentWidget 3.3.2、Moments 1.18.0；
完整 JAR/包/工具/原始报告哈希见[机器记录](comment-uploads.json)。仅独占本地
实验室、官方本地存储、合成账号和 `.invalid` 邮箱，SMTP 保持未配置/禁用。

## 功能结果

直接上传范围包括：实际上传按钮选择 PNG，拒绝 SVG/超过 1 MiB 文件且无上传请求，
本地预览，注入一次 503 后保留内容，真实表单重试，父评论和回复图片提交，
发布图片解码，以及刷新后再次读取。三引擎分别为 Chromium 153.0.8010.12、
Firefox 155.0、WebKit 26.6；匿名 390px、登录 1440px。

- Post `31302e317ba0b0030d8f`：6/6，12 张附件，浏览器和受控清理均通过，恢复核验通过。
- SinglePage：C/F 四例见 `e8ff3db87895721c60d6`，WebKit 两例补证见
  `5f5a21bbc73cd7ee39a5`。功能跨批覆盖，**两批总报告仍为失败**：附件在推进
  清理注解后没有在工具的 30 秒观察窗内删除。另行按创建时间、内容、归属及原库存
  核对后执行管理 API 恢复；该恢复不算官方 GC 通过。
- Moment `3e117a948d43ce7d061e`：浏览器 6/6、12 张图片；原总报告仍因受控 GC
  超时而失败。独立恢复对照仅推进已归属附件的截止时间，再通过官方 API 停用/启用
  CommentWidget，官方重启扫描删除了 12 张附件，全部公开 URL 返回 404；随后原库存、
  主题和插件配置及安装包复核通过。它是受控时间加插件重启的证据，不是自然到期证明。

合计三主体 18 个身份的直接上传功能已覆盖，SinglePage 为跨批补证；不等于 18 例
完整端到端清理报告均通过。36 次实际提交正文与预期文本逐项核对相同。

直接上传不包括“尚未提交的图片刷新后再上传”，不覆盖全部图片类型、其他存储提供方、
保留附件/被其他内容引用的保护分支，也不能代表完整 PLG-03/06、EXT-02/03 通过。
每批剩余未运行的身份仍计入声明数量；不删失败后重新拼成单批通过。

## WebKit 尚未提交图片的边界

完整刷新批次 `3b4496890e4aa6b16c67` 的 C/F 四例通过；WebKit 匿名恢复图片草稿后，
上传收到 500，登录例未运行。服务端记录 `Could not find first boundary`。
同一问题不能据此归为 #338，也不能归为主题协议缺陷。

两个无主题、无 Halo/插件的最小对照分别检查 IndexedDB File 往返与 multipart 传输。
WebKit 临时上下文未可靠存储 File；新建磁盘上下文能恢复 File，但从 IndexedDB 读出的
File 作为 multipart 发送时，回显服务收到零字节；新建 File 正常。有无路由拦截和
一次 503 注入的对照保留。详见 [File 存储对照](upload-idb-control.json)和
[multipart 传输对照](upload-transport-control.json)。结论限于所测 Playwright WebKit，
不声称实际 Safari 有同样问题，也不把改成直接上传视作修复。
传输记录中 `injected=true, routed=false` 只是两次普通请求；只有同时
`routed=true` 才实际注入一次 503，不能把前者称为错误重试。

## 脚本故障和恢复边界

全部失败报告保留在机器记录中，包括初期图片夹具、定位器和网络结算器错误，
临时 WebKit 上下文存储问题，以及匿名输入焦点问题。

官方 [comment-editor.ts](https://github.com/halo-dev/plugin-comment-widget/blob/v3.3.2/packages/comment-widget/src/comment-editor.ts)
对编辑器/工具栏点击延迟 100ms 聚焦。脚本过早切换身份字段时曾把昵称或邮箱写进正文；
现等待该动作完成、用真实 Tab/逐字键入，并检查字段值、编辑器正文和实际提交正文。
原指针点击拦截仍保留，不把键盘输入补证说成指针操作通过。

附件先观察官方约一小时 `delete-after`，再仅推进自有夹具的注解时间，观察官方清理
及公开图片 404。这是受控截止时间验证，**不是自然等待一小时或 24 小时的证明**。
推进注解后 30 秒仍未删除的批次保持失败，不以管理 API 清理替代官方 GC 结果；
该工具观察窗失败也不足以认定官方自然到期机制故障。

官方 [AttachmentUploadReconciler](https://github.com/halo-dev/plugin-comment-widget/blob/v3.3.2/src/main/java/run/halo/comment/widget/upload/AttachmentUploadReconciler.java)
声明 `syncAllOnStart(true)` 并扫描 GC_PENDING 附件，Moment 的恢复对照沿用此路径。
没有由此推断自然一小时重调度失效。

清理失败锁定实验室，另行恢复记录与原失败报告分开。恢复只针对唯一分组、运行 ID、
创建时间、上传 ID、评论/回复目标及票据记录共同确认的自有资源，最后核对原库存、
主题配置、插件配置和安装包。本轮没有抹去失败或把恢复成功改记为验收通过。

## 仍阻塞的范围

评论上传完整验收仍未闭合：WebKit 未提交图片刷新后的上传、未干预计时的附件到期
回收及其他完整合同场景继续保留。P1 图片剩余配置、P2 平台映射和最终候选集成门禁
见[剩余清单](../../parity/DEVELOPMENT-BACKLOG.md)。P3 既有延期不变；不发布 1.0。

本地完整 `bun run verify`：799/0，类型、897 项矩阵、构建及 269 文件安装包检查通过。
新增回归检查覆盖唯一注入 503 的严格豁免、迟到网络/页面错误，以及拒绝删除被替换的
附件和无法归属的新票据。没有新增矩阵 verified；CI 状态以本批 PR 的精确提交为准。

首轮 [PR #431 CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/40364960114)
在 794 项通过、0 项失败后超过八分钟无进展，取消后取得日志；唯一缺少输出的是
`layout-probe.test.mjs` 的五项同步 Python stdin 测试，新上传测试三项均通过。
将该调用改为异步 `execFile -c`，保留五项断言，子进程增加 20 秒界限，未放宽原
30 秒测试门禁。专项 5/5、完整 verify 799/0 再次通过；不声称证明了 Bun 内部根因。
原取消记录与日志哈希保留在 [CI 记录](pr431-ci.json)，后续 CI 不覆盖原结果。
