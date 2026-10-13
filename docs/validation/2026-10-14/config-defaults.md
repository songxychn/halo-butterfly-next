# 配置简化与默认体验：限定验证

日期：2026-10-14（Asia/Shanghai）。[机器记录](config-defaults.json)保存输入摘要、逐项结果、原始失败及环境边界。本次对应未提交工作区，基础提交为 `5622798dd06306c8b56b519581d807cd4f473b70`；包含既有资源和内容扩展改动，不能把 HEAD 单独视作候选源码。

## 实现范围

按维护者批准的 [DEC-08 清单](../../parity/DEC-08-CONFIG-DEFAULTS-DRAFT.md)完成九项：首页统一七种布局；配色统一 system/light/dark/schedule；代码折叠使用语义三态；字幕默认本地且无文案时静默；资源统一根地址和单项覆盖；顶图按页面类型独立控制；分类默认列表；标签默认标签云；头像默认静止。旧字段只由离线迁移工具转换。Pace 由另一个分叉实现。

统计图从公共工具静态依赖移到按需 `charts` 包，保留分类、标签和归档统计。失败时保留文本链接，页面切换清理实例、监听和观察器；加载脚本参与 PJAX 精确地址识别。新代码未拆开已打包的其他库。

## 最终身份与结果

| 项目 | 结果 |
| --- | --- |
| 源码/构建输入摘要 | `d170b1d80d3458dcff7bbb7e66e07cc41fe0a7d52c4b8b4f253c7f42ea9cb8d4` |
| ZIP SHA-256 | `e8c72d2843a861c6577492dc5473c7c3381d1983cdce7b6ee8b3715668f03c93` |
| `bun run verify` | 类型检查、897 条矩阵检查、657 项测试（127 文件）、构建、160 文件包检查全部通过 |
| 真实 Halo 2.26.1 | 40/40 组；包括两种视口七布局、主题覆盖/恢复、代码三态、资源回退、图表按需/失败回退及六次 PJAX 跳转 |
| 顶图补充 | 16/16；四场景 × 桌面/手机视口 × 亮/暗，覆盖原生单页封面及移除旧隐式回退 |
| ZIP 与实际安装 | 160 文件逐字节一致，无缺失或差异 |
| 配置与内容恢复 | 两个运行脚本均恢复并核对原配置；顶图脚本另恢复临时封面和注解 |
| 矩阵 | 28 条相关记录增加限定证据；897 条总量，0 条 verified，145 条 not-applicable，无新增 N/A |

安装包内首页、文章、分类、标签、归档脚本分别为 170542、274180、156872、157282、157852 字节，ECharts 位于独立 664472 字节的 charts 包。默认分类和标签没有请求 charts。这里只记录包字节和实际请求，不声称 LCP 或完整性能预算达标。

## 失败记录与修正

首次运行脚本误查不存在的 `.description`，改查实际 `.excerpt` 后保留原摘要断言。之后真实 PJAX 检查发现图表加载后导航退回整页加载：charts 脚本缺少生命周期标记；补齐标记及精确白名单后重建、重装，同一最终包两轮 40/40。

顶图首次补充为 12/16：实验环境在 Hexo 清理处中断，未复制 Halo 图片附件，封面 URL 返回 404。补齐固定夹具、核对 HTTP 图片与夹具字节后，原断言 16/16；随后在完整附件环境再次运行主检查，40/40。各失败报告及当轮包身份原样纳入机器记录，不用后续成功覆盖。

## 复验与边界

```sh
bun run verify
LAB_RUNTIME="$PWD/.runtime/config-defaults" HALO_PORT=18114 HEXO_PORT=14114 python3 scripts/config-defaults/validate.py
LAB_RUNTIME="$PWD/.runtime/config-defaults" HALO_PORT=18114 HEXO_PORT=14114 python3 scripts/images/validate.py --only post-empty-legacy single-empty-pure-color post-random-not-top-image single-default
```

运行脚本需要已初始化并安装候选包的隔离 Halo、固定夹具和 headless agent-browser。本轮为作者工作区、Halo 单站、Chromium 152；没有新的双站、Firefox/WebKit、真实 Safari/设备、屏幕阅读器、性能预算或真实第三方服务完整验收。公开 DEC 登记、独立审查、最终提交 CI 和完整 1.0 合同仍待完成；本次未发布或部署到外部站点。
