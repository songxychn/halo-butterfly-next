# 首次上架整改：字体与交付范围

2026-10-07。本轮完成 hopscotch 在线字体整改、[审核差距清单](../../APP-STORE-READINESS.md)及[首发范围和验收项](../../APP-STORE-FIRST-RELEASE.md)。**这是开发整改验证，不是正式首发验收通过。** 结构化结果见[摘要](store-review-remediation.json)。

## 安装包身份

- 起点：`a5471a907fdf0c80a79778b0279485174f24c129`，在有未提交修改的工作树上构建；修改文件摘要见结构化结果。实验室调用方声明的 `sourceCommit` 记录起点，不能视作本轮包的完整源码提交。
- 本地开发 ZIP：`dist/halo-butterfly-next-0.1.0-alpha.3.zip`，SHA-256 `14f9072c8597e487333fcbf721a703f8843bf8b25af845407f467212b514f0f3`，129 文件。未发布或替换公开 alpha.3 安装包，不用于市场重提。
- Node 24.11.0 / Bun 1.4.0，`bun install --frozen-lockfile --ignore-scripts` 和 `bun run verify` 成功，581 测试通过、0 失败；包检查通过。
- 新 ZIP 的 52 份 CSS 均可解析，未发现 Google Fonts 域名。hopscotch 与源码字节相同；对比起点 CSS，除在线导入、字体声明和修改注释外的规则保持相同。
- 分别在本地开发包注入 `fonts.googleapis.com` 和 `fonts.gstatic.com`，包检查均以在线字体错误拒绝。检查后恢复原 ZIP，核对字节相同并再次通过包检查。

## 真实 Halo 局部回归

独立 loopback Halo 2.26.1，H2、可选插件全部关闭，端口 `18407`；官方 JAR 固定摘要 `7a1d6ea0800e8940672aab99a7328b7bd9520e297677169594328004a41991bc`。比较参考站端口 `14407`。全新实验室成功初始化并播种 13 个内容对象，安装后的 129 文件与 ZIP 逐字节一致。

通过本地 API 保存配置备份，将代码亮色/暗色配色均设为 hopscotch。独立无头 Chromium 152.0.0.0 访问真实文章 `/archives/preview-1`，检查以下四组：

| 视口 | 主题模式 | 结果 |
| --- | --- | --- |
| 1440 × 1000 | light | 系统等宽字体、高亮、复制成功反馈、折叠及重新展开通过；Google Fonts 请求 0 |
| 1440 × 1000 | dark | 同上 |
| 390 × 844 | light | 同上 |
| 390 × 844 | dark | 同上 |

实际计算字体为 `Menlo, Monaco, "Lucida Console", "Courier New", Courier, monospace`。四张局部开发截图及原始检查结果保存在 `.evidence/store-review-remediation-20261007/`，对应摘要见 JSON；已人工查看桌面亮色及手机暗色截图。这些图用于代码字体整改检查，不作为最终市场截图，未完成 hopscotch 全面对比度验收。

初次实验室启动因沙箱不能连接本机代理而失败，受控沙箱外执行后成功；原始日志保留。最初误用 `/archives/article` 返回真实 404，核对夹具后改用实际路由。复制检查初次未等待异步反馈，断言失败；改为等待真实 `.copy-notice` 生成，保留原始失败日志。浏览器剪贴板读取返回 `NotAllowedError`，本轮只确认真实点击的成功反馈，不声明剪贴板逐字节比对通过。截图改用绝对路径后保存并核对文件摘要。

可复核入口：

```sh
bun install --frozen-lockfile --ignore-scripts
bun run verify
# 首次运行可用 HALO_JAR_SOURCE 指向固定官方 JAR 缓存
LAB_RUNTIME="$PWD/.runtime/store-review/lab" HALO_PORT=18407 HEXO_PORT=14407 \
  python3 scripts/lab/lab.py bootstrap \
  --package dist/halo-butterfly-next-0.1.0-alpha.3.zip \
  --source-sha a5471a907fdf0c80a79778b0279485174f24c129
```

上述命令对应本轮修改工作树；正式候选必须先冻结完整源码提交，再以该提交和新包摘要重新执行。原始脚本、日志与截图在忽略目录中，不含公开验收承诺；凭据及配置备份以权限 0600 保存在本地运行目录。检查结束后已恢复并核对原配置，关闭本任务浏览器和两个归属明确的实验室进程。

## 仍待完成

未运行完整 Firefox/WebKit 矩阵、实际手机、安装升级回退、搜索评论及插件生态的正式验收。#338 资源挂起、#313 搜索关闭焦点、明亮顶图可读性及性能结论仍按首发清单收口。市场兼容字段未读取，正式版本、兼容范围、最终界面截图和市场重提尚未执行。本轮没有修改 1.0 合同或提升功能矩阵验收状态。
