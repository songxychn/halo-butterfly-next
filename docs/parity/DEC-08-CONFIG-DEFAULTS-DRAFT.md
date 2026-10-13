# DEC-08 草案：配置简化与默认体验

日期：2026-10-14（Asia/Shanghai）。状态：维护者已同意除 Pace 外按建议推进，此前交付具体清单和裁定草案供审阅；维护者随后授权按本草案实施。九项配置与默认体验已在当前工作区接入，迁移工具和矩阵映射同步；独立审查问题已修复，复审无阻塞项；最新结果见[最终限定记录](../validation/2026-10-14/config-defaults-reviewed.md)，[首次实施记录](../validation/2026-10-14/config-defaults.md)保留原身份。DEC-08 的公开裁定登记与完整 1.0 验收仍未完成。

Pace 由另一个分叉开发，现已随 PR #411 合入 master；本 PR 保留基线实现，不更改其模式、资源字段或导航进度生命周期。资源地址简化归入 DEC-03，本文件统一列出实施清单，其余配置与体验调整拟归入 DEC-08。已有导航、特效、Viewer.js、Prism 及 MD5 消费链裁定见 [DEC-03](DEC-03-RESOURCES-DECISION.md)，不重复立项。当前 master 已接入 Mermaid、Chart.js、ABCJS；整合候选保留对应设置与独立覆盖，资源解析服从同一优先级。

## 裁定原则

- 正式版前统一新配置模型；缺省字段采用同一产品默认，不识别新旧安装，不由废弃字段暗中切换行为。
- 保留七种首页布局、代码折叠三态、字幕来源、统计图、可选头像动画及用户配置内容。移除的是重复控制、旧值解释和隐式继承。
- 旧配置转换集中到离线导入工具；工具先输出新配置及转换报告，由使用者选择导入。运行时不调用转换器，不自动重写当前 Halo 配置。
- 保留文章顶图默认复用 Halo 后台文章封面的决定，不新增独立文章顶图字段。
- 默认值调整不等于性能改善或验收完成；原矩阵 ID 和来源保留，实施后按新条件验证。

## 九项具体清单

| 编号 | 当前行为与问题 | 目标配置和默认体验 | 移除或改变 |
| --- | --- | --- | --- |
| CFG-01 首页布局 | `index.index_layout` 留空时读取 `post_layout`；旧 tile 分支额外禁止摘要 | `index.index_layout` 仅接受 `1`～`7`，默认 `3` 左右交替；全部布局遵循 `index.index_post_content`，摘要 method=3、length=500 暂不改变 | 删除空值选项、`index.post_layout`、旧 list/tile 运行分支及旧平铺无摘要例外 |
| CFG-02 深色模式 | `style.mode` 与 `darkmode.autoChangeMode` 叠加；旧 auto 仍可能按时间切换 | `style.mode: system / light / dark / schedule`，默认 system；定时使用 `darkmode.night_start=18`、`night_end=6` | 删除 user/auto 旧枚举、autoChangeMode、start/end 旧小时语义；具体按钮及偏好规则见下文 |
| CFG-03 代码折叠 | `enable_code_expander` 的布尔 true 与字符串 true 含义相反 | `render.code_shrink: expanded / collapsed / disabled`，默认 expanded；disabled 指不显示折叠按钮，代码完整展开 | 删除旧字段与布尔反向映射；仍映射到上游 shrink 三态能力 |
| CFG-04 首页字幕 | 来源 custom 还要旧随机开关才能请求；默认文案宣传主题 | `index.subtitle_source: local / custom / hitokoto / yiyan / jinrishici`，默认 local；默认本地文案为空，空时静态使用 Halo `site.subtitle`，两者均空则不输出字幕占位 | 删除 `enable_typewriter_random_text` 和旧来源枚举；选择 custom 即使用配置的 API；不默认请求远端服务 |
| CFG-05 资源地址（DEC-03） | 根地址、来源选择器、模板格式并存；主题与字体对 name/file 的解释不同 | `CDN.asset_base` 空为安装包，非空为完整 assets 根地址；`CDN.option` 单项覆盖优先；`CDN.version=true` 保留 | 删除 `CDN.internal_provider`、`third_party_provider`、`custom_format`；字体独立来源改填 `CDN.option.fontawesome`，默认随统一根地址 |
| CFG-06 顶图继承 | 文章随机图、单页与首页背景有隐式耦合 | 有原生封面的页面先用自己的封面，再对应页面类型背景、全局默认图、纯色；文章只有原生封面→全局默认图→纯色 | 文章不再读取列表随机封面；单页、友链、图库、瞬间不再隐式读取首页背景；页面类型开关独立，见下文 |
| UX-01 分类页 | 默认统计图 | `appearance.category_ui=list`，默认显示可点击分类树；chart 继续可选 | 不删统计图；图表依赖只在 chart 模式按需加载 |
| UX-02 标签页 | 默认统计图和标签云 | `appearance.tag_ui=cloud`，默认可点击标签云；chart 继续可选，保留自定义颜色 | 不删统计图；图表依赖只在 chart 模式按需加载 |
| UX-03 头像 | `appearance.avatar_effect=true`，保留旧版旋转 | 默认 false；明确选择 true 才旋转 | 删除缺省沿用旧旋转的分支，保留显式动画和减少动态效果适配 |

