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

## 已确认问题与下一步

1. 基础菜单修正与矩阵门禁已完成；16 张双站初检截图发现的字幕和视觉差异继续保留，见 [对照初检](validation/2026-09-06/comparison-initial.json)。
2. [#7 公共布局](https://github.com/songxychn/halo-butterfly-next/issues/7)：Halo 实测 `pageLayout=MISSING`。按官方 `html(head, content)` 契约实现，再用真实测试插件及亮暗/手机页面验收。
3. [#14 字幕开关](https://github.com/songxychn/halo-butterfly-next/issues/14)：补齐启用/禁用、静态首项和旧配置兼容；第三方服务枚举及 typed_option 全参数不随本包关闭。
4. [#16 两级导航](https://github.com/songxychn/halo-butterfly-next/issues/16)：修复关闭抽屉仍可聚焦、打开时焦点进入背景、宽度恢复时滚动锁残留及二级菜单键盘语义。全页欢迎按钮暗色对比度及其他人工判断仍待处理。
5. 从矩阵继续提取无依赖阻塞的功能包；平台提供方替代、内容语法兼容等实质范围问题在具备具体样例和差异后交维护者裁定。

当前截图、HTTP 通过和 alpha 包一致性均不是完整视觉、交互、无障碍或性能验收。尚未通过的真实浏览器/真机、插件联调、迁移生命周期、扩展能力与发行条件继续保持未完成。保持仓库私有；公开、历史重写及正式 1.0 发布须维护者确认。
