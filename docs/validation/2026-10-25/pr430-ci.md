# PR #430 菜单夹具 CI 补充

首轮精确提交 `c277eb433bbf67ee17a3300b8a698701456a66d3` 的 [CI 40197550170](https://github.com/songxychn/halo-butterfly-next/actions/runs/40197550170) 为 794 通过、2 失败。`navigation-fixture.test.mjs` 的顶层 parent 校验及多层菜单场景分别触发 30 秒超时；原记录保留，不用重跑同 SHA 覆盖。

测试原本同步调用 Python CLI。`0e211c13839bd8d9eb883f09dcc18767b945d658` 改为异步等待 stdout，异常输入由 `assert.rejects` 接收；五个测试、Python 代码、全部正负断言和全局 30 秒门禁不变，没有新增重试。

修正提交的 [CI 40197981627](https://github.com/songxychn/halo-butterfly-next/actions/runs/40197981627) 为 completed/success：796/0，类型与固定上游矩阵检查通过，269 文件包检查及二次构建字节比较通过。两个原超时场景分别在约 82ms、469ms 通过。源码及原始日志哈希见[机器记录](pr430-ci.json)。

这是限定的测试等待方式修正，尚未证实 Bun 的精确内部根因，不宣称所有偶发 CI 超时已解决。产品源码和正式包未因此改变；本地独占性能测试使用冻结工具和冻结包，不与本地测试进程并跑。后续提交的 CI 以 PR 实际 head 为准，此记录仅证明上述精确提交。