CFG-05 中删除两个来源选择器是对“资源根地址＋单项覆盖”的进一步简化建议：界面无需先选择 custom 才让已填写地址生效。任意兼容的 HTTPS/本站路径仍可配置，不取消使用 jsDelivr、unpkg 或 cdnjs 的能力；主题完整 assets 需由站点自行托管，不能把普通 npm CDN 当作 Next 页面包。

### CFG-02：主题策略、按钮与读者选择

1. system 跟随系统并监听变化；系统无偏好时用浅色，不自动转为定时。
2. schedule 按访客本地时间使用夜间区间，18:00（含）到次日 06:00（不含）为深色；切换边界自动更新。小时接受 0～23，跨午夜有效；起止相同视为无效并采用默认区间，在表单提示。
3. system/schedule 中读者显式选择浅色或深色后优先使用并持久保存；提供“恢复站点默认”操作，清除覆盖后立即重新计算。不通过长按或多次点击猜测恢复意图。
4. light/dark 为站长固定模式，覆盖读者保存值，不提供读者切换入口；之后恢复 system/schedule 时读者保存的选择仍可用。
5. 深色模式组只保留 `darkmode.button` 控制读者切换入口（默认 true），删除作用重叠的 `darkmode.enable`。隐藏按钮不改变主题策略。主切换按钮保持一键切换，恢复站点默认提供独立且有文字名称的辅助入口；不复用作者卡片按钮。
6. 第一帧、客户端初始化和 PJAX 使用同一策略；本地存储不可用仍可切换当前页，自动推导不写成读者显式选择。

### CFG-04：字幕细节

- 保留 `index.enable_subtitle=true`、`subtitle_effect=true` 作为能力开关。站点副标题回退静态显示；只有明确填写的本地文案或主动选择的远端文案参与打字效果。减少动态效果时静态显示。
- 本地多条文案暂保留 `typewriter_custom_text` 和 `|&|` 输入方式、作者已有文案与受支持格式；本轮不另外引入列表编辑器迁移。
- 保留 `typewriter_random_api`、`typewriter_api_value_format`，仅 custom 时显示。地址为空或远端失败，回退本地文案，再回退站点副标题。
- 保留 `subtitle_typed_option` 参数覆盖。默认速度暂保持 typeSpeed=200、backSpeed=50、startDelay=300；不把“旧版速度”当产品理由，但本轮没有证据选择新的最佳速度，不额外改动。
- 关闭字幕不发请求；切换来源、离开首页、PJAX 往返不得由迟到响应覆盖新页面或创建重复实例。服务实测仍归 DEC-04，不以本地桩替代真实服务验收。

### CFG-05：资源和另一个分叉的边界

