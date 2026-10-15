# 1.0 完整性能矩阵：固定 160 次尝试

结论：**未完成**。160 次预定采样全部执行且未重试，142 份有效、18 份因请求未完成而无效。候选有完整五次证据的 12/16 个页面设备组合均满足绝对预算；9/16 个可与基线配对的组合均满足回归和主题 JS/CSS 体积预算。其余组合仍缺有效证据，不能把已执行 160 次写成性能验收通过。

机器记录：[performance-full-matrix.json](performance-full-matrix.json)。后续请求诊断另见[持续未完成请求观察](performance-navigation-observations.md)，不补入正式样本。

## 固定输入

- 基线：`f4ecc75d46651cd8a2f3188799ae27737dfdfd36`，ZIP `2733dc6380c727682d15ad7491d09c89b53bde2441affb937700e7b4fbd3d0ce`。
- 候选：合并 PR417 的 `d678d3f839347554d7f100996f87b23b571888df`，ZIP `93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e`。
- 采样工具：干净 runner `b44dc00e346be008b6422e615a196ba5ea69cd2f`；分析器：`b56e97f5ea72fc0547a269863ab6028bce0755eb`。分析修正独立识别候选绝对预算，不改变任何原始测量。
- Halo 2.26.1、Chrome 153.0.8010.12、Lighthouse 13.4.1、Bun 1.4.0；独占窗口 `20261016-exclusive-02`，专属 loopback Halo 18845。
- 默认组合只启用相应页面必需插件；推荐组合使用已锁定的九插件及完整 Plugin ConfigMap 摘要。两侧相同安装版本、配置和夹具；每批前后实时快照一致。官方评论/KaTeX资源实际计入，没有停用资源或改主题默认配置刷分。

## 覆盖与失败

| 组合 | 首页 | 长文 | 图库 | 公共页 | 有效/尝试 |
| --- | ---: | ---: | ---: | ---: | ---: |
| baseline / default | 10/10 | 10/10 | 10/10 | 10/10 | 40/40 |
| baseline / recommended | 6/10 | 10/10 | 9/10 | 7/10 | 32/40 |
| candidate / default | 10/10 | 10/10 | 10/10 | 10/10 | 40/40 |
| candidate / recommended | 10/10 | 9/10 | 2/10 | 9/10 | 30/40 |

18 份无效记录分为两组：8 份已达到原 Lighthouse 约 45 秒导航上限；10 份在约 2.55–2.59 秒的导航收集结束时仍有请求未完成。后者不能仅凭最后一条网络事件时间认定为正常加载，也不能直接等同于 45 秒停滞。每份具体资源、设备、原始 LHR 哈希、导航时长和警告均在机器记录中。

## 候选具备完整五次证据的绝对预算

| 组合 | 页面/设备 | LCP 中位数 ms | TBT 中位数 ms | CLS 中位数 |
| --- | --- | ---: | ---: | ---: |
| default | home/mobile | 2027.9 | 0.0 | 0.0000 |
| default | home/desktop | 1090.4 | 0.0 | 0.0000 |
| default | longform/mobile | 2026.6 | 62.0 | 0.0008 |
| default | longform/desktop | 622.9 | 0.0 | 0.0003 |
| default | photos/mobile | 1578.1 | 0.0 | 0.0000 |
| default | photos/desktop | 842.6 | 0.0 | 0.0000 |
| default | public-layout/mobile | 1999.2 | 0.0 | 0.0000 |
| default | public-layout/desktop | 542.0 | 0.0 | 0.0000 |
| recommended | home/mobile | 1953.7 | 0.0 | 0.0000 |
| recommended | home/desktop | 1085.0 | 0.0 | 0.0000 |
| recommended | longform/desktop | 665.2 | 0.0 | 0.0003 |
| recommended | public-layout/desktop | 603.3 | 0.0 | 0.0000 |

阈值保持 LCP≤2500ms、TBT≤200ms、CLS≤0.10；回归和体积阈值见[固定性能流程](../../PERFORMANCE.md)。未完成的候选组合是推荐长文/手机、图库/手机、图库/桌面、公共页/手机；没有挑出其中成功的样本补足五次。

PERF-01、PERF-02 仍为 `incomplete`。PERF-03 的体积比较在可配对组合中通过，但完整场景还需独立的按需资源和故障恢复证据，不能由本报告单独认证。固定执行机 CI 门禁与最终 RC 仍另行处理。

## 原始证据与范围

正式目录为 clean runner 的 `.runtime/performance/runs/{baseline-full-f4ecc75d4665,candidate-full-d678d3f83934}-20261016-exclusive-02/`。每份有效样本已有 LHR/trace/DevTools 日志哈希，无效 LHR 也单独绑定哈希；16 份完整报告的哈希位于机器记录。原始报告、ZIP 和日志保留在 ignored runtime，不提交大体积二进制。

初始两个工具诊断未并入本集合：第二批曾因重新登录限流导致后快照失败，原失败证据保留；修复为每批同一内存会话并提交工具后才开始正式 160 次。完整样本与额外诊断都没有提高超时、删除失败或重跑挑选。

已将两个完整正式集合复制到主工作区 `.runtime/performance-followup/evidence/full-runs/`，共 1,026 个文件、2,141,698,763 字节。每个副本均逐字节摘要与 clean runner 原文件核对一致；完整清单为 `.runtime/performance-followup/evidence/formal-raw-manifest.json`，清单 SHA256 绑定在机器记录。clean runner 后续归档不会删除这份保留副本。
