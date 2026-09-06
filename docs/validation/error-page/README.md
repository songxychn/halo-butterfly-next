# 主题 404 页面验收

Issue #30 提供 Halo 2.26.1 的 `templates/error/404.html`，独立 `error404` 页面资源与设置组。失效路径保留核心返回的 HTTP 404；主题只渲染 HTML，不接管 API 错误响应，也不把未知路径重定向到首页。本包是 alpha.2 之后的独立功能包。

Halo 的 [错误页模板契约](https://docs.halo.run/developer-guide/theme/template-variables/error) 定义了 `error/404.html` → `error/4xx.html` → `error/error.html` 的查找顺序。已核对固定 [v2.26.1 HaloErrorWebExceptionHandler](https://github.com/halo-dev/halo/blob/v2.26.1/application/src/main/java/run/halo/app/infra/exception/handlers/HaloErrorWebExceptionHandler.java) 及固定 JAR：主题模板沿用错误响应构造器，JSON 仍返回 `application/problem+json`。真实 HTTP 检查另外验证 GET、HEAD、Accept、深层路径、查询参数及正常页面和资源，不能用浏览器截图替代状态码证据。

上游固定 Butterfly 5.7.0 / `f223b1888b42b2b336068e6c959ed90a3cd7c8f3`：`_config.yml:113` 的 `error_404`、`scripts/events/404.js`、`layout/includes/page/404.pug`、`source/css/_page/404.styl`。矩阵关联 `config:error_404.enable/subtitle/background`、`lifecycle-hook:scripts/events/404.js#generator:404`、`template:includes/page/404`、`style:source/css/_page/404.styl`、`page:404`；合同关联 ENV-02、PAGE-01、PAGE-04、CFG-01、A11Y-01/02/03、SEO-01、NET-01。它们仍需各自证据和独立审查，本文不会把整行矩阵自动标为 verified。

实现保持桌面左右图文、手机上下布局、404 标识、可配置背景与纯文本字幕；页脚按上游错误页隐藏。站点导航复用已经集成的键盘实现，短页面仍显示模式按钮，并增加返回首页、跳过导航和可见焦点。

保留的差异：

- Hexo `enable` 控制静态 `404.html` 的生成，Halo 按 HTTP 异常选择模板。本包没有把它映射为一个含义不同的开关，后续仍需决定该配置的适配契约。
- 上游默认背景 `/img/error-page.png` 尚未完成素材来源适配。本包用已存在且随包分发的插图作最终回退，不将素材差异标为不适用。空背景先用首页背景；自定义图片失败后依次尝试首页背景、本地插图，全部失败隐藏装饰图，不影响文字和链接。
- 字幕空值或纯空格回退“页面未找到”，默认值为上游的 `Page Not Found`。长字幕完整换行而不做上游两行截断；HTML 按纯文本转义。
- 上游同时隐藏右下工具区；本包为 1.0 键盘与模式合同保留模式入口。主题不承诺 Hexo 静态服务器的错误页路由或 HTTP 状态配置。

## 合成站与运行方法

只在 root 明确移交的 18095/14005（或另行分配的 18096）上运行。先用 `lsof` 核对监听 PID、cwd、`lab.json` 所有者和端口，再备份完整配置、已装包身份与参考站输入。共享参考站 18091/14000 等不参与修改。凭据由 `scripts/lab/lab.py` 的私有文件读取，不打印或提交。

```sh
pnpm verify
# 先用 scripts/lab/lab.py install 安装当前干净 SHA 的 ZIP，核对安装文件字节。
python3 scripts/error-page/check-http.py --base http://127.0.0.1:18095 --output .evidence/error-page/final/http
python3 scripts/error-page/profile.py apply --profile default --base http://127.0.0.1:18095 --lab-runtime /path/to/assigned/runtime --backup .evidence/error-page/original-error404.json
node scripts/error-page/check-browser.mjs http://127.0.0.1:18095 default .evidence/error-page/final/default
# 依次运行 fixtures/error-page/profiles.json 的其他 profile，最后恢复原组。
python3 scripts/error-page/profile.py restore --base http://127.0.0.1:18095 --lab-runtime /path/to/assigned/runtime --backup .evidence/error-page/original-error404.json
```

`profile.py` 只替换 `error404` 组并检查其他组没有变化。`local-fallback` 在独立浏览器中阻断合成首页图片请求，以覆盖本地插图回退，不修改服务器首页设置。其余图片请求均为真实合成站资源。

浏览器运行器使用独立 agent-browser headless 会话。默认配置验证 1440×1000、390×844、320×844 的亮暗模式，自定义配置覆盖桌面手机亮暗，边界配置覆盖桌面暗色与手机亮色。检查站点身份、完整转义字幕、已加载的预期图片、无横向溢出、noindex/无 canonical、原生返回首页、跳转正文、模式按钮、手机抽屉的 hidden/inert/焦点循环/Escape，以及局部 axe WCAG2A/2AA。截图、原始响应、配置、包哈希、安装文件比对与实际结果保存在 `.evidence/error-page/`，不提交截图。

参考站需保留配置副本和输入哈希，仅把 `error_404.enable` 打开并使用相同合成背景/字幕生成 `/404.html`；记录该静态文件的 200 与 Halo 失效路径的 404 是不同契约。完成后恢复参考配置并重新生成，保留恢复证明。

真实浏览器和服务器验收不是当前 CI 自动步骤。CI 的 `pnpm verify` 检查工程测试、构建，以及安装包必须包含 404 模板和对应 JS/CSS；不能等同于运行时验收或独立审查通过。
