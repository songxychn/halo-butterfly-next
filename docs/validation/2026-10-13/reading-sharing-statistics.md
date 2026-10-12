# 阅读、分享与统计的限定验收

2026-10-13。本轮开发对应 [#395](https://github.com/songxychn/halo-butterfly-next/issues/395)，固定参考 Butterfly 5.7.0；配置、迁移和回退见[使用说明](../../READING-SHARING-STATISTICS.md)。矩阵的 25 条对应项维持 `implemented-unverified`。

源码提交、安装 ZIP、Halo JAR、工程日志、浏览器报告及截图的摘要见[机器记录](reading-sharing-statistics.json)。原始材料保留在本任务忽略目录 `.runtime/reading-statistics/`，未提交凭据、数据库或运行环境。记录只属于其中列出的提交及包，后续变更须重新核对。

| 检查 | 结果 |
| --- | --- |
| `bun run verify` | 612 项测试通过；类型、矩阵、构建及 151 文件包检查通过 |
| 实际服务 | 独立本地 Halo 2.26.1 / Corretto 25；13 篇公开合成文章与一个单页 |
| 浏览器 | Chromium 152 无头；1440×1000、390×844，各自亮色/暗色 |
| Share.js | 5 个配置平台、可访问名称、外链 HTTPS、本地微信二维码；Escape 收起且保留键盘焦点 |
| 系统分享 | 模拟 Web Share 成功、取消及拒绝；正确传递标题与规范链接 |
| AddToAny | 阻断在线脚本后保留平台 URL 和手动链接 |
| 不蒜子 | 页面 PV、站点 PV/UV 标记正确；阻断服务后保留“暂不可用” |
| 统计资源边界 | 仅启用站点 PV/UV、关闭文章 PV 时，文章页无统计节点且不加载在线统计脚本 |
| 字数 | 真实服务端中英混合正文与实体解码结果一致；全站汇总 566 字；阻断 API 不显示部分总数 |
| 复制、繁简 | 链接复制成功/拒绝回退；正文版权追加，代码复制不受干扰；转换保护代码、脚本与 `translate=no` |
| 全部关闭 | 不生成字数、分享、转换或统计节点；正文普通复制按配置阻止，代码不受干扰 |
| 布局 | 五种配置共 20 组亮暗/桌面/手机视口，无页面横向溢出；截图复核分享区域，修正暗色 X 图标 |

剪贴板和系统分享采用页面内模拟，不能当作操作系统剪贴板或系统面板验收。在线统计与分享脚本在首次真实导航前阻断；没有提交真实分享账号，也没有验证第三方计数准确性。浏览器请求失败测试用于验证回退，不能当作在线服务联调结果。

早期 runner 曾在拦截前导航，导致不蒜子真实响应进入失败模拟；另一次使用了当前 CLI 不支持的 `addinitscript`。两份失败报告摘要原样保留在机器记录中；修正 runner 后重新执行，不改写失败结果。本地登录准备也曾短暂失败，重新认证后完成对应场景。

本轮没有完成固定双站全量对照、Firefox/WebKit/真机、全局键盘与读屏合同、最低 Halo 版本专项或性能门禁；不代表完整 1.0 验收或发行通过。全站汇总逐篇读取公开正文，大型站点成本见使用说明。

复现时先按[实验室说明](../../COMPARISON-LAB.md)建立属于自己的隔离 runtime、构建安装包，再使用：

```sh
python3 scripts/reading/statistics-lab.py sharejs --runtime .runtime/reading-statistics
bun scripts/reading/check-statistics-browser.mjs \
  http://127.0.0.1:18116/archives/reading-sharing-fixture \
  sharejs .runtime/reading-statistics/browser-sharejs.json
python3 scripts/reading/statistics-lab.py restore --runtime .runtime/reading-statistics
```

可分别替换 preset 为 `native`、`addtoany`、`busuanzi`、`off`；端口须使用自己 runtime 的端口。配置脚本只接受带所有权标记且进程属于该 runtime 的本地实验室，只创建专用合成文章。

## 合并最新 master 后的回归

PR #400 创建时，`master` 已合并 SEO/代码注入 PR #398。普通合并 `329463a0088a5c5ed2066a169ea9b6a93952ba44`，保留两边历史；变更记录保留两项功能，默认配置和矩阵从合并源重新生成。共享布局补充绝对规范链接变量，供正文版权复制和分享使用；SEO 关闭也保留这些链接。

新源码 `ac8e017ce6f8b5f73fe0e1dea5cf538444a53c75` 的安装包和回归见[独立合并记录](reading-sharing-statistics-merged.json)。`bun run verify` 再次通过 612 项测试及 154 文件包检查；五种阅读配置重跑通过 36 项检查、20 组布局，另外关闭 SEO 的系统分享配置通过 8 项检查、4 组布局。受共享布局影响的 SEO/注入 runner 通过 52 项检查并恢复全部合成配置。新结果有自己的包摘要，原 151 文件包与旧报告保持原身份。
