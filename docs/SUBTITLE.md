# 首页字幕来源与打字参数

本功能对应 [#14](https://github.com/songxychn/halo-butterfly-next/issues/14)，覆盖字幕开关、静态首项、自定义 API、三种内置来源及声明式打字参数；完整视觉和实际第三方服务可用性仍需独立验收。固定参考为 Butterfly 5.7.0 提交 `f223b1888b42b2b336068e6c959ed90a3cd7c8f3`。

## 配置映射与行为

| Halo 首页配置 | 上游对应 | 本包行为 |
| --- | --- | --- |
| `index.enable_subtitle` | `subtitle.enable` | `false` 时服务器不输出字幕节点，前端不创建 Typed、不请求随机文案；第一屏关闭时同样不执行 |
| `index.subtitle_effect` | `subtitle.effect` | `false` 时用 `textContent` 显示首项，不创建 Typed；默认 `true` |
| `index.typewriter_custom_text` | `subtitle.sub` 的本地映射 | 保留 `\|&\|` 分隔和移除换行的旧规则；静态显示第一项，即使第一项为空也不跳到后续项 |
| `index.subtitle_source` | `subtitle.source` | `0` 对应上游 `false`（仅本地），`1` 一言 hitokoto、`2` 一言 aa1、`3` 今日诗词；额外提供默认 `custom` 保留旧配置 |
| `index.subtitle_typed_option` | `subtitle.typed_option` | JSON 对象，支持下述声明式参数；空值或无效 JSON 使用既有默认 |
| `index.enable_typewriter_random_text`、`typewriter_random_api`、`typewriter_api_value_format` | 既有 Halo 自定义来源 | 仅来源为 `custom` 时生效；保留原 URL、JSON 路径和成功后替换整个本地列表的行为 |

上游 [`_config.yml:151-169`](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/_config.yml#L151) 默认关闭字幕。本主题已有版本默认显示字幕，因此新开关默认 `true`，直接升级时缺失或为 `null` 的新增开关也按开启处理；这是有意保留的默认值兼容差异。只有显式布尔 `false` 关闭，迁移工具继续检查字段类型。原版 2.0.5/2.0.7 迁移依靠当前设置默认值补齐开关，不改变原文案转换，也不覆盖显式 `false`。

上游 [`header/index.pug:37-40`](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/header/index.pug#L37) 控制字幕节点，[`subtitle.pug:27-44`](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/third-party/subtitle.pug#L27) 区分动态与纯文本静态分支。随机来源启用时，上游静态分支仍可显示服务返回的内容；本主题同样在静态模式取远程字符串，失败后显示自定义第一项。

## 空值和来源失败

- 空文案、只含空白的列表或缺少文案时保持空显示，不创建 Typed，也不循环输出配置警告。
- 来源为仅本地时不发请求。`custom` 来源沿用旧随机开关：未启用或 URL 为空时不发请求；内置 1/2/3 来源不受旧随机开关控制。
- 请求失败、5 秒超时、非成功 HTTP、JSON 无效、路径缺失/不存在、结果不是非空字符串时回退本地文案；本地为空则保持空显示。
- TEXT 响应作为纯文本；配置 JSON 路径（如 `data.content`）或响应标为 JSON 时解析 JSON。路径只读取自有字段，嵌套缺项不抛出未捕获异常。
- 请求强制使用 `dataType: 'text'`，不根据服务响应类型执行脚本。静态分支始终用 `textContent`；仅含远程内容时设置 `contentType: null`，服务返回的标签显示为文字。内置来源与本地 HTML 混排时先转义远端的 `&<>` 再交给 Typed，远端标签仍显示为文字，本地 HTML 继续有效。动态自定义文案及失败后的本地回退保留既有 Typed 默认 `contentType: 'html'`，继续支持作者配置的 HTML 标记。

## 来源顺序与兼容

缺少 `subtitle_source`、值为 `null` 或空字符串时与 `custom` 一致，升级不会覆盖旧随机 API。新安装默认同样为 `custom`，旧随机开关默认关闭。显式选择 `0`（也接受布尔 `false`）只显示本地；未知来源也按仅本地处理，不意外请求旧 API。

内置来源成功时动态顺序对应上游：远端首句 → 一言返回的“出自 …”（仅有非空字符串 `from` 时）→ 本地列表；静态只显示远端首句。来源失败只播放一次本地列表，避免上游失败分支重复追加本地文案的副作用。

- `1`：读取 `https://v1.hitokoto.cn` 的 `hitokoto` 和可选 `from` 字符串。
- `2`：读取 `https://v.api.aa1.cn/api/yiyan/index.php` 第一个 `<p>…</p>` 匹配内容，空内容回退本地，保留上游解析边界，内嵌标签按文字展示。
- `3`：读取 `https://v2.jinrishici.com/one.json?client=browser-sdk/1.2` 的 `data.content`。已核实[官方 SDK 1.2.2](https://sdk.jinrishici.com/v2/browser/jinrishici.js)：首次无 token 时直接 GET 此端点并携带凭据，返回内容及 token。本主题使用同样首次请求和 `withCredentials`，不执行远端 SDK，不持久化或读取用户 token，因此不提供 SDK 的跨访问 token 个性化语义。浏览器跨站凭据限制、CORS 或服务失败时仍在 5 秒超时后回退本地。

测试使用合成响应，不宣称验证了真实第三方服务 SLA、地域网络或浏览器 CORS；这些服务会收到读者的网络请求，选用前可先配置本地回退。

## 打字参数

保持旧版 `startDelay: 300`、`typeSpeed: 200`、`backSpeed: 50`、`loop: true`。上游 `typeSpeed` 默认 150ms，需要时显式填写 `{"typeSpeed":150}`，不会自动改变现有站点速度。其他未填写参数沿用项目当前 Typed.js 默认值。

支持参数：

- 毫秒数：`typeSpeed`、`startDelay`、`backSpeed`、`backDelay`、`fadeOutDelay`，接受 0 至 2147483647 的有限数字。
- 布尔：`smartBackspace`、`shuffle`、`fadeOut`、`loop`、`showCursor`、`autoInsertCss`、`bindInputFocusEvents`（字幕为 span，因此输入框焦点选项不会产生效果）。
- `loopCount`：非负安全整数，或 JSON 字符串 `"Infinity"`。
- `cursorChar`：纯文本光标，HTML 字符会转义；`fadeOutClass`：单个类名，仅字母/下划线开头，后续允许字母、数字、下划线、连字符。自定义淡出类的样式由作者提供。

与上游任意 Typed 配置对象相比，此映射只接收声明式行为。`strings`、`stringsElement`、`contentType`、`attr` 和所有回调不开放覆盖，避免绕过来源纯文本处理或修改其他 DOM。JSON 整体无效时全部使用默认，合法 JSON 中错误类型、未知或不支持的字段逐项忽略；静态模式完全不创建 Typed。

例如：

```json
{"typeSpeed":150,"backSpeed":40,"backDelay":1500,"loop":true,"loopCount":3,"showCursor":true,"cursorChar":"▌"}
```

## 验证边界

`node --test tests/subtitle.test.mjs` 检查禁用/第一屏关闭、静态安全首项、缺配置兼容、空值、TEXT/JSON 取值、失败回退、三种来源的顺序/出处/HTML 边界、Typed 参数校验及旧版配置迁移。实际 Halo 升级与浏览器场景使用专属实验站，并分别记录完整源码 SHA、主题包/夹具/配置摘要、1440×1000 与 390×844 的亮暗结果和随机请求计数；不连接真实第三方文案服务。单元测试不替代真实页面验收，无头手机视口不替代真机。

手工运行器 `tests/subtitle-runtime.py` 只使用当前 checkout 下完成 bootstrap 的 `.runtime/subtitle-lab`，固定 Halo `18093` / Hexo `14002`，并校验目录标记与两个进程的归属。它会在该专属站安装指定基线、写入合成旧配置、升级候选包并运行场景，结束后保留候选主题与缺失新开关的合成配置。运行前按 [双站文档](COMPARISON-LAB.md)用相同端口和目录完成 bootstrap；不要指定已有业务数据的站点。

```sh
python3 -B tests/subtitle-runtime.py \
  --baseline-package /path/to/baseline/theme.zip \
  --baseline-sha <构建基线包的完整提交> \
  --package dist/halo-butterfly-next-0.1.0-alpha.3.zip
```

该运行器需要 `agent-browser` 和独立无头 Chromium，会创建自己的命名会话，只允许访问 `127.0.0.1`。本地 TEXT/JSON/404 由该 Halo 实验站提供；分别对 Resource Timing 和浏览器网络记录计数。截图前等待加载遮罩移除和有限 CSS 入场动画结束，并检查导航/字幕的可见透明度。证据及截图写入专属运行目录，包含是否有未提交修改；正式验收应提交代码、从该提交重新构建并重跑。成功后关闭浏览器，保留服务器。该运行器属于显式手工集成检查，不由 `bun run check` 自动启动服务。

开发期间重复上传相同 `0.1.0-alpha.1` 版本时，资源 URL 的版本参数不变，旧浏览器可能继续使用缓存脚本。运行器在上传候选后创建全新会话，确认候选行为；这不冒充旧浏览器跨发行版本的升级验证。正式私有预览升版时仍须验证已有 alpha 浏览器刷新后取得新版本资源及配置。
