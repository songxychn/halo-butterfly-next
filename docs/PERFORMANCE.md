# 固定性能采样与预算检查

Issue #35 实现 PERF-01/02/03 的测量工具，不改变[工程验收合同](RELEASE-ACCEPTANCE.md#8-无障碍与性能门禁)。工具测试通过不代表主题性能通过。默认/推荐组合、基线/候选四个集合，每个集合必须具备首页、长文、图库、真实插件公共页 × 手机/桌面 × 5次，共160份原始Lighthouse报告。缺一项、运行错误或输入漂移均保持未完成。

## 固定工具和环境

独立依赖是 Lighthouse13.4.1，锁文件在 `fixtures/performance/`。运行使用Node24与pnpm11.19.0；Chrome固定为现有Playwright1.63.0缓存中的Chrome for Testing153.0.8010.12（revision1243，macOS arm64）。安装器要求明确传入该应用路径，核对可执行文件版本和固定SHA256，再保存完整应用树摘要；采样前再次核验。没有下载或选择最新浏览器的回退逻辑，不自动寻找用户Chrome，也不连接其profile/CDP。此固定引擎用于性能实验，不代替BROWSER稳定Safari/Firefox或真机验收。

```sh
node scripts/perf/install.mjs --chrome-app '/explicit/cache/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app'
node scripts/perf/longform.mjs --check
```

`--chrome-app`是调用者提供的实际缓存位置；仓库未写入某人的绝对路径作为默认依赖。工具和依赖安装在本worktree `.runtime/performance`，运行目录有独立所有权标记，依赖不进入主题ZIP。Chrome应用更新、锁文件变更或硬件/系统变化后，应重新安装并重测基线和候选两侧。

实际配置继承固定版本Lighthouse默认值并导出完整解析设置。手机：390×844、DPR1、`formFactor=mobile`、模拟RTT150ms/1638.4Kbps/CPU4；桌面：1440×1000、DPR1、desktop、40ms/10240Kbps/CPU1；两者均`throttlingMethod=simulate`。`emulatedUserAgent`按两种模式固定，locale为zh-CN。配置中的`rttMs`和`throughputKbps`属于模拟参数，不能换成DevTools请求限速字段。

