# 官方评论真实使用验收补充（2026-10-17）

本轮仍为 **incomplete**。Chromium 匿名、登录两种身份完成全部使用流程并通过严格网络门禁；Firefox 登录、WebKit 两种身份虽完成七个功能检查点，整例仍因网络门禁失败而保留失败。Firefox 匿名首次页面就绪超时，未重复使用流程。独立的插件停用、恢复读取批次通过 **3 + 3**，其中父评论和回复由 API 建立，只证明恢复显示，不计入 UI 提交通过数。

## 被测身份与范围

- 主题源归属：`d678d3f839347554d7f100996f87b23b571888df`，产品代码未修改。
- 安装包：`.runtime/performance-followup/evidence/candidate-d678d3f.zip`；SHA-256 `93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e`。每批前后逐文件核对安装目录 **269** 个文件。源 SHA 是调用者归属声明，包字节由摘要和安装文件实证绑定。
- Halo **2.26.1**，JAR SHA-256 `7a1d6ea0800e8940672aab99a7328b7bd9520e297677169594328004a41991bc`。
- 官方 CommentWidget **3.3.2**，JAR SHA-256 `e569a4bd8aade89383c8c7fee169fd822cfa80ff01341fdaa292cd2cd9db8f3f`，读取官方 `static/a.ff4cd3aa.js` 契约；没有改插件、请求内容或连接设置。
- 独占已有本地实验站 `http://127.0.0.1:18845`，运行器不启动、停止或安装服务。全部浏览器为新建 headless context：Chromium `153.0.8010.12`、Firefox `155.0`、WebKit `26.6`；匿名宽度 390，登录宽度 1440。具体浏览器版本、所有插件 JAR 摘要见[机器摘要](comment-usage-followup.json)。
- 本轮主题评论容器 `lazyload=false`，保留官方资源行为；配置允许匿名及登录评论、关闭审核，以便观察本地生成内容。每批 finally 恢复原配置。无需邮件通知，官方 `allowNotification:true` 仍保持真实值。

新工具位于 `scripts/acceptance/comments/`。最终执行源码：`run.py` SHA-256 `0e8e55956ce22e38e5d2857967924bb2772647028f04f8df12c081d23f9fd3af`；`check.mjs` SHA-256 `bc88bcc5577f2d4f740163fab84fe19e79b03ad236cbdd794facd1ba56443945`。每批都保留对应 `runner-*` 源副本、原始报告和独立摘要，不使用最终工具摘要倒填旧批。

## 固定功能检查

每个完整使用例依次检查七点：草稿落盘；触发真实 `beforeunload` 并取消离开；接受离开再原生返回后草稿恢复；官方表单提交父评论返回 200 并清空草稿；一次回复 503 后编辑器与草稿保留；同一表单实际点击重试返回 200 并清空草稿；刷新后父评论与回复各恰好一条。HTML、可见文本、localStorage、真实 POST 和服务端返回的 raw 内容相互核对。

仅回复第一次 POST 被注入一次固定 503。后续重试是被测用户功能的一部分，不是失败样本重跑。页面就绪 30 秒、功能等待 20 秒、最终 pending 等待 5 秒维持原限制；失败请求仍严格判失败，未因 WebKit 字体取消放宽门禁。

## 全批次账本

原始根目录：`.runtime/performance-followup/halo-lab/comment-usage-followup/`。表中分母均为该批实际固定范围；旧批没有被替换或改判。

| 批次 | 范围与原始结果 | 清理 / 恢复 |
| --- | --- | --- |
| `e6060c04b23c518473b7` | 首六例 **0/6**。五例误把官方富文本草稿 HTML 当纯文本；Firefox 匿名初始页面 30 秒就绪超时。无评论 POST。 | 自有 Post 1/1 删除；原始 `restorationVerified=false` 保留，另附对账及解锁记录。 |
| `6bfce0f24bacc66fce4f` | 修正文稿契约的五例 **0/5**，排除首次 Firefox 匿名网络失败。Chromium 两例和 Firefox 登录完成父评论 200，随后采集器只匹配错误 title，未匹配官方 title/detail 拼接；WebKit 两例 `fill` 后编辑器为空。 | 7/7 删除，恢复 true。 |
| `db27de6efccd937f043c` | 已到回复 503 的固定三例 **2/3**。Chromium 匿名、登录全通过。Firefox 登录七点完成，但离开阶段 `/lab/avatar.svg` 至最终仍 pending，整例失败，未重复。 | 10/10 删除，恢复 true。 |
| `a4aac9416852bfdcdf91` | WebKit 实际键盘输入补证 **0/2**。两例七点均完成，原生离开阶段 `butterfly-brands.woff2` 取消使整例失败；无 pending。 | 8/8 删除，恢复 true。 |
| `0c37ed2d875c60203356` | 生命周期 API 夹具；停用 **0/3**。插件消失与提示前置断言完成，但采集器错误查找 `#article-container`；恢复读取未运行。 | 4/4 删除，恢复 true。 |
| `e15b626e935011640d0b` | 生命周期 API 夹具；停用 **0/3**。正文容器可见，但标题精确可访问名称断言失败；恢复读取未运行。 | 4/4 删除，恢复 true。 |
| `f206f97f6c62ec14d651` | 生命周期 API 夹具；停用 **3/3**、恢复 **3/3**。使用实际正文 DOM 合同，检查 `article.render` 与直属 h2 可见、h2 `textContent` 精确一致。 | 4/4 删除，恢复 true，身份一致，无遗留锁。 |

