# Halo Butterfly Next 派生主题说明（上架准备草稿）

日期：2026-10-04；本项目对照基线 `16a5274a886a3e075c1d35b26c93c2c501d91c33`。本文尚不能直接用于提交；独立上架必要性、当前改进的上游贡献记录、维护承诺和最终运行证据仍待补齐，状态见[差距清单](APP-STORE-READINESS.md)。

## 来源和身份

Halo Butterfly Next 是基于[小红的 Halo Butterfly](https://github.com/dhjddcn/halo-theme-butterfly)的独立社区分支，不代表 Halo、原作者或 Hexo Butterfly 官方，没有已核验的官方接续授权。

- 直接上游：[仓库](https://github.com/dhjddcn/halo-theme-butterfly)、[市场应用 Butterfly](https://www.halo.run/store/apps/app-UeCsJ)。市场页面列示作者小红、版本 2.0.5；页面信息来自网页读取，提交前应再核验。
- 本项目与当前上游的共同祖先是 `de9046b47a8e04c3db85170e356dde9e68f26d77`，即当前上游 master 的“发布：v2.0.7”源码提交；本地 `git merge-base` 已核对。GitHub latest Release 则仍是 [v2.0.5](https://github.com/dhjddcn/halo-theme-butterfly/releases/tag/v2.0.5)，不能混用源码版本与发行包版本。
- 另一个固定对齐来源是 [Hexo Butterfly 5.7.0](https://github.com/jerryc127/hexo-theme-butterfly/tree/f223b1888b42b2b336068e6c959ed90a3cd7c8f3)，不是已完整实现的兼容承诺。
- 主题继承 GPL-3.0；保留原作者、Jerry 等已有署名，Hexo 改写内容及其他依赖按各自许可保留来源和原文。详见[第三方说明](THIRD_PARTY.md)及[归属清单](../third-party-licenses/UPSTREAM-ATTRIBUTION.txt)。许可合规不等于市场自动收录。

## 上游维护及贡献核验

2026-10-04 的 GitHub API 查询显示：上游未归档、未禁用；默认分支提交日期为 2024-09-03，latest Release 发布日期为 2023-03-20。[固定 README](https://github.com/dhjddcn/halo-theme-butterfly/blob/de9046b47a8e04c3db85170e356dde9e68f26d77/README.md)只表达暂时无暇完善、以后继续迭代。本次未查到明确停维或迁移声明，不能据时间间隔宣称停维；查询也不穷尽所有历史沟通。原始查询入口、时间和摘要见[核验记录](validation/2026-10-04/upstream-status.json)。

| 已知记录 | 日期和结果 | 能证明什么 |
| --- | --- | --- |
| songxychn 的 [issue #146：首页向下箭头无法点击](https://github.com/dhjddcn/halo-theme-butterfly/issues/146) | 2024-08-18 提交；作者于 8 月 20 日回复将修复；9 月 11 日以 completed 关闭 | 一次公开缺陷反馈和维护者响应，不是本分支新增功能的贡献证明，也不是独立运行验收 |
| 作者/评论者/审查者为 songxychn 的上游 PR，以及默认分支匹配该账号的提交 | 本次各查询返回 0 | 仅描述列明查询范围，不能排除其他账号、未关联身份、删除或站外记录 |

**待补：** 本分支适合向上游合入的改进清单、每项 issue/PR/沟通链接与结果；尚未贡献的实际原因。当前没有证据支持“上游拒绝合并”“无法联系”或“已同意接续”，不代填这些理由。[派生应用审核要求 §4.2.1–2](https://docs.halo.run/developer-guide/app-store/app-review-guidelines)

## 供评估的差异与用户场景

下面是可核验的本项目工作和候选价值说明，**不是已经获认可的独立上架理由**。提交时需结合当前上游复现，不能只拿旧市场截图比较，也不能用提交数、重构量或测试数代替用户收益。下列源码入口跟随当前 TypeScript 文件名；历史比较记录保持原 JS 路径和固定提交。逐项原版已有行为、精确比较提交及源码路径见[独立差异核验](validation/2026-10-04/derived-differences.json)；可用记录中的 from / to / paths 执行 `git diff` 复核。

| 工作与源码入口 | 用户场景 / 已有材料 | 仍需补证 |
| --- | --- | --- |
| [本地配置迁移工具](../scripts/migrate-config.mjs)及独立主题 ID | 从原版 2.0.5 / 2.0.7 转移配置、报告不支持项，保留原主题回退；见[迁移说明](MIGRATION.md) | 当前候选真实导入、共存和回退，不能声称无损迁移或支持 Hexo 内容转换 |
| [侧栏配置](SIDEBAR-OPTIONS.md)、[菜单配置](NAVIGATION-OPTIONS.md)、[字幕配置](SUBTITLE.md) | 分类层级/数量/排序，移动多层菜单逐层关闭，字幕来源及 Typed 白名单参数；9 月 29 日[52 组运行检查](validation/2026-09-29/sidebar-menu-subtitle.json) | 原版已有侧栏、菜单和打字机；需要按具体新增行为比较，不宣传整项首创。当前证据不是完整双站对照，外部字幕真实响应/CORS 未验 |
| [Viewer.js 灯箱适配](../src/js/modules/AmplifyImg.ts)及[来源清理](THIRD_PARTY.md) | 多图查看、键盘入口和关闭焦点；本地许可清楚的发行资源 | 原版已有看图能力；替换依赖、修复及许可整理本身不足以证明必须独立上架；新候选仍需回归 |
| [验收合同](RELEASE-ACCEPTANCE.md)、[可构建源码](SOURCE-BUILD.md)、固定来源与矩阵 | 让维护者可以复核安装包、限制和升级行为 | 属于维护能力证据；不能把工程流程当作独立终端用户功能 |

目前的产品定位可表述为：为希望在 Halo 使用 Butterfly 风格、需要可配置导航/侧栏及明确迁移回退路径的站长提供独立社区分支。**仍需维护者给出真实需求证据，并说明为何通过上游贡献无法合理满足这些需求。** 若最终只剩通用修复、依赖替换和少量配置增强，应优先贡献上游或自行分发，不能预设独立市场条目必然成立。

此前原版/Next 的受控资源加载对照在两者均复现异常，只用于判断问题边界，不是独立价值材料，也不消除实际用户影响。不能以“原主题也有”作为新申请的通过依据。

## 建议维护计划（待维护者确认）

| 方向 | 拟执行方式 | 提交前补充 |
| --- | --- | --- |
| Halo 与插件适配 | 固定支持版本，升级先跑核心页面、插件缺失/启停、生命周期和真实资源加载；再调整声明范围 | 负责人、支持版本表及实际运行结果 |
| 安全及来源 | 每次候选复查模板/URL/私密内容、依赖与素材；接收问题后修复或明确影响及处置 | 可公开的安全反馈渠道；不预先承诺未经确认的响应时限 |
| 上游同步 | 记录当前上游 SHA 和变化，区分适合回馈的通用改进与本分支特有行为，保留署名并回归 | 持续检查的负责人和节奏；贡献台账 |
| 用户支持 | 公开安装、设置、迁移、故障和已知限制；按可复现版本受理反馈 | 实际可访问的支持网址和维护能力说明 |

安装和迁移以[现有指南](MIGRATION.md)为准：Next 的主题 ID、Setting、ConfigMap 独立；转换工具仅本地生成文件，有未支持项，需要人工核对；不自动修改文章或替换原主题。市场文案必须保留这些限制。

本仓库及其 issue/PR 已公开。提交前还需复核证据链接可访问性，更新最终候选身份和截图，保留作者与第三方许可。发行材料、协议确认及正式提交另按[准备清单](APP-STORE-READINESS.md)完成。
