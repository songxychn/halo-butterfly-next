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

## 可核对的上游兼容修复候选

CommentWidget [v3.3.2](https://github.com/halo-dev/plugin-comment-widget/blob/v3.3.2/packages/comment-widget/src/utils/upload-api.ts)
和 [v3.4.0](https://github.com/halo-dev/plugin-comment-widget/blob/v3.4.0/packages/comment-widget/src/utils/upload-api.ts)
都直接将 File append 到 FormData，这一函数的源代码相同。可以在官方上传边界将
File 重新包装，并保留 name、type、lastModified，避免把引擎兼容代码放进主题。

已准备[最小补丁](upstream/comment-widget-file-rewrap.patch)，对官方 v3.4.0 源文件的
`git apply --check` 通过，补丁核心包装表达式已在上述八个对照格验证。
**补丁没有安装、发布或向上游提交；完整官方插件构建、浏览器流程及实际 Safari
仍未验证，不能把它当成已交付修复。** 本仓库只是保存复现和修复候选。

此前失败的完整图片草稿流程继续保留。直接上传成功、升级测试工具仍失败，或最小
重包装对照成功，都不足以关闭 1.0 的该项完整验收。
