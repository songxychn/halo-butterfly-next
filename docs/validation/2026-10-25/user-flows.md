# Halo 2.27.1：评论、公式作者与历史恢复

按评论/Moment → WebKit 公式作者 → 导航历史的顺序执行。全部使用官方 Halo 2.27.1 正式 JAR；不发布 1.0，不提升矩阵 verified。原始失败批次不改判，恢复复核用独立 sidecar 记录。机器索引见 [user-flows.json](user-flows.json)。

PR #429 独立审查补充：共享预约、核心滚动断言时点及关闭后错误门禁已加严。原始批次保持当时的结果和范围；当前严格复验与合并门禁见 [独立审查记录](pr429-review.md)。

## 产品与环境

- 初始固定产品 `28d6656929ea1b945ab80266a8495b0654d2eff8`，ZIP SHA-256 `4b13dd856dca8599548f433cf43ca2a05c126ff8c76ec6cebedba0b6957df075`。
- 本轮发现 WebKit 原生后退偏移后，产品修复候选 `577cc427f15fcbc3a53d056eb7e5f10b48c38ab9`，ZIP `8a95280a840f2a6fdfd9639a8094a641be5687335e3e3293c664b8146626ea4d`。版本仍为 `0.1.0-alpha.4`、269 文件。以下评论/公式初始证据属于前一候选；修复后的导航回归单列，不搬用旧包的全量性能结果。
- 官方 JAR SHA-256 `f621cdcfbb66d18079784a1c8796a1707da45c9a4a783978c4ccae3133f9a3d3`。未修补 Halo/插件，未改连接或限流参数，主题最低版本仍为 `>=2.20.2`。
- 本任务独占合成站 `127.0.0.1:18845`；13 个已安装插件、原配置 9 个启用。CommentWidget 3.3.2、Moments 1.18.0、KaTeX 3.0.0、SearchWidget 1.8.0。浏览器为 Chromium 153.0.8010.12、Firefox 155.0、Playwright WebKit 26.6；不是实际 Safari/手机。
- SMTP 关闭；正文、账户与评论为合成夹具。Cookie、登录密码、原始网络记录、通知快照不提交。

## 评论与 Moment

每个主体覆盖三引擎 × 匿名手机 390px/亮色与登录桌面 1440px/暗色，共六个身份/设备组合。七个检查点分别为草稿保存、取消离页、确认离页并返回恢复、真实主评论成功且草稿清空、一次注入回复 503 后保留输入、用户再次提交成功且清空、重载后恰好一条父评论和一条回复。503 是声明的客户端故障注入；不重写正常请求，不把 API 夹具计为 UI 提交。

| 主体 | 实际 UI 结果 | 停用/恢复与清理边界 |
| --- | --- | --- |
| Post | `270baa847428984b30c3` 严格 5/6，六例均完成七个功能检查点；修正离页等待后 `f83024388087efd7d466` 补齐 Firefox 登录 1/1。六个组合为跨批覆盖，不是单批 6/6。 | 两批各自停用 3/3、恢复 3/3；自动恢复与清理通过。 |
| Moment | `44adc722bf389f212eff` UI 6/6，停用/恢复各 3/3。 | 原协调器因异步 approvedTime 和通知订阅身份轮换失败；保持 failed。受控复核删除唯一剩余自有 Moment、核对原内容/配置/插件/包；`bce2db1d875dcd7e9832` 使用 API 阅读夹具补停用/恢复 3+3，自动恢复通过，不增加 UI 提交通过数。 |
| SinglePage | `0d0fed3bafd2153fb505` UI 6/6、停用 3/3；恢复读取 2/3。 | WebKit 恢复阶段误要求打开回复编辑器，改为展开并读取已存在回复；精确主体通知轮换单列。`511ae9cc6bd644c74b41` API 阅读夹具复验停用/恢复 3+3，自动恢复通过；原失败保留。 |

先前 Post `74bdf1d8a3dbf7a2f62c` 为严格 2/6（功能 5/6），含官方 429；`7611fbd3d41cf21c6619` 为严格 4/6（功能 6/6）。工具按官方 `comment-creation` 10/minute 预算，在每次提交前间隔 6500ms；没有放宽服务端限制。离页改用已有链接的真实键盘激活，避免自动点击先滚动触发额外资源；回程前等待 away 文档在原 5 秒内 networkidle。旧字体/头像取消继续保留，不豁免网络错误，不推断均属于 #338。

