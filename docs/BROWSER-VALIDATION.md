# 独立多引擎浏览器回归

本工具为 `BROWSER-04` 提供可重复的基础回归设施。它扫描合成对照站的 10 条核心路由，分别运行 1440×1000、390×844 与亮暗组合，每个引擎 40 页。报告始终保留 `contractAcceptance: false`：尚未覆盖完整 P/P+、全部交互、插件、真机与人工判断，不能据此关闭验收合同。

Playwright **1.63.0** 与 `playwright-core` 的精确版本、包完整性由 `fixtures/browser/package.json`、`bun.lock` 固定；[官方 npm 发布元数据](https://registry.npmjs.org/playwright/1.63.0)的身份摘录在 `upstream.json`。安装使用 Bun **1.4.0**、Node.js 20 或更新版本，不自动安装包管理器。

[Playwright 官方说明](https://playwright.dev/docs/browsers)中，每个版本配套特定浏览器构建。此工具只启动它下载的 Chromium（`channel: chromium` 新无头模式）、Firefox 与 WebKit。后两者依赖自动化补丁，WebKit 也不是实际 Safari；这些结果不替代 `BROWSER-01/02/03` 的品牌稳定版证据。手机场景是独立无头浏览器的视口，不是真机。

## 安装

在本项目 worktree 中执行，确保 `node` 和精确版本 `bun` 已在 PATH：

```sh
node scripts/browser/install.mjs
```

依赖、Bun 缓存、下载引擎、临时配置与报告全部放在当前 worktree 的 `.runtime/browser-matrix/`。脚本强制 `PLAYWRIGHT_BROWSERS_PATH` 指向其中的 `browsers/`，拒绝外部覆盖和 `SELENIUM_REMOTE_URL` 隐式连接；不安装系统依赖、全局浏览器，不连接已有 Chrome/Safari，不读取用户浏览器配置。缓存存在但无所属标识、所属标识不符或目录指向外部时拒绝认领。重复安装复用下载缓存。包管理器迁移后需重新运行安装器生成与 `bun.lock` 匹配的安装记录。

下载失败时命令非零退出并保留日志和已有缓存。可在网络恢复后重试同一命令。运行阶段某个引擎不存在或无法启动会记录 `unavailable`，不会改用 Chromium 冒充；可用 `--engines chromium,firefox` 限定已安装引擎，但遗漏引擎仍计入 `incomplete`。Linux 缺少系统库也属于明确缺口，本工具不会自行修改系统。

## 运行

先按 [双站文档](COMPARISON-LAB.md)建立合成实验站并安装主题包。以下三个参数必须指向实际所属实验目录、被安装 ZIP、完整源码提交；ZIP 摘要和源码声明必须与该实验目录的 `installed-package.json` 一致。源码声明与构建的因果证明仍由构建证据提供，运行器不会把自己的 HEAD 当作主题源码。

```sh
BASE_URL=http://127.0.0.1:18091 node scripts/browser/run.mjs \
  --lab-runtime /absolute/path/to/owned/lab \
  --theme-package /absolute/path/to/installed-theme.zip \
  --theme-source-sha 0123456789abcdef0123456789abcdef01234567
```

`BASE_URL` 没有默认值，只接受明确的 `http://127.0.0.1:<port>` origin，并要求端口匹配实验目录的 Halo 所属标识。禁止 URL 凭据、路径、查询参数和非本地站点。运行器不登录，不安装主题/插件，不改变站点配置；每页使用新的浏览器上下文，模式值只写该上下文自己的 localStorage。

请求放行同 origin 的 GET/HEAD，以及唯一的公开访客计数 `POST /apis/api.halo.run/v1alpha1/trackers/counter`。已核对 Halo 实际 `/halo-tracker.js`：该请求上报文章/独立页面的 group、plural、name、视口、页面 URL 等访问信息，返回访问计数。因此合成站访问数可能增长。每页报告 `allowedWrites` 保存接口、用途与请求体摘要；真实请求直达实验站，不伪造成功。近似路径、查询串、认证/控制台 API 和所有其他写入、外站、WebSocket 仍阻止并登记。

请由测试站当前负责人保持安装包不变直到运行结束。报告同时保存工具 SHA/工作区状态、主题 SHA 声明/ZIP SHA-256、Playwright/锁摘要、浏览器实际版本与可执行文件摘要、操作系统、时区、视口和模式，并在结束时核对安装记录未变化。

## 检查与证据

逐页检查路由最终 HTTP 状态、主题文档/唯一标题、明暗值、非空桌面和手机菜单、横向溢出、页面未捕获异常、请求失败及资源响应。CSS/脚本返回 200 HTML 也失败。主题资源还与所声明 ZIP 的条目比较，响应体摘要记录的是 Playwright API 解码字节。Chromium 会从文本响应中去掉 UTF-8 BOM，因此 CSS/JS 比较只规范化可选的这 3 字节；报告保留原包与响应两种摘要，绝不忽略其它差异。

首页先用键盘 Enter 打开右侧设置，再对当前 `#darkmode` 按钮执行 Enter 切换和刷新持久化检查；手机首页使用 Space 打开菜单、Escape 关闭并检查焦点返回。二级菜单焦点约束及全部路由交互不由此基础检查代替。

合成文章 `preview-1` 额外检查代码折叠与恢复：真实点击收起后，工具栏保持不透明且不被父容器裁剪，再点击展开；Enter 收起、Space 展开，并核对代码文本未改变。此回归在每个引擎的桌面/手机、亮暗组合执行，不替代代码全屏、复制及其他配置场景。

正式截图前等待字体、加载遮罩结束、有限动画结束，以及当前可见图片实际加载成功。无限动画只登记数量，不关闭、不注入隐藏 CSS；屏外懒加载图片不会被声称已加载。准备条件失败时可保存明确标记 `diagnosticOnly` 的诊断截图，不作为稳定截图通过。

每页 `diagnostics` 复用搜索诊断器，记录有界生命周期事件、未完成请求与 `readyState`，失败即取 `failure` 快照、结束时取 `final` 快照（各最多等待 1 秒）；新增诊断仅保留 URL origin/path，不采集请求头、正文、存储或 HAR，不重试、不改超时/断言/退出码。需要底层 Firefox 网络日志时由运行者在外部环境设置 `MOZ_LOG`/`MOZ_LOG_FILE`，原始日志仅保存在本地私有路径，不能加入报告或公开证据。

首页键盘检查的主动 reload 通过请求对象账本区分 runner 取消：仅 reload 开始前未完成的主 frame 只读静态资源、在新文档 commit 前发出的已知 abort，且 reload 返回同 URL 的非重定向 200 文档，并在该新文档中观测到另一个请求完整读取相同资源时，才不计入产品请求失败。原始 `requestFailures`、响应状态及 `captureError` 保留，`runnerCancellations` 单列旧/新请求 ID；HTTP/类型/包内容错误、未恢复资源、reload 外或新文档取消、上下文关闭取消、被阻止写入与超时仍失败。账本不单凭报告字符串、URL 或宽泛时间窗授予豁免，旧验收报告不重分类。仅对从已知 `about:blank` 开始、首次主导航请求之后且首次 commit 之前发起的主 frame 资源补齐首文档归属；后续导航 commit 之前发起的资源无法证明新文档归属时，继续失败而不充当恢复证明。

矩阵在关闭上下文之前，用同一请求对象账本等待所有已观测到、且 Playwright `resourceType` 为 `document`、`stylesheet`、`script`、`image`、`font` 或 `media` 的 GET/HEAD 请求完成，包括子 frame 与旧文档请求。此范围按浏览器报告的类型判定：独立验证发现 WebKit 的部分视频请求即使使用 `.mp4` URL 和显式 `video/mp4` 类型仍归为 `other`，本次完成门禁不认证这类请求已经完成。等待与动态响应体读取共用 5 秒预算；期间新发起的这些请求和新到达的响应体也纳入检查。超时仍关闭上下文，但先将未完成请求的 ID、URL、方法、类型、文档归属及是否收到响应写入 `pendingRequestsBeforeClose` 并判失败；关闭时没有 `requestfailed` 事件，或随后出现结束事件，都不能清除这份快照。没有原生 abort 证据的旧 reload 请求即使同 URL 已重新加载成功，也继续失败。此完成门禁由矩阵显式传入账本启用，不声称其它未传账本的工具或尚未发起的懒加载资源已验证。后台 fetch/XHR、事件流和已允许的计数 POST 不新增完成要求，既有请求失败、HTTP 错误及阻止写入门禁保持有效。

每次创建唯一 `.runtime/browser-matrix/runs/<timestamp-id>/`，包含每页 JSON、截图与 SHA-256、精简进度快照和完整 `report.json`。不会覆盖以前的运行。标准退出码：`0` 表示三引擎核心 smoke 全通过；`1` 表示页面/资源/交互等失败；`2` 表示遗漏或不可用引擎造成不完整。任何结果都不自动修改矩阵验收状态。

离线保护测试无需浏览器或独立依赖：

```sh
node --test tests/browser-guards.test.mjs tests/browser-reload.test.mjs tests/browser-completion.test.mjs tests/search-diagnostics.test.mjs
```

首次实跑若发现基线主题缺陷，保留失败结果，交对应功能包修复后用其真实安装包重跑，不能放宽运行器规则制造通过。
