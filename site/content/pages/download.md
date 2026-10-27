# 下载与预览说明

这组内容面向 Halo Butterfly Next 1.0.0 发行候选版。安装包已准备，尚未公开发行，也未打 tag。已公开版本与附件以 [GitHub Releases](https://github.com/songxychn/halo-butterfly-next/releases) 为准；本地预览不代表公网站点已经升级。

候选安装文件为 `halo-butterfly-next-1.0.0.zip`，核对维护者提供的 `SHA256SUMS` 后使用。正式发布后再从对应发行页获取安装包、源码与验证记录。GitHub 自动生成的 Source code 压缩包不能直接安装为主题。

## 平台与验证范围

建议使用 Halo 2.27.1；主题最低声明为 Halo ≥2.20.2，声明不代表所有版本均已验证。当前本地预览使用 Halo 2.27.1 官方包与主题 1.0.0 候选包。搜索和评论插件在这个预览实例中停用，文章和单页也不开放评论提交。

插件教程介绍 SearchWidget 1.8.0、CommentWidget 3.3.2；两者均要求 Halo ≥2.26.0。教程中的版本要求与本地实例是否启用插件是两回事。

## 当前已知限制

- SearchWidget 1.7.1 的关闭焦点恢复问题已在 1.8.0 修复；旧版限制仍需留意。
- #338 的静态资源请求问题已在 Halo 2.27.1 官方包限定复验通过，不再列为当前发行阻塞。
- 所测 Playwright WebKit 的评论图片草稿刷新后恢复上传失败；新选图片直接上传对照正常，不外推实际 Safari。
- 明亮顶图上的文字可能对比不足，建议选择文字区域较暗的背景。
- 恢复 Butterfly 原有动画后，没有新的性能预算通过结论。
- 真机 Safari、完整无障碍和任意插件版本组合未穷尽；不承诺全部 Halo 版本或完整 Hexo Butterfly 等价。

首次使用见[快速开始](../tutorials/getting-started.md)，已有站点先阅读[升级与回退](../tutorials/upgrade.md)。其他问题见[常见问题](faq.md)。
