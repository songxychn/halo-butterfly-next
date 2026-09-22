# Linux 真实 Halo 浏览器对照

私有仓库的 `Linux Halo browser comparison` 工作流用于对照 macOS 的 Firefox 资源停滞调查（#338）。它不改变主题资源顺序、网络请求头或断言，不对失败页面重试后改绿；Linux 成功也不能直接证明 macOS 问题已修复。

仅运行于 GitHub 临时 Ubuntu 24.04 runner，权限 `contents: read`，无生产地址或凭据。固定 Node 24、Java 21、pnpm 11.19.0、Playwright 1.63.0、Halo 2.26.1、官方 SearchWidget 1.7.1 与 CommentWidget 3.3.2。Halo/插件下载 URL 与 SHA-256 复用版本夹具；下载和安装后的 JAR 均核对，错误直接失败。Ubuntu 系统库显式通过固定 Playwright CLI 的 `install-deps chromium firefox webkit` 安装。

## 触发与包归属

手动 `workflow_dispatch` 必须传 `source_sha` 完整小写40位提交SHA。PR只在本工作流或 `scripts/ci/linux-halo/` 路径变更时触发，并限制同私有仓库的PR；PR默认验证精确head SHA，不以合成merge ref冒充源版本。

工作流分开检出 harness 和 theme-source：后者严格匹配输入SHA，在干净工作树执行冻结安装和 `pnpm verify`。工作流显式设置 `PYTHONDONTWRITEBYTECODE=1`，避免 Python 测试在 Linux 源码目录产生 `__pycache__`；源码干净检查仍包含所有未跟踪文件。harness从本地theme-source取得精确Git对象，不改自己的工作树、不抓全部旧历史。安装浏览器前把精确harness checkout克隆到`RUNNER_TEMP/h`，保留同一SHA，避免GitHub长工作目录触发Chromium的Unix socket路径上限；计算包含`org.chromium.Chromium.XXXXXX/SingletonSocket`的路径字节必须小于108。原checkout和主题源码不移动。报告分别记录harness SHA、theme SHA和ZIP SHA-256；安装后逐文件核对ZIP。未来主题候选变更时可重新指定SHA，本次通过不泛化为未来包通过。

## 合成站与覆盖

新建独立数据库，loopback `127.0.0.1:18141`，仅启动Halo。复用lab客户端、主题安装、合成内容和菜单配置；Halo内容/正文/分类标签仍严格核对，显式不启动或检查Hexo参考站。两份checkout的comparison、插件和browser夹具须字节一致，否则拒绝混合测试profile。

固定标准comparison主题和12文章/单页夹具。停用其他内置插件，安装并仅启用两款固定官方插件，设置全局 `comment.enable=true`。评论组件按macOS实验站的白名单显式覆盖：basic 的 withReplies=false、showCommenterDevice=false、showPrivateCommentBadge=true、enablePrivateComment=false、size=20/replySize=10/withReplySize=5；avatar 的 enable=false、policy=anonymousUser、provider=gravatar；editor 的 enableEmoji=true、enableUpload=false；security.captcha 为 enable=false、type=ALPHANUMERIC、audience=ANONYMOUS、roles=[]。报告保留完整显式profile。macOS的system comment为空并依赖Halo默认，Linux显式enable=true；不声称其他设置完整一致。这是匿名核心浏览器对照profile，不是搜索查询、评论提交或完整插件生命周期验收。

启动Halo前先用完全相同的 bundled Chromium 参数做独立 launch preflight，失败保留有界错误头尾，避免20分钟后才发现启动原因被参数截断。复用现有 `scripts/browser/run.mjs`，Chromium/Firefox/WebKit × 1440/390 × 亮暗 × 10核心路由，共120页。保留JS/资源失败、Loading/图片/字体等待、页面截图、键盘导航与模式持久化等原检查；保持无头浏览器原生请求头，不加identity或Connection补丁。仅120页全部通过且原runner返回 `passed-core-smoke` 才通过；引擎缺失、超时、失败或部分报告均失败，不吞Halo安装/配置错误。

## 证据与清理

只上传专门证据目录：候选ZIP、package.sha256、summary.json、chromium-preflight.json，以及浏览器输出内严格文件名白名单的匿名逐页JSON/PNG、report.json与progress JSON。会话、密码、Cookie、storage、配置快照、日志、JAR、数据库及整个lab/browser runtime均不复制、不上传。浏览器使用匿名独立上下文，诊断不收集请求头/正文/存储；页面内容仅来自合成夹具。

浏览器错误保留有界头尾；readiness失败记录具体阶段与当时字体/loading/动画/图片状态。响应体在关闭上下文前后分别限时5秒，关闭也限时5秒；超时明确记为失败并继续保存证据，不能转为通过。CI日志额外输出匿名逐页失败分类，实际请求头未采集，不能从默认配置推断线上的请求头。

主runner `finally` 停止自己的浏览器进程组和带同一GitHub run/repository标记的Halo进程；工作流再用 `always()` 清理兜底。 job 45分钟、浏览器矩阵1500秒超时，强制取消时最后由临时runner销毁隔离环境。清理失败也算失败，原始浏览器失败记录保持不变。

本工作流仍是私有诊断入口，不会开仓库、打tag或发布Release。证据不能替代实际Safari、真机、屏幕阅读器、完整1.0及最终候选的跨环境验收。
