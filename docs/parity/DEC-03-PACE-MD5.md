# DEC-03：Pace / Loading 差异与 MD5 消费方

日期：2026-10-13（Asia/Shanghai）。这是固定源码对照及裁定建议，未安装 Pace，也不是新一轮双站或 Halo 运行验收。已确认的导航、特效、灯箱、Prism 方案及待裁定项汇总见 [裁定方案](DEC-03-RESOURCES-DRAFT.md)。

证据来自 Butterfly **5.7.0 / f223b1888b42b2b336068e6c959ed90a3cd7c8f3**：下载归档中的 217 个索引文件与现有 `upstream-5.7.0.json` SHA-256 全部一致。另下载原版 **pace-js 1.2.4** 核对引擎与默认主题，而非用最新 Pace 推断旧行为。来源、相关源码哈希、完整 MD5 搜索结果见 [审计 JSON](DEC-03-SOURCE-AUDIT.json)。

## Pace 与当前 Loading

上游 `preloader.enable` 默认 false；`source: 1` 是全屏 Loading，`source: 2` 是 Pace。本次重点比较 **Pace 模式与 Halo 当前四种 Loading**，不把上游全屏 Loading 的行为混入 Pace。

| 对比 | 固定 Butterfly Pace 模式 | Halo 当前 Loading / PJAX |
| --- | --- | --- |
| 首屏形态 | 默认 blue/minimal CSS：顶部 2px 蓝条，长度随估算进度变化；不阻挡点击、不隐藏正文 | circle/hourglass/cross_line/dot 四种动画；`body.loading` 隐藏 `#Butterfly`，正文就绪后解除 |
| 默认开关 | Butterfly 默认关闭 preloader；启用后选择 source=2 才使用 Pace | `loading.enable` 默认 true，保留 Next 旧行为；`loading.type` 默认 circle |
| 进度含义 | 综合文档 readyState、指定元素、事件循环延迟、受跟踪请求并平滑估算；不是全站实际字节下载百分比 | 没有进度值；等待“正文可用”这一事件 |
| 首屏结束条件 | 监控来源汇总或全局进度达到完成条件，经最少显示时间与消退延时结束；默认 minTime=250ms、ghostTime=100ms | SSR 正文结束标记优先；已有标记或 DOM 已就绪立即结束，否则监听正文就绪 / DOMContentLoaded；不等待窗口 load |
| 请求跟踪 | 1.2.4 默认跟踪 XHR GET 与 WebSocket 建连，可在持续超过 500ms 的后续请求上重新显示；不拦截 fetch | 当前 Loading 不观察请求；图片、字体、第三方 SDK 不参与结束门槛 |
| PJAX 起点 | Butterfly 关闭 restartOnPushState，改由 `pjaxSend` 回调显式调用 Pace.restart；请求进度来自引擎监控 | 当前 fetch 导航开始加 theme-navigating；顶部 **3px 全宽实色忙碌条**，不含比例或估算增长 |
| PJAX 完成/失败 | Pace 按监控来源结束；不等于业务初始化成功，需另行核对导航钩子 | 目标样式/脚本及公共模块初始化成功后完成；错误、取消和普通导航回退由当前导航状态机负责 |
| 样式配置 | `preloader.pace_css_url` 覆盖默认 CSS；资源有 `pace_js` / `pace_default_css` 独立供应项 | 没有 Pace CSS 字段；四种动画样式随实现供应，PJAX 忙碌条为主题 CSS |
| 新增资源代价 | 原包 pace.min.js **12,962 bytes**，默认 minimal CSS **409 bytes**，合计 13,371 原始字节；非压缩传输/总性能测量 | 四种动画已内联供应，没有新增 Pace 下载；PJAX 条已在主题样式中 |
| 运行边界 | 引擎包装 XHR/WebSocket 和 history API，持续观察事件循环/元素；不能据此承诺任意插件兼容 | 当前 Loading 不包装网络 API；正文释放与导航状态由主题掌握 |

