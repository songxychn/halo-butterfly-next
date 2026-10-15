# KaTeX 按内容加载集成候选

- 上游：https://github.com/halo-sigs/plugin-katex
- 基线：官方 `v3.0.0`，`07c18d120c43dd680390aebe112bd7c6a9565278`
- 本地候选版本：`3.0.0-demand.1`，要求 Halo `>=2.27.0`；不是官方已发布能力。
- 补丁：`0001-content-aware-resources.patch`，从该基线直接 `git apply`。
- 本地完整 JAR SHA-256：`e9bc80d62cc8c045144e3aea8229783557c7af3dbd64fecd8456c45bb7f8ef4c`。
- 外仓分支：`codex/content-resource-loading`；生产发布、上游提交尚未进行。

## 构建

```sh
git clone https://github.com/halo-sigs/plugin-katex.git
cd plugin-katex
git checkout 07c18d120c43dd680390aebe112bd7c6a9565278
git apply /absolute/path/to/0001-content-aware-resources.patch
cd console
pnpm install --frozen-lockfile
pnpm build
cd ..
./gradlew test build -x buildFrontend --no-daemon
```

使用 Java 21、pnpm 10.20.0。先显式构建前端再跳过 Gradle 前端任务；不要省略前端而发布后端空壳。
依赖采用已发布 Halo 插件平台 2.27.0、devtools 0.8.0、支持 Java 21 的 Lombok 1.18.38，显式对齐 JUnit launcher。
产物为 `build/libs/plugin-katex-3.0.0-demand.1.jar`，不把二进制纳入本仓库。

## 契约

设置 `basic.resource_loading=on_demand`；默认 `global` 保持插件原有资源模式。按需模式 head 仅嵌入内容探测代码：无公式不下载 KaTeX CSS/JS，已有 MathML/KaTeX 输出只加载 CSS，启用前端渲染且明确选择器命中原始公式时才加载 JS。保留已有 MathML，不扫描正文分隔符。非法选择器、资源失败不破坏正文；下次 refresh 可以重试。

PJAX bootstrap 为 `data-katex-demand="1"`、`data-katex-version="3.0.0-demand.1"`，脚本以协议注释 `/* halo-katex-demand:v1 */` 开头；动态 renderer 标记 `data-katex-demand-resource="1"`。主题仅接受精确同源 `/plugins/plugin-katex/assets/static/katex.min.js?version=3.0.0-demand.1`，不放行其他插件脚本。

主题提交导航前触发 `katex:suspend`，替换 DOM/head 后执行新页 bootstrap 刷新配置；缺失 bootstrap 时保持停用。`pjax:complete`／`katex:refresh` 触发扫描；已加载 renderer 复用，被 head 替换移除的 CSS 重新挂载；迟到失败仅清理该请求仍拥有的缓存，避免污染后续页面。

## 验证边界

2026-10-15：完整前端构建、Java test/build（4 例，含宿主线程 classloader 隔离）、独立 Chromium／Firefox／WebKit 36 例及迟到 CSS error/timeout 竞态 2 例通过。主题严格协议识别用例和 typecheck 通过。

独立浏览器测试使用真实打包 KaTeX 资源，覆盖无公式、MathML 保留、原始公式、客户端渲染关闭、非法选择器、资源失败恢复、五次初始化/head 替换、配置更新和暂停。测试源码与 `ON-DEMAND.md` 包含在补丁中，可使用已有 Playwright 模块复跑。

上述不单独证明真实 Halo 编辑器、主题或物理 Safari 通过；实际 Halo 2.27.0 集成验收由主仓库另行记录。不做旧 Halo／旧资源契约回移，不承诺长期私有发行分支。

真实 Halo 联调发现默认 ClassPathResource 误用宿主线程 classloader 导致 head 渲染失败，现已显式使用插件 classloader 加载内嵌脚本并新增隔离回归测试；需安装上述新 SHA 的 JAR 后重新执行真实 Halo 验收。
