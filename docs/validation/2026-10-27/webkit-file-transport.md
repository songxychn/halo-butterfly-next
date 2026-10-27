# WebKit 图片草稿上传：独立传输复现与修复候选

本批没有请求 Halo、修改主题、修补官方插件或更换既有验收浏览器。
使用临时 loopback HTTP 回显服务、全新私有磁盘 profile、真实 IndexedDB File
存储与页面刷新，再由浏览器直接提交 FormData。报告见[32 格矩阵](webkit-transport-matrix.json)。

现用 Playwright 1.63.0 / WebKit 26.6 与独立安装的正式
[Playwright 1.64.1](https://github.com/microsoft/playwright/releases/tag/v1.64.1) / WebKit 27.2，
分别用 Node 24.22.1 和 Bun 1.4.0 驱动。每组再比较有无 `route.continue` 拦截。
这不是实际 Safari、手机或 Linux WebKit 验证，也不是完整官方插件端到端验收。

| 输入 File | 四种版本/运行时 × 两种拦截模式 | 服务端结果 |
| --- | --- | --- |
| 新建 File | 8/8 正常 | 195 字节 multipart，包含正确十字节文件内容 |
| IndexedDB 恢复出的原 File | 8/8 复现失败 | File.size=10、File.text() 正确，但 HTTP 请求体为零字节 |
| `new File([restored], name, metadata)` | 8/8 正常 | multipart 和文件内容正确，文件名/类型/修改时间保留 |
| 从 `arrayBuffer()` 重建 File | 8/8 正常 | 同上 |

新旧版本和 Node/Bun 都复现，排除了仅由 Bun 或路由拦截造成的解释。
这将问题缩小到**所测 WebKit 对 IndexedDB 恢复 File 的 multipart 传输路径**；
没有证明 WebKit 内部的精确实现根因，也不能外推实际 Safari 同样受影响。
没有把失败格删除或把零字节请求的 HTTP 200 误判为上传成功。

## 维护结论与历史材料

按维护者批准的 [DEC-09](../../parity/DEC-09-RELEASE-CLOSURE.md)，本问题作为所测 WebKit / 官方评论插件图片草稿刷新路径的已知限制，不再默认阻塞主题 1.0。不承诺刷新后的图片草稿可靠续传；直接上传成功只覆盖原记录场景。

一次性传输诊断已结束。上游补丁和三个独立诊断入口从当前树移除，不维护、不构建或安装定制插件，不继续矩阵或上游提交。原始失败、32 格结果和报告/脚本哈希保持原样；重新包装对照成功仍不等于完整插件流程已修复。

以下固定 Git 快照供追溯原实验，不是当前执行入口：

- [原上游补丁](https://github.com/songxychn/halo-butterfly-next/blob/409e79cc6e4bc027b35d2972b8854efcfbc61b28/docs/validation/2026-10-27/upstream/comment-widget-file-rewrap.patch)：曾通过 v3.4.0 源码 apply-check；未安装、发布或提交上游。
- [IDB File 对照源码](https://github.com/songxychn/halo-butterfly-next/blob/409e79cc6e4bc027b35d2972b8854efcfbc61b28/scripts/acceptance/comments/idb-control.mjs)，对应 [原报告](upload-idb-control.json)。
- [multipart 对照源码](https://github.com/songxychn/halo-butterfly-next/blob/409e79cc6e4bc027b35d2972b8854efcfbc61b28/scripts/acceptance/comments/transport-control.mjs)，对应 [原报告](upload-transport-control.json)。
- [版本/运行时传输矩阵源码](https://github.com/songxychn/halo-butterfly-next/blob/409e79cc6e4bc027b35d2972b8854efcfbc61b28/scripts/acceptance/comments/transport-matrix.mjs)，对应 [32 格结果](webkit-transport-matrix.json)。