通知恢复只允许合成维护者、当前主体的精确 reason/expression/字段形状保持语义一致；其他订阅严格比较。Moment/SinglePage 的恢复诊断登录额外产生本地设备登录通知与订阅，明确保留并散列，不能宣称整个通知库存逐字相同。后续运行器等 Moment approvedTime 稳定后再冻结清理身份。全部恢复 sidecar 与原报告各自保留哈希。

## WebKit 公式作者

`0f9ccca012c295774964`：行内、块级公式作者 **2/2**；启用、主题关闭、插件关闭、恢复四状态前台 **8/8**。真实 UI 登录、编辑、保存、重开、再次修改保存均通过，请求/存储/再次打开与发布内容的 TeX 核对一致。两个自有文章清理、原 KaTeX 实例/配置恢复通过。

2.27.1 使用官方内置默认编辑器，运行器绑定正式 JAR 中的 CodeMirror 模块/export；没有要求安装旧 hybrid 编辑器。发布步骤使用官方 API，不能称 UI 发布按钮已验；复制验证的是事件处理输出，不能称系统剪贴板已验。其他编辑器、真实浏览器/设备及完整 EXT-02/PLG-06 仍保留。

## 历史与滚动恢复

核心 PJAX：临时停用全部插件，保存与恢复原 13 个实例的启用状态、spec/config/JAR 身份。390/1440px × 亮暗 × 三引擎共 12 例，每例五轮 A/B、Back、Forward 和排除路径，14 个检查点、13 次转换；校验真实 850/1250px 历史恢复、新页面 0、内容/标题/canonical、工具栏唯一、灯箱键盘退出、旧 PageScope 释放及每页一条实际统计 POST。插件启用时的完整导航不计作 PJAX。

初始候选 `8706855a7ba2f27c3a08` 为 10/12 完整通过，两个 WebKit 就绪等待超时保留；`60ac92f603527d6f980a` 两个固定补例通过。补例的新等待条件改为显式 100ms 轮询，原 30/20/5 秒边界不变；不能据此确认首批超时根因。协调器两次均完整恢复插件。

官方插件原生历史：保留 SearchWidget 未标记脚本，按 A→B→Back→Forward→新 A 入口执行五个位置检查；文档请求证明原生导航；无请求时必须同时观察原文档身份与 pageshow.persisted，才可计作 bfcache。初始 `291eaed207eb201eb1ba` Chromium/Firefox 8/8，WebKit 0/4。

WebKit 三次只读诊断 `b8ccd38e3fbaf2f200a8`、`dfa2f4150288c069a6fc`、`6690009d417b22926e71` 确认离页 850、返回 917，阅读从第三段变为第四段。时间线显示浏览器先恢复 850，Prism 后加载工具栏时 pre 高度 28→71、文档高度 9302→9369，同时 scrollY 850→917；原页面最终高度也是 9369。不是请求失败或测试误差。

原生路径修复只包围 WebKit back_forward 下的一次同步代码增强，保留增强前已恢复的非零偏移；普通原生导航、reload、其他引擎原生锚点不改变。wheel/touchstart/pointerdown/keydown 或页面清理后取消保护，避免抢回用户位置。这里使用明确的 WebKit UA 边界，因为 Chromium/Firefox 可先恢复临时锚点位置；跨引擎共用修正在实际矩阵中导致回归。iOS 浏览器品牌仍属于 WebKit 判断，但真实 iOS 未验。

中间候选 `fb33c7e` / `501a2b06a27559ab8d5c` 与 `f5a4fca` / `c673b22ed59d8ce85b06` 失败保留，均完成自有夹具清理与原配置恢复；最终产品不包含额外原生 history.state 写入。

候选 `6f6ea9c` 原生历史 `bcbf3d3b3f9adda50ab3` 12/12 通过；核心 PJAX `581ebe76b1ee75a0c507` 为 7/12，复现 Chromium 一例及 Firefox 四例在 Back/Forward 后被后加载代码布局再次推高约 67px。所有失败保留，插件恢复通过。最终修复进一步保护主题负责的 manual/PJAX 恢复，适用于三引擎；增强期间临时禁止 CSS 滚动锚定，下一次绘制后恢复原 inline 值与优先级，不在延迟回调中强行滚动。六项单元回归覆盖一次性保护、引擎边界、用户取消、PJAX、样式恢复及异常路径。

