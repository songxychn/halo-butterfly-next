# 菜单配置与平台映射

主题使用 Halo 后台的主菜单。Halo 2.26.1 的 `MenuItem.spec.menuName` 和 `spec.parent` 组成树，模板递归读取 Finder 的 `children`；不使用已弃用的 `spec.children`。有子项的节点是展开按钮，叶节点保留 Halo 的链接、打开方式和图标。

菜单项的自定义属性提供 `icon` 和 `hide`。`hide` 的后台标签为“移动菜单默认折叠”，存储为字符串 `true` / `false`，缺省为 `false`。它对应 Butterfly 5.7.0 菜单组键第三段 `||hide`：只决定移动抽屉分组初始是否收起，不隐藏分组或叶节点。未指定时移动分组默认展开；桌面分组始终初始收起，由鼠标进入、Enter 或 Space 打开。每次重新打开抽屉恢复配置默认值。升级时，旧菜单没有 `hide` 注解的分组将从旧版默认折叠变为默认展开；如需保留原来的折叠状态，请为分组设置“移动菜单默认折叠”。

展开按钮具有独立的 `aria-controls` / `aria-expanded`。Escape 关闭最近的已展开分组，并把焦点放回该按钮；再按 Escape 可继续关闭外层或抽屉。移动分组不会因为 Tab 离开而折叠。抽屉继续提供焦点环、背景 inert、滚动锁和关闭后的焦点恢复。

固定上游只支持两层菜单；Halo 的多层菜单使用递归分组作为平台扩展。桌面二级及更深层级在同一个可滚动下拉面板内缩进展开，避免向侧面弹出时越出视口；移动端沿用缩进树。长子项换行，桌面下拉限制视口高度并允许滚动；移动菜单由整个抽屉滚动，没有上游的 1000px 内容裁切。桌面顶层过长的名称显示省略号并保留完整 title；顶层菜单总宽无法容纳时自动显示同一个菜单抽屉入口。

当前页面链接标记 `aria-current="page"`，祖先分组加粗。只匹配同源 HTTP(S) 的完整路径（忽略尾斜杠），不把父路径当当前页面；带查询参数的菜单链接要求查询一致，无查询参数的页面链接允许当前页有查询参数。锚点、命令和跨站链接不标记当前页。多层递归、超长菜单适配和当前路由标记是 Halo 端行为，不声称为固定上游已有能力。

## 对照来源

- [Butterfly 5.7.0 menu_item.pug](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/header/menu_item.pug)：两层渲染、组键第三段 hide。
- [Butterfly 5.7.0 sidebar.styl](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/source/css/_layout/sidebar.styl)：非 hide 分组默认展开。
- [Halo 2.26.1 MenuFinderImpl](https://github.com/halo-dev/halo/blob/v2.26.1/application/src/main/java/run/halo/app/theme/finders/impl/MenuFinderImpl.java)：菜单树生成、排序及 children。

## 验证边界

`fixtures/navigation/two-level.json` 显式配置 hide，保持现有键盘回归的初始折叠场景；Hexo 输出包含 `||hide`。`fixtures/navigation/options.json` 包含默认展开、显式折叠、三级树和 40 项长列表。`fixture.py halo-json` 保留任意层级，而 `hexo-json` 对三级树明确报错，避免制造并不存在的上游对照。`tests/navigation-state.test.mjs` 检查路径、查询参数及非法链接匹配。

真实 Halo 模板渲染、视口布局及键盘交互必须另行使用当前构建包验收，离线测试不能替代真实浏览器、Safari、真机或屏幕阅读器验收。矩阵记为 implemented-unverified，不表示全部 1.0 对照验收通过。
