# DEC-03：资源供应裁定（2026-10-14）

日期：2026-10-14（Asia/Shanghai）。维护者已授权按本方案实施：默认 Pace，Loading 动画显式可选，无旧配置兼容；导航、特效、灯箱、Prism 与两个 MD5 消费链按下文调整。登记：[#410](https://github.com/songxychn/halo-butterfly-next/issues/410)。PWA、离线、RSS、站点地图仍待另行裁定，本记录不取消其要求。

| 分项 | 选择 | 当前状态 |
| --- | --- | --- |
| 导航、预取和提示 | 主题自身实现，通过承载页面包供应 | 维护者已确认 |
| 七种特效 | 主题自身实现，通过 effects 包供应 | 维护者已确认 |
| 灯箱 | Viewer.js 为唯一主题提供方 | 维护者已确认 |
| Prism | 保留整包延迟加载，公开语言清单，未知语言保留代码 | 维护者已确认 |
| Pace | 默认进度模式，与显式选择的 Loading 动画互斥；无旧默认迁移分支 | 维护者已确认 |
| blueimp-md5 / md5 helper | 随已退出的 Valine / Gitalk 移除专属要求 | 维护者已确认 |

固定源码核对、Pace 具体差异与 MD5 消费链见 [对照与消费方审计](DEC-03-PACE-MD5.md)；[机器审计记录](DEC-03-SOURCE-AUDIT.json)保存来源、文件哈希和完整 MD5 搜索命中。下载的固定上游源码与现有索引的 217 个文件哈希全部一致。

## 已确定的本批方向

维护者在本次对话选择：统一换资源地址，已打包的库不拆，Mermaid、Chart.js、ABCJS 随对应功能单独接入覆盖；随后授权先实现统一资源地址、动态加载、Share.js、不蒜子、PJAX 地址识别及依赖版本固定。

主题默认完整随包分发；自定义来源可配置完整 assets 根地址，或兼容现有地址格式。静态标签和动态加载保持单项覆盖优先、统一来源其次、安装包最后。依赖包和主题适配保留其实际版本与布局。关闭本地版本缓存参数不取消 Font Awesome CDN 的固定版本；显式自定义 URL 的内容由站点维护者托管。服务商在线 SDK 不因主题版本固定而变成已锁定的发行物。

`config:CDN.internal_provider`、`config:CDN.third_party_provider`、`config:CDN.version`、`config:CDN.custom_format`、`config:CDN.option` 和 `data-schema:cdn-overrides` 保留。后三者的全量映射仍须完成；局部接入不关闭总项。

已打包能力继续通过承载文件供应：`config:CDN.option.typed`、`lazyload`、`translate`、`utils` 对应页面脚本；`config:CDN.option.egjs_infinitegrid` 对应 masonry；`config:CDN.option.prismjs_lineNumber_js` 对应 Prism。资源 ID `resource:typed`、`resource:lazyload`、`resource:egjs_infinitegrid`、`resource:prismjs_lineNumber_js` 保留。上述六个独立覆盖配置不再要求，改为有依据的不适用；实际库资源与用户能力仍保留。库供应方式变化不代表参数、资源失败、语言覆盖或用户交互已验收。

Mermaid、Chart.js、ABCJS 的配置和资源六个 ID 保留待开发：`config:CDN.option.mermaid`、`config:CDN.option.chartjs`、`config:CDN.option.abcjs_basic_js`、`resource:mermaid`、`resource:chartjs`、`resource:abcjs_basic_js`。本批不增加空壳设置，也不将资源框架视为渲染功能完成。

## 已确认 A：主题自身实现的供应方式

### 导航、预取和提示

原来源：固定 Butterfly 5.7.0 的 `plugins.yml`，以及 `layout/includes/third-party/pjax.pug`、`source/js/main.js`、`source/js/utils.js`。原要求包含独立 PJAX、instant.page、Snackbar 脚本/样式供应与 URL 覆盖。

Halo 当前使用 `src/js/core/navigation-loading.ts`、`page-lifecycle.ts`、`_message.ts` 及主题样式实现列表局部导航、公共链接预取、状态提示。维护者已确认供应随主题页面包，通过统一来源和 `main` / `main_css` 覆盖；不新增上游对应独立库。

涉及配置 ID：`config:CDN.option.pjax`、`config:CDN.option.instantpage`、`config:CDN.option.snackbar`、`config:CDN.option.snackbar_css`。

涉及资源 ID：`resource:pjax`、`resource:instantpage`、`resource:snackbar`、`resource:snackbar_css`。同时核对 `template:includes/third-party/pjax` 的实现职责。

新成功条件：明确供应替代，验证主题实现的配置、导航往返、清理、错误回退、预取限制、提示位置/颜色和资源来源。**文章/单页 tracker、任意插件及第三方 SDK 的 PJAX 兼容仍是独立缺口**，不因资源供应裁定而完成 `interaction:pjax`。

### 七种特效

原来源：固定 `_config.yml`、`plugins.yml` 和 `layout/includes/third-party/effect.pug`。当前 `src/js/page/effects.ts` 使用主题自身实现，统一按需加载 `effects.min.js`。

维护者已确认通过 `CDN.option.effects` 或统一主题地址供应。以下七个名称分别对应完整 `config:CDN.option.<名称>` 和 `resource:<名称>` 共 14 个 ID：

| 名称 | 保留的用户能力 |
| --- | --- |
| activate_power_mode | 输入特效、颜色和震动控制 |
| canvas_fluttering_ribbon | 飘动彩带 |
| canvas_nest | 粒子连线与数量/颜色/层级 |
| canvas_ribbon | 彩带尺寸/透明度/层级及点击变色 |
| click_heart | 点击爱心 |
| clickShowText | 点击文字及字体/随机控制 |
| fireworks | 烟花及层级 |

当前已有配置和局部实现不等于效果完全等价。正式登记及能力验收应补固定对照样例、视觉和行为差异、手机开关、减少动态效果偏好、清理和资源失败证据。取消这 14 项独立供应要求，矩阵改为有依据的不适用；保留每种效果的读者能力验收，未完成的对照不据此关闭。

## 已确认 B：灯箱提供方

原来源：固定 `plugins.yml` 的 Fancybox、medium-zoom 及 `_config.yml` 的覆盖项。当前采用 MIT Viewer.js 1.14.0，随主题包分发；原因和许可边界见 `docs/THIRD_PARTY.md`。本裁定不恢复已移除的 Fancyapps UI 文件。

涉及六个 ID：`config:CDN.option.fancybox`、`config:CDN.option.fancybox_css`、`config:CDN.option.medium_zoom`、`resource:fancybox`、`resource:fancybox_css`、`resource:medium_zoom`。

维护者已确认 Viewer.js 作为 1.0 唯一主题灯箱提供方，资源通过承载包迁移。仍需对照多图浏览、缩放、图片说明、键盘、焦点恢复、禁用和坏图等能力，明确未覆盖的差异。提供方选择已确定，用户能力的验收继续保留。

## 已确认 C：Prism 按语言加载

涉及 `config:CDN.option.prismjs_autoloader`、`resource:prismjs_autoloader`。当前 `src/plugins/prism/prism.min.js` 内含多语言，`prism-ready.ts` 在有代码的页面延迟加载整包；不是按语言的 autoloader。

维护者已确认：1.0 保留整包延迟加载，固定并公开支持语言清单，未知语言保留可读代码；不新增语言 CDN 请求。代价是有代码的页面下载整包，而非按语言下载。

当前 vendored Prism 为 **1.29.0**，固定文件哈希、297 个选入组件及 400 个实际注册标识见 [语言清单](DEC-03-PRISM-LANGUAGES.json)。标识含别名、纯文本和内部辅助语法，不能当作 400 种独立语言或逐语言验收通过。JavaScript/TypeScript、Java、Python、Bash、SQL、JSON、YAML、CSS、HTML 等标识可查；未知标识不自动下载语言。`mermaid` 语法仅高亮源码，Mermaid 图表渲染仍随对应功能开发。

## 已确认 D：Pace 默认进度条

涉及 `config:preloader.pace_css_url`、`resource:pace_js`、`resource:pace_default_css`、`template:includes/loading/pace`，并交叉影响 `config:preloader.enable`、`config:preloader.source`。原 Loading 支持正文就绪结束，原 PJAX 顶部条没有比例进度。本轮新增 Pace 默认模式。

已完成固定源码差异对照，两者不等价，见 [详细对照](DEC-03-PACE-MD5.md#pace-与当前-loading)。**维护者已确认以 Pace 为默认进度模式**：Pace 1.2.4 随包固定，独立 CSS 可覆盖；当前四种 Loading 仅在显式选择 animation 时使用，两种互斥。Pace 模式不隐藏正文，主题 PJAX 显式接入开始/完成/错误/取消，避免自动 hook 猜测 fetch 完成或重复显示两条顶部提示。

已新增 `loading.mode: animation | pace`（默认 pace）、`loading.pace_css_url` 和资源覆盖 `pace_js` / `pace_default_css`。所有配置缺失 mode 时统一使用 pace，不按配置年代或已有 loading.type 推断旧动画模式；`loading.type` 仅在显式选择 animation 后用于四种动画。具体失败保护与验收见详细对照。

此前“默认 Loading / 缺省沿用旧动画”的建议已被本次决定覆盖。不引入新旧站点识别或历史配置迁移分支；正文非阻塞显示与导航反馈作为统一产品默认。仍保留 loading.enable 显式关闭能力，四种动画作为用户主动选择的外观能力。

## 已确认 E：评论提供方专属 MD5 不适用

固定上游全量搜索确认：`blueimp-md5@2.19.0` 的唯一直接加载与调用在 Valine 最新评论模板，用邮箱小写后的 MD5 拼接 Gravatar 头像 URL。它不参与文章、导航、灯箱或其他保留能力。

另有同名 **构建期** `helper:md5`：用 Node crypto 对 `decodeURI(url_for(path, {relative:false}))` 求 MD5，仅被 Gitalk 评论 ID 消费，和浏览器 blueimp 库没有依赖关系。完整加载路径、分支及源码行见 [消费链](DEC-03-PACE-MD5.md#blueimp-md5-与同名-helper)。

本裁定为 `config:CDN.option.blueimp_md5`、`resource:blueimp_md5` 明确引用 DEC-01 的 Valine 提供方退出；另为 `helper:md5` 单列 Gitalk 消费方退出依据，三项转为有依据的不适用。保留 Halo 官方评论、最新评论和头像能力：当前头像直接读取 Halo `owner.avatar`，不要求复现 Valine 邮箱哈希或 Gitalk ID。三项各自保留固定来源和原消费链，不将浏览器库与构建 helper 合并。

若后续新增保留能力需要 MD5，按新消费方独立立项，不以这次裁定禁止通用摘要算法或取消评论头像。

## 矩阵与实现结果

39 项原独立供应/覆盖要求改为有依据的不适用：导航 8、特效 14、灯箱 6、Prism autoloader 2、已打包库的独立覆盖配置 6、评论专属 MD5 3。所有原 ID、来源和历史证据保留；资源提供方退出不代表读者行为通过。Pace 相关 6 项具备实现，状态为 `implemented-unverified`；0 项提升为 `verified`。机器矩阵逐项登记替代字段、原条件、新条件和裁定依据。

Pace 使用固定 1.2.4 + minimal CSS，精确依赖、包来源与许可摘要见 [固定来源](../../third-party-licenses/pace-source.json)。开启时并行加载 JS/CSS，两者成功后启动；原生失败或接口不符可回退一次安装包，超时不重试。两种资源失败不隐藏正文，PJAX 保留原忙碌提示。30 秒连续进度未结束则停止 Pace，之后使用普通导航提示，整页刷新可恢复。进度是估算，不承诺全站字节下载百分比；普通 fetch 不自动被 Pace 监控，主题导航 fetch 通过专属进度源覆盖。

导航阶段以当前请求身份推进（接收响应、正文、样式、页面入口）；旧请求无法结束新进度。Pace 1.2.4 旧 ghost 定时器可能隐藏重启后的进度条，适配层在仍有当前导航时恢复进度。替换 head/body 时恢复 CSS 和进度条，避免重复条。自定义 CSS 优先于 CDN 单项与统一地址。Pace 启动脚本采用 `th:inline="none"`，避免 Thymeleaf 将资源正则当作 JavaScript 内联结构解析；颜色/侧栏启动仍沿用原配置块。

Loading 只在显式 `animation` 模式启动，保留 circle/hourglass/cross_line/dot。未知类型回落 circle；正文就绪结束。缺少 mode 一律 Pace，不读取旧 type 推断模式、不加入配置迁移分支。显式关闭不加载两种资源。公开插件布局也映射相同开关，但本次限定浏览器记录不宣称已验插件网络 API 组合。

[本轮验证](../validation/2026-10-14/dec03-pace.md)绑定当前未提交工作区输入快照与包摘要；先前审计与资源验收仍仅适用于各自快照。本批不关闭 Mermaid/Chart.js/ABCJS 渲染、固定双站、真实 SDK、物理设备、独立审查、最终提交 CI 或完整 1.0 验收。
