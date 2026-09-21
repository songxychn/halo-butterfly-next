# 来源与许可证

| 资源 | 来源/用途 | 许可 |
| --- | --- | --- |
| 原 Halo Butterfly 代码 | dhjddcn/halo-theme-butterfly，保留完整历史 | GPL-3.0 |
| Hexo Butterfly 5.7.0 | jerryc127/hexo-theme-butterfly；已有样式改写及繁简字表提取，未直接导入其构建系统 | Apache-2.0；固定原文及本项目归属说明随源码和 ZIP 分发，见 [改写来源清单](../third-party-licenses/UPSTREAM-ATTRIBUTION.txt) |
| normalize.css 8.0.1 | 从固定 Hexo 源码继承，改为 SCSS 并限定 `.container` 选择器 | MIT；保留 Nicolas Gallagher / Jonathan Neal 版权及[官方许可原文](../third-party-licenses/normalize-8.0.1-LICENSE.md)，不改标 Apache-2.0 |
| Font Awesome Free 6.7.2 | npm `@fortawesome/fontawesome-free`，本地图标 | 图标 CC BY 4.0、字体 SIL OFL 1.1、代码 MIT；包内附上游许可证 |
| Prism 1.29.0 | 原主题 vendored JS/CSS，高亮及代码主题 | MIT；包内补入同版本上游 LICENSE |
| Viewer.js 1.14.0 | 图片灯箱；[官方固定版源码](https://github.com/fengyuanchen/viewerjs/tree/v1.14.0) | [MIT](https://github.com/fengyuanchen/viewerjs/blob/v1.14.0/LICENSE)；完整版权及许可正文随包分发 |
| jQuery、Clipboard、Tocbot、Typed.js | DOM、复制、目录、打字机 | MIT；许可证随包分发 |
| ECharts | 原分类统计页面 | Apache-2.0；许可证随包分发 |
| Animate.css | 原有动画 | MIT；许可证随包分发 |
| `src/images/above.svg` | Halo Butterfly Next 原创装饰图 | GPL-3.0，同本主题 |

确切依赖版本由 `pnpm-lock.yaml` 锁定。第三方许可证位于安装包的 `templates/assets/licenses/` 及相应插件目录。

非 npm 改写内容由 [upstream-sources.json](../third-party-licenses/upstream-sources.json) 记录固定提交、官方许可证 URL、原文字节 SHA-256 和本地来源映射。Hexo 固定为 `f223b1888b42b2b336068e6c959ed90a3cd7c8f3`；normalize 8.0.1 固定为 `fc091cce1534909334c1911709a39c22d406977b`。固定 Hexo 树没有上游 NOTICE；`UPSTREAM-ATTRIBUTION.txt` 是本项目编写的归属和修改说明，不冒充上游 NOTICE。改写源文件保留来源/修改注释，构建与包检查保证两份未改写的官方许可及此说明进入 ZIP。

构建会递归收集运行时依赖的 LICENSE/NOTICE，包括 ECharts 的 ZRender/tslib 和 Clipboard 的间接依赖。good-listener 1.2.2、delegate 3.2.0、select 1.1.2 的 npm 包在 README 中声明 MIT 和 Zeno Rocha 版权，安装包同时保留这些原始声明及 MIT 正文。

原主题所带 Font Awesome Pro、CircularBody/HarmonyOS 字体和默认照片已从当前源码与安装包移除。Git 历史保留上游记录；这些旧资源不包含在 Next 新发行包的许可承诺中。默认系统字体由访问者操作系统提供。

发布前仍应检查本次实际安装包及新增依赖；新增上游文件时登记来源、版本和对应许可证，不能用主题主许可证替代第三方声明。

公开 alpha 准备中移除了来源尚未逐项核实的两份继承 `.cur` 光标，改用操作系统的默认/链接光标；不随包分发光标文件。四张未被当前文档引用的继承 PNG（`metadata.png`、`renderings.png`、`sponsor.png`、`user.png`）也已从当前源码移除。当前 README 的预览图继续使用本项目合成测试站截图。这里描述当前源码与新构建包，不表示完整 Git 历史已经清理；公开历史的处理方式仍须单独确认。

2026-09-22 更正：此前将 Fancyapps UI 5.x 标为 GPLv3 不正确。[v5 官方许可](https://v5.fancyapps.com/license/)对开源项目分发另有授权要求；主题运行时代码、内嵌 CSS、直接依赖和新发行 ZIP 已移除该实现，改用 Viewer.js。比较实验室固定的上游 Hexo 参考站保留其自身依赖，仅供本地对照测试，不进入本主题 ZIP，也不据此承诺有权重新分发上游参考站。Git 历史及旧发行物的公开处理仍需单独核查，当前替换不能追溯改变旧内容的许可。
