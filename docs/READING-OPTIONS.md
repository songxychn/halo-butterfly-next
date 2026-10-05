# 文章与阅读配置

本批补齐目录与章节定位、单篇设置覆盖、正文图片说明、右侧工具栏排列。固定参考为 Hexo Butterfly 5.7.0（`f223b1888b42b2b336068e6c959ed90a3cd7c8f3`）的 `_config.yml`、`source/js/main.js`、`layout/includes/widget/card_post_toc.pug` 和 `layout/includes/rightside.pug`；使用 Halo 的[模型元数据](https://docs.halo.run/developer-guide/theme/annotations)表达逐篇覆盖。

## 目录和单篇覆盖

主题设置的“文章目录”提供 `toc.post`（默认开启）和 `toc.page`（默认关闭），分别控制文章和自定义页面。编号、默认展开、进度和简洁侧栏保留原有全局选项。简洁侧栏仅在目录开启时生效；关闭目录后恢复普通侧栏。

文章/自定义页的元数据新增 `toc`、`toc_number`、`toc_expand`、`toc_style_simple`。每项为“继承全局 / 开启 / 关闭”，存储为 `inherit` / `true` / `false` 字符串。显式单篇值优先，未填或旧配置缺字段时继承全局。自定义页的简洁侧栏继承值为关闭；显式开启是 Halo 适配扩展。

文章另有 `copyright`、`noticeOutdate` 三态开关，允许覆盖全局版权块和过期提醒开关。过期提醒仍遵守全局天数阈值、位置与样式；开启不代表尚未过期的文章也出现提醒。自定义页面不增加文章版权或过期提醒。

## 章节定位

- `anchor.auto_update` 默认关闭；开启后滚动更新当前章节 hash，使用替换历史记录，避免每次滚动增加“后退”次数。
- `anchor.click_to_scroll` 默认关闭；开启后正文标题提供可聚焦的章节链接，也支持点击标题定位。
- 目录跳转保留查询参数，支持后退、前进、直接打开和刷新。定位预留导航栏距离，遵守系统减少动态效果设置。
- 保留作者已有标题 ID；缺少 ID 时按标题生成，并为重名生成不同 ID。没有目录也可使用章节链接。标题内容变更后，自动生成的链接可能变化；需要长期链接时在正文固定 ID。

## 图片说明

`post.photofigcaption` 默认关闭，作用于文章和自定义页面正文。开启后优先显示图片 `title`，没有时显示 `alt`；空说明跳过，已有编辑器图注不重复生成。

保留原图片、链接和 `picture` 节点及替代文本。单图 `figure` 使用 `figcaption`，普通段落图片使用块级显示的 `span`，避免把非法块元素塞进段落。说明按纯文本显示。灯箱沿用既有入口。

## 工具栏

`rightside.item_order.enable` 默认关闭。开启后，`hide` 为展开后显示组，`show` 为常驻组，按英文逗号分隔按钮标识。支持 `readmode`、`translate`、`darkmode`、`hideAside`、`toc`；功能本身关闭或当前页面不适用时不会因排序而创建入口。重复项以展开组首次出现为准，未知项忽略，未列出的按钮隐藏，返回顶部始终保留。

空组沿用上游默认：展开组 `readmode,translate,darkmode,hideAside`，常驻组 `toc,chat,comment`；其中 `chat` 和 `comment` 尚无主题按钮，不因本批配置而接入。只保留当前视口不可用按钮的展开组不显示空齿轮。手机目录沿用 1100px 断点，侧栏按钮沿用 900px 断点。

`rightside.config_animation` 默认开启，控制齿轮旋转；减少动态效果时关闭动画。展开组收起后不可 Tab 进入，组内按 Escape 收起并将焦点返回齿轮。

## 升级与验收边界

章节浏览器回归使用独立无头 agent-browser：在合成测试站准备含至少两级标题的文章/单页，开启目录及两个章节定位选项，然后运行 `node scripts/reading/check-browser.mjs http://127.0.0.1:<端口>/<路径>/ .evidence/reading/anchors.json`。脚本检查章节 ID、点击、焦点、历史、刷新和滚动更新，并输出 JSON 与截图；它不修改服务端配置，不代替完整浏览器矩阵。

旧配置缺新增字段时采用上述默认值；自定义页面目录默认关闭，可通过 `toc.page` 或单页元数据开启。原代码复制注解保持不变。回退旧包后新增字段不再使用，不需要删除文章正文或配置。

本批不实现分享、复制附带版权、文章编辑入口、字数算法或外部服务，也不解除已有资源加载和公开 alpha 门禁。矩阵只更新为有实现待完整对照验收，不提升 `verified`。性能默认配置快照随新设置重新冻结，旧性能测量结果不迁移到新候选。