因此原六种“引擎 × 身份”中，严格使用验收为 **2/6**，完成七个功能检查点为 **5/6**。后者不覆盖前者的失败门禁。插件生命周期使用 Chromium 匿名、Firefox 登录、WebKit 匿名三种读取身份，不能算又完成六个 UI 提交使用例。

最后生命周期停用时，评论区域、widget、lazy host 和 CommentWidget 资源均不存在，配置的降级提示和正文可见；恢复后正好一个对应自有文章的 widget，父评论及实际展开的回复均可见。插件状态经过 `DISABLED → STARTED`，同一实例的创建时间、版本及除 enabled 外 spec 在启停前核对。

## 失败的证据边界

Firefox 匿名原始 document 已返回 200，但 CSS 和头像请求未完成，`DOMContentLoaded` 30 秒未到；Firefox 登录是功能流程全部完成后头像仍 pending。这两条网络问题独立保留，本轮不认定其精确根因，也不通过重试覆盖。

WebKit 的 `fill` 失败另有一次只读本地草稿诊断：计划八个观察点，仅完成前两个，随后匿名姓名输入定位超时。前后编辑器节点身份一致，而 DOM HTML、官方 editor 模型和草稿都仍为空，不能解释为仅 `innerText` 读取差异；后续初始化时序未被完整观察，不能归因上游缺陷。诊断禁止所有业务 POST，销毁新 context。随后经审查授权的两例使用真实键盘事件，证明该输入路径可完成七点；其字体取消失败依旧保留，**未证明属于 Halo 连接读取缺陷**。

标题旧断言以完整可访问名称作为正文可用性判断，最终改为正文 DOM 文本合同。旧批实际 `anchor.click_to_scroll=false`，不能拿开启分支的 heading anchor 逻辑解释该批；可访问名称不匹配的具体原因仍未证明。这是采集器合同修正，不代表发现或完成了无障碍问题验收。

## 归属、通知与恢复

写入仅为随机 run 名称、标签和正文标记的自有合成 Post，以及挂在该 subject 上、含 run 标记的评论和回复。服务端非空 `creationTimestamp` 与完整 spec 摘要在删除前核对；不伪造 UID。浏览器业务写入仅允许自有 subject 的官方评论/回复及该文章追踪，外部 HTTP 被阻止并使场景失败。

每批只允许官方默认邮件 notifier，sender config 无 SMTP host 且未启用；使用 `.invalid` 维护者和匿名地址。没有打开外部通知，也没有改官方 `allowNotification` 请求语义。本地 reason 通过唯一 run 文本或已登记评论/回复名称归属，notification 通过唯一 run 文本或这些 reason 关联归属；登记时保存真实创建时间与 spec 摘要。新增 `someone-replied-to-you` subscription 另要求不在原订阅名单、表达式绑定 run 或合成维护者，且创建时间处于本次写入窗口。不能把这项订阅时间窗口检查泛化为所有 notification/reason 都有同一门禁。旧通知从不按“数量变化”批量删除。

官方 Halo `PostReconciler.subscribeNewCommentNotification` 调用通知订阅流程，会移除并重建作者全局 `new-comment-on-post` 订阅及随机 token。因此后六批使用严格限定的语义对账：仅启用的 `fixture-maintainer`、reasonType `new-comment-on-post`、表达式 `props.postOwner == 'fixture-maintainer'`、官方 `NonexistentKind` subject、固定 spec 字段形状允许 token/name/timestamp 轮换；这些身份差异另列 `postSubscriptionRotations`。其他既有通知、reason、subscription 仍要求身份与 spec 完全相同。每批私有全量前后通知快照保留，不把这种语义一致称为原 token 或原对象身份恢复。

首批只有部分通知 spec 摘要，无法逐字段还原旧订阅及 token，因此原始恢复失败不改判。单独的 `first-batch-reconciliation.json` 证明原 53 条通知和其余业务状态一致、自有 Post 已不存在，并记录官方轮换机制、额外诊断登录及证据缺口；经父代理审查才按原 lock 内容解锁，记录为 `first-batch-unlock.json`。未重建或删除官方全局订阅以“还原”证据。

后六批 `before == after` 包含主题/系统配置、插件状态与配置、原 Post/SinglePage 的 release-content 摘要、原评论回复和上述通知边界；`identity == identityAfter` 包含所有 JAR 和主题包身份。私有快照留在 ignored runtime；会话 cookie 文件 finally 删除。最终批恢复完成后释放 18845 给下一条验收任务，本 lane 不再发 API 或浏览器请求。

## 记录与未覆盖范围

[机器摘要](comment-usage-followup.json) 包含所有原始报告、旧工具副本及 SHA-256、每例检查点和网络例外。完整本地索引 `.runtime/comment-usage-followup-20261017/raw-manifest.json` 为 79 个证据文件记录摘要；私有文件只列摘要，不把凭据或 token 写入版本库。首批对账、只读 WebKit 诊断以及各批失败均保留。

本轮没有修改主题或官方插件，没有扩展 1.0 范围，也不将局部结果提升为 feature-matrix verified。仅覆盖原生导航、所列浏览器与身份；不包含 PJAX、性能预算、邮件送达、验证码、私密评论、附件、审核、真实移动设备、所有配置组合或完整无障碍验收。Firefox 网络残留、WebKit 取消门禁与首批通知精确恢复证据缺口均未被“全部通过”掩盖。

独立审查通过上述有限结论，记录 `.runtime/comment-usage-followup-20261017/independent-review.json`，SHA-256 `c7caed6596b678d644d35bfa2998c78be1a7d2ac5c3a796686bffc33af82d31e`。审查核对七批及冻结源码、真实请求和草稿、通知语义边界与证据摘要；没有据此扩大通过范围或追加采样。