Pace 的监控机制见 [官方说明](https://github.com/CodeByZach/pace#collectors)。本表的版本、默认值和缺少 fetch 拦截结论以本次下载的 **1.2.4 原包**为准；最新 README 只作概念说明。

主题对应代码：`src/js/core/loading-ready.ts`、四个 `src/plugins/loading/*.ts`、`src/html/views/layout.html` 的正文就绪标记、`src/html/views/config.html` 的隐藏规则、`src/js/core/navigation-loading.ts` 与 `src/scss/core/navigation-loading.scss`。上游模板见 [pace.pug](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/loading/pace.pug)。

### 具体场景的差异

下表是固定源码支持的行为分析，未当作真实双站的测量结果。

| 场景 | Pace | 当前方案 |
| --- | --- | --- |
| 正文已到达，延迟脚本/图片还在下载 | 正文可见；文档/其他来源可能使顶部进度继续存在；并非每个图片都按字节跟踪 | 正文标记释放 Loading，直接显示可读内容，不等待可选资源 |
| 页面就绪后发起 2 秒 XHR GET | 默认 500ms 后可重新显示进度，并跟踪请求 | Loading 不再出现，PJAX 条也不因普通 XHR 改变 |
| 页面就绪后发起 2 秒 fetch | 1.2.4 无 fetch 拦截，单靠请求不会获得自动进度 | 普通 fetch 没有 Loading；若是主题 PJAX，忙碌条覆盖导航全过程 |
| 连续点击导航、取消旧请求 | 上游通过 pjaxSend 重启；单独的 Pace 估算不代表当前请求所属或最新页面成功 | AbortController 与当前请求身份决定清理、提交和回退；忙碌条不表达下载比例 |
| Pace/Loading 资源失败 | 若未来接入 Pace，应保留正文与正常导航，并兜底清理进度 | 当前四种默认动画已内联；正文就绪事件不依赖可选资源。已有加载/导航失败证据仍只属于此前候选包 |
| 自定义进度样式 | 上游可换 Pace CSS，改变位置/高度/动画等外观 | 当前没有等价配置；选一种 Loading 动画不能替代该能力 |

### 已确认裁定方向：默认 Pace 模式

维护者已明确：项目尚未正式发布，可以为效果放弃历史兼容。默认采用非阻塞 Pace，保留进度估算和自定义 CSS；当前四种动画作为显式可选模式，与 Pace 互斥。以下设置已按 2026-10-14 授权接入；表格之前的“当前”是实施前审计快照，运行结果另见裁定与验证：

| 目标设置 | 实际映射 |
| --- | --- |
| `loading.enable` | 沿用当前开关；关闭时不加载动画或 Pace，正文可读 |
| `loading.mode: pace / animation` | 映射上游 preloader.source；默认 pace；所有配置缺失字段统一 pace，无旧动画默认迁移分支 |
| `loading.type` | 继续选择 circle/hourglass/cross_line/dot，仅 animation 模式使用 |
| `loading.pace_css_url` | 映射 preloader.pace_css_url；留空使用随包默认 minimal CSS |
| `CDN.option.pace_js` / `pace_default_css` | 单项优先、统一 assets 其次、安装包最后；固定供应 Pace 1.2.4 与 MIT 声明 |

Pace 模式不添加隐藏正文的 body.loading。沿用上游关闭自动 pushState 重启的选择，在主题导航开始/完成/失败/取消时显式绑定生命周期，并用当前请求身份防止旧请求误结束新进度；Pace 1.2.4 无法自动跟踪 fetch，因此必须为主题 fetch 导航增加进度来源/完成信号，不能只调用 restart 就声称覆盖全过程。正常 XHR/文档/元素估算能力仍保留，不改为假下载百分比。

启用 Pace 时避免同时显示当前 PJAX 全宽条；资源失败则回到既有忙碌提示，正文和完整导航保持可用。第三方请求永不成为正文显示门槛。不得叠加全屏动画与进度条，也不增加等所有 SDK 成功才开放页面的条件。

开发后须验证：默认 Pace、缺省字段统一 Pace、两模式切换/关闭、首屏慢资源、XHR 与 fetch 区分、连续 PJAX 与取消、前进后退、失败与超时清理、默认/自定义 CSS、明暗/移动端/减少动态效果、插件网络 API 兼容及资源来源。完整合同要求仍保留，本轮限定验证见 [DEC-03 裁定](DEC-03-RESOURCES-DECISION.md)。

此前为旧配置沿用动画的建议已撤回，不保留新旧安装区别。已保存 loading.type 的配置也不能自行覆盖默认 Pace；用户只有显式选择 animation 才使用动画。保留四种动画是提供可选外观，不作为兼容默认分支。本轮已完成接入和默认值变更；本对照表中的“当前”描述保留实施前源码事实。

## blueimp-md5 与同名 helper

扫描固定上游全部源码：`rg -n -i 'blueimp|\bmd5\b'`。声明、配置和全部命中保存于审计 JSON，未只检查一个已知模板。

| 对象 | 定义 / 加载 | 实际调用 | 消费能力 |
| --- | --- | --- | --- |
| 浏览器 blueimp-md5 2.19.0 | plugins.yml:21–24；最新评论 valine.pug:3 加载 theme.asset.blueimp_md5 | valine.pug:14 对 `mail.toLowerCase()` 求 MD5，拼 Gravatar 头像 URL；已有 QQAvatar 时优先用该头像 | Valine 最新评论卡片头像 |
| 构建期 helper:md5 | scripts/helpers/page.js:88–89，使用 Node crypto；输入经 url_for 和 decodeURI 处理，输出十六进制 | comments/gitalk.pug:33 对 page.path 生成默认评论 ID；自定义 option.id 优先，说说用传入 path | Gitalk 评论线程标识 |

浏览器加载分支是 `layout/includes/third-party/newest-comments/index.pug` 的 comments.use[0] = Valine；不是所有最新评论提供方都会加载。`blueimp-md5` 和 Node crypto helper 名字相近但独立，Gitalk 不因此加载 blueimp 库。

来源：[Valine 消费模板](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/third-party/newest-comments/valine.pug)、[helper 定义](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/scripts/helpers/page.js#L88)、[Gitalk 调用](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/third-party/comments/gitalk.pug#L33)。核对范围为固定主题源码，不包含已退出的外部 SDK 内部实现或站长任意注入代码。

Halo 当前最新评论从公开评论模型读取 `owner.avatar`，保留安全 URL 处理和空/坏头像行为，不在浏览器用邮箱生成 Gravatar。Prism 高亮语法中出现的 MD5 字符串是语言词法规则，不是 MD5 调用或依赖。

### 已确认裁定：取消评论提供方专属 MD5 要求

DEC-01 已选择官方 PluginCommentWidget，Valine / Gitalk 的主题提供方已退出 1.0。维护者已授权 DEC-03 为以下三项各自写明消费方与替代能力：

| 矩阵 ID | 处理 | 保留能力 |
| --- | --- | --- |
| config:CDN.option.blueimp_md5 | 有依据的不适用：无保留消费方，不提供空覆盖设置 | Halo 评论、最新评论及头像 |
| resource:blueimp_md5 | 有依据的不适用：不新增浏览器 MD5 包 | Halo owner.avatar 与失败兜底 |
| helper:md5 | 单列不适用：唯一消费方为已退出的 Gitalk，不混同浏览器库 | Halo 评论主题标识与文章关联 |

三项按 DEC-03 各自登记不适用；本裁定明确消费方退出，不取消通用哈希能力；后续保留功能若新引入 MD5，再按实际输入输出、来源和许可独立登记。

## 证据边界

本轮重新执行现有 Loading 的 5 项单元回归，只核对正文就绪/延迟脚本路径；不验证 Pace 集成、全屏视觉等价或第三方插件。Pace 原包只解包读取，未注入主题、运行实例或安装包。本轮不改运行源码、设置、锁文件及包；之前的候选 ZIP 与 648 项门禁结果保留原身份。