- 顺序：有效单项覆盖→有效统一根地址→安装包；已有资源失败回退、精确 URL 识别和重复加载保护继续保留。
- 根地址只支持 `${name}`、`${version}`，其语义固定为当前主题名称与版本；不再支持通用 `${file}` 模板。单项覆盖仍保留当前已支持的占位符，语义统一为主题实际 assets 路径，不再把 Font Awesome 解释为另一个 npm 包。
- Font Awesome 默认来自当前主题的 `plugins/fontawesome/css/all.min.css`；独立覆盖填完整 CSS URL。继续固定 6.7.2；关闭缓存参数不解除版本固定。自定义 CSS 的字体相对路径由托管方一起保持。
- 动态加载、Share.js、不蒜子和 PJAX 使用同一解析结果；服务型脚本不蒜子仍仅由自己的入口覆盖控制，不能被 assets 根地址误改写。
- 不拆已经打包的依赖，不扩大 CDN 单项覆盖为任意依赖版本混用。
- 本分叉的解析器改动与 Pace 分叉接入处需在后续合并时对接：Pace 已有资源服从公共优先级；其配置和实现保留 master，本草案不创建或更改 Pace 字段。

### CFG-06：顶图开关与图片来源

| 页面 | 图片来源（从左到右） | 页面类型开关 |
| --- | --- | --- |
| 首页 | `index.above_background`→全局默认→纯色 | 保留 `index.enable_above` |
| 文章 | Halo `post.spec.cover`→全局默认→纯色 | 保留 `post.enable_above` |
| 自定义页面 | Halo `singlePage.spec.cover`→全局默认→纯色 | 新 `single.enable_above=true` |
| 分类/标签详情 | 各自 Halo 原生封面→对应 categories/tags 背景→全局默认→纯色 | 保留对应类型开关 |
| 归档、分类/标签总览 | 对应页面背景→全局默认→纯色 | 保留对应类型开关 |
| 友链、图库、瞬间 | 全局默认→纯色 | 新 `image.other_pages_above=true`，覆盖这三类主题页面 |
| 插件公共布局 | 不新增顶图 | 保留当前公共布局 |

不新增文章或单页独立顶图图片字段。`image.disable_top_img` 仍是全局最高优先级；文章/单页 `top_img_enable` 三态元数据保留，显式显示可覆盖页面类型关闭，但不能越过全局关闭。单页不再同时继承首页开关和首页背景。

全局默认图 `image.default_top_img` 默认空，不自动拷贝首页背景。已有明确页面背景、内容封面不覆盖。图片失败继续尝试全局默认图，同 URL 不重复尝试，最终纯色保留标题与导航。列表随机封面、列表封面兜底和正文坏图规则不受此项影响。

### UX-01/02：图表按需供应

当前分类/标签页面文件静态引入 ECharts，仅切换默认模式仍会下载依赖。实施时把图表初始化及 ECharts 放入共享异步模块，在 chart 模式且存在容器时加载；列表/云模式不得请求该模块，图表模块失败仍有可点击文本内容。保留分类层级、统计数量、标签自定义颜色、明暗模式、大小变化和生命周期清理。

这是本轮为了实际加载效果配套的工作，不是把 ECharts 换成 Chart.js。Chart.js 对应独立正文图表需求，已由当前 master 的正文渲染功能接入。加载字节和请求变化以实施后的构建产物、网络记录为准。

## 离线转换清单

扩展当前 `scripts/config-migration.mjs`，继续支持显式 `--from 2.0.5 / 2.0.7`，并新增当前 Next `0.1.0-alpha.4` 配置输入。只输出新配置及报告，不写线上 ConfigMap；无法确定的转换列为 manual-review，不静默丢弃。

