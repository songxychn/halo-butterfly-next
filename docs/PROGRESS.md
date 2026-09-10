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
| [图库瞬间分页 / PR #39](https://github.com/songxychn/halo-butterfly-next/pull/39) | 审查 head `888eaf0`（产品 `48a3fc11`，其后仅文档）。独立干净 worktree `pnpm verify`：53 项测试、121 文件；ZIP SHA-256 `958ec18d0dd84343cd774f672ef874cc726dd83576679f83933348add73e7696`。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34191511332) 通过。集成 `aaf96ea` 的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34245453927) 被随后 #40 推送取消，不记成功。使用插件 `prevUrl`/`nextUrl`，不关闭 PLG-04 或矩阵 `verified`。见[审查摘要](validation/2026-09-08/plugin-pagination-review.json) |
| [主题 404 / PR #40](https://github.com/songxychn/halo-butterfly-next/pull/40) | 审查 head `df13024`。独立 `pnpm verify`：53 项测试、123 文件；ZIP SHA-256 `5bbe816965f7e089ceeea6f1642d3829a1da2cbed453d04f416e9d8542a384b1`。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34191516859) 通过。集成 `0b5790d` 的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34245460152) 通过。保留真实 HTTP 404 与 Halo JSON 错误契约；Hexo `error_404.enable` 仍未映射。不关闭 PAGE-01/A11Y 全域或矩阵 `verified`。见[审查摘要](validation/2026-09-08/error-page-review.json) |
| [性能测量工具 / PR #43](https://github.com/songxychn/halo-butterfly-next/pull/43) | 审查 head `8857d1d`。非作者 explore agent（`cursor-fcid-explore`）批准合并。作者落实 Chrome 应用树 `treeSha256` pin `cd77ddc2c729ff00bb2888ffcf2d9a215442171b38a3f57489ee83d746f01c25`；体积超预算时 `PERF-03=failed`。独立/PR `pnpm verify`：65 项测试、124 文件。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34250273740) 通过。集成 `0aaacc9` 的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34251148133) 通过，记录时仍为最新 master 运行、未被后继推送取消。GitHub #35 已因 Closes 关闭。未跑 160 真实样本，不关闭 PERF-01/02/03 或矩阵 `verified`。见[审查摘要](validation/2026-09-08/performance-tool-review.json) |

截至本轮集成，矩阵仍为 897 个跟踪条目（含 387 个配置叶子）：557 待补齐、262 待平台映射、68 有实现待验、10 推进中、0 已完成全部验收。跟踪条目数量不等于独立功能数量。404 与分页已有实现，但矩阵状态尚未从 gap 提升，下一轮记录时按 `implemented-unverified` 校正，不能写成已验收。

## 2026-09-09：首页导航合入

[PR #47](https://github.com/songxychn/halo-butterfly-next/pull/47) 已合并，关闭 [#44](https://github.com/songxychn/halo-butterfly-next/issues/44)。审查/CI head `5519dd0`；合并 `d6343f6`（2026-09-09T01:39:00Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34252140952) 通过（曾 artifact 403 后重跑）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34300046974) **cancelled**，不得写成 success；后继 master `08f31b0`（#48 文档）的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34300050425) 通过。见[审查摘要](validation/2026-09-08/home-nav-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 八项矩阵 | `config:nav.fixed`、`config:nav.logo`、`config:nav.display_title`、`config:nav.display_post_title`、`config:index_top_img_height`、`config:index_site_info_top`、`interaction:sticky-nav`、`template:includes/header/nav` 升为 `implemented-unverified`，**不**标 `verified` |
| `nav.fixed` 默认 | `false` = 滚动超过导航高度后向下隐藏、向上显示，**不是**关闭吸顶；`true` 才始终吸顶可见 |
| 审查链 | explore `258c400c-f555-446f-92c3-0de5244784d5` 对 `b2bc6e4` 请求改动；`f3c7905` 修复；`5519dd0` rebase 到已合 #43 并重冻 `settingsSha256` `f87efe3716472c64156072c03c9cf914a70b60ded5e83b3a8799b33d9520af05`。同 GitHub 账户不能 Approve；无双站 lab；**不**关闭 PAGE-01 / A11Y / PERF |

截至 [#50](https://github.com/songxychn/halo-butterfly-next/pull/50) 记录时，origin/master 矩阵为 897：549 待补齐、262 待平台映射、76 有实现待验、10 推进中、0 已完成全部验收。[PR #50](https://github.com/songxychn/halo-butterfly-next/pull/50) 已合并 `57e2a7b`（2026-09-09T13:53:31Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34360015626) **cancelled**，被随后 #51 合入推送取消，不得写成 success。[#49](https://github.com/songxychn/halo-butterfly-next/issues/49) 已由 [PR #51](https://github.com/songxychn/halo-butterfly-next/pull/51) 关闭，见下节。

## 2026-09-09：文章页 post_meta 合入

[PR #51](https://github.com/songxychn/halo-butterfly-next/pull/51) 已合并，关闭 [#49](https://github.com/songxychn/halo-butterfly-next/issues/49)。审查/CI head `4ea5df9`；合并 `824c3f0`（2026-09-09T13:53:35Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34320643874) 通过（76 tests、124 文件）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34360021769) 通过（`gh run view` 等到 completed 后为 success）。独立审查为 [issue comment 5603019037](https://github.com/songxychn/halo-butterfly-next/pull/51#issuecomment-5603019037)（本会话审查，非 GitHub Approve；reviews 为空）。见[审查摘要](validation/2026-09-08/post-meta-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 五项矩阵 | `config:post_meta.post.position`、`date_type`、`categories`、`tags`、`label` 升为 `implemented-unverified`，**不**标 `verified` |
| 仍 gap / mapping-required | `config:post_meta.post.date_format` 仍 gap；`config:wordcount.*` 仍 mapping-required。字数是去标签后字符长度 / 500，**不是** hexo-wordcount |
| 审查链 | 相对 `4ea5df9`；`settingsSha256` `2ed1ac4207f1db6365a9537bb2e12a7b48810ba3844b5af18d304aa9efddb83d` 与 freeze 一致。同 GitHub 账户不能 Approve；无双站 lab；**不**关闭 PAGE-01 / POST-01 |

截至本轮记录，origin/master 矩阵为 897：544 待补齐、262 待平台映射、81 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。下一刀是 [#52](https://github.com/songxychn/halo-butterfly-next/issues/52)（列表 `post_meta.page`），尚未完成。[PR #53](https://github.com/songxychn/halo-butterfly-next/pull/53) 已合并 `529e8e3`（2026-09-09T14:03:45Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34361128098) 通过（`gh run view` 等到 completed 后为 success；该运行在 #54 合入推送前已结束，不得写成 cancelled）。[#52](https://github.com/songxychn/halo-butterfly-next/issues/52) 已由 [PR #54](https://github.com/songxychn/halo-butterfly-next/pull/54) 关闭，见下节。

## 2026-09-09：首页列表 post_meta.page 合入

[PR #54](https://github.com/songxychn/halo-butterfly-next/pull/54) 已合并，关闭 [#52](https://github.com/songxychn/halo-butterfly-next/issues/52)。审查/CI head `e018240`；合并 `3e66cb1`（2026-09-09T14:06:37Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34361068404) 通过（82 tests、124 文件）。中间 run [34361024654](https://github.com/songxychn/halo-butterfly-next/actions/runs/34361024654)（head `cd85a90`）为 **cancelled**，不记成功。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34361445833) 通过（`gh run view` 等到 completed 后为 success）。独立审查为 [issue comment 5603214002](https://github.com/songxychn/halo-butterfly-next/pull/54#issuecomment-5603214002)（本会话审查，非 GitHub Approve；reviews 为空）。见[审查摘要](validation/2026-09-08/post-meta-page-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 四项矩阵 | `config:post_meta.page.date_type`、`categories`、`tags`、`label` 升为 `implemented-unverified`，**不**标 `verified` |
| 仍 gap | `config:post_meta.page.date_format` 仍 gap。本刀不做 `relative` |
| 审查链 | 相对 `e018240`；`settingsSha256` `75e71ce2b2942457ca2be4c4c34774470ce8e9e7c2ac3041a1c36348a77efa0c` 与 freeze 一致，sourceCommit `436ab80`。同 GitHub 账户不能 Approve；无双站 lab；**不**关闭 PAGE-01 |

截至本轮记录，origin/master 矩阵为 897：540 待补齐、262 待平台映射、85 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。下一刀是 [#55](https://github.com/songxychn/halo-butterfly-next/issues/55)（封面 `cover.index_enable` / `default_cover`），尚未完成。[PR #56](https://github.com/songxychn/halo-butterfly-next/pull/56) 已合并 `8d85813`（2026-09-09T14:18:45Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34362778956) 通过（`gh run view` 等到 completed 后为 success；该运行在 #57 合入推送前已结束，不得写成 cancelled）。[#55](https://github.com/songxychn/halo-butterfly-next/issues/55) 已由 [PR #57](https://github.com/songxychn/halo-butterfly-next/pull/57) 关闭，见下节。

## 2026-09-09：首页列表封面合入

[PR #57](https://github.com/songxychn/halo-butterfly-next/pull/57) 已合并，关闭 [#55](https://github.com/songxychn/halo-butterfly-next/issues/55)。审查/CI head `49653c2`；合并 `292a0db`（2026-09-09T14:21:31Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34362582409) 通过（88 tests、124 文件）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34363081328) 通过（`gh run view` 等到 completed 后为 success）。独立审查为 [issue comment 5603436225](https://github.com/songxychn/halo-butterfly-next/pull/57#issuecomment-5603436225)（本会话审查，非 GitHub Approve；reviews 为空）。见[审查摘要](validation/2026-09-08/cover-index-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 两项矩阵 | `config:cover.index_enable`、`config:cover.default_cover` 升为 `implemented-unverified`，**不**标 `verified` |
| 仍 gap | `config:cover.aside_enable`、`config:cover.archives_enable` 仍 gap。本刀不做侧栏/归档封面 |
| 审查链 | 相对 `49653c2`；`settingsSha256` `cebd89dbf2152038734a867188e20e7b596582182d3d5bfb3cfbd71450864c66` 与 freeze 一致，sourceCommit `afd3ad2`。合入树 `tracking.pullRequests` 仍为空（P2，本记录不改矩阵）。同 GitHub 账户不能 Approve；无双站 lab；**不**关闭 PAGE-01 |

截至本轮记录，origin/master 矩阵为 897：538 待补齐、262 待平台映射、87 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。下一刀当时尚未开 issue。[PR #58](https://github.com/songxychn/halo-butterfly-next/pull/58) 已合并 `2f25831`（2026-09-09T14:30:19Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34364043076) 通过（`gh run view` 等到 completed 后为 success；该运行在 #60 合入推送前已于 2026-09-09T14:31:39Z 结束，不得写成 cancelled）。[#59](https://github.com/songxychn/halo-butterfly-next/issues/59) 已由 [PR #60](https://github.com/songxychn/halo-butterfly-next/pull/60) 关闭，见下节。

## 2026-09-09：文章页代码块工具栏合入

[PR #60](https://github.com/songxychn/halo-butterfly-next/pull/60) 已合并，关闭 [#59](https://github.com/songxychn/halo-butterfly-next/issues/59)。审查/CI head `a05107a`；合并 `f169288`（2026-09-09T14:48:05Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34365332061) 通过（93 tests、124 文件）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34366011779) 通过（`gh run view` 等到 completed 后为 success）。独立审查为 [issue comment 5603824792](https://github.com/songxychn/halo-butterfly-next/pull/60#issuecomment-5603824792)（非作者 explore，非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/code-blocks-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:code_blocks.height_limit`、`interaction:copy-code` 升为 `implemented-unverified`，**不**标 `verified` |
| 保持待验 | `config:code_blocks.copy` / `shrink` / `language` / `macStyle` 保持 `implemented-unverified`（本刀补上真实可关） |
| 仍 gap | `config:code_blocks.word_wrap`、`config:code_blocks.fullpage` 仍 gap。本刀不做这两项 |
| P2（审查已列） | `shrink=true` 默认折叠未做；`page.html` 无逐页 copy 注解；无双站。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `a05107a`；`settingsSha256` `d7f1092b6686c1c11a0f64d109caef3c2f1847cde1a6f20667b3b1cd48b39cbb` 与 freeze 一致，sourceCommit `3942fce`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：536 待补齐、262 待平台映射、89 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。下一刀是 [#61](https://github.com/songxychn/halo-butterfly-next/issues/61)（侧栏封面 `cover.aside_enable`），尚未完成。[PR #62](https://github.com/songxychn/halo-butterfly-next/pull/62) 已合并 `a382af9`（2026-09-09T14:58:16Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34367135493) 通过（`gh run view` 等到 completed 后为 success；该运行在 #63 合入推送前已于 2026-09-09T14:59:50Z 结束，不得写成 cancelled）。[#61](https://github.com/songxychn/halo-butterfly-next/issues/61) 已由 [PR #63](https://github.com/songxychn/halo-butterfly-next/pull/63) 关闭，见下节。

## 2026-09-09：侧栏最近文章与 cover.aside_enable 合入

[PR #63](https://github.com/songxychn/halo-butterfly-next/pull/63) 已合并，关闭 [#61](https://github.com/songxychn/halo-butterfly-next/issues/61)。审查/CI head `81bc030`；合并 `d11357d`（2026-09-09T15:08:48Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34367854243) 通过（98 tests、124 文件）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34368311111) 通过（`gh run view` 等到 completed 后为 success）。独立审查为 [issue comment 5604127343](https://github.com/songxychn/halo-butterfly-next/pull/63#issuecomment-5604127343)（非作者 explore，非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/cover-aside-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:cover.aside_enable`、`config:aside.card_recent_post.enable`、`limit`、`sort`、`template:includes/widget/card_recent_post` 升为 `implemented-unverified`，**不**标 `verified` |
| 仍 gap | `config:cover.archives_enable`、`config:aside.card_recent_post.sort_order` 仍 gap。本刀不做这两项。归档页 `archives.html` 目前无条件渲染封面 |
| P2（审查已列） | 无双站；`limit=0` Halo 封顶 20；`postFinder` sort 运行时未验。**不**关闭 PAGE-01 |
| 审查链 | 相对 `81bc030`；`settingsSha256` `1519fb73c5e6d54101e79946a3706b23ed49c44370bdef328bf67145df6cd41e` 与 freeze 一致，sourceCommit `a0a2600`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：531 待补齐、262 待平台映射、94 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。下一刀是 [#64](https://github.com/songxychn/halo-butterfly-next/issues/64)（归档封面 `cover.archives_enable`），尚未完成。[PR #66](https://github.com/songxychn/halo-butterfly-next/pull/66) 已合并 `5968598`（2026-09-09T15:20:56Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34369657125) 通过（`gh run view` 等到 completed 后为 success）。[#64](https://github.com/songxychn/halo-butterfly-next/issues/64) 已由 [PR #65](https://github.com/songxychn/halo-butterfly-next/pull/65) 关闭，见下节。

## 2026-09-09：归档封面 cover.archives_enable 合入

[PR #65](https://github.com/songxychn/halo-butterfly-next/pull/65) 已合并，关闭 [#64](https://github.com/songxychn/halo-butterfly-next/issues/64)。审查/CI head `14f9995`；合并 `08357ce`（2026-09-09T15:18:40Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34369023012) 通过（103 tests、124 文件）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34369407348) 通过（`gh run view` 等到 completed 后为 success；该运行在 #66 合入推送前已于 2026-09-09T15:20:17Z 结束，不得写成 cancelled）。#66 文档合入的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34369657125) 是另一条 push 运行（head `5968598`），`gh run view` 等到 completed 后为 success，不要与 34369407348 搞混。独立审查为 [issue comment 5604267368](https://github.com/songxychn/halo-butterfly-next/pull/65#issuecomment-5604267368)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/cover-archives-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | 仅 `config:cover.archives_enable` 升为 `implemented-unverified`，**不**标 `verified` |
| P2（审查已列） | 无双站；上游归档只用 `article.cover`，本实现与 list/aside 共用 `default_cover` / `random` 回退。Halo 年-月时间轴 vs 上游 article-sort 卡片。**不**关闭 PAGE-01 |
| 审查链 | 相对 `14f9995`；`settingsSha256` `3e1579d6737b4889c3973aa3977054c6490a4a138b7b5b8fc9c0fc8c79fc3d3d` 与 freeze 一致，sourceCommit `c785db5`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：530 待补齐、262 待平台映射、95 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #68](https://github.com/songxychn/halo-butterfly-next/pull/68) 已合并 `5ca97ac`（2026-09-09T15:34:07Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34371096512) 通过（`gh run view` 等到 completed 后为 success；该运行在 #69 合入推送前已于 2026-09-09T15:35:48Z 结束，不得写成 cancelled）。[#67](https://github.com/songxychn/halo-butterfly-next/issues/67) 已由 [PR #69](https://github.com/songxychn/halo-butterfly-next/pull/69) 关闭，见下节。

## 2026-09-09：代码块自动换行 code_blocks.word_wrap 合入

[PR #69](https://github.com/songxychn/halo-butterfly-next/pull/69) 已合并，关闭 [#67](https://github.com/songxychn/halo-butterfly-next/issues/67)。审查/CI head `74e3cfa`；合并 `722d461`（2026-09-09T15:41:11Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34371191835) 通过（107 tests、124 文件）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34371865455) 通过（`gh run view` 等到 completed 后为 success，completed 2026-09-09T15:42:48Z）。独立审查为 [issue comment 5604581240](https://github.com/songxychn/halo-butterfly-next/pull/69#issuecomment-5604581240)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/code-wrap-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | 仅 `config:code_blocks.word_wrap` 升为 `implemented-unverified`，**不**标 `verified` |
| 仍 gap | `config:code_blocks.fullpage`、`interaction:fullpage-code`、`interaction:collapse-code`（`shrink=true` 默认折叠）仍 gap。本刀不做这三项 |
| P2（审查已列） | 无双站；上游开启行号时编译期禁用 word_wrap，本 PR 未做该互斥。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `74e3cfa`；`settingsSha256` `9ac2d9a98da7cf9c0c60f0ec5d97e2cd88cba455649453192d185139e7d84835` 与 freeze 一致，sourceCommit `99601b2`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：529 待补齐、262 待平台映射、96 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #72](https://github.com/songxychn/halo-butterfly-next/pull/72) 已合并 `9fa055d`（2026-09-09T16:06:06Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34374585122) 通过（`gh run view` 等到 completed 后为 success；该运行在 #71 合入推送前已于 2026-09-09T16:08:25Z 结束，不得写成 cancelled）。[#70](https://github.com/songxychn/halo-butterfly-next/issues/70) 已由 [PR #71](https://github.com/songxychn/halo-butterfly-next/pull/71) 关闭，见下节。

## 2026-09-09：代码块全屏 code_blocks.fullpage 合入

[PR #71](https://github.com/songxychn/halo-butterfly-next/pull/71) 已合并，关闭 [#70](https://github.com/songxychn/halo-butterfly-next/issues/70)。审查/CI head `56d28fa`；合并 `a2d04f3`（2026-09-09T16:08:54Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34372758881) 通过（112 tests、124 文件）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34374880464) 通过（`gh run view` 等到 completed 后为 success，completed 2026-09-09T16:10:41Z）。独立审查为 [issue comment 5604925760](https://github.com/songxychn/halo-butterfly-next/pull/71#issuecomment-5604925760)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/code-fullpage-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:code_blocks.fullpage`、`interaction:fullpage-code` 升为 `implemented-unverified`，**不**标 `verified` |
| 仍 gap | `interaction:collapse-code`（`shrink=true` 默认折叠）仍 gap。本刀不做该项 |
| P2（审查已列） | 无双站；上游 `figure.highlight` + `i.fullpage-button` vs Halo `.code-toolbar` + `button`。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `56d28fa`；`settingsSha256` `1c363d87541f69057cc4bce0986d6212b6e4b2643dd5bee0a7146f22bb77814f` 与 freeze 一致，sourceCommit `32278aa`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：527 待补齐、262 待平台映射、98 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #74](https://github.com/songxychn/halo-butterfly-next/pull/74) 已合并 `81c20ec`（2026-09-09T16:17:34Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34375799081) 通过（`gh run view` 等到 completed 后为 success；该运行在 #75 合入推送前已于 2026-09-09T16:19:02Z 结束，不得写成 cancelled）。[#73](https://github.com/songxychn/halo-butterfly-next/issues/73) 已由 [PR #75](https://github.com/songxychn/halo-butterfly-next/pull/75) 关闭，见下节。

## 2026-09-10：代码块默认折叠 code_blocks.shrink 三态合入

[PR #75](https://github.com/songxychn/halo-butterfly-next/pull/75) 已合并，关闭 [#73](https://github.com/songxychn/halo-butterfly-next/issues/73)。审查/CI head `9d1df0d`；合并 `8818f31`（2026-09-10T13:01:28Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34376842281) 通过（118 tests、124 文件）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34480096038) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-10T13:02:58Z）。独立审查为 [issue comment 5606407464](https://github.com/songxychn/halo-butterfly-next/pull/75#issuecomment-5606407464)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/code-shrink-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | 仅 `interaction:collapse-code` 升为 `implemented-unverified`，**不**标 `verified` |
| 保持待验 | `config:code_blocks.shrink` 保持 `implemented-unverified`（finding 改为三态已齐） |
| 兼容 | 旧布尔 `true`→上游 `false`（展开+按钮）；`false`→`none`；新字符串 `"true"` 才初始 closed。默认 `"false"` |
| P2（审查已列） | 无双站；旧布尔在控制台可能显示异常直至重选；未映射逐页 highlight_shrink。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `9d1df0d`；`settingsSha256` `20cf238db57abce2e6cb482425a9537d35d926160549bf1c8329d765287c9c8f` 与 freeze 一致，sourceCommit `cb336f6`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：526 待补齐、262 待平台映射、99 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #77](https://github.com/songxychn/halo-butterfly-next/pull/77) 已合并 `f6d4735`（2026-09-10T13:20:14Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34482006258) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #78 合入推送前已于 2026-09-10T13:21:57Z 结束，不得写成 cancelled）。[#76](https://github.com/songxychn/halo-butterfly-next/issues/76) 已由 [PR #78](https://github.com/songxychn/halo-butterfly-next/pull/78) 关闭，见下节。

## 2026-09-10：文章与列表日期格式 post_meta.date_format 合入

[PR #78](https://github.com/songxychn/halo-butterfly-next/pull/78) 已合并，关闭 [#76](https://github.com/songxychn/halo-butterfly-next/issues/76)。审查/CI head `a80660b`；合并 `49ba69b`（2026-09-10T13:24:18Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34481406484) 通过（122 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34482431216) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-10T13:26:24Z）。独立审查为 [issue comment 5619384352](https://github.com/songxychn/halo-butterfly-next/pull/78#issuecomment-5619384352)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/date-format-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:post_meta.post.date_format`、`config:post_meta.page.date_format` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| P2（审查已列） | 无双站；相对时间粒度少于上游（无「x 个月前」/ ISO 回退）；`applyRelativeDates` 选择器略宽于上游两个容器。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `a80660b`；产品提交 `672c620` 实现 → `a3bef0c` freeze → `a80660b` 矩阵。`settingsSha256` `f3cba754755343ba599ca138deb471208b8db6c341d881b7ef4788f88716375b` 与 freeze 一致，sourceCommit `672c620`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：524 待补齐、262 待平台映射、101 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #80](https://github.com/songxychn/halo-butterfly-next/pull/80) 已合并 `da326d2`（2026-09-10T13:47:33Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34484866291) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #81 合入推送前已于 2026-09-10T13:49:04Z 结束，不得写成 cancelled）。[#79](https://github.com/songxychn/halo-butterfly-next/issues/79) 已由 [PR #81](https://github.com/songxychn/halo-butterfly-next/pull/81) 关闭，见下节。

## 2026-09-10：首页列表摘要 index_post_content 合入

[PR #81](https://github.com/songxychn/halo-butterfly-next/pull/81) 已合并，关闭 [#79](https://github.com/songxychn/halo-butterfly-next/issues/79)。审查/CI head `da84ca3`；squash 合并 `14b8b26`（2026-09-10T13:49:55Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34484449538) 通过（129 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34485114265) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-10T13:51:17Z）。独立审查为 [issue comment 5619751613](https://github.com/songxychn/halo-butterfly-next/pull/81#issuecomment-5619751613)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/index-post-content-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:index_post_content.method`、`config:index_post_content.length` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 默认与语义 | 默认 method **3**、length **500**；false 不渲染；1 仅手动摘要；2 优先手动否则截断；3 始终截断；可见文本 `th:text` |
| P2（审查已列） | 无双站；Halo `spec.excerpt.raw` 与 Hexo `description` 字段差异。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `da84ca3`；产品提交 `cdf2c2b` 实现 → `dbb5cb9` freeze → `da84ca3` 矩阵。`settingsSha256` `1851c4355a82d96524509be1904aadb4d6c3abc0ae6409d4c74ee1addc6f80dd` 与 freeze 一致，sourceCommit `cdf2c2b`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：522 待补齐、262 待平台映射、103 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #83](https://github.com/songxychn/halo-butterfly-next/pull/83) 已合并 `d638a0c`（2026-09-10T13:56:37Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34485823698) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #84 合入推送前已于 2026-09-10T13:58:22Z 结束，不得写成 cancelled）。[#82](https://github.com/songxychn/halo-butterfly-next/issues/82) 已由 [PR #84](https://github.com/songxychn/halo-butterfly-next/pull/84) 关闭，见下节。

## 2026-09-10：文章上下篇导航 post_pagination 合入

[PR #84](https://github.com/songxychn/halo-butterfly-next/pull/84) 已合并，关闭 [#82](https://github.com/songxychn/halo-butterfly-next/issues/82)。审查/CI head `d60ce9f`；squash 合并 `7d2fb24`（2026-09-10T14:08:47Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34486799104) 通过（136 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34487132013) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-10T14:10:30Z）。独立审查为 [issue comment 5620002425](https://github.com/songxychn/halo-butterfly-next/pull/84#issuecomment-5620002425)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/post-pagination-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | 仅 `config:post_pagination` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `interaction:post-pagination` 仍 gap。本刀不做该项 |
| 默认与语义 | 默认 **1**；false 不渲染；2 不对调 Hexo prev/next；否则对调。Halo previous=较早 ↔ Hexo next |
| P2（审查已列） | 无双站；悬停摘要复用 `index_post_content`。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `d60ce9f`；产品提交 `7b60f1b` 实现 → `0a13428` freeze → `d60ce9f` 矩阵。`settingsSha256` `c936eeff7d7f8a9db46a055ded555668b5d8cb017b7c782e2133317b028d72b2` 与 freeze 一致，sourceCommit `7b60f1b`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：521 待补齐、262 待平台映射、104 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #86](https://github.com/songxychn/halo-butterfly-next/pull/86) 已合并 `11f1791`（2026-09-10T14:16:26Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34487969195) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #87 合入推送前已于 2026-09-10T14:17:47Z 结束，不得写成 cancelled）。[#85](https://github.com/songxychn/halo-butterfly-next/issues/85) 已由 [PR #87](https://github.com/songxychn/halo-butterfly-next/pull/87) 关闭，见下节。

## 2026-09-10：文章过期提醒 noticeOutdate 合入

[PR #87](https://github.com/songxychn/halo-butterfly-next/pull/87) 已合并，关闭 [#85](https://github.com/songxychn/halo-butterfly-next/issues/85)。审查/CI head `03cc810`；squash 合并 `fd73d20`（2026-09-10T14:21:51Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34488204512) 通过（145 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34488562138) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-10T14:23:30Z）。独立审查为 [issue comment 5620191899](https://github.com/songxychn/halo-butterfly-next/pull/87#issuecomment-5620191899)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/notice-outdate-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | 六项 `config:noticeOutdate.*` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 mapping-required | `page-data:noticeOutdate` 仍 mapping-required。本刀不做逐页 `page.noticeOutdate` |
| 默认与语义 | 默认 enable **false**、style **flat**（该 SHA 不是 simple）、limit_day 365、position top |
| P2（审查已列） | 无双站；`noticeDiffDay` 未显式 `Math.floor`；SSR vs 上游客户端 JS；未做逐页 `page.noticeOutdate`。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `03cc810`；产品提交 `e532182` 实现 → `02c2ac7` freeze → `03cc810` 矩阵。`settingsSha256` `946d3f6cf60ee6a879624e883e40b376600f82738c1c28388ae2577a465ba4d2` 与 freeze 一致，sourceCommit `e532182`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：515 待补齐、262 待平台映射、110 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。下一刀是 [#88](https://github.com/songxychn/halo-butterfly-next/issues/88)（文章目录 `toc`），尚未完成。

## 正在推进

1. [#35 性能基线](https://github.com/songxychn/halo-butterfly-next/issues/35)：测量工具已由 [PR #43](https://github.com/songxychn/halo-butterfly-next/pull/43) 合入 master `0aaacc9`。GitHub issue 已因 Closes 关闭，但 PERF-01/02/03 合同仍不关闭；尚未跑 160 份真实采样，须集成负责人分配专属站与 CPU 窗口。P/P+ 是页面集合，不是插件安装配置。
2. M1 用户可见切片：[PR #47](https://github.com/songxychn/halo-butterfly-next/pull/47) 已合入（首页首屏与导航 logo/标题/fixed）。[PR #51](https://github.com/songxychn/halo-butterfly-next/pull/51) 已合入（文章页 `post_meta.post` 五项，不含 `date_format`）。[PR #54](https://github.com/songxychn/halo-butterfly-next/pull/54) 已合入（列表 `post_meta.page` 四项，不含 `date_format`）。[PR #57](https://github.com/songxychn/halo-butterfly-next/pull/57) 已合入（首页列表封面 `cover.index_enable` / `default_cover`，不含 aside/archives）。[PR #60](https://github.com/songxychn/halo-butterfly-next/pull/60) 已合入（文章页代码块工具栏 copy/shrink/language/macStyle/height_limit 与复制交互，不含 word_wrap/fullpage）。[PR #63](https://github.com/songxychn/halo-butterfly-next/pull/63) 已合入（侧栏最近文章与 `cover.aside_enable`，不含 `archives_enable` / `sort_order`）。[PR #65](https://github.com/songxychn/halo-butterfly-next/pull/65) 已合入（归档封面 `cover.archives_enable`）。[PR #69](https://github.com/songxychn/halo-butterfly-next/pull/69) 已合入（代码块自动换行 `code_blocks.word_wrap`，不含 fullpage / shrink=true 默认折叠）。[PR #71](https://github.com/songxychn/halo-butterfly-next/pull/71) 已合入（代码块全屏 `code_blocks.fullpage` 与 `interaction:fullpage-code`，不含 shrink=true 默认折叠）。[PR #75](https://github.com/songxychn/halo-butterfly-next/pull/75) 已合入（代码块默认折叠 `code_blocks.shrink` 三态与 `interaction:collapse-code`，不含逐页 highlight_shrink）。[PR #78](https://github.com/songxychn/halo-butterfly-next/pull/78) 已合入（文章与列表日期格式 `post_meta.date_format`，两组独立，evidence 仍 []）。[PR #81](https://github.com/songxychn/halo-butterfly-next/pull/81) 已合入（首页列表摘要 `index_post_content.method` / `length`，evidence 仍 []）。[PR #84](https://github.com/songxychn/halo-butterfly-next/pull/84) 已合入（文章上下篇 `post_pagination`，evidence 仍 []；`interaction:post-pagination` 仍 gap）。[PR #87](https://github.com/songxychn/halo-butterfly-next/pull/87) 已合入（文章过期提醒 `noticeOutdate` 六项 config，evidence 仍 []；`page-data:noticeOutdate` 仍 mapping-required）。下一刀是 [#88](https://github.com/songxychn/halo-butterfly-next/issues/88)（文章目录 `toc`），尚未完成；双站对照后才把相关矩阵项从待验推进。站点级 PAGE-01/A11Y/PERF 仍是 RC 门禁。
3. DEC-01/02/03 决策样例：搜索/评论提供方、标签语法、PWA/PJAX/生成器，用可运行双站差异提请维护者裁定；裁定前不删减矩阵分母。
4. 双站已知的其他视觉差异继续保留，见[对照初检](validation/2026-09-06/comparison-initial.json)。提供方替代、内容语法兼容等实质取舍在有具体样例后交维护者裁定。

当前截图、HTTP 通过和 alpha 包一致性均不是完整视觉、交互、无障碍或性能验收。尚未通过的真实浏览器/真机、插件联调、迁移生命周期、扩展能力与发行条件继续保持未完成。保持仓库私有；公开、历史重写及正式 1.0 发布须维护者确认。
