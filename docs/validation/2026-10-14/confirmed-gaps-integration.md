# 已确认缺口开发与组合验收

本记录区分分支限定验收、合并组合包与完整1.0门禁。所有实例为独占本地Halo2.26.1，使用合成内容；没有部署生产、发布或合并主线。

## 已取得的组合证据

| 候选/证据 | 结果与范围 |
| --- | --- |
| `33c6b1580f8e8df0948469b1c5c5f6527ba16156` / [正文](confirmed-content-integration.json) | 三引擎、两视口、亮暗及无脚本共27项通过；包含Tabs键盘、嵌套锚点、折叠、图库、灯箱和溢出。 |
| 同候选 / [瞬间首次失败](confirmed-moments-initial-failure.json) | 首个请求HTTP500；根因是新增标题的消息函数写在Thymeleaf变量表达式外。此失败属于集成代码，不归因于平台。 |
| `6775405ac11c043d9bae82d2fa365a6ba72f65a4` / [瞬间复验](confirmed-moments-integration.json) | 修复表达式并加回归；33项通过，含原生与远端数据、权限、Moment评论/最新评论、停用及无脚本回退。 |
| 同候选 / [社交页脚友链](confirmed-site-content-integration.json) | 29项通过；位置、亮暗色、净化HTML、相对URL、原生/远端组、坏图、错误重试和无脚本回退。 |
| 同候选 / [跨功能导航首次失败](confirmed-navigation-initial-failure.json) | 第一条跨语言导航等待超时；保留失败。随后独立探针保持window身份，完成URL/locale/消息切换；单次探针不关闭该批验收，后续组合需带完整请求诊断。 |

| `8acdbe1` / [安全集成首次运行](confirmed-security-initial-failure.json) | Chromium 7/7、Firefox首页通过；Firefox文章页等待 networkidle 30s 超时，第9项失败；全部设置/资源已恢复。原脚本缺请求ledger，不能据此归因主题或平台，后续增加诊断后在新候选复验。 |

## 编辑器与独立分支证据

[真实编辑器](content-editor.md)确认官方HTML块在三引擎保存重开完整17个增强属性与正文结构；普通富文本粘贴不能保留增强属性。该结论来自编辑器自身版本，与主题前台候选证明分开。

[D06](author-listing-options.md)141项、[D05](i18n-completion.md)、[D02核心](pjax-completion.md)、[D03背景](backgrounds.md)、[D08](resource-hints.md)均保留各自精确版本、包哈希和范围，不把分支运行冒充最终全部代码验收。

[核心组合验收](core-acceptance.md)保留119/120页面矩阵整体失败（Firefox一张图片请求pending）、TOC对比度修复后axe40页0 violations但存在人工判断项、性能行为30项通过以及两条未构成完整合同的Lighthouse诊断。

## 仍保留的门禁

固定双站逐项能力、真实Safari/移动设备/屏幕阅读器、外部服务账户、完整性能/生命周期、精确候选CI与维护者发行决定仍是独立条件。核心页面曾有5类失败状态保持；自动化无头WebKit不代替Safari应用，局部运行不升级矩阵verified。

## 后续组合与保留失败

| 候选 / 证据 | 结果与边界 |
| --- | --- |
| `63683a1` / [带请求诊断的安全运行](confirmed-security-request-failure.json) | Firefox单页等待networkidle超时；[ledger](confirmed-security-request-ledger.json)显示同源官方CommentWidget的`a.ff4cd3aa.js`仍pending，无响应、页面或控制台异常。配置恢复，未确定网络栈根因，不归因#338。 |
| `59fee48` / [完整安全收集](confirmed-security-complete.json) | 36/36通过且配置恢复。收集器遇错继续独立案例，最终仍断言全通过；未更改等待阈值或增加自动重试。该通过不抹去前述请求停滞。 |
| `59fee48` / [组合导航原记录](confirmed-navigation-polling-failure.json) | 10/12；两条Chromium等待rAF轮询超时，失败快照中的URL、locale、ready及window身份已满足谓词，无pending/error。其余Firefox/WebKit全部通过。 |
| `adda323` / [组合导航定时轮询](confirmed-navigation-complete.json) | 同谓词、同30秒阈值，轮询改100ms后12/12；三引擎、两视口、亮暗，包含文案切换、Moment/Post评论身份与旧编辑器清理、Tabs/友链重入及未完成远端请求离页。此更改是验收收集器修正，不宣称消除了浏览器所有rAF问题。 |
| `59fee48` / [正文计数原记录](confirmed-content-counter-failure.json) | 19/27；Chromium八项收到统计HTTP200后请求ERR_ABORTED，独立无导航探针在真实和路由响应上均复现。 |
| `adda323` / [正文计数修复](confirmed-content-counter-fixed.json) | `9cdcc28`消费成功响应body后，真实和路由探针均requestfinished，正文27/27通过。见[前后探针](confirmed-counter-response-probes.json)。没有重试统计请求或放宽验收。 |

[首页布局当前候选](home-layouts-candidate.md)的固定双站318次观察保留317通过/1张图pending；日历图标修复及坏图/备用图失败定向48/48。[手机首屏性能](mobile-title-performance.md)记录标题动画取消后的实际LCP改善，但首页仍超过预算，长文样本后置身份校验失败仍为error/incomplete；均不升级完整门禁。