| 旧值 | 新值或处理 |
| --- | --- |
| index_layout 有效 1～7 | 原样保留；忽略旧 post_layout 并报告移除 |
| index_layout 空、post_layout=list/tile | 分别转换为 3/6；旧 tile 不再隐式禁用摘要，报告体验变化，不强制改新摘要设置 |
| style.mode=light/dark | 原样保留 |
| autoChangeMode=1/2，且不是固定 light/dark | 分别转换 system/schedule |
| style.mode=auto，autoChangeMode 未开启 | 转换 schedule；旧 user 且未启用自动策略转为 system，并报告默认策略变化 |
| 旧 start/end | 先按旧数值判定：start<end 的白天窗口交换，start>end 的夜间窗口保留；再将 24 转为 0。非法、等值或无法表达的全天窗口采用 18/6 并报告 manual-review |
| darkmode.enable / button | 合成为 button：任一明确关闭则隐藏；随后移除 enable；固定模式无切换入口 |
| enable_code_expander 布尔 true/false | 分别转换 expanded/disabled；2.0.5 的 code.enable_expander 同理 |
| enable_code_expander 字符串 false/true/none | 分别转换 expanded/collapsed/disabled |
| subtitle_source=0/1/2/3 | 分别转换 local/hitokoto/yiyan/jinrishici |
| subtitle_source=custom 或缺省 | 旧随机开关明确开启且 API 非空才转换 custom，否则 local；保留作者文案和 API 内容 |
| 已保存主题宣传文案 | 保留，不凭内容相似删除站长配置；仅新默认去掉宣传文案 |
| internal_provider=local | asset_base 空；现存地址是否弃用写入报告 |
| internal_provider=custom，asset_base 非空 | 保留有效根地址；custom_format 不再参与 |
| custom_format 是可确定的 assets 前缀＋`${file}` | 校验后转换根地址；含其他插值、查询或不同目录布局则 manual-review |
| third_party_provider=inherit/local/公共 CDN/custom | 明确 fontawesome 覆盖优先；否则 inherit 用统一来源、local 转安装包 CSS 路径、公共 CDN 生成固定 6.7.2 完整 URL；custom 单独按原字体语义展开，不能把主题根地址套成字体地址，无法确定则 manual-review |
| single 与其他主题页缺少独立顶图开关 | 转换原 index.enable_above 到新开关并报告；不自动复制首页图片，报告其隐式图片继承已取消 |
| category_ui / tag_ui / avatar_effect 已有有效值 | 原样保留显式选择；缺少值使用 list/cloud/false，不按旧版本补 chart/chart/true |

未使用导入工具而直接使用旧配置时，废弃字段不再生效；新字段缺省采用新默认。文档必须明确这一点并给出转换命令，不承诺原地升级零差异。转换器重复运行相同旧输入应给出相同配置与报告；支持版本必须明确，不猜测输入年代。

## 矩阵裁定条目

本表是拟调整条件，不修改 `matrix.json` 的状态、适用性或分母。配置名改变不意味着相应用户能力变成不适用。分类/标签显示模式是 Halo 侧设置，其页面条目保留。

| 范围 | 原矩阵 ID | 原成功条件与新条件的关系 |
| --- | --- | --- |
| 首页 | `config:index_layout`、`config:index_post_content.method`、`config:index_post_content.length`、`page:home`、`style:source/css/_page/homepage.styl` | 保留全部七布局及摘要参数；删除 Halo 旧布局例外，逐布局核对摘要 |
| 深色模式 | `config:darkmode.enable`、`config:darkmode.button`、`config:darkmode.autoChangeMode`、`config:darkmode.start`、`config:darkmode.end`、`interaction:darkmode` | 上游独立开关/自动枚举/白天窗口改为统一策略、单按钮设置及夜间窗口；保留自动、定时、手动和隐藏入口能力；合并字段不直接标 N/A |
| 代码折叠 | `config:code_blocks.shrink` | 三态保持，输入改为语义枚举；移除 Halo 旧布尔解释 |
| 字幕 | `config:subtitle.enable`、`config:subtitle.effect`、`config:subtitle.typed_option`、`config:subtitle.source`、`config:subtitle.sub`、`template:includes/third-party/subtitle`、`interaction:subtitle`、`resource:typed` | 保留提供方、参数及轮播；来源配置改语义枚举，缺省不依赖远端，空文案回退站点副标题 |
| 资源（DEC-03） | `config:CDN.internal_provider`、`config:CDN.third_party_provider`、`config:CDN.custom_format`、`config:CDN.option`、`config:CDN.option.fontawesome`、`data-schema:cdn-overrides` | 来源选择改为根地址/完整单项 URL；通用模板拼接要求拟取消，由根地址与覆盖替代。正式登记明确 custom_format 原模板要求的 N/A 依据；其他条目按新映射验证，不批量 N/A |
| 顶图 | `config:disable_top_img`、`config:default_top_img`、`page-data:top_img`、`page:post`、`page:page`、`page:category`、`page:tag`、`page:links`、`page:gallery`、`page:shuoshuo` | 保留封面复用、全局/逐页控制及坏图回退；取消随机图和首页配置的隐式跨页面继承，补明确开关 |
| 分类/标签 | `page:categories`、`page:tags` | 文本导航为默认；图表可选并延迟加载，不删除图表模式 |
| 头像 | `config:avatar.effect` | 显式 true/false 两态继续验收；默认 false，不沿用旧旋转 |

