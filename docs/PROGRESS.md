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

截至本轮记录，origin/master 矩阵为 897：515 待补齐、262 待平台映射、110 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #89](https://github.com/songxychn/halo-butterfly-next/pull/89) 已合并 `bd8cca6`（2026-09-10T14:28:18Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34489276801) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #90 合入推送前已于 2026-09-10T14:29:58Z 结束，不得写成 cancelled）。[#88](https://github.com/songxychn/halo-butterfly-next/issues/88) 已由 [PR #90](https://github.com/songxychn/halo-butterfly-next/pull/90) 关闭，见下节。

## 2026-09-11：文章目录 toc.number / expand / style_simple / scroll_percent 合入

[PR #90](https://github.com/songxychn/halo-butterfly-next/pull/90) 已合并，关闭 [#88](https://github.com/songxychn/halo-butterfly-next/issues/88)。审查/CI head `9488cdb`；squash 合并 `d56f3f9`（2026-09-10T22:48:56Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34531127896) 通过（151 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34539263348) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-10T22:50:17Z）。独立审查为 [issue comment 5626309560](https://github.com/songxychn/halo-butterfly-next/pull/90#issuecomment-5626309560)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/toc-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:toc.number`、`config:toc.expand`、`config:toc.style_simple`、`config:toc.scroll_percent` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 保持待验 | `config:toc.post` / `config:toc.page` 保持 `implemented-unverified`，本刀未改 |
| 默认与语义 | 默认 number **true**、expand **false**、style_simple **false**、scroll_percent **true**；序号 `1.` / `1.1.`；百分比 `textContent`；仅文章页 |
| P2（审查已列） | 无双站；Halo 文章侧栏本就只有 toc + recentPost；`getScrollPercent` 无上游尺寸缓存；百分比节点 `th:if`。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `9488cdb`；产品提交 `82ce481` 实现 → `03f8e28` freeze → `9488cdb` 矩阵。`settingsSha256` `f6335ec6281b437605ac8daad1a94c37f0d183a7f2a436e320b378c6114516b4` 与 freeze 一致，sourceCommit `82ce481`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：511 待补齐、262 待平台映射、114 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #92](https://github.com/songxychn/halo-butterfly-next/pull/92) 已合并 `552faed`（2026-09-11T01:30:10Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34550922081) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #93 合入推送前已于 2026-09-11T01:31:54Z 结束，不得写成 cancelled）。[#91](https://github.com/songxychn/halo-butterfly-next/issues/91) 已由 [PR #93](https://github.com/songxychn/halo-butterfly-next/pull/93) 关闭，见下节。

## 2026-09-11：相关文章 related_post.enable / limit / date_type 合入

[PR #93](https://github.com/songxychn/halo-butterfly-next/pull/93) 已合并，关闭 [#91](https://github.com/songxychn/halo-butterfly-next/issues/91)。审查/CI head `0800538`；squash 合并 `cc0e7ec`（2026-09-11T06:39:16Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34569515157) 通过（157 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34570852163) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-11T06:40:57Z）。独立审查为 [issue comment 5630370230](https://github.com/songxychn/halo-butterfly-next/pull/93#issuecomment-5630370230)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/related-post-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:related_post.enable`、`config:related_post.limit`、`config:related_post.date_type` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `helper:related_posts`、`interaction:related`、`style:source/css/_layout/relatedposts.styl` 仍 gap |
| 默认与语义 | 默认 enable **true**、limit **6**、date_type **created**；关闭或无标签不渲染；created 显示发布时间，其余显示更新时间 |
| P2（审查已列） | 无双站；Halo `listByTag` 顺序去重截断 vs 上游 Map 加权 + random。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `0800538`；产品提交 `9c9f36a` 实现 → `f4be559` freeze → `0800538` 矩阵。`settingsSha256` `011b93b49c07df37bb75b3a40977e966e3b368f85a59e2cc272fec61fbf94d3a` 与 freeze 一致，sourceCommit `9c9f36a`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：508 待补齐、262 待平台映射、117 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #98](https://github.com/songxychn/halo-butterfly-next/pull/98) 已合并 `2fcffc0`（2026-09-11T15:02:56Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34613787870) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #99 合入推送前已于 2026-09-11T15:04:35Z 结束，不得写成 cancelled）。[#97](https://github.com/songxychn/halo-butterfly-next/issues/97) 已由 [PR #99](https://github.com/songxychn/halo-butterfly-next/pull/99) 关闭，见下节。


## 2026-09-11：页脚 footer.owner / copyright / custom_text 合入

[PR #99](https://github.com/songxychn/halo-butterfly-next/pull/99) 已合并，关闭 [#97](https://github.com/songxychn/halo-butterfly-next/issues/97)。审查/CI head `3d48beb`；squash 合并 `c7a00e3`（2026-09-11T15:17:28Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34614811486) 通过（163 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34615248697) 通过（`gh run watch` 等到 completed 后为 **success**，completed 2026-09-11T15:19:09Z）。独立审查为 [issue comment 5636594469](https://github.com/songxychn/halo-butterfly-next/pull/99#issuecomment-5636594469)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/footer-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:footer.owner.enable`、`config:footer.owner.since`、`config:footer.copyright.enable`、`config:footer.copyright.version`、`config:footer.custom_text` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `config:footer.nav`、`config:footer_img`、`template:includes/footer`、`style:source/css/_layout/footer.styl` 仍 gap |
| 默认与语义 | 默认 owner.enable **true**、since **2025**、copyright.enable **true**、copyright.version **true**、custom_text **空**；关闭不渲染对应块；since 与当前年不同才显示区间；可见文本 `th:text` |
| P2（审查已列） | 无双站；作者行用 `site.title`（上游 `config.author`）。**不**关闭 POST-01 / PAGE-01 / A11Y / PERF |
| 审查链 | 相对 `3d48beb`；产品提交 `6f1d3e5` 实现 → `50761b2` freeze → `3d48beb` 矩阵。`settingsSha256` `158c485e62f64caf61e9d044de4d596507e74e6d64347e4dda1f8521d570a17c` 与 freeze 一致，sourceCommit `6f1d3e5`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：503 待补齐、262 待平台映射、122 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #100](https://github.com/songxychn/halo-butterfly-next/pull/100) 已合并 `de6d92d`（2026-09-11T15:25:11Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34616009598) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #101 合入推送前已于 2026-09-11T15:26:57Z 结束，不得写成 cancelled）。[#94](https://github.com/songxychn/halo-butterfly-next/issues/94) 已由 [PR #101](https://github.com/songxychn/halo-butterfly-next/pull/101) 关闭，见下节。

## 2026-09-11：打赏 reward.enable / text / QR_code 合入

[PR #101](https://github.com/songxychn/halo-butterfly-next/pull/101) 已合并，关闭 [#94](https://github.com/songxychn/halo-butterfly-next/issues/94)。审查/CI head `f432ee5`；squash 合并 `14546fd`（2026-09-11T15:37:01Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34616685828) 通过（167 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34617184918) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-11T15:38:46Z）。独立审查为 [issue comment 5636858163](https://github.com/songxychn/halo-butterfly-next/pull/101#issuecomment-5636858163)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/reward-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:reward.enable`、`config:reward.text`、`config:reward.QR_code` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap / mapping-required | `template:includes/post/reward`、`interaction:reward`、`style:source/css/_layout/reward.styl` 仍 gap；`data-schema:reward-items` 仍 mapping-required |
| 默认与语义 | 默认 enable **false**、text **空**、QR_code **空列表**；仅显式开启且二维码非空才渲染；空 text 显示「打赏」；仅文章页 |
| P2（审查已列） | 无双站；CI 评论时仍 pending；空 img 项被过滤。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `f432ee5`；产品提交 `35c6267` 实现 → `e278331` freeze → `f432ee5` 矩阵。`settingsSha256` `9a5d9c7e13cc7805a4194067db5422e6b5930f11747a1b9a16807b96b8e42ea6` 与 freeze 一致，sourceCommit `35c6267`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：500 待补齐、262 待平台映射、125 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #104](https://github.com/songxychn/halo-butterfly-next/pull/104) 已合并 `fb79720`（2026-09-11T15:52:25Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34618697437) 通过（`gh run watch` 等到 completed 后为 **success**；2026-09-11T15:54:15Z）。[#103](https://github.com/songxychn/halo-butterfly-next/pull/103) 合入提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34618517520) 已于 2026-09-11T15:51:54Z **success**（在 #104 合入推送 15:52:25Z 之前结束，不得写成 cancelled）。[#102](https://github.com/songxychn/halo-butterfly-next/issues/102) 已由 [PR #103](https://github.com/songxychn/halo-butterfly-next/pull/103) 关闭，见下节。

## 2026-09-11：文章版权 post_copyright.enable / decode / author_href / license 合入

[PR #103](https://github.com/songxychn/halo-butterfly-next/pull/103) 已合并，关闭 [#102](https://github.com/songxychn/halo-butterfly-next/issues/102)。审查/CI head `cc26eb1`；squash 合并 `50c18c3`（2026-09-11T15:50:31Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34617914061) 通过（172 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34618517520) 通过（`gh run watch` 等到 completed 后为 **success**，completed 2026-09-11T15:51:54Z，早于 #104 合入，不得写成 cancelled）。独立审查为 [issue comment 5637024582](https://github.com/songxychn/halo-butterfly-next/pull/103#issuecomment-5637024582)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/post-copyright-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:post_copyright.decode`、`config:post_copyright.author_href` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 保持待验 | `config:post_copyright.enable` / `license` / `license_url` 原为硬编码 IU，本刀补真实设置，仍 IU |
| 仍 gap | `template:includes/post/post-copyright` 仍 gap |
| 默认与语义 | 默认 enable **true**、decode **false**、author_href **空**、license **CC BY-NC-SA 4.0**；仅显式关闭 enable 才不渲染；permalink 默认不 decodeURI |
| P2（审查已列） | 无双站；未做逐页 `page.copyright`。**不**关闭 POST-01 / PAGE-01 |
| 审查链 | 相对 `cc26eb1`；产品提交 `5c8ace2` 实现 → `e28f6c4` freeze → `cc26eb1` 矩阵。`settingsSha256` `0403aeeced077e21d50dabd284323134cf890c399d4844d8948f2dac0eddd189` 与 freeze 一致，sourceCommit `5c8ace2`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：498 待补齐、262 待平台映射、127 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #106](https://github.com/songxychn/halo-butterfly-next/pull/106) 已合并 `00ffcbb`（2026-09-11T16:00:15Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34619443777) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #107 合入推送前已于 2026-09-11T16:01:51Z 结束，不得写成 cancelled）。[#105](https://github.com/songxychn/halo-butterfly-next/issues/105) 已由 [PR #107](https://github.com/songxychn/halo-butterfly-next/pull/107) 关闭，见下节。


## 2026-09-11：页脚导航 footer.nav 合入

[PR #107](https://github.com/songxychn/halo-butterfly-next/pull/107) 已合并，关闭 [#105](https://github.com/songxychn/halo-butterfly-next/issues/105)。审查/CI head `4032c18`；squash 合并 `483d6e8`（2026-09-11T16:04:47Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34619319456) 通过（173 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34619904123) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-11T16:06:25Z）。独立审查为 [issue comment 5637206619](https://github.com/songxychn/halo-butterfly-next/pull/107#issuecomment-5637206619)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/footer-nav-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:footer.nav` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `config:footer_img`、`template:includes/footer`、`style:source/css/_layout/footer.styl` 仍 gap |
| 默认与语义 | 默认 **空列表** 不渲染；本刀为 `title` + `url` 扁平链接，不做嵌套列、width、html 子项；可见文本 `th:text` / `th:href` |
| P2（审查已列） | 平坦 vs 上游嵌套列为本刀取舍；无双站；模板 `#strings.isEmpty` 不 trim，与 JS `visibleNavItems` 不完全同构；矩阵 PR 号写在 `tracking.prs` 而非惯例 `pullRequests`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `4032c18`；产品提交 `f54ffc5` 实现 → `741bdc0` freeze → `4032c18` 矩阵。`settingsSha256` `4b5a0bca49b2bdbcb910e4dd8adbd7bf5a6b93411533e4143c7fa1585cabccc0` 与 freeze 一致，sourceCommit `f54ffc5`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：497 待补齐、262 待平台映射、128 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #109](https://github.com/songxychn/halo-butterfly-next/pull/109) 已合并 `d8517cb`（2026-09-11T16:15:03Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34620899862) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #110 合入推送前已于 2026-09-11T16:16:47Z 结束，不得写成 cancelled）。[#108](https://github.com/songxychn/halo-butterfly-next/issues/108) 已由 [PR #110](https://github.com/songxychn/halo-butterfly-next/pull/110) 关闭，见下节。


## 2026-09-11：页脚背景 footer_img 合入

[PR #110](https://github.com/songxychn/halo-butterfly-next/pull/110) 已合并，关闭 [#108](https://github.com/songxychn/halo-butterfly-next/issues/108)。审查/CI head `0bb47b9`；squash 合并 `a348cb6`（2026-09-11T16:26:04Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34621342739) 通过（174 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34621964381) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-11T16:27:33Z）。独立审查为 [issue comment 5637462466](https://github.com/songxychn/halo-butterfly-next/pull/110#issuecomment-5637462466)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/footer-img-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:footer_img` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `config:mask.footer`、`template:includes/footer`、`style:source/css/_layout/footer.styl` 仍 gap |
| 默认与语义 | 上游顶层默认 **false**；Halo `footer.footer_img` 空字符串视为 false，不套背景；非空 URL 用 `th:style` 写 `background-image` |
| P2（审查已列） | 不做 `true`=复用页头 `top_img`；不做 `mask.footer`；`th:style` `url('${footerImg}')` 属性内 CSS 注入风险；helper 宽于模板；`#strings.isEmpty` 不 trim。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `0bb47b9`；产品提交 `a9c5a9d` 实现 → `b8bdcd2` freeze → `0bb47b9` 矩阵。`settingsSha256` `6d413b07f427a3d2549c197a649edf62d08184ac638fd1b5d8a3b41d91646955` 与 freeze 一致，sourceCommit `a9c5a9d`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：496 待补齐、262 待平台映射、129 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #112](https://github.com/songxychn/halo-butterfly-next/pull/112) 已合并 `550b6e1`（2026-09-11T16:32:29Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34622584621) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #113 合入推送前已于 2026-09-11T16:34:04Z 结束，不得写成 cancelled）。[#111](https://github.com/songxychn/halo-butterfly-next/issues/111) 已由 [PR #113](https://github.com/songxychn/halo-butterfly-next/pull/113) 关闭，见下节。


## 2026-09-11：页脚遮罩 mask.footer 合入

[PR #113](https://github.com/songxychn/halo-butterfly-next/pull/113) 已合并，关闭 [#111](https://github.com/songxychn/halo-butterfly-next/issues/111)。审查/CI head `3ff1c8b`；squash 合并 `bd95a74`（2026-09-11T16:39:28Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34622822776) 通过（175 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34623257381) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-11T16:41:13Z）。独立审查为 [issue comment 5637624114](https://github.com/songxychn/halo-butterfly-next/pull/113#issuecomment-5637624114)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/mask-footer-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:mask.footer` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `config:mask.header`、`template:includes/footer`、`style:source/css/_layout/footer.styl` 仍 gap |
| 默认与语义 | 默认 **true**；仅显式 false 关闭；仅当 `footer_img` 非空时加 `footer--mask` `:before` 遮罩 |
| P2（审查已列） | `--footer-mask-bg` 未接上游 `--mark-bg`；多了 `pointer-events` / `inset` / `z-index: 1`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `3ff1c8b`；产品提交 `0a9a24e` 实现 → `ebffcb4` freeze → `3ff1c8b` 矩阵。`settingsSha256` `3b98aec0f6e7cc0837674e4dba623bf795a4d66031bba963ed2a4a44b8e2964d` 与 freeze 一致，sourceCommit `0a9a24e`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：495 待补齐、262 待平台映射、130 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #115](https://github.com/songxychn/halo-butterfly-next/pull/115) 已合并 `29aa7f5`（2026-09-11T16:49:25Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34624198389) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #116 合入推送前已于 2026-09-11T16:51:14Z 结束，不得写成 cancelled）。[#114](https://github.com/songxychn/halo-butterfly-next/issues/114) 已由 [PR #116](https://github.com/songxychn/halo-butterfly-next/pull/116) 关闭，见下节。


## 2026-09-11：页头遮罩 mask.header 合入

[PR #116](https://github.com/songxychn/halo-butterfly-next/pull/116) 已合并，关闭 [#114](https://github.com/songxychn/halo-butterfly-next/issues/114)。审查/CI head `9388bc4`；squash 合并 `e95cd52`（2026-09-11T16:58:39Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34624382593) 通过（178 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34625061731) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-11T17:00:24Z）。独立审查为 [issue comment 5637836341](https://github.com/songxychn/halo-butterfly-next/pull/116#issuecomment-5637836341)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/mask-header-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:mask.header` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `config:aside.hide`、`config:aside.mobile`、`config:aside.button`、`template:includes/footer`、`style:source/css/_layout/footer.styl` 仍 gap |
| 默认与语义 | 默认 **true**；仅显式 false 关闭；有第一屏 `.above` 时给页头加 `:before` 遮罩，对齐 `:not(.not-top-img)`；无第一屏不加 |
| P2（审查已列） | 组注释仍写「本刀不含 mask.header」；plugin 壳 `src/html/layout.html` 未挂 `mask-header`（该页无 `.above`）。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `9388bc4`；产品提交 `8beb909` 实现 → `a211ec5` freeze → `9388bc4` 矩阵。`settingsSha256` `858c4cefccdf6167be0c914bf8080a1fe67dc221965779b791543ee4c816443a` 与 freeze 一致，sourceCommit `8beb909`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：494 待补齐、262 待平台映射、131 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #118](https://github.com/songxychn/halo-butterfly-next/pull/118) 已合并 `4bd90a9`（2026-09-11T17:15:02Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34626616737) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #119 合入推送前已于 2026-09-11T17:16:33Z 结束，不得写成 cancelled）。[#117](https://github.com/songxychn/halo-butterfly-next/issues/117) 已由 [PR #119](https://github.com/songxychn/halo-butterfly-next/pull/119) 关闭，见下节。


## 2026-09-11：侧栏隐藏 aside.hide 合入

[PR #119](https://github.com/songxychn/halo-butterfly-next/pull/119) 已合并，关闭 [#117](https://github.com/songxychn/halo-butterfly-next/issues/117)。审查/CI head `2e12a3d`；squash 合并 `3a75647`（2026-09-11T20:19:37Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34639883961) 通过（181 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34643616207) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-11T20:21:19Z）。独立审查为 [issue comment 5639976908](https://github.com/songxychn/halo-butterfly-next/pull/119#issuecomment-5639976908)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/aside-hide-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:aside.hide` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `config:aside.mobile`、`config:aside.button`、`interaction:hide-aside`、`template:includes/footer`、`style:source/css/_layout/footer.styl` 仍 gap |
| 默认与语义 | 默认 **false**；仅显式 true 给 `html` 加 `hide-aside`；须 `aside.enable`；桌面 `min-width: 900px` 隐藏 `.aside`、主栏约 80%。**必须**用新键 `aside.hide`，禁止复用作者卡片 `aside.button` |
| P2（审查已列） | 900–1100px 既有 `#Butterfly .main` 规则 specificity 更高，主栏宽度可能是 100% 而非上游 80%；侧栏仍 `display: none`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `2e12a3d`；产品提交 `269c330` 实现 → `619cbdb` freeze → `2e12a3d` 矩阵。`settingsSha256` `4f12c414dded21a7502bbae028fa50466e1aed8f94c7fa4963af694d655fb5c9` 与 freeze 一致，sourceCommit `269c330`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：493 待补齐、262 待平台映射、132 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #121](https://github.com/songxychn/halo-butterfly-next/pull/121) 已合并 `57d7b65`（2026-09-12T02:20:14Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34667378940) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #122 合入推送前已于 2026-09-12T02:21:57Z 结束，不得写成 cancelled）。[#120](https://github.com/songxychn/halo-butterfly-next/issues/120) 已由 [PR #122](https://github.com/songxychn/halo-butterfly-next/pull/122) 关闭，见下节。

## 2026-09-12：侧栏移动端 aside.mobile 合入

[PR #122](https://github.com/songxychn/halo-butterfly-next/pull/122) 已合并，关闭 [#120](https://github.com/songxychn/halo-butterfly-next/issues/120)。审查/CI head `1b2b62a`；squash 合并 `bd8fe50`（2026-09-12T04:03:43Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34669363000) 通过（184 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34672008283) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T04:05:32Z）。独立审查为 [issue comment 5643333401](https://github.com/songxychn/halo-butterfly-next/pull/122#issuecomment-5643333401)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/aside-mobile-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:aside.mobile` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `config:aside.button`、`interaction:hide-aside`、`template:includes/footer`、`style:source/css/_layout/footer.styl` 仍 gap |
| 默认与语义 | 默认 **true**；仅显式 false 给 `html` 加 `aside-mobile-off`；须 `aside.enable`；窄屏 `max-width: 768px` 隐藏非目录侧栏卡片。**必须**用新键 `aside.mobile`，禁止复用作者卡片 `aside.button` |
| P2（审查已列） | `aside.hide` 注释仍写「不做 aside.mobile」；`aside-hide` 测试不再锚定完整 `th:classappend`。无双站 / 390 证据。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `1b2b62a`；产品提交 `1ddc9f4` 实现 → `8a9b1f4` freeze → `1b2b62a` 矩阵。`settingsSha256` `a8d86806c83fba7d136793fa0ad0f4aec586d7fe43413b37f23dfd26268e37ad` 与 freeze 一致，sourceCommit `1ddc9f4`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：492 待补齐、262 待平台映射、133 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #124](https://github.com/songxychn/halo-butterfly-next/pull/124) 已合并 `7ba114d`（2026-09-12T04:15:02Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34672505309) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #125 合入推送前已于 2026-09-12T04:16:44Z 结束，不得写成 cancelled）。[#123](https://github.com/songxychn/halo-butterfly-next/issues/123) 已由 [PR #125](https://github.com/songxychn/halo-butterfly-next/pull/125) 关闭，见下节。

## 2026-09-12：侧栏隐藏开关 aside.hide_button 合入

[PR #125](https://github.com/songxychn/halo-butterfly-next/pull/125) 已合并，关闭 [#123](https://github.com/songxychn/halo-butterfly-next/issues/123)。审查/CI head `e31ceab`；squash 合并 `e12e2ea`（2026-09-12T04:30:29Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34672870827) 通过（187 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34673184345) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T04:31:42Z）。独立审查为 [issue comment 5643458765](https://github.com/songxychn/halo-butterfly-next/pull/125#issuecomment-5643458765)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/aside-hide-button-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:aside.button`、`interaction:hide-aside` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `template:includes/footer`、`style:source/css/_layout/footer.styl`、`template:includes/rightside`、`style:source/css/_layout/rightside.styl` 仍 gap |
| 默认与语义 | 默认 **true**；仅显式 false 不渲染 `#hide-aside-btn`；须 `aside.enable`；点击切换 `html.hide-aside`，`localStorage aside-status` TTL 2 天。**必须**用新键 `aside.hide_button`，禁止复用作者卡片 `aside.button` |
| P2（审查已列） | 按钮挂在已有 `.side-btn`（滚动后才 `.active`），不是完整 `#rightside`；上游默认藏在齿轮后、且 `max-width: 900px` 隐藏按钮，Halo 未对齐；无逐页 `page.aside`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `e31ceab`；产品提交 `d660658` 实现 → `93d063e` freeze → `e31ceab` 矩阵。`settingsSha256` `f034dd26fcd1e0e0535078b702244689b12b0676a36a3c6a60e95df1dc96b0a7` 与 freeze 一致，sourceCommit `d660658`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：490 待补齐、262 待平台映射、135 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #127](https://github.com/songxychn/halo-butterfly-next/pull/127) 已合并 `fd79a20`（2026-09-12T04:39:04Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34673563418) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #128 合入推送前已于 2026-09-12T04:40:34Z 结束，不得写成 cancelled）。[#126](https://github.com/songxychn/halo-butterfly-next/issues/126) 已由 [PR #128](https://github.com/songxychn/halo-butterfly-next/pull/128) 关闭，见下节。

## 2026-09-12：页脚模板 includes/footer 合入

[PR #128](https://github.com/songxychn/halo-butterfly-next/pull/128) 已合并，关闭 [#126](https://github.com/songxychn/halo-butterfly-next/issues/126)。审查/CI head `3c0df8c`；squash 合并 `6420a51`（2026-09-12T04:50:12Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34673751526) 通过（188 tests）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34674046639) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T04:51:54Z）。独立审查为 [issue comment 5643543264](https://github.com/songxychn/halo-butterfly-next/pull/128#issuecomment-5643543264)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/footer-template-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `template:includes/footer` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `style:source/css/_layout/footer.styl`、`template:includes/rightside`、`style:source/css/_layout/rightside.styl` 仍 gap |
| 默认与语义 | 对齐 footer.pug 骨架：`.footer-separator`、框架/主题链、有 nav 时 `.footer-other--nav`。扁平 `footer.nav` 不变；`custom_text` 仍 `th:text`。**无新增 `th:utext`**。未改 `settings.yaml`。已落地 footer config 不得升 verified |
| P2（审查已列） | 非完整 footer.styl（配色、嵌套 flex 列）；主题链仍指 dhjddcn 仓；上游 custom_text HTML 未做；`.footer-copyright` flex gap 与 inline separator 叠间距。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `3c0df8c`；产品提交 `d7774f3` 实现 → `3c0df8c` 矩阵（无 freeze）。当前 `settingsSha256` 仍为 `f034dd26fcd1e0e0535078b702244689b12b0676a36a3c6a60e95df1dc96b0a7`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：489 待补齐、262 待平台映射、136 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #130](https://github.com/songxychn/halo-butterfly-next/pull/130) 已合并 `d0f9599`（2026-09-12T04:59:20Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34674417547) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #131 合入推送前已于 2026-09-12T05:00:58Z 结束，不得写成 cancelled）。[#129](https://github.com/songxychn/halo-butterfly-next/issues/129) 已由 [PR #131](https://github.com/songxychn/halo-butterfly-next/pull/131) 关闭，见下节。

## 2026-09-12：右侧栏 includes/rightside 合入

[PR #131](https://github.com/songxychn/halo-butterfly-next/pull/131) 已合并，关闭 [#129](https://github.com/songxychn/halo-butterfly-next/issues/129)。审查/CI head `7e5ffa3`；squash 合并 `9da1a6e`（2026-09-12T05:13:21Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34674716965) 通过（192 tests；审查当时一次快照为 pending，`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T05:07:43Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34675029062) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T05:15:00Z）。独立审查为 [issue comment 5643678533](https://github.com/songxychn/halo-butterfly-next/pull/131#issuecomment-5643678533)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/rightside-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `template:includes/rightside` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `style:source/css/_layout/footer.styl`、`style:source/css/_layout/rightside.styl`、`config:rightside_bottom`、`config:rightside_scroll_percent` 仍 gap |
| 默认与语义 | 对齐 rightside.pug 骨架：`#rightside`、hide/show 组、齿轮、`#go-up`。`#hide-aside-btn` 仍用 `aside.hide_button`，挂在 hide 组。保留 `.side-btn` 滚动 `.active`。窄屏 900px 隐藏隐藏开关。**无新增 `th:utext`**。未改 `settings.yaml`。不把 footer 模板或 config 升 verified |
| P2（审查已列） | 非完整 rightside.styl（bottom / opacity / z-index / scroll_percent）；齿轮无 spin；显隐仍靠 `.active`；h5-toc 仍 1100px。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `7e5ffa3`；产品提交 `159ab11` 实现 → `7e5ffa3` 矩阵（无 freeze）。当前 `settingsSha256` 仍为 `f034dd26fcd1e0e0535078b702244689b12b0676a36a3c6a60e95df1dc96b0a7`。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：488 待补齐、262 待平台映射、137 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #133](https://github.com/songxychn/halo-butterfly-next/pull/133) 已合并 `196405f`（2026-09-12T05:20:04Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34675316679) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #134 合入推送前已于 2026-09-12T05:21:51Z 结束，不得写成 cancelled）。[#132](https://github.com/songxychn/halo-butterfly-next/issues/132) 已由 [PR #134](https://github.com/songxychn/halo-butterfly-next/pull/134) 关闭，见下节。

## 2026-09-12：右侧栏 rightside_scroll_percent 合入

[PR #134](https://github.com/songxychn/halo-butterfly-next/pull/134) 已合并，关闭 [#132](https://github.com/songxychn/halo-butterfly-next/issues/132)。审查/CI head `add4b2e`；squash 合并 `969a724`（2026-09-12T05:27:48Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34675501637) 通过（196 tests；审查当时一次快照为 pending，`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T05:26:08Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34675643877) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T05:29:10Z）。独立审查为 [issue comment 5643764777](https://github.com/songxychn/halo-butterfly-next/pull/134#issuecomment-5643764777)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/rightside-scroll-percent-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:rightside_scroll_percent` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `style:source/css/_layout/footer.styl`、`style:source/css/_layout/rightside.styl`、`config:rightside_bottom`、`config:rightside_item_order.*`、`config:readmode` 仍 gap |
| 默认与语义 | 上游顶层 `rightside_scroll_percent` 默认 **false**（不是 `toc.scroll_percent` 的 true）。Halo 新组 **`rightside.scroll_percent`**；仅显式 true 时 `#go-up` 内渲染 `<span class="scroll-percent">`。滚动百分比 **< 95** 加 `.show-percent` 并用 **textContent** 写数字；≥95 去掉该类。`getScrollPercent` 复用 `src/js/core/toc.mjs`。未复用作者卡片 `aside.button`。help 含 `#go-up` 已加 YAML 引号。**无新增 `th:utext`** |
| freeze | 实现 `9c8ffbd` → freeze `d76596c`：`sourceCommit` = `9c8ffbd3d9de7702fd68a81db461188e8f919c2c`；`settingsSha256` = `52779147f135eb6bd56c97cfc76a383a6c24f5681e070807825b12f164e6fd5f` |
| P2（审查已列） | 非完整 rightside.styl 动画；未做 `rightside_bottom`；短页面上游 `checkDocumentHeight` 提前 return 未对齐；hover 动画简化。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `add4b2e`；四 commit：`9c8ffbd` 实现 → `d76596c` freeze → `97fcc54` 矩阵 IU → `add4b2e` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：487 待补齐、262 待平台映射、138 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #136](https://github.com/songxychn/halo-butterfly-next/pull/136) 已合并 `15e236f`（2026-09-12T05:41:12Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34676217100) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #137 合入推送前已于 2026-09-12T05:43:30Z 结束，不得写成 cancelled）。[#135](https://github.com/songxychn/halo-butterfly-next/issues/135) 已由 [PR #137](https://github.com/songxychn/halo-butterfly-next/pull/137) 关闭，见下节。

## 2026-09-12：右侧栏 rightside_bottom 合入

[PR #137](https://github.com/songxychn/halo-butterfly-next/pull/137) 已合并，关闭 [#135](https://github.com/songxychn/halo-butterfly-next/issues/135)。审查/CI head `f8c410e`；squash 合并 `b72731e`（2026-09-12T05:53:53Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34676510155) 通过（199 tests；`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T05:49:58Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34676747773) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T05:55:14Z）。独立审查为 [issue comment 5643999105](https://github.com/songxychn/halo-butterfly-next/pull/137#issuecomment-5643999105)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/rightside-bottom-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:rightside_bottom` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `style:source/css/_layout/footer.styl`、`style:source/css/_layout/rightside.styl`、`config:rightside_item_order.*`、`config:readmode` 仍 gap |
| 默认与语义 | 上游顶层 `rightside_bottom` 默认 **空**，`var.styl` 回退 **40px**（不是 400px）。Halo 新键 **`rightside.bottom`** 默认空字符串；空值 CSS 回退 40px，非空写入 `--rightside-bottom`（须带单位）。`.side-btn` 使用 `var(--rightside-bottom, 40px)`。未复用作者卡片 `aside.button`。help 含 `#rightside` 已加 YAML 引号。**无新增 `th:utext`** |
| freeze | 实现 `13ae8a1` → freeze `3e73b84`：`sourceCommit` = `13ae8a10340614e88062d05a49bf5924cb4ec4c8`；`settingsSha256` = `6d9ac8e98ea885862fcbabb50523ab0220a888057352e3402181c812286f9452` |
| P2（审查已列） | 非完整 rightside.styl（z-index 100 / opacity / 动画）；未做 `item_order` / `readmode`；无单位数字不自动补 px。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `f8c410e`；四 commit：`13ae8a1` 实现 → `3e73b84` freeze → `8fbe053` 矩阵 IU → `f8c410e` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：486 待补齐、262 待平台映射、139 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #139](https://github.com/songxychn/halo-butterfly-next/pull/139) 已合并 `5ce6125`（2026-09-12T06:05:56Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34677252799) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #140 合入推送前已于 2026-09-12T06:07:08Z 结束，不得写成 cancelled）。[#138](https://github.com/songxychn/halo-butterfly-next/issues/138) 已由 [PR #140](https://github.com/songxychn/halo-butterfly-next/pull/140) 关闭，见下节。

## 2026-09-12：阅读模式 readmode 合入

[PR #140](https://github.com/songxychn/halo-butterfly-next/pull/140) 已合并，关闭 [#138](https://github.com/songxychn/halo-butterfly-next/issues/138)。审查/CI head `a373388`；squash 合并 `31fa4d4`（2026-09-12T06:19:04Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34677578968) 通过（203 tests；审查当时一次快照为 pending，`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T06:15:36Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34677813149) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T06:20:22Z）。独立审查为 [issue comment 5644141793](https://github.com/songxychn/halo-butterfly-next/pull/140#issuecomment-5644141793)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/readmode-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:readmode`、`interaction:readmode` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `style:source/css/_mode/readmode.styl`、`style:source/css/_layout/footer.styl`、`style:source/css/_layout/rightside.styl`、`config:rightside_item_order.*`、`config:translate.*` 仍 gap |
| 默认与语义 | 上游 `readmode` 默认 **true**。Halo 新键 **`rightside.readmode`**；仅显式 false 不渲染 `#readmode`。仅文章页。点击给 `body` 加 `.read-mode`，退出按钮 `.exit-readmode`（class 图标，不走 innerHTML）。未复用作者卡片 `aside.button`。help 含 `#readmode` 已加 YAML 引号。**无新增 `th:utext`** |
| freeze | 实现 `6222f31` → freeze `a94313b`：`sourceCommit` = `6222f313761be491af3d2a80eff46d1c68ed8b76`；`settingsSha256` = `0599052cae121ca9ad4ff61c846287ddd7f5361c2313255ae96cc52d34d1c942` |
| P2（审查已列） | 非完整 readmode.styl 配色/代码块皮肤；退出按钮带 `fa-sign-out-alt`（上游仅 `exit-readmode`）；未做 `item_order` / `translate`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `a373388`；四 commit：`6222f31` 实现 → `a94313b` freeze → `bcf1b68` 矩阵 IU → `a373388` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：484 待补齐、262 待平台映射、141 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #142](https://github.com/songxychn/halo-butterfly-next/pull/142) 已合并 `14a3959`（2026-09-12T06:29:15Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34678249820) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #143 合入推送前已于 2026-09-12T06:30:43Z 结束，不得写成 cancelled）。[#141](https://github.com/songxychn/halo-butterfly-next/issues/141) 已由 [PR #143](https://github.com/songxychn/halo-butterfly-next/pull/143) 关闭，见下节。

## 2026-09-12：繁简转换 translate.enable 合入

[PR #143](https://github.com/songxychn/halo-butterfly-next/pull/143) 已合并，关闭 [#141](https://github.com/songxychn/halo-butterfly-next/issues/141)。审查/CI head `cf4f8b7`；squash 合并 `a7808d4`（2026-09-12T06:46:58Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34678750520) 通过（207 tests；审查当时一次快照为 **success**，completed 2026-09-12T06:42:34Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34679024330) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T06:48:28Z）。独立审查为 [issue comment 5644274856](https://github.com/songxychn/halo-butterfly-next/pull/143#issuecomment-5644274856)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/translate-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:translate.enable`、`config:translate.default`、`interaction:translate` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 [] |
| 仍 gap | `config:translate.defaultEncoding` / `translateDelay` / 两套 msg、`style:source/css/_mode/readmode.styl`、`style:source/css/_layout/footer.styl`、`style:source/css/_layout/rightside.styl`、`config:rightside_item_order.*`、`interaction:darkmode` 仍 gap |
| 默认与语义 | 上游 `translate.enable` 默认 **false**。Halo 新组 **`translate.enable`**；仅显式 true 渲染 `#translateLink`。不限文章页。`translate.default` 默认「繁」，模板 `th:text`。点击 `textContent` 切 繁/簡 并转换页面文本，不走 innerHTML。未复用作者卡片 `aside.button`。help 含 `#translateLink` 已加 YAML 引号。**无新增 `th:utext`** |
| freeze | 实现 `64f2fac` → freeze `caae774`：`sourceCommit` = `64f2fac39fc9c48d1fb0ed6bbec1ffe40f6c8508`；`settingsSha256` = `7923f050ab68aa4759dbb15609610113a22b81996874a59a5583784e761cdef1` |
| P2（审查已列） | 未把 encoding/delay/两套 msg 进设置；无 snackbar；未做 `item_order`（hide 组现序 readmode → translate → hideAside → darkmode）；未做代码块保护（上游也不保护）。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `cf4f8b7`；四 commit：`64f2fac` 实现 → `caae774` freeze → `e4e2ea8` 矩阵 IU → `cf4f8b7` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：481 待补齐、262 待平台映射、144 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #145](https://github.com/songxychn/halo-butterfly-next/pull/145) 已合并 `db3adb7`（2026-09-12T06:55:38Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34679394265) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #146 合入推送前已于 2026-09-12T06:57:21Z 结束，不得写成 cancelled）。[#144](https://github.com/songxychn/halo-butterfly-next/issues/144) 已由 [PR #146](https://github.com/songxychn/halo-butterfly-next/pull/146) 关闭，见下节。

## 2026-09-12：深色模式按钮 interaction:darkmode 合入

[PR #146](https://github.com/songxychn/halo-butterfly-next/pull/146) 已合并，关闭 [#144](https://github.com/songxychn/halo-butterfly-next/issues/144)。审查/CI head `75f6281`；squash 合并 `4270f0a`（2026-09-12T07:09:13Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34679742176) 通过（210 tests；审查当时一次快照为 pending，`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T07:05:34Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34679976087) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T07:10:56Z）。独立审查为 [issue comment 5644377044](https://github.com/songxychn/halo-butterfly-next/pull/146#issuecomment-5644377044)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/darkmode-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `interaction:darkmode` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。`config:darkmode.enable` / `config:darkmode.button` 仍为待验（更新 settings/finding） |
| 仍 gap | `config:darkmode.start` / `end`、`style:source/css/_mode/darkmode.styl`、`style:source/css/_mode/readmode.styl`、`style:source/css/_layout/footer.styl`、`style:source/css/_layout/rightside.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap。`config:darkmode.autoChangeMode` 仍待验（仍映射 `style.mode`） |
| 默认与语义 | 上游 `darkmode.enable` / `button` 默认 **true**。Halo 新组 **`darkmode.enable` / `darkmode.button`**；仅显式 false 不渲染 `#darkmode`。显隐不再仅限 `style.mode == user`。点击走既有 `Theme.toggleMode`，不走 innerHTML。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。help 含 `#darkmode` 已加 YAML 引号。**无新增 `th:utext`** |
| freeze | 实现 `7ec49ac` → freeze `9bb298d`：`sourceCommit` = `7ec49ac07b3a1ff11a944da7b9b522bf476cc45f`；`settingsSha256` = `3fdce760f4c18740058a6784cb7329e9d9f5f06ea83500877b02606944d2c2f9` |
| P2（审查已列） | localStorage 键仍是 `halo-butterfly-next.color-scheme` 而非上游 `theme`；未做 autoChangeMode 1/2、start/end、完整 styl、snackbar、`item_order`；`style.mode` 仍并存；按钮去掉 `.switch-model`（部分 lab/A11Y 脚本仍点该类）。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `75f6281`；四 commit：`7ec49ac` 实现 → `9bb298d` freeze → `ff6b62f` 矩阵 IU → `75f6281` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：480 待补齐、262 待平台映射、145 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #148](https://github.com/songxychn/halo-butterfly-next/pull/148) 已合并 `91aec4f`（2026-09-12T07:19:48Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34680441821) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #149 合入推送前已于 2026-09-12T07:21:30Z 结束，不得写成 cancelled）。[#147](https://github.com/songxychn/halo-butterfly-next/issues/147) 已由 [PR #149](https://github.com/songxychn/halo-butterfly-next/pull/149) 关闭，见下节。

## 2026-09-12：深色模式 autoChangeMode 合入

[PR #149](https://github.com/songxychn/halo-butterfly-next/pull/149) 已合并，关闭 [#147](https://github.com/songxychn/halo-butterfly-next/issues/147)。审查/CI head `311c31a`；squash 合并 `1deba5f`（2026-09-12T07:34:32Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34680766573) 通过（213 tests；审查当时一次快照为 pending，`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T07:33:46Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34681091080) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T07:36:17Z）。独立审查为 [issue comment 5644480305](https://github.com/songxychn/halo-butterfly-next/pull/149#issuecomment-5644480305)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/darkmode-auto-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `config:darkmode.start` / `config:darkmode.end` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。`config:darkmode.autoChangeMode` 仍为待验（更新 settings/finding） |
| 仍 gap | `style:source/css/_mode/darkmode.styl`、`style:source/css/_mode/readmode.styl`、`style:source/css/_layout/footer.styl`、`style:source/css/_layout/rightside.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 上游 `autoChangeMode` 默认 **false**。Halo `darkmode.autoChangeMode`：false 仅恢复已存；`1` 跟随系统；`2` 按小时。`start` / `end` 空回退 6 / 18；0 与 24 有效。已存 light/dark 优先。`style.mode` 的 light/dark 仍强制。初始自动推导不写入 localStorage。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。**无新增 `th:utext`** |
| freeze | 实现 `5e73cfd` → freeze `b89e26d`：`sourceCommit` = `5e73cfdea07c6c47032233f4586fb09d3299615d`；`settingsSha256` = `484129fc296305e7f90c7cbbac39263beedf3b887787d3e8d36228c214e6842b` |
| P2（审查已列） | localStorage 键仍不是上游 `theme`；FOUC 与 `darkmode.mjs` 并行实现；`style.mode` 仍并存；无已存时 Halo 落 light（上游 default 不 activate）。未做完整 styl / snackbar / `item_order`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `311c31a`；四 commit：`5e73cfd` 实现 → `b89e26d` freeze → `0dd4f72` 矩阵 IU → `311c31a` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：478 待补齐、262 待平台映射、147 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #151](https://github.com/songxychn/halo-butterfly-next/pull/151) 已合并 `190f3e2`（2026-09-12T07:43:50Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34681485118) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #152 合入推送前已于 2026-09-12T07:45:32Z 结束，不得写成 cancelled）。[#150](https://github.com/songxychn/halo-butterfly-next/issues/150) 已由 [PR #152](https://github.com/songxychn/halo-butterfly-next/pull/152) 关闭，见下节。

## 2026-09-12：深色模式样式 darkmode.styl 合入

[PR #152](https://github.com/songxychn/halo-butterfly-next/pull/152) 已合并，关闭 [#150](https://github.com/songxychn/halo-butterfly-next/issues/150)。审查/CI head `ab9d94c`；squash 合并 `8070394`（2026-09-12T07:57:41Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34681854369) 通过（审查当时一次快照为 pending，`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T07:54:36Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34682047375) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T07:59:05Z）。独立审查为 [issue comment 5644591881](https://github.com/songxychn/halo-butterfly-next/pull/152#issuecomment-5644591881)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/darkmode-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_mode/darkmode.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。已落地 `config:darkmode.*` / `interaction:darkmode` 仍为待验 |
| 仍 gap | `style:source/css/_mode/readmode.styl`、`style:source/css/_layout/footer.styl`、`style:source/css/_layout/rightside.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器挂在 `html[data-color-scheme='dark']`，**不**改 `data-theme`。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。`#darkmode` 仍用 enable && button。**无新增 `th:utext`** |
| P2（审查已列） | localStorage 键仍不是上游 `theme`；`svg { fill: !important }` 从上游 `#gitalk-container svg` 提到整棵深色树；部分上游选择器（`#page-header`、`#web_bg`）在 Halo DOM 可能不存在。未做 snackbar / `item_order`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `ab9d94c`；三 commit：`5d08d43` 实现 → `3db4669` 矩阵 IU → `ab9d94c` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：477 待补齐、262 待平台映射、148 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #154](https://github.com/songxychn/halo-butterfly-next/pull/154) 已合并 `ced439a`（2026-09-12T08:04:17Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34682329714) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #155 合入推送前已于 2026-09-12T08:05:37Z 结束，不得写成 cancelled）。[#153](https://github.com/songxychn/halo-butterfly-next/issues/153) 已由 [PR #155](https://github.com/songxychn/halo-butterfly-next/pull/155) 关闭，见下节。

## 2026-09-12：阅读模式样式 readmode.styl 合入

[PR #155](https://github.com/songxychn/halo-butterfly-next/pull/155) 已合并，关闭 [#153](https://github.com/songxychn/halo-butterfly-next/issues/153)。审查/CI head `d3dc639`；squash 合并 `2c6236a`（2026-09-12T08:13:21Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34682490284) 通过（审查当时一次快照为 pending，`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T08:09:23Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34682716547) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T08:15:01Z）。独立审查为 [issue comment 5644658435](https://github.com/songxychn/halo-butterfly-next/pull/155#issuecomment-5644658435)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/readmode-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_mode/readmode.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。已落地 `config:readmode` / `interaction:readmode` / `darkmode.styl` 仍为待验 |
| 仍 gap | `style:source/css/_layout/footer.styl`、`style:source/css/_layout/rightside.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器挂在 `body.read-mode` 与 `html[data-color-scheme='dark']`，**不**改 `data-theme`。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。`#readmode` 仍仅文章页。**无新增 `th:utext`** |
| P2（审查已列） | `* { color: !important }` 过宽；退出按钮加了 `color: !important` 对抗该规则；部分上游选择器靠 Halo 并列类。未做 snackbar / `item_order`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `d3dc639`；三 commit：`66af59a` 实现 → `5d14167` 矩阵 IU → `d3dc639` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：476 待补齐、262 待平台映射、149 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #157](https://github.com/songxychn/halo-butterfly-next/pull/157) 已合并 `4c175ca`（2026-09-12T08:22:00Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34683081826) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #158 合入推送前已于 2026-09-12T08:23:50Z 结束，不得写成 cancelled）。[#156](https://github.com/songxychn/halo-butterfly-next/issues/156) 已由 [PR #158](https://github.com/songxychn/halo-butterfly-next/pull/158) 关闭，见下节。

## 2026-09-12：页脚样式 footer.styl 合入

[PR #158](https://github.com/songxychn/halo-butterfly-next/pull/158) 已合并，关闭 [#156](https://github.com/songxychn/halo-butterfly-next/issues/156)。审查/CI head `7c6a13b`；squash 合并 `82ff78b`（2026-09-12T08:33:04Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34683371462) 通过（审查当时一次快照为 pending，`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T08:30:19Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34683558470) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T08:35:24Z）。独立审查为 [issue comment 5644762457](https://github.com/songxychn/halo-butterfly-next/pull/158#issuecomment-5644762457)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/footer-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/footer.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。已落地 footer 模板 / `config:footer.*` / `mask.footer` 仍为待验 |
| 仍 gap | `style:source/css/_layout/rightside.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器并列 `.footer` / `#footer`，**不**改 `data-theme`。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。保留 #5 下划线与 `:focus-visible`。**无新增 `th:utext`** |
| P2 | 审查未列 P2。已知：Halo nav 仍是扁平链接（不做嵌套列 DOM）；390 未抄 `white-space: nowrap`；模板无 `#footer` id。未做 snackbar / `item_order`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `7c6a13b`；三 commit：`2c95739` 实现 → `47409f8` 矩阵 IU → `7c6a13b` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：475 待补齐、262 待平台映射、150 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #160](https://github.com/songxychn/halo-butterfly-next/pull/160) 已合并 `24cc02a`（2026-09-12T08:40:08Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34683857736) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #161 合入推送前已于 2026-09-12T08:41:56Z 结束，不得写成 cancelled）。[#159](https://github.com/songxychn/halo-butterfly-next/issues/159) 已由 [PR #161](https://github.com/songxychn/halo-butterfly-next/pull/161) 关闭，见下节。

## 2026-09-12：右侧按钮栏样式 rightside.styl 合入

[PR #161](https://github.com/songxychn/halo-butterfly-next/pull/161) 已合并，关闭 [#159](https://github.com/songxychn/halo-butterfly-next/issues/159)。审查/CI head `e47403d`；squash 合并 `eadd8ee`（2026-09-12T08:56:27Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34684356676) 通过（重审当时一次快照为 pending，`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T08:53:26Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34684546450) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T08:58:10Z）。第一次独立审查 [issue comment 5644839892](https://github.com/songxychn/halo-butterfly-next/pull/161#issuecomment-5644839892) 为 changes-requested（P1：404/plugin `.side-btn` 被 `#rightside { position:fixed }` 压过）；第四 commit `e47403d` 改为 `&#Butterfly > #rightside`。重审为 [issue comment 5644865602](https://github.com/songxychn/halo-butterfly-next/pull/161#issuecomment-5644865602)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/rightside-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/rightside.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。已落地 rightside 模板 / `rightside_bottom` / `scroll_percent` 仍为待验 |
| 仍 gap | `style:source/css/_layout/aside.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器挂在 `#rightside`，滚动显隐并列 `.rightside-show` / `.active`，**不**改 `data-theme`。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。**无新增 `th:utext`** |
| P1（已修） | 404/plugin 短页覆盖改为 `#Butterfly.error404 > #rightside` / `#Butterfly.plugin > #rightside`，压过 ID 定位 |
| P2 | `#go-up` 仍在 `#rightside` 块外；`common.scss` `.side-btn` 仍 `position:fixed; z-index:80`。未做 snackbar / `item_order`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `e47403d`；四 commit：`1410413` 实现 → `1e0f0d8` 矩阵 IU → `8a3a597` 矩阵 PR 号 → `e47403d` P1。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：474 待补齐、262 待平台映射、151 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #163](https://github.com/songxychn/halo-butterfly-next/pull/163) 已合并 `c619abe`（2026-09-12T09:03:46Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34684859344) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #164 合入推送前已于 2026-09-12T09:05:28Z 结束，不得写成 cancelled）。[#162](https://github.com/songxychn/halo-butterfly-next/issues/162) 已由 [PR #164](https://github.com/songxychn/halo-butterfly-next/pull/164) 关闭，见下节。

## 2026-09-12：侧栏样式 aside.styl 合入

[PR #164](https://github.com/songxychn/halo-butterfly-next/pull/164) 已合并，关闭 [#162](https://github.com/songxychn/halo-butterfly-next/issues/162)。审查/CI head `7a2ea81`；squash 合并 `c124a92`（2026-09-12T09:21:46Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34685304400) 通过（审查当时一次快照为 pending，`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T09:15:38Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34685648324) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T09:23:29Z）。独立审查为 [issue comment 5644978824](https://github.com/songxychn/halo-butterfly-next/pull/164#issuecomment-5644978824)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/aside-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/aside.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。已落地 aside hide/mobile/`hide_button` / position 仍为待验 |
| 仍 gap | `style:source/css/_layout/head.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器并列 `#aside-content` / `.aside`，padding 编译为 `.main.aside-right > .aside`（**不是** `.main .main.aside-right`），**不**改 `data-theme`。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。**无新增 `th:utext`** |
| P2 | 单测只扫源码字符串；Halo DOM 无 `.sticky_layout`（文章目录仍 `.is-sticky`）。未做 snackbar / `item_order`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `7a2ea81`；三 commit：`0e4608d` 实现 → `487d662` 矩阵 IU → `7a2ea81` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：473 待补齐、262 待平台映射、152 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #166](https://github.com/songxychn/halo-butterfly-next/pull/166) 已合并 `43f7dbc`（2026-09-12T09:28:59Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34685965364) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #167 合入推送前已于 2026-09-12T09:30:39Z 结束，不得写成 cancelled）。[#165](https://github.com/songxychn/halo-butterfly-next/issues/165) 已由 [PR #167](https://github.com/songxychn/halo-butterfly-next/pull/167) 关闭，见下节。

## 2026-09-12：页头样式 head.styl 合入

[PR #167](https://github.com/songxychn/halo-butterfly-next/pull/167) 已合并，关闭 [#165](https://github.com/songxychn/halo-butterfly-next/issues/165)。审查/CI head `1ad8fe4`；squash 合并 `649b032`（2026-09-12T09:43:21Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34686247856) 通过（审查当时一次快照为 **success**，completed 2026-09-12T09:37:02Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34686585514) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T09:44:59Z）。独立审查为 [issue comment 5645089457](https://github.com/songxychn/halo-butterfly-next/pull/167#issuecomment-5645089457)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/head-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/head.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。已落地 mask.header / nav / subtitle 仍为待验 |
| 仍 gap | `style:source/css/_layout/pagination.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器并列 `#page-header` / `.header`，**不**改 `data-theme`。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。mask.header 仍仅 `#Butterfly.mask-header .above::before`。**无新增 `th:utext`** |
| P2 | `darkmode.scss` / `readmode.scss` 仍只打 `#page-header`（Halo 页头 DOM 碰不到）。首页 100vh 未被 400/280 压过。未做 snackbar / 移动侧栏完整交互。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `1ad8fe4`；三 commit：`d29d16f` 实现 → `2f17a1f` 矩阵 IU → `1ad8fe4` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：472 待补齐、262 待平台映射、153 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #169](https://github.com/songxychn/halo-butterfly-next/pull/169) 已合并 `264fc65`（2026-09-12T09:54:05Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34687039490) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #170 合入推送前已于 2026-09-12T09:55:49Z 结束，不得写成 cancelled）。[#168](https://github.com/songxychn/halo-butterfly-next/issues/168) 已由 [PR #170](https://github.com/songxychn/halo-butterfly-next/pull/170) 关闭，见下节。

## 2026-09-12：分页样式 pagination.styl 合入

[PR #170](https://github.com/songxychn/halo-butterfly-next/pull/170) 已合并，关闭 [#168](https://github.com/songxychn/halo-butterfly-next/issues/168)。审查/CI head `263b0f6`；squash 合并 `efd9edf`（2026-09-12T10:07:11Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34687337887) 通过（审查首次 `gh pr checks` 为 pending，评论发出时已 **success**，completed 2026-09-12T10:03:02Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34687603312) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T10:08:50Z）。独立审查为 [issue comment 5645226917](https://github.com/songxychn/halo-butterfly-next/pull/170#issuecomment-5645226917)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/pagination-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/pagination.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。已落地 `config:post_pagination` 仍为待验；`template:includes/pagination` 仍 gap |
| 仍 gap | `style:source/css/_layout/post.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器并列 `#pagination .pagination` / `.layout .pagination` / `.pagination`，**不**改 `data-theme`。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。不套用 `.plugin-pagination`。不改 `#pagination.pagination-post`。**无新增 `th:utext`** |
| P2 | `.layout .pagination` 未再写 `:not(.plugin-pagination)`；Halo 无 `.layout`，插件分页 44px 特异性仍赢。空 mixin 可编译。未做 snackbar / shuoshuo 分页。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `263b0f6`；三 commit：`242b499` 实现 → `dddf60f` 矩阵 IU → `263b0f6` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：471 待补齐、262 待平台映射、154 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #172](https://github.com/songxychn/halo-butterfly-next/pull/172) 已合并 `f5dcad4`（2026-09-12T10:16:23Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34688009933) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #173 合入推送前已于 2026-09-12T10:18:11Z 结束，不得写成 cancelled）。[#171](https://github.com/songxychn/halo-butterfly-next/issues/171) 已由 [PR #173](https://github.com/songxychn/halo-butterfly-next/pull/173) 关闭，见下节。


## 2026-09-12：文章页样式 post.styl 合入

[PR #173](https://github.com/songxychn/halo-butterfly-next/pull/173) 已合并，关闭 [#171](https://github.com/songxychn/halo-butterfly-next/issues/171)。审查/CI head `3d5e1c7`；squash 合并 `ba9cce9`（2026-09-12T10:35:27Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34688533582) 通过（审查一次快照为 **success**，completed 2026-09-12T10:30:11Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34688855486) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T10:36:52Z）。独立审查为 [issue comment 5645355043](https://github.com/songxychn/halo-butterfly-next/pull/173#issuecomment-5645355043)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/post-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/post.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。已落地 `config:post_pagination` / noticeOutdate / post_copyright / related_post 仍为待验；`template:includes/post/post-copyright` 仍 gap |
| 仍 gap | `style:source/css/_layout/relatedposts.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器并列 `#post` / `.post`、`.container` / `.render` / `.post-content`，**不**改 `data-theme`。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。不改 `#pagination.pagination-post`。**无新增 `th:utext`** |
| P2 | 未跑双站（已声明）。上游 `.container` 的 `img` / `p` / `hr` 未移植，属本刀声称 kbd/iframe 范围外。Halo 无 `#post` / `.tag_share` DOM，选择器并列即可。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `3d5e1c7`；三 commit：`73237c1` 实现 → `0d0d69e` 矩阵 IU → `3d5e1c7` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：470 待补齐、262 待平台映射、155 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #175](https://github.com/songxychn/halo-butterfly-next/pull/175) 已合并 `e3518fd`（2026-09-12T10:45:14Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34689271530) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #176 合入推送前已于 2026-09-12T10:46:54Z 结束，不得写成 cancelled）。[#174](https://github.com/songxychn/halo-butterfly-next/issues/174) 已由 [PR #176](https://github.com/songxychn/halo-butterfly-next/pull/176) 关闭，见下节。


## 2026-09-12：相关文章样式 relatedposts.styl 合入

[PR #176](https://github.com/songxychn/halo-butterfly-next/pull/176) 已合并，关闭 [#174](https://github.com/songxychn/halo-butterfly-next/issues/174)。审查/CI head `3dc9463`；squash 合并 `c828fed`（2026-09-12T10:55:46Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34689471964) 通过（审查一次快照为 **success**，completed 2026-09-12T10:51:42Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34689720264) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T10:57:31Z）。独立审查为 [issue comment 5645445936](https://github.com/songxychn/halo-butterfly-next/pull/176#issuecomment-5645445936)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/relatedposts-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/relatedposts.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。已落地 `config:related_post.*` 仍为待验；`helper:related_posts` 仍 gap |
| 仍 gap | `style:source/css/_layout/reward.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器并列 `.relatedPosts` 与列表 `> a` / `a.pagination-related`，**不**改 `data-theme`。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。不改 `#pagination.pagination-post`。**无新增 `th:utext`** |
| P2 | 未跑双站（已声明）。200px 只挂在 `.relatedPosts` 卡片，上下篇仍 150px。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `3dc9463`；三 commit：`5c819c7` 实现 → `dc5df73` 矩阵 IU → `3dc9463` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：469 待补齐、262 待平台映射、156 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #178](https://github.com/songxychn/halo-butterfly-next/pull/178) 已合并 `feb6f6c`（2026-09-12T11:04:06Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34690073279) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #179 合入推送前已于 2026-09-12T11:05:52Z 结束，不得写成 cancelled）。[#177](https://github.com/songxychn/halo-butterfly-next/issues/177) 已由 [PR #179](https://github.com/songxychn/halo-butterfly-next/pull/179) 关闭，见下节。


## 2026-09-12：打赏样式 reward.styl 合入

[PR #179](https://github.com/songxychn/halo-butterfly-next/pull/179) 已合并，关闭 [#177](https://github.com/songxychn/halo-butterfly-next/issues/177)。审查/CI head `a2272be`；squash 合并 `644b38e`（2026-09-12T11:19:05Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34690429694) 通过（审查一次快照为 **success**，completed 2026-09-12T11:13:36Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34690736411) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T11:20:36Z）。独立审查为 [issue comment 5645556262](https://github.com/songxychn/halo-butterfly-next/pull/179#issuecomment-5645556262)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/reward-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/reward.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。已落地 `config:reward.*` 仍为待验；`template:includes/post/reward` / `interaction:reward` 仍 gap |
| 仍 gap | `style:source/css/_layout/sidebar.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器并列 `.post-reward` 与 `img` / `img.post-qr-code-img`，**不**改 `data-theme`。弹层走 `--reward-pop`（浅色回退 `#f5f5f5`）。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。不改 `#pagination.pagination-post`。**无新增 `th:utext`** |
| P2 | 未跑双站（已声明）。`.reward-button` 为 `div`，键盘焦点不能打开弹层。btn-effects 内联到按钮。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `a2272be`；三 commit：`01b8d00` 实现 → `9b24fe0` 矩阵 IU → `a2272be` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：468 待补齐、262 待平台映射、157 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #181](https://github.com/songxychn/halo-butterfly-next/pull/181) 已合并 `28dee1a`（2026-09-12T11:30:22Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34691219097) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #182 合入推送前已于 2026-09-12T11:32:00Z 结束，不得写成 cancelled）。[#180](https://github.com/songxychn/halo-butterfly-next/issues/180) 已由 [PR #182](https://github.com/songxychn/halo-butterfly-next/pull/182) 关闭，见下节。


## 2026-09-12：移动侧栏样式 sidebar.styl 合入

[PR #182](https://github.com/songxychn/halo-butterfly-next/pull/182) 已合并，关闭 [#180](https://github.com/songxychn/halo-butterfly-next/issues/180)。审查/CI head `b1f7908`；squash 合并 `208b8d8`（2026-09-12T11:40:08Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34691477477) 通过（审查一次快照为 pending，合入前 `gh run view` 为 **success**，completed 2026-09-12T11:37:43Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34691646848) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T11:41:55Z）。独立审查为 [issue comment 5645652088](https://github.com/songxychn/halo-butterfly-next/pull/182#issuecomment-5645652088)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/sidebar-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/sidebar.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。`template:includes/sidebar` / `interaction:mobile-menu` 仍 in-progress |
| 仍 gap | `style:source/css/_layout/chat.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器并列 `#sidebar` / `#menu-mask` / `#sidebar-menus` 与 Halo `#mobile-navigation.side-bar` / `#Butterfly > .mask` / `menu.bar`，**不**改 `data-theme`。抽屉 330px。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。不改 `#pagination.pagination-post`。`.side-btn` 仍 `--rightside-bottom`。**无新增 `th:utext`** |
| P2 | 未跑双站（已声明）。Halo 抽屉并列 `.active` 与上游 `.open`。`#Butterfly > .mask` 仍可能带 `_base` blur。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `b1f7908`；三 commit：`fb99379` 实现 → `4f4b1f5` 矩阵 IU → `b1f7908` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：467 待补齐、262 待平台映射、158 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #184](https://github.com/songxychn/halo-butterfly-next/pull/184) 已合并 `afff8ec`（2026-09-12T11:51:27Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34692129985) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #185 合入推送前已于 2026-09-12T11:52:57Z 结束，不得写成 cancelled）。[#183](https://github.com/songxychn/halo-butterfly-next/issues/183) 已由 [PR #185](https://github.com/songxychn/halo-butterfly-next/pull/185) 关闭，见下节。


## 2026-09-12：聊天按钮样式 chat.styl 合入

[PR #185](https://github.com/songxychn/halo-butterfly-next/pull/185) 已合并，关闭 [#183](https://github.com/songxychn/halo-butterfly-next/issues/183)。审查/CI head `915d910`；squash 合并 `6465de3`（2026-09-12T12:00:22Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34692321611) 通过（审查一次快照为 pending，合入前 `gh run view` 为 **success**，completed 2026-09-12T11:57:58Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34692495186) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T12:02:07Z）。独立审查为 [issue comment 5645744292](https://github.com/songxychn/halo-butterfly-next/pull/185#issuecomment-5645744292)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/chat-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/chat.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。`config:chat.*` 与聊天模板仍 mapping-required |
| 仍 gap | `style:source/css/_layout/comments.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` / delay / msg 仍 gap |
| 默认与语义 | 选择器 `#chatra:not(.chatra--expanded)`，**不**改 `data-theme`。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。不改 `#pagination.pagination-post`。**不**接入 Chatra/Crisp/Tidio/Knocket。**无新增 `th:utext`** |
| P2 | 未跑双站（已声明）。编译 CSS 始终带隐藏规则（上游仅在 rightside_button && use=chatra 时输出）；无 `#chatra` DOM 时为空操作。未做 `button_hide_show`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `915d910`；三 commit：`bb2878c` 实现 → `f565d6c` 矩阵 IU → `915d910` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：466 待补齐、262 待平台映射、159 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #187](https://github.com/songxychn/halo-butterfly-next/pull/187) 已合并 `3c48943`（2026-09-12T12:09:02Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34692887395) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #188 合入推送前已于 2026-09-12T12:10:50Z 结束，不得写成 cancelled）。[#186](https://github.com/songxychn/halo-butterfly-next/issues/186) 已由 [PR #188](https://github.com/songxychn/halo-butterfly-next/pull/188) 关闭，见下节。


## 2026-09-12：评论区样式 comments.styl 合入

[PR #188](https://github.com/songxychn/halo-butterfly-next/pull/188) 已合并，关闭 [#186](https://github.com/songxychn/halo-butterfly-next/issues/186)。审查/CI head `b3abce7`；squash 合并 `cb33438`（2026-09-12T12:18:04Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34693133342) 通过（审查一次快照为 in_progress，合入前 `gh run view` 为 **success**，completed 2026-09-12T12:15:52Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34693299658) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T12:19:46Z）。独立审查为 [issue comment 5645830061](https://github.com/songxychn/halo-butterfly-next/pull/188#issuecomment-5645830061)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/comments-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/comments.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。`config:comments.use` 仍待验，不得升 verified。`config:comments.text` 与评论模板仍 mapping-required |
| 仍 gap | `style:source/css/_layout/loading.styl`、`config:rightside_item_order.*`、`config:translate.defaultEncoding` 仍 gap |
| 默认与语义 | 选择器 `#post-comment` / `.comment-head` / `.comment-headline` / `.comment-wrap`，**不**改 `data-theme`。Halo `<halo:comment>` 包在 `#post-comment`。标题 `th:text`「评论」。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。不改 `#pagination.pagination-post`。**不**做双评论切换脚本，**不**接入 Disqus/Waline。**无新增 `th:utext`** |
| P2 | 未跑双站（已声明）。`@keyframes tabshow` 为 Halo 补的。Halo 评论插件可能自带标题。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `b3abce7`；三 commit：`b8a081a` 实现 → `d25780f` 矩阵 IU → `b3abce7` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：465 待补齐、262 待平台映射、160 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #190](https://github.com/songxychn/halo-butterfly-next/pull/190) 已合并 `2b3ca71`（2026-09-12T12:25:34Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34693636398) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #191 合入推送前已于 2026-09-12T12:27:24Z 结束，不得写成 cancelled）。[#189](https://github.com/songxychn/halo-butterfly-next/issues/189) 已由 [PR #191](https://github.com/songxychn/halo-butterfly-next/pull/191) 关闭，见下节。


## 2026-09-12：全屏加载样式 loading.styl 合入

[PR #191](https://github.com/songxychn/halo-butterfly-next/pull/191) 已合并，关闭 [#189](https://github.com/songxychn/halo-butterfly-next/issues/189)。审查/CI head `aaf9d3f`；squash 合并 `4d96e75`（2026-09-12T12:34:32Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34693818039) 通过（审查 `gh pr checks` 一次快照为 pending，同 run 元数据与合入前 `gh run view` 为 **success**，completed 2026-09-12T12:31:11Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34694046264) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T12:36:14Z）。独立审查为 [issue comment 5645909725](https://github.com/songxychn/halo-butterfly-next/pull/191#issuecomment-5645909725)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/loading-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/loading.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。`config:preloader.enable` / `pace_css_url` 仍 gap；`config:preloader.source` 仍待验，不得升 verified |
| 仍 gap | `style:source/css/_layout/third-party.styl`、`config:rightside_item_order.*` 仍 gap |
| 默认与语义 | 选择器 `#loading-box`，**不**改 `data-theme`。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。不改 `#pagination.pagination-post`。**不**接入 pace。无 `#loading-box` DOM。**无新增 `th:utext`** |
| P2 | 未跑双站（已声明）。编译 CSS 始终带规则（上游仅在 enable && source=1 时输出）；无 DOM 时为空操作。Halo `loading.type` 插件仍独立。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `aaf9d3f`；三 commit：`8febb01` 实现 → `397b1df` 矩阵 IU → `aaf9d3f` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：464 待补齐、262 待平台映射、161 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #193](https://github.com/songxychn/halo-butterfly-next/pull/193) 已合并 `b217f12`（2026-09-12T12:43:29Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34694454920) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #194 合入推送前已于 2026-09-12T12:45:20Z 结束，不得写成 cancelled）。[#192](https://github.com/songxychn/halo-butterfly-next/issues/192) 已由 [PR #194](https://github.com/songxychn/halo-butterfly-next/pull/194) 关闭，见下节。


## 2026-09-12：第三方组件样式 third-party.styl 合入

[PR #194](https://github.com/songxychn/halo-butterfly-next/pull/194) 已合并，关闭 [#192](https://github.com/songxychn/halo-butterfly-next/issues/192)。审查/CI head `21211d5`；squash 合并 `f763842`（2026-09-12T12:57:40Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34694807654) 通过（审查一次快照与合入前 `gh run view` 均为 **success**，completed 2026-09-12T12:52:56Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34695093579) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T12:59:28Z）。独立审查为 [issue comment 5646019604](https://github.com/songxychn/halo-butterfly-next/pull/194#issuecomment-5646019604)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/third-party-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_layout/third-party.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。`_layout/*.styl` 现已全部待验。`config:snackbar.enable` / mermaid / artalk.vote 仍不得升 verified |
| 仍 gap | `style:source/css/_page/common.styl`、`config:rightside_item_order.*`、`config:preloader.enable` 仍 gap |
| 默认与语义 | 选择器 `#vcomment` / `#waline-wrap` / `.fireworks` 等，**不**改 `data-theme`。fireworks z-index 9999。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。不改 `#pagination.pagination-post`。不输出 `.katex { display: none }` 与 mermaid.code_write 隐藏。**无新增 `th:utext`** |
| P2 | 未跑双站（已声明）。编译 CSS 始终带规则（上游仅在 mermaid/chartjs/artalk.vote/math 打开时输出）；无 DOM 时为空操作。保留上游 `:not(last-child)` 笔误。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `21211d5`；三 commit：`8b53c29` 实现 → `4498ff8` 矩阵 IU → `21211d5` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：463 待补齐、262 待平台映射、162 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。[PR #196](https://github.com/songxychn/halo-butterfly-next/pull/196) 已合并 `3fa1a8d`（2026-09-12T13:05:42Z），其 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34695465747) 通过（`gh run view` 等到 completed 后为 **success**；该运行在 #197 合入推送前已于 2026-09-12T13:07:34Z 结束，不得写成 cancelled）。[#195](https://github.com/songxychn/halo-butterfly-next/issues/195) 已由 [PR #197](https://github.com/songxychn/halo-butterfly-next/pull/197) 关闭，见下节。


## 2026-09-12：页面通用样式 common.styl 合入

[PR #197](https://github.com/songxychn/halo-butterfly-next/pull/197) 已合并，关闭 [#195](https://github.com/songxychn/halo-butterfly-next/issues/195)。审查/CI head `0f27278`；squash 合并 `63bf50a`（2026-09-12T13:16:35Z）。[PR CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34695732543) 通过（审查 `gh pr checks` 一次快照为 pending，同 run 元数据与合入前 `gh run view` 为 **success**，completed 2026-09-12T13:13:00Z）。合并提交的 [master CI](https://github.com/songxychn/halo-butterfly-next/actions/runs/34695978915) 通过（`gh run view` 等到 completed 后为 **success**，completed 2026-09-12T13:18:26Z）。独立审查为 [issue comment 5646115858](https://github.com/songxychn/halo-butterfly-next/pull/197#issuecomment-5646115858)（非 GitHub Approve；reviews 为空；verdict approve，无 P1）。见[审查摘要](validation/2026-09-08/page-common-styl-review.json)。

| 项目 | 结果与边界 |
| --- | --- |
| 新升矩阵 | `style:source/css/_page/common.styl` 升为 `implemented-unverified`，**不**标 `verified`；evidence 仍 []。`config:aside.position` 仍待验，不得升 verified |
| 仍 gap | `style:source/css/_page/homepage.styl`、`config:rightside_item_order.*`、`config:snackbar.enable` 仍 gap |
| 默认与语义 | 选择器并列 `#body-wrap` / `.layout` / `.main`，**不**改 `data-theme`。1200px、40px 15px、hide-aside 1000/1300。`html.hide-aside` 主栏 80% 不改。无 `settings.yaml` 改动，因此无 freeze。未复用作者卡片 `aside.button`。`#hide-aside-btn` 仍用 `aside.hide_button`。不改 `#pagination.pagination-post`。无 `#body-wrap` DOM。**无新增 `th:utext`** |
| P2 | 未跑双站（已声明）。无 `#body-wrap` DOM（Halo 用 `#Butterfly`）。`.layout.hide-aside` / `.apple` 无对应 class 时为空操作。aside 规则现同时挂在 `.layout` 与 `.main`。**不**关闭 POST-01 / PAGE-01 / A11Y |
| 审查链 | 相对 `0f27278`；三 commit：`48783f3` 实现 → `679a94f` 矩阵 IU → `0f27278` 矩阵 PR 号。同 GitHub 账户不能 Approve |

截至本轮记录，origin/master 矩阵为 897：462 待补齐、262 待平台映射、163 有实现待验、10 推进中、0 已完成全部验收。本记录不改矩阵文件。下一刀是 [#198](https://github.com/songxychn/halo-butterfly-next/issues/198)（`style:source/css/_page/homepage.styl`；已落地的 common/third-party/loading/comments/chat/sidebar/reward/relatedposts/post/pagination/head/aside/footer/rightside 不得升 verified）；[#95](https://github.com/songxychn/halo-butterfly-next/issues/95) 与 [#96](https://github.com/songxychn/halo-butterfly-next/issues/96) 为 #94 的重复开票，仍 OPEN。

## 正在推进

1. [#35 性能基线](https://github.com/songxychn/halo-butterfly-next/issues/35)：测量工具已由 [PR #43](https://github.com/songxychn/halo-butterfly-next/pull/43) 合入 master `0aaacc9`。GitHub issue 已因 Closes 关闭，但 PERF-01/02/03 合同仍不关闭；尚未跑 160 份真实采样，须集成负责人分配专属站与 CPU 窗口。P/P+ 是页面集合，不是插件安装配置。
2. M1 用户可见切片：[PR #47](https://github.com/songxychn/halo-butterfly-next/pull/47) 已合入（首页首屏与导航 logo/标题/fixed）。[PR #51](https://github.com/songxychn/halo-butterfly-next/pull/51) 已合入（文章页 `post_meta.post` 五项，不含 `date_format`）。[PR #54](https://github.com/songxychn/halo-butterfly-next/pull/54) 已合入（列表 `post_meta.page` 四项，不含 `date_format`）。[PR #57](https://github.com/songxychn/halo-butterfly-next/pull/57) 已合入（首页列表封面 `cover.index_enable` / `default_cover`，不含 aside/archives）。[PR #60](https://github.com/songxychn/halo-butterfly-next/pull/60) 已合入（文章页代码块工具栏 copy/shrink/language/macStyle/height_limit 与复制交互，不含 word_wrap/fullpage）。[PR #63](https://github.com/songxychn/halo-butterfly-next/pull/63) 已合入（侧栏最近文章与 `cover.aside_enable`，不含 `archives_enable` / `sort_order`）。[PR #65](https://github.com/songxychn/halo-butterfly-next/pull/65) 已合入（归档封面 `cover.archives_enable`）。[PR #69](https://github.com/songxychn/halo-butterfly-next/pull/69) 已合入（代码块自动换行 `code_blocks.word_wrap`，不含 fullpage / shrink=true 默认折叠）。[PR #71](https://github.com/songxychn/halo-butterfly-next/pull/71) 已合入（代码块全屏 `code_blocks.fullpage` 与 `interaction:fullpage-code`，不含 shrink=true 默认折叠）。[PR #75](https://github.com/songxychn/halo-butterfly-next/pull/75) 已合入（代码块默认折叠 `code_blocks.shrink` 三态与 `interaction:collapse-code`，不含逐页 highlight_shrink）。[PR #78](https://github.com/songxychn/halo-butterfly-next/pull/78) 已合入（文章与列表日期格式 `post_meta.date_format`，两组独立，evidence 仍 []）。[PR #81](https://github.com/songxychn/halo-butterfly-next/pull/81) 已合入（首页列表摘要 `index_post_content.method` / `length`，evidence 仍 []）。[PR #84](https://github.com/songxychn/halo-butterfly-next/pull/84) 已合入（文章上下篇 `post_pagination`，evidence 仍 []；`interaction:post-pagination` 仍 gap）。[PR #87](https://github.com/songxychn/halo-butterfly-next/pull/87) 已合入（文章过期提醒 `noticeOutdate` 六项 config，evidence 仍 []；`page-data:noticeOutdate` 仍 mapping-required）。[PR #90](https://github.com/songxychn/halo-butterfly-next/pull/90) 已合入（文章目录 `toc.number` / `expand` / `style_simple` / `scroll_percent`，evidence 仍 []；`toc.post` / `toc.page` 未改）。[PR #93](https://github.com/songxychn/halo-butterfly-next/pull/93) 已合入（相关文章 `related_post.enable` / `limit` / `date_type`，evidence 仍 []；`helper:related_posts` 仍 gap）。[PR #99](https://github.com/songxychn/halo-butterfly-next/pull/99) 已合入（页脚 `footer.owner` / `copyright` / `custom_text`，evidence 仍 []；`footer.nav` 仍 gap）。[PR #101](https://github.com/songxychn/halo-butterfly-next/pull/101) 已合入（打赏 `reward.enable` / `text` / `QR_code`，evidence 仍 []；reward 模板/交互仍 gap）。[PR #103](https://github.com/songxychn/halo-butterfly-next/pull/103) 已合入（文章版权 `post_copyright.enable` / `decode` / `author_href` / `license`，evidence 仍 []；template 仍 gap）。[PR #107](https://github.com/songxychn/halo-butterfly-next/pull/107) 已合入（页脚导航 `footer.nav`，evidence 仍 []）。[PR #110](https://github.com/songxychn/halo-butterfly-next/pull/110) 已合入（页脚背景 `footer_img`，evidence 仍 []）。[PR #113](https://github.com/songxychn/halo-butterfly-next/pull/113) 已合入（页脚遮罩 `mask.footer`，evidence 仍 []）。[PR #116](https://github.com/songxychn/halo-butterfly-next/pull/116) 已合入（页头遮罩 `mask.header`，evidence 仍 []）。[PR #119](https://github.com/songxychn/halo-butterfly-next/pull/119) 已合入（侧栏隐藏 `aside.hide`，evidence 仍 []）。[PR #122](https://github.com/songxychn/halo-butterfly-next/pull/122) 已合入（侧栏移动端 `aside.mobile`，evidence 仍 []）。[PR #125](https://github.com/songxychn/halo-butterfly-next/pull/125) 已合入（侧栏隐藏开关 `aside.hide_button`，evidence 仍 []）。[PR #128](https://github.com/songxychn/halo-butterfly-next/pull/128) 已合入（页脚模板 `includes/footer`，evidence 仍 []）。[PR #131](https://github.com/songxychn/halo-butterfly-next/pull/131) 已合入（右侧栏 `includes/rightside`，evidence 仍 []；footer.styl / rightside.styl 仍 gap）。[PR #134](https://github.com/songxychn/halo-butterfly-next/pull/134) 已合入（右侧栏 `rightside_scroll_percent`，evidence 仍 []）。[PR #137](https://github.com/songxychn/halo-butterfly-next/pull/137) 已合入（右侧栏 `rightside_bottom`，evidence 仍 []；footer.styl / rightside.styl 仍 gap）。[PR #140](https://github.com/songxychn/halo-butterfly-next/pull/140) 已合入（阅读模式 `readmode`，evidence 仍 []；`readmode.styl` / item_order 仍 gap）。[PR #143](https://github.com/songxychn/halo-butterfly-next/pull/143) 已合入（繁简转换 `translate.enable`，evidence 仍 []；encoding/delay/msg / item_order 仍 gap）。[PR #146](https://github.com/songxychn/halo-butterfly-next/pull/146) 已合入（深色模式按钮 `interaction:darkmode`，evidence 仍 []）。[PR #149](https://github.com/songxychn/halo-butterfly-next/pull/149) 已合入（深色模式 `autoChangeMode` / `start` / `end`，evidence 仍 []）。[PR #152](https://github.com/songxychn/halo-butterfly-next/pull/152) 已合入（深色模式样式 `darkmode.styl`，evidence 仍 []）。[PR #155](https://github.com/songxychn/halo-butterfly-next/pull/155) 已合入（阅读模式样式 `readmode.styl`，evidence 仍 []）。[PR #158](https://github.com/songxychn/halo-butterfly-next/pull/158) 已合入（页脚样式 `footer.styl`，evidence 仍 []）。[PR #161](https://github.com/songxychn/halo-butterfly-next/pull/161) 已合入（右侧按钮栏样式 `rightside.styl`，evidence 仍 []）。[PR #164](https://github.com/songxychn/halo-butterfly-next/pull/164) 已合入（侧栏样式 `aside.styl`，evidence 仍 []）。[PR #167](https://github.com/songxychn/halo-butterfly-next/pull/167) 已合入（页头样式 `head.styl`，evidence 仍 []）。[PR #170](https://github.com/songxychn/halo-butterfly-next/pull/170) 已合入（分页样式 `pagination.styl`，evidence 仍 []）。[PR #173](https://github.com/songxychn/halo-butterfly-next/pull/173) 已合入（文章页样式 `post.styl`，evidence 仍 []）。[PR #176](https://github.com/songxychn/halo-butterfly-next/pull/176) 已合入（相关文章样式 `relatedposts.styl`，evidence 仍 []）。[PR #179](https://github.com/songxychn/halo-butterfly-next/pull/179) 已合入（打赏样式 `reward.styl`，evidence 仍 []）。[PR #182](https://github.com/songxychn/halo-butterfly-next/pull/182) 已合入（移动侧栏样式 `sidebar.styl`，evidence 仍 []）。[PR #185](https://github.com/songxychn/halo-butterfly-next/pull/185) 已合入（聊天按钮样式 `chat.styl`，evidence 仍 []）。[PR #188](https://github.com/songxychn/halo-butterfly-next/pull/188) 已合入（评论区样式 `comments.styl`，evidence 仍 []）。[PR #191](https://github.com/songxychn/halo-butterfly-next/pull/191) 已合入（全屏加载样式 `loading.styl`，evidence 仍 []）。[PR #194](https://github.com/songxychn/halo-butterfly-next/pull/194) 已合入（第三方组件样式 `third-party.styl`，evidence 仍 []；`_layout/*.styl` 现已全部待验）。[PR #197](https://github.com/songxychn/halo-butterfly-next/pull/197) 已合入（页面通用样式 `common.styl`，evidence 仍 []；`homepage.styl` / item_order 仍 gap）。下一刀是 [#198](https://github.com/songxychn/halo-butterfly-next/issues/198)（`style:source/css/_page/homepage.styl`；已落地的 common/third-party/loading/comments/chat/sidebar/reward/relatedposts/post/pagination/head/aside/footer/rightside 不得升 verified；#95/#96 为 #94 重复开票仍 OPEN），尚未完成；双站对照后才把相关矩阵项从待验推进。站点级 PAGE-01/A11Y/PERF 仍是 RC 门禁。
3. DEC-01/02/03 决策样例：搜索/评论提供方、标签语法、PWA/PJAX/生成器，用可运行双站差异提请维护者裁定；裁定前不删减矩阵分母。
4. 双站已知的其他视觉差异继续保留，见[对照初检](validation/2026-09-06/comparison-initial.json)。提供方替代、内容语法兼容等实质取舍在有具体样例后交维护者裁定。

当前截图、HTTP 通过和 alpha 包一致性均不是完整视觉、交互、无障碍或性能验收。尚未通过的真实浏览器/真机、插件联调、迁移生命周期、扩展能力与发行条件继续保持未完成。保持仓库私有；公开、历史重写及正式 1.0 发布须维护者确认。
