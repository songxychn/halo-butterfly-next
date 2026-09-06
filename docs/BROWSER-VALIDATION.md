# 独立多引擎浏览器回归

本工具为 `BROWSER-04` 提供可重复的基础回归设施。它扫描合成对照站的 10 条核心路由，分别运行 1440×1000、390×844 与亮暗组合，每个引擎 40 页。报告始终保留 `contractAcceptance: false`：尚未覆盖完整 P/P+、全部交互、插件、真机与人工判断，不能据此关闭验收合同。

Playwright **1.63.0** 与 `playwright-core` 的精确版本、包完整性由 `fixtures/browser/package.json`、`pnpm-lock.yaml` 固定；[官方 npm 发布元数据](https://registry.npmjs.org/playwright/1.63.0)的身份摘录在 `upstream.json`。安装使用 pnpm **11.19.0**、Node.js 20 或更新版本，不自动安装包管理器。

[Playwright 官方说明](https://playwright.dev/docs/browsers)中，每个版本配套特定浏览器构建。此工具只启动它下载的 Chromium（`channel: chromium` 新无头模式）、Firefox 与 WebKit。后两者依赖自动化补丁，WebKit 也不是实际 Safari；这些结果不替代 `BROWSER-01/02/03` 的品牌稳定版证据。手机场景是独立无头浏览器的视口，不是真机。

## 安装

在本项目 worktree 中执行，确保 `node` 和精确版本 `pnpm` 已在 PATH：

```sh
node scripts/browser/install.mjs
```

依赖、pnpm store、下载引擎、临时配置与报告全部放在当前 worktree 的 `.runtime/browser-matrix/`。脚本强制 `PLAYWRIGHT_BROWSERS_PATH` 指向其中的 `browsers/`，拒绝外部覆盖；不安装系统依赖、全局浏览器，不连接已有 Chrome/Safari，不读取用户浏览器配置。缓存存在但无所属标识、所属标识不符或目录指向外部时拒绝认领。重复安装复用下载缓存。

下载失败时命令非零退出并保留日志和已有缓存。可在网络恢复后重试同一命令。运行阶段某个引擎不存在或无法启动会记录 `unavailable`，不会改用 Chromium 冒充；可用 `--engines chromium,firefox` 限定已安装引擎，但遗漏引擎仍计入 `incomplete`。Linux 缺少系统库也属于明确缺口，本工具不会自行修改系统。

## 运行

先按 [双站文档](COMPARISON-LAB.md)建立合成实验站并安装主题包。以下三个参数必须指向实际所属实验目录、被安装 ZIP、完整源码提交；ZIP 摘要和源码声明必须与该实验目录的 `installed-package.json` 一致。源码声明与构建的因果证明仍由构建证据提供，运行器不会把自己的 HEAD 当作主题源码。

```sh
BASE_URL=http://127.0.0.1:18091 node scripts/browser/run.mjs \
  --lab-runtime /absolute/path/to/owned/lab \
  --theme-package /absolute/path/to/installed-theme.zip \
  --theme-source-sha 0123456789abcdef0123456789abcdef01234567
```

`BASE_URL` 没有默认值，只接受明确的 `http://127.0.0.1:<port>` origin，并要求端口匹配实验目录的 Halo 所属标识。禁止 URL 凭据、路径、查询参数和非本地站点。运行器不登录，不安装主题/插件，不改变站点配置；每页使用新的浏览器上下文，模式值只写该上下文自己的 localStorage。请求仅放行同 origin 的 GET/HEAD；外站、写入请求和 WebSocket 均阻止并登记为缺口。

请由测试站当前负责人保持安装包不变直到运行结束。报告同时保存工具 SHA/工作区状态、主题 SHA 声明/ZIP SHA-256、Playwright/锁摘要、浏览器实际版本与可执行文件摘要、操作系统、时区、视口和模式，并在结束时核对安装记录未变化。

## 检查与证据

逐页检查路由最终 HTTP 状态、主题文档/唯一标题、明暗值、非空桌面和手机菜单、横向溢出、页面未捕获异常、请求失败及资源响应。CSS/脚本返回 200 HTML 也失败。主题资源还与所声明 ZIP 的条目比较，响应体摘要记录的是 Playwright API 解码字节。Chromium 会从文本响应中去掉 UTF-8 BOM，因此 CSS/JS 比较只规范化可选的这 3 字节；报告保留原包与响应两种摘要，绝不忽略其它差异。

首页补充模式按钮键盘 Enter 切换和刷新持久化；手机首页使用 Space 打开菜单、Escape 关闭并检查焦点返回。二级菜单焦点约束及全部路由交互不由此基础检查代替。

正式截图前等待字体、加载遮罩结束、有限动画结束，以及当前可见图片实际加载成功。无限动画只登记数量，不关闭、不注入隐藏 CSS；屏外懒加载图片不会被声称已加载。准备条件失败时可保存明确标记 `diagnosticOnly` 的诊断截图，不作为稳定截图通过。

每次创建唯一 `.runtime/browser-matrix/runs/<timestamp-id>/`，包含每页 JSON、截图与 SHA-256、精简进度快照和完整 `report.json`。不会覆盖以前的运行。标准退出码：`0` 表示三引擎核心 smoke 全通过；`1` 表示页面/资源/交互等失败；`2` 表示遗漏或不可用引擎造成不完整。任何结果都不自动修改矩阵验收状态。

离线保护测试无需浏览器或独立依赖：

```sh
node --test tests/browser-guards.test.mjs
```

首次实跑若发现基线主题缺陷，保留失败结果，交对应功能包修复后用其真实安装包重跑，不能放宽运行器规则制造通过。