## 实施批次与验收

1. **配置模型**：CFG-01/02/03，完成表单、服务端首帧、客户端类型/解析、折叠和切换交互、离线转换。
2. **资源**：CFG-05 更新构建期地址解析、静态标签、动态加载、精确 PJAX URL 识别、说明与转换；与 Pace 分叉在合并时核对公共接口。
3. **首页与图片**：CFG-04/06、UX-03，覆盖空内容、远端失败、坏图、减少动态效果及跨页面继承。
4. **导航默认体验**：UX-01/02，拆分图表依赖并验证默认列表/云、显式图表和图表失败的文本路径。

每个批次同步实际设置、矩阵映射与专属断言；`settings.yaml` 变化后重新生成 `fixtures/performance/theme-defaults.json` 及 settingsSha256，不手改生成模板或安装包。完成源码批次运行 `bun run verify`；适用的真实 Halo 场景另存当前提交与包身份的证据，不引用旧包门禁当新结果。

| 项目 | 具体验收条件 |
| --- | --- |
| 首页 | 1～7 布局逐值；摘要 method 各值及长度生效；缺省为 3；旧 post_layout 不参与；瀑布流按需供应 |
| 深色 | system/light/dark/schedule；系统变化、18/6 边界、跨午夜、错误小时、读者覆盖/恢复、存储不可用；首帧无模式矛盾、PJAX 不重复监听 |
| 代码 | 展开/折叠/无按钮逐值；折叠可恢复、复制内容完整；废弃布尔不再改变默认 |
| 字幕 | 默认无第三方请求；本地文案、站点副标题、全空；各来源成功/失败/迟到；静态/打字、参数覆盖和减少动态效果；离开页面销毁 |
| 资源 | 本地/统一根地址/各单项及无效值；Font Awesome 固定版和字体相对路径；Share.js JS/CSS、不蒜子；原生失败回退、超时/迟到避免重复、PJAX 往返地址精确识别 |
| 顶图 | 所列页面来源及开关；文章/单页/分类/标签原生封面；首页配置不再影响单页及其他主题页；全局禁用/逐篇覆盖/坏图纯色；列表随机封面不变 |
| 分类/标签 | 默认文本导航点击、数量/层级/颜色、空数据；chart 模式初始化、失败文本路径、尺寸/明暗/清理；非 chart 模式网络无 ECharts 图表模块 |
| 头像 | 缺省静止、显式旋转/关闭、减少动态效果、作者卡片和移动导航一致 |
| 转换 | 各来源版本与表内各分支；人工复核项可见；作者内容保留；不写当前站点；旧输入结果可复现 |

实施轮已修改设置、源码、离线迁移工具、文档和矩阵映射，未修改 Pace 或发布公开 issue；矩阵未提升为 verified 或新增 N/A。正式登记时在 DEC-03/拟 DEC-08 中写入维护者决定、原 ID、原/新条件、替代能力和证据，再逐项更新合同；草案链接不是验收证明。
