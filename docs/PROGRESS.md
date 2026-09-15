# 持续对齐进度

本记录对应私有仓库总任务 [#1](https://github.com/songxychn/halo-butterfly-next/issues/1)。固定目标为 Hexo Butterfly 5.7.0（`f223b1888b42b2b336068e6c959ed90a3cd7c8f3`），平台基准为 Halo 2.26.1。实际持续 Goal 于 2026-09-06 启动；本文是仓库进度记录，不代替运行中的 Goal。

工程终点由 [1.0 验收合同](RELEASE-ACCEPTANCE.md)定义；各能力状态以 [完整矩阵](parity/MATRIX.md)为准。当前尚无能力凭本轮证据被标为“已对齐 5.7.0”。

## 2026-09-06：接手与基础建设

| 项目 | 状态与证据 |
| --- | --- |
| 接手基线 | 目录与远端核验一致：master `bbc1ebe5c5726cf36f52949455e1a97120637cac`，工作区干净，GitHub 私有，无遗留 open issue/PR |
| 构建基线 | Node 24.19.0 / pnpm 11.19.0，固定锁文件安装、6 项迁移测试、构建与 117 文件安装包检查通过；ZIP SHA-256 `92e7bfeff60a753aeef2cbcd57f1d148e5f589e5fd3b6df3eec27944b836800a`，与已发布 alpha 一致 |
| 隔离旧站复验 | 复制合成数据后独立启动，不改原数据库；10 路由、25 资源通过；无头 Chrome 390×844 文章无横向溢出，菜单开关与 Escape 关闭通过，见 [基线摘要](validation/2026-09-06/baseline.json) |
| 工程验收合同 | [PR #6](https://github.com/songxychn/halo-butterfly-next/pull/6)，作者 `/root/acceptance_contract`，独立审查 `/root`；审查 SHA `e7ea6b7b25182ddb3321c0a1c0ad5c60020c2048`，对应 [PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34037703810) 通过；合并 SHA `77e48d10d4914ed5e6af6442d58a133cd9bc48f4`，[合并后 CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34037791145) 通过；集成 diff 确认主题构建输入未变 |
| 功能矩阵 | [PR #9](https://github.com/songxychn/halo-butterfly-next/pull/9) 已合并，897/897 覆盖、17 测试通过；独立审查 `/root/acceptance_contract`，审查 SHA `8d49cac58e3ccc04eaed9b3776c902b4001b898a` 与 [PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34038371720) 一致；合并 SHA `422c3b6d2ca8495e57534649a7641e0fd2956ae0`，树与审查 head 相同，[master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34038480390) 通过。564 待实现、263 待平台映射、70 有相关实现待验证、0 已验收 |
| 双站夹具 | [PR #10](https://github.com/songxychn/halo-butterfly-next/pull/10) 已合并，作者 `/root/comparison_lab`、独立审查 `/root`；审查 SHA `f625b244201e976739f36b393be9ff9f8b98fc6a`，[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34038803451) 与合并 SHA `45e54b467f43475695943c4f433b0bb4956867d5` 的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34038907722) 通过；15 项 Python 保护测试、20 条双站路由、4 个共享资源、分类标签全集与 API 菜单检查通过。合并后真实截图发现页面主菜单为空，曾重新打开 [#3](https://github.com/songxychn/halo-butterfly-next/issues/3)；后续修复和复验见下表，视觉与完整浏览器验收仍未完成 |

当前席位由会话实际运行额度动态分配；这次运行提供 4 席（含主 agent），不将此数字固化为项目上限。开发使用独立 worktree，作者不完成自己的独立审查；共享测试站由集成负责人串行变更。

## 2026-09-06：第一轮修复与执行门禁

| 项目 | 状态与证据 |
| --- | --- |
| 默认与 CI 门禁 | [PR #11](https://github.com/songxychn/halo-butterfly-next/pull/11) 已合并；作者 `/root`，独立审查 `/root/acceptance_contract`，精确 head `465ed836fdf862df6e0c4c0563d1d6025646a0fa` 在独立快照通过 18 Node / 15 Python、117 文件包和固定上游 897/897；[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34039240247) 通过，合并 SHA `41b21fc4da7cc0866a38781010b15e995f15eb6d` |
| 双站菜单复验 | 初检发现菜单为空后，重新打开 #3，由 [PR #13](https://github.com/songxychn/halo-butterfly-next/pull/13) 修复 MenuItem.spec.menuName；作者 `/root/comparison_lab`，root 独立审查精确 head `f0af0d26f2a9431c4ba809787d766d1e0dd8c363`，20 路由的桌面/侧栏各 5 项导航通过，[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34039312907) 通过；集成 SHA `38cca3c5005a4d40fe8c890f55886a6332a72819` 的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34039397713) 通过，见[菜单摘要](validation/2026-09-06/comparison-menus.json) |
| 公共布局探针 | [PR #12](https://github.com/songxychn/halo-butterfly-next/pull/12) 已合并；作者 `/root/acceptance_contract`、独立审查 `/root`，精确 head `3c25f3c4f37f71437b792c9d85eb5821331294c6`；[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34039301955) 通过，合并 SHA `6f07d721e74961ea7a44434d40a9b5ebe634c562`。独立重建 JAR 及真实安装/启停/卸载/重装通过，见[审查摘要](validation/2026-09-06/layout-probe-review.json)。当时主题仍 MISSING，只完成夹具，不关闭 PLG-05 |
| 页脚署名无障碍 | [PR #15](https://github.com/songxychn/halo-butterfly-next/pull/15) 已合并；作者 `/root/parity_matrix`，独立审查 `/root`；精确 head `7f647fe38f4a54ed60f5ed831b297579f3fc57d8` 与 [PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34039505592) 一致；合并 SHA `43a902dfa5462de817ddb140451d59bcdff02d0d`。四种视口/模式页脚 axe 均零违规和零未决，8 次真实键盘焦点复验通过，安装包 `11819367c7793238bf628951ab1f16b0adab0c6769a756a7b9c74c823d7bc79d`，见[范围与证据](validation/2026-09-06/footer-a11y.json) |

连续集成使 PR #11、#12 的中间 master 运行被后继推送取消，记录为已取代，不记成功。共同集成树 `38cca3c` 已通过上述 master CI；页脚集成 `43a902d` 的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34039661564) 通过。各 PR 均在自身提交审查和 CI 通过后合并。

## 2026-09-06：公共布局、交互修复与浏览器基础

以下 PR 均在精确提交独立审查和对应 CI 通过后合并。组件提交、包摘要、验证范围和可定位原始结构化报告见[组件证据索引](validation/2026-09-06/alpha-2-components.json)。这些是限定范围的修复验收，尚不关闭相关矩阵条目的全部验收合同。

| 项目 | 结果 |
| --- | --- |
| [公共布局 PR #19](https://github.com/songxychn/halo-butterfly-next/pull/19) | `274589a`：真实插件显式/空 head、8 种页面状态、6 步生命周期、全局注入一次及核心 HTTP 回归通过；支持状态为 SUPPORTED。生态插件组合继续验证 |
| [字幕 PR #20](https://github.com/songxychn/halo-butterfly-next/pull/20) | `e7c24ec`：启用/效果开关、静态首项、API 失败回退及旧配置兼容；独立 13 场景、52 视图、28 张稳定截图通过。上游来源枚举和 typed_option 全参数仍未补齐 |
| [图表构建 PR #22](https://github.com/songxychn/halo-butterfly-next/pull/22) | `a2bff3c`：浏览器包固定生产环境，包门禁拒绝未解析 Node 环境引用；独立归档/分类/标签共 12 状态统计图实际绘制、两个门禁反例通过 |
| [浏览器工具 PR #24](https://github.com/songxychn/halo-butterfly-next/pull/24) | `c1ef1ed`：固定三种独立引擎，9 项保护测试；原产品 120 页基线明确失败于图表/光标问题。最终工具在修复候选的独立 Chromium 40 页通过，正确将遗漏另外两引擎记为 incomplete，不冒充完整合同通过 |
| [光标资源 PR #26](https://github.com/songxychn/halo-butterfly-next/pull/26) | `546c558`：当前主题资源地址供不同样式表共享；独立 6 类页面光标请求和 120 个安装文件一致性通过 |
| [导航 PR #27](https://github.com/songxychn/halo-butterfly-next/pull/27) | `98853f3`：两级键盘入口、抽屉焦点及响应式恢复；独立审查修复两处 P2 后，36 项工程测试、82 条实际浏览器断言及空菜单/恢复验证通过。默认展开、长菜单及桌面对比度人工判断仍保留 |

## 2026-09-08：alpha.2 发布与后续集成

以下记录关联精确审查提交、PR 和合并后 CI；机器可读摘要及原始审查报告见[交付索引](validation/2026-09-08/delivery-index.json)。

| 项目 | 结果与边界 |
| --- | --- |
| [私有 alpha.2 / PR #31](https://github.com/songxychn/halo-butterfly-next/pull/31) | 已发布[私有预览包](https://github.com/songxychn/halo-butterfly-next/releases/tag/v0.1.0-alpha.2)，tag 指向 `3e603fa`。独立审查 head `3e659f6`，PR、master、tag CI 均通过；本机与独立审查者重新下载的 ZIP、摘要文件、发行验证 JSON 均与冻结附件一致。ZIP SHA-256 `a1bbbb13fa61c07e9500fc228941b4e9d759f0f1d1bc042c22621a5d55afaa42`，120 文件。覆盖三引擎 120 页、导航 74 条、公共布局 8 状态/6 步生命周期及真实已发布 alpha.1 缓存升级、回退、恢复。旧配置和内容原值保留，升级只补入两个已声明的字幕默认字段 |
| [侧栏按钮 / PR #34](https://github.com/songxychn/halo-butterfly-next/pull/34) | `db2d36f` 独立通过 12 状态，局部 axe 零违规、零未决，最低文字和焦点环对比度 4.89；单个原生链接保留地址和打开方式，键盘不再重复进入嵌套按钮。集成 `a10eb34`；此验收限于欢迎按钮 |
| [新站初始化重试 / PR #36](https://github.com/songxychn/halo-butterfly-next/pull/36) | `47bec9b` 独立通过 24 项 Python / 46 项 Node、6 项额外故障反例。仅初始化关闭插件时发生 409 才重新读版本并有限重试，最多 4 次 PUT；其他错误直接报出。实际新站首次写入 13 个夹具对象，再次运行不写入，配置与标记保留；实际新站未观测到 409，冲突分支证据来自离线注入。集成 `93083dd` |
| [P+ 双站工具 / PR #37](https://github.com/songxychn/halo-butterfly-next/pull/37) | `d072d5b` 经独立审查和 CI 合并为 `3a299ea`。固定 Links 2.3.0、Photos 2.1.2、Moments 1.18.0，建立空数据、正常、多页及停用/恢复验证，并逐页核对 API 内容、顺序和资源。首次独立审查发现当前页误判，修复并补负例后通过。原产品基线仍有 12 项分页缺口；另一次 Hexo 动画稳定性失败及后续两次通过均保留原记录。这里只交付工具，不把诊断结果改写为完整插件合同通过 |

截至本轮集成，矩阵仍为 897 个跟踪条目（含 387 个配置叶子）：557 待补齐、262 待平台映射、68 有实现待验、10 推进中、0 已完成全部验收。跟踪条目数量不等于独立功能数量。

## 正在推进

1. [#30 404 页面](https://github.com/songxychn/halo-butterfly-next/issues/30)：对照固定上游的卡片布局、字体和间距，验证默认、自定义、空白、图片失败和长文本配置，随后完成精确提交独立审查与 CI。
2. [#32 图库与瞬间分页](https://github.com/songxychn/halo-butterfly-next/issues/32)：为服务端分页补齐原生上一页/下一页，保留插件提供的分组、标签及每页数量参数；在 P+ 双站和多页筛选夹具中验证后独立审查。
3. [#35 性能基线](https://github.com/songxychn/halo-butterfly-next/issues/35)：固定工具、浏览器、机器与原始样本；分别以默认和推荐配置运行首页、长文章、图库和公共插件页，并与冻结基线比较。P/P+ 是页面集合，不是插件安装配置。
4. 双站已知的其他视觉差异继续保留，见[对照初检](validation/2026-09-06/comparison-initial.json)。DEC-01 已按选项 2 裁定（[#46](https://github.com/songxychn/halo-butterfly-next/issues/46)）：1.0 搜索/评论以官方插件为唯一主题支持面。继续从完整矩阵提取工作；DEC-02 等内容语法取舍仍须有具体样例后再交维护者裁定。

当前截图、HTTP 通过和 alpha 包一致性均不是完整视觉、交互、无障碍或性能验收。尚未通过的真实浏览器/真机、插件联调、迁移生命周期、扩展能力与发行条件继续保持未完成。保持仓库私有；公开、历史重写及正式 1.0 发布须维护者确认。
