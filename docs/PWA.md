# PWA 首期：桌面入口与离线提示

维护者于 2026-10-05 确认 [#357](https://github.com/songxychn/halo-butterfly-next/issues/357)：首期提供桌面入口、独立窗口及断网重开的离线提示，接受 Halo 插件分工；完整文章离线阅读保留为后续范围。本页是 DEC-03 的 PWA 子项，不裁定 RSS、站点地图、PJAX 或 CDN，不表示全部 Butterfly 5.7.0 PWA 选项已验收。

## 安装与配置

主题 ZIP 与可选插件 JAR 分开构建、分开安装。未安装插件时不显示安装入口，也不注册 Worker。当前插件身份为 `butterfly-pwa`，版本 `0.1.0`，验证目标为 Halo **2.26.1**；声明范围 `>=2.26.1 & <2.27.0`。

1. 安装本次构建的 `halo-butterfly-next-0.1.0-alpha.3.zip`。
2. 在 Halo「插件」上传 `butterfly-pwa-0.1.0.jar`，启用插件。
3. 打开插件设置，填写应用名称、短名称及可选的 192/512 PNG 图标，勾选「启用桌面入口与离线提示」。默认关闭，不自动改变已有站点行为。
4. 使用 HTTPS 访问博客（独立本地测试可用 `http://127.0.0.1`）。首次联网访问并成功安装 Worker 后，浏览器才具备离线提示能力。
5. 页脚显示「安装应用」或「添加到桌面」帮助。安装只由读者主动触发；已经独立窗口运行时隐藏入口。不支持应用安装的浏览器继续使用普通网页。

配置真相源为插件的 `butterfly-pwa-config`，主题不复制另一套 PWA 开关或 manifest 设置。主题从插件注入的带标记 manifest 判断是否接入。manifest `id`、`start_url`、`scope` 均为 `/`；首期只支持部署在域名根路径的站点。图标留空使用自主生成的几何蝴蝶 PNG；自定义图标应使用正确尺寸和 PNG 格式。外部附件地址的可用性由站点维护者负责。

不要同时启用其他 PWA 插件。检测到多个 manifest 或其他 Service Worker 注册时，主题放弃注册与安装入口，不覆盖已有 Worker；必须先由维护者处理冲突。其他插件可能仍注入 metadata，本主题不自动移除它们。

## 插件与主题职责

| 部分 | 负责能力 |
| --- | --- |
| 插件 | 应用配置、manifest、图标、`apple-touch-icon`、窗口 `theme-color`、同源 Worker 路由与作用域响应头、独立离线页 |
| 主题 | 注册与冲突检查、读者主动安装入口、浏览器菜单帮助、主题页面/公共布局样式、插件关闭后的本插件注册与缓存清理 |
| Worker | 公开页面网络失败时返回离线页；只保存离线页；检测插件关闭/卸载；升级时清理旧版本离线页缓存 |

Worker 从 `/butterfly-pwa/sw.js` 提供，通过 `Service-Worker-Allowed: /` 声明根作用域，脚本及状态接口使用 `Cache-Control: no-store`。所有路由位于 `/butterfly-pwa/`，反向代理须保持路径及响应头，不应给该前缀增加登录认证、HTML 回退或长期缓存。

首期不会保存文章、评论、登录内容、API、图片或完整主题资源。只有同源无查询参数的公开文档 GET 导航才参与离线回退；后台、用户中心、登录、API、附件、含编码路径和带文件扩展名的路径保持原生行为。网络成功时保持原响应，包括 404/401/500，不把服务端错误伪装成离线页。网络断开时离线页返回 **503** 和 `X-Butterfly-PWA: offline`，未来 PJAX 不应把它当成正常文章替换。

## 关闭、升级与回退

- **关闭配置**：先在插件设置关闭，再联网访问博客确认应用入口、注册和 `halo-butterfly-pwa-offline-*` 缓存被清理。随后可以停用/卸载插件。桌面图标是浏览器/操作系统管理的，用户可自行删除。
- **直接停用或卸载**：下一次联网访问时，主题清理自身注册；已安装 Worker 也会在公开导航中检查状态接口的 404/410，注销自身并删除自己的缓存。外部缓存与其他 Worker 不删除。
- **已经离线的设备**：无法收到关闭命令，可能继续显示旧离线页；再次联网访问后完成清理。服务器卸载插件不能远程立即清空离线设备。
- **升级**：缓存名称包含 Worker 与离线 HTML 的内容摘要。新 Worker 只有在配置有效、离线页可成功获取时才安装；激活时只清理本插件旧缓存。首期缓存没有文章或应用外壳，更新不会强制刷新正在阅读的页面。
- **回退主题或切换主题**：先关闭 PWA 并完成在线清理，再安装旧主题；保留插件配置备份。插件元数据仍可能出现在其他主题 head，但只有本主题提供注册/安装入口。即使换了主题，旧 Worker 仍可通过插件状态接口退出。

## 构建与验收

```sh
bun install --frozen-lockfile --ignore-scripts
bun run verify
bun run pwa:build /path/to/halo-2.26.1.jar
```

插件构建只从 SHA-256 固定的官方 Halo JAR 提取编译依赖，使用 Java 21 字节码，不把 Halo/Spring 依赖打入插件。输出为 `dist/butterfly-pwa-0.1.0.jar` 及同名 `.build.json`。`bun run verify` 包含 Worker TypeScript 检查与缓存/路由/清理行为测试；CI 另执行插件构建和同工具链重建比较。JAR 是候选产物，构建通过不等于实际安装通过。

独立实验站只占用本工作区 `.runtime/pwa-lab` 与回环端口 **18097**，不复用其他站点的数据库或凭据。默认安装 Halo 新站自带内容及插件；它不是完整 1.0 双站对照实验。

```sh
python3 scripts/pwa/lab.py start --halo-jar /path/to/halo-2.26.1.jar
node scripts/browser/install.mjs
node scripts/pwa/browser.mjs
node scripts/pwa/browser-engines.mjs
python3 scripts/pwa/lab.py stop
```

浏览器脚本使用独立持久化 Chromium 档案（隐私窗口不支持正常安装条件），执行 manifest/图标、桌面/手机明暗、仅缓存离线页、离线新页面、浏览器重启后离线访问、恢复网络，以及配置关闭/插件停用/卸载。报告和前后截图保留在 `.runtime/pwa-lab/browser/`。原生系统安装、iOS/Android 真机、Safari 和完整插件组合在取得实际证据前仍未验收；模拟安装事件或浏览器能力检查不等于系统安装完成。

2026-10-05 的首期作者验证见 [PWA 验收记录](validation/2026-10-05/pwa-author.json)：578 项测试与打包检查通过，Chromium 完整生命周期通过。Firefox/WebKit 的浏览器级断网模拟分别出现仍返回网络 404 和内部错误；改用仅转发本任务 Halo 的临时回环代理、断开真实连接后，两引擎的离线回退与恢复均通过。报告保留原始失败观察，不将其改为通过；这组受控检查不等于原生 Safari 或真机验收。

## 保留的后续范围

完整离线阅读已单独保留为 [#358](https://github.com/songxychn/halo-butterfly-next/issues/358)，需要设计并验证：读者主动保存/移除文章、离线文章列表、内容及附件更新、容量上限、私有或撤回文章处理、账户切换和缓存失效。当前只交付离线提示，不将完整阅读标记为完成或不适用。

上游独立 favicon 16/32、mask icon、自定义 manifest URL 等选项仍留在矩阵中。首期使用插件生成 manifest 与 192 图标作为 Apple Touch 图标，不声称这些配置已经完全等价。

## 依据

- [Butterfly 5.7.0 PWA head](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/head/pwa.pug) 和同提交 `_config.yml`：主题提供 metadata，离线生成另依赖 hexo-offline。
- [Halo 2.26 插件模板集成](https://docs.halo.run/developer-guide/plugin/api-reference/server/template-for-theme)：插件与主题共享渲染环境。
- [候选现成插件源码](https://github.com/chengzhongxue/plugin-pwa/tree/7f7ce9db0fdc9b091f89b6525f67af34118eb4f7)：只有 manifest 接口与 head 注入，不具备本期要求的离线回退；本仓库未修改或复制该外部项目。
- [Service Worker 注册与作用域](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)。
