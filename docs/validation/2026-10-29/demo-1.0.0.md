# 公网 Demo 1.0.0 部署验证

2026-10-29 经维护者授权，https://butterfly.baizhukui.com/ 已独立升级至 v1.0.0。

- 源码：`41cc26b192877e870991df4d508463e01a570a87`。
- 主题 ZIP SHA-256：`3280eefb3eb4782508e584f14af9df113cd08952f3d170d49411ad3cd782483b`。
- [Demo 工作流](https://github.com/songxychn/halo-butterfly-next/actions/runs/40899010338)通过公开制品下载校验、镜像构建、全新 H2 初始化与重启检查。
- [公网版本回执](https://butterfly.baizhukui.com/site-assets/demo-version.json)的 tag/sourceSha/themeSha256 与 Release 一致，published=true、ready=true、contentCount=19。
- 服务器已安装主题的 254 个文件集合及字节与公开 ZIP 一致。
- 首页、归档、分类、标签、`/docs`、`/archives/demo-guide` 和 17 个主题资源 HTTP 检查通过。
- 独立无头 Chromium 桌面页面正常；官方搜索“灯箱”返回结果，并经 Enter 导航到 `/archives/images`；390px 窄屏正文无横向溢出。

旧实例与回退材料保留，既有更新检查已恢复。本次没有额外执行线上回退演练，不代表真实手机、所有浏览器或插件业务矩阵通过。截图与内部环境材料不入库；正式 Release 标签及附件不因这次部署改变。