另保留一次准备阶段竞态 `8c6d74c3bbf3766b8dbb`：插件恢复协调器尚持锁时旧内层运行器开始准备，预检拒绝，未启动浏览器。自有夹具清理与独立恢复复核完成。运行器现拒绝任何其他锁；只有匹配唯一协调器 token 的 core 子运行可进入，四个拒绝路径回归已覆盖。

最终候选 `577cc42`：

| 范围 / run ID | 完整用例 | 检查点 / 转换 | 恢复 |
| --- | ---: | --- | --- |
| core PJAX `7d3cabc28109480f6840` | 12/12 | 168 个检查点；144 次 PJAX + 12 次排除路径完整导航 | 3 个自有文章删除、主题/系统恢复；协调器 `1554382159388b7b6ac9` 原 13 插件恢复，前后摘要相同 |
| 官方插件原生历史 `201b1341c1b5059770f7` | 12/12 | 60 个位置检查点、48 次原生历史/链接转换；850/1250px 返回和新入口 0 均通过 | 3 个自有文章删除，原主题/系统/插件/内容与包身份核验通过 |

上述两批执行当时的网络/页面错误及原超时门禁，没有失败自动重试或错误豁免。独立审查发现其核心滚动断言时点与关闭后错误检查尚不完整；加严后的新批结果另见[独立审查记录](pr429-review.md)，不向旧报告补写新门禁通过。原生与 PJAX 的通过各自归属，不扩展到未知 SDK、真实 Safari 或完整设备合同。

## 剩余与交付边界

本轮缩小的是以上实际受测场景。评论验证码/审核/上传等其他设置、其他编辑器/OS 剪贴板、原生图片配置及缓存证据、A02/DEC-08 平台长尾、母语审校、真实 Safari/手机/辅助技术、外部账户、最终 RC 安装升级回退与固定执行机性能仍未整体完成。矩阵仍为 897 项、1.0 适用分母 691、verified 0。

完整 `bun run verify` 通过：789 项测试、0 失败，类型、矩阵、构建、269 文件包检查通过；重新构建 ZIP 与实际受测 `8a95280a…` 完全一致。运行器、最终源码与报告各自可定位；精确提交 CI 以 PR checks 为准，独立审查仍待。

最终原内容（Post/SinglePage）、主题配置、系统配置、插件状态与首批前快照一致；Moment/评论/回复按各自恢复报告清理，通知库存边界如上。任务 Halo 已停止、18845 已关闭，无剩余验收锁或本任务浏览器进程。原站与线上未改；未创建 1.0 tag/release。

## 重跑入口

在独占运行中的 Halo 2.27.1 lab 上执行，所有路径与摘要绑定待测包；运行器检查源差异、269 文件字节和 JAR，不允许同时运行其他写入器：

```sh
export HALO_VERSION=2.27.1
python3 scripts/acceptance/comments/run.py --runtime "$LAB_RUNTIME" --package "$CANDIDATE_ZIP" --source-sha "$CANDIDATE_SHA" --subject Moment --cases full-six --allow-synthetic-writes yes
python3 scripts/acceptance/math-editor/run.py --runtime "$LAB_RUNTIME" --package "$CANDIDATE_ZIP" --source-sha "$CANDIDATE_SHA" --plugin "$KATEX_JAR" --engines webkit --allow-synthetic-writes yes
python3 scripts/acceptance/navigation/coordinate.py --runtime "$LAB_RUNTIME" --package "$CANDIDATE_ZIP" --source-sha "$CANDIDATE_SHA" --profile history-matrix --allow-synthetic-writes yes
python3 scripts/acceptance/navigation/run.py --runtime "$LAB_RUNTIME" --package "$CANDIDATE_ZIP" --source-sha "$CANDIDATE_SHA" --package-sha256 "$CANDIDATE_SHA256" --profile official-history --allow-synthetic-writes yes
```

Post/SinglePage 分别选择对应 subject。上面是顺序执行入口，不表示所有已存报告使用最终新包重跑；产品归属以每个报告 identity 为准。