来源：[Lighthouse13.4.1](https://github.com/GoogleChrome/lighthouse/releases/tag/v13.4.1)、[配置类型](https://github.com/GoogleChrome/lighthouse/blob/v13.4.1/types/lhr/settings.d.ts)、[网络记录字段](https://github.com/GoogleChrome/lighthouse/blob/v13.4.1/core/audits/network-requests.js)、[原始trace保存](https://github.com/GoogleChrome/lighthouse/blob/v13.4.1/core/lib/asset-saver.js)。

## 真实夹具和两个配置

长文为原创固定合成内容：14992汉字、20节、8代码块、2表格、12张不同的本地SVG，固定发布时间2026-08-01。正文和每张图都有SHA256，`longform --check`拒绝正文篡改、外部资源和缺失语义结构。`station.py seed-longform`使用已授权专属实验站的实际API；先检查所有既有文章/附件是否冲突，再增量创建。不会覆盖不同内容，重复运行保持幂等，创建后中断可从同一内容恢复发布。

```sh
python3 scripts/perf/station.py seed-longform --lab-runtime /absolute/owned/performance-lab
```

在全新专属实验实例完成基础comparison bootstrap之后再添加长文和插件内容。后续不要再次调用基础bootstrap来覆盖性能配置：基础夹具保护会拒绝新增长文或启用插件。服务管理仍使用实验工具的归属检查；本工具不新建/停止服务。

#25 已经固定 PluginLinks2.3.0、PluginPhotos2.1.2、PluginMoments1.18.0 的JAR/manifest/API契约以及4友链、24图、12瞬间、两组数据。`plugin-profile.json`保存这些确切输入与来源摘要；其功能审查/集成结果与性能采样分别记录，不能写成尚未锁版，也不能从固定版本推导功能已通过。实际测量前须采用已审查的#25夹具，真实页面可用才采样。

合同的 P/P+ 是核心/插件页面集，以下 `default`/`recommended` 是本工具的安装组合，二者不混用。`plugin-profile.json` 的 `requiredPlugins` 逐路由声明依赖，`profiles` 声明该次采样允许启用的确切集合：

| 路由 | 必需插件 | default 实际启用 | recommended 实际启用 |
| --- | --- | --- | --- |
| 首页 | 无 | 无；所有可选插件停用 | Links、Photos、Moments、probe |
| 长文 | 无 | 无；所有可选插件停用 | Links、Photos、Moments、probe |
| 图库 | Photos | 仅 Photos | Links、Photos、Moments、probe |
| 插件公共页 | probe | 仅 probe | Links、Photos、Moments、probe |

因此默认首页/长文确实测量纯主题；默认图库/公共页明确附带各自必需依赖，不能统称无插件默认站。每个路由保存全部已安装插件清单、启用布尔值，以及已启用插件版本/JAR摘要。推荐组合仅指表中这四个固定插件；搜索/评论等其他生态配置尚未覆盖，不能推导通过。

`theme-defaults.json` 直接从基线 `settings.yaml` 的表单默认值生成，保存原设置文件摘要；两个组合均要求这些真实默认值完全一致，不沿用基础comparison为视觉对照修改过的字幕、背景或侧栏配置。配置准备由站点负责人把该文件的 `config` 通过 Halo 主题 JSON 配置 API 明确应用并保存前值。本工具只核对，不隐式修改；包中默认值有变时拒绝采样，需要冻结新配置并重测两侧。

启用图库时验证24图和两组，启用推荐组合时另验证4友链/12瞬间。预检核对已发布长文原文、主题120文件实际字节、Halo2.26.1官方JAR；保存主题/系统/用户展示字段/菜单配置和内容摘要。布局页必须输出真实插件正文标记，图库必须实际输出合成图片，200空白/错误页不能当作可测页面。任何默认/推荐组合覆盖不足继续incomplete。

## 采样与CPU席位

正式采样前由集成负责人分配专属Halo/Hexo端口、实验运行目录和CPU独占窗口。不要同时构建、执行其他浏览器批量测试或更改配置。预期使用同一个专属站点按版本顺序切换安装包，保持内容、配置、URL完全一致；不能用两个不同绝对URL的插件数据假装相同夹具。

计划顺序：冻结基线包 → default四路由各10样本 → recommended四路由各10样本；再安装候选包 → default四路由各10样本 → recommended四路由各10样本。每次采样前、后独立比对安装/配置/内容/插件状态。首次基线必须新跑，不能使用旧截图或历史文字。先用1样本诊断工具兼容性与耗时，再安排完整160样本窗口；诊断结果始终incomplete，不能补入正式集合挑选好样本。

```sh
# 将CPU窗口名称替换为集成负责人实际安排的窗口；这不是自动申请或抢占CPU。
node scripts/perf/collect.mjs --lab-runtime /absolute/owned/performance-lab \
  --package /absolute/frozen/theme.zip --profile default --route home \
  --cohort baseline-SHA --cpu-window assigned-window --limit 1

# 正式集合用全新cohort目录并省略limit；每一路由固定10份。
node scripts/perf/collect.mjs --lab-runtime /absolute/owned/performance-lab \
  --package /absolute/frozen/theme.zip --profile default --route home \
  --cohort baseline-full-SHA --cpu-window assigned-window
```

同一cohort下分别采集两个profile的四个route，结果存放 `runs/<cohort>/<profile>/<route>/`；候选使用另一cohort名。每次default路由切换前，由负责人按表调整插件后再采样，首页与长文均核对零启用集合。工具不会替调用者开关插件、安装主题或改变基础配置。每个样本先启动全新独立无头Chrome进程/空profile，冷浏览器缓存；Halo的固定3次HTTP热身在另一个阶段执行。Lighthouse从首次导航开始测量，不先等待页面完全渲染再启动审计。每个完整10样本批次要求工具提交工作区干净；dirty的一次诊断仍只记incomplete。

进程通过独立process group运行，超时收尾只终止该样本自己的组；不会全局清理Chrome。共享的任务专属CPU锁防止两套性能工具并发。若进程被外部中断且锁保留，先核实锁内PID和实际进程归属，再由负责人处理；不自动删除未知锁。服务和基线配置继续保留供复验。

每份报告保存LHR JSON、原始trace JSON、DevTools网络日志、完整命令、起止时间、解析后的配置、指标和网络清单。不会修改trace生成所谓更好的分数。外部域名DNS被限制，外部请求/失败或未完成请求会使样本失败；这不验证真实提供商行为。故障注入必须在单独场景保留，而不是混入基准样本。

## 比较结果和退出码

```sh
node scripts/perf/compare.mjs \
  .runtime/performance/runs/baseline-full-SHA \
  .runtime/performance/runs/candidate-full-SHA \
  .runtime/performance/comparison.json
```

比较器重新读取原始LHR、trace和网络文件并核对字节摘要，不信任采样摘要中的预计算分数。比较器同时拒绝同一集合混入不同源码、安装包或配置。逐页/设备/profile计算5次中位数：LCP≤2500ms、TBT≤200ms、CLS≤0.10；LCP/TBT退化同时超过10%和100ms失败；CLS增量>0.02失败。主题初始导航JS/CSS解压体积分别增加同时超过10%和20KiB失败。零基线仍按绝对增量和百分比双条件判断，不除零放行。不会跨页面平均。

网络窗口为初始导航至Lighthouse采集完成，不主动滚动/展开。保存所有请求的传输字节和解压体积；只把主题assets路径下JS/CSS计入主题预算，插件和其他资源仍在完整清单中。此窗口不等于所有离屏或延迟交互资源都已加载。

输出分别包含`budgetResult`和各PERF场景状态。即使160份样本预算全通过，PERF-03要求的按需组件与失效提供商Loading恢复也不能靠网络体积推导：当前比较器明确将这部分保持incomplete。后续实际故障/按需验证应以独立可审查报告接入，不能手填true。运行器保存完整样本返回0、样本未完成返回2；比较器预算失败返回1、尚缺完整合同证据返回2。不存在以Lighthouse总分替代合同通过的路径。

工程测试由默认`pnpm verify`执行。真实Lighthouse采样目前按显式CPU窗口执行；正式RC前仍须按原合同把可自动化性能门禁接入固定执行机的CI。共享随机负载机器上的分数不视为固定性能基线。
