# 两级导航键盘场景

这是 issue #16 的独立合成场景，不改 `fixtures/comparison/` 的五项基础导航。两级菜单使用“首页 / 内容（归档、关于）/ 标签”，空菜单使用单独菜单身份。所有正文路径指向隔离站现有合成内容。

固定对照为 Butterfly 5.7.0 / `f223b1888b42b2b336068e6c959ed90a3cd7c8f3`，参考 `layout/includes/header/menu_item.pug`、`source/js/main.js` 的 `clickFnOfSubMenu`/`sidebarFn`/resize处理。上游桌面为hover、手机分组按点击折叠，默认非hide组展开。当前这包补齐现有Halo折叠菜单的disclosure与抽屉键盘语义；上游hide默认/注解映射、长菜单宽度、导航固定和当前路由高亮仍独立待实现，不把键盘完善写成上游已有能力。

[Halo 官方菜单接口](https://docs.halo.run/developer-guide/theme/finder-apis/menu)说明：2.26起通过 `MenuItem.spec.menuName` 与 `spec.parent` 建树，模板读取 Finder 的 `children`。夹具不用已弃用的 `spec.children` 或 `Menu.spec.menuItems` 作为层级依据，重复ID及超出两级的输入明确拒绝，不静默截断。

## 生成与隔离播种

```sh
python3 scripts/navigation/fixture.py halo-json
python3 scripts/navigation/fixture.py hexo-json
```

两个命令只输出对应平台的菜单输入。为本轮任务提供的 `apply`/`restore` 辅助入口只允许显式 `http://127.0.0.1:18090`，必须传入已有认证客户端模块（公开 `BASE`、`Client().api(path, method, data)` 接口），不接触正式站。模块和凭据不入库；命令只输出菜单身份与计数。

```sh
python3 scripts/navigation/fixture.py apply \
  --client-module /absolute/path/to/local/halo-client.py \
  --backup .evidence/navigation/menu-restore.json \
  --base http://127.0.0.1:18090
# 空菜单使用相同恢复副本，不覆盖首次保存的设置：
python3 scripts/navigation/fixture.py apply \
  --fixture fixtures/navigation/empty.json \
  --client-module /absolute/path/to/local/halo-client.py \
  --backup .evidence/navigation/menu-restore.json \
  --base http://127.0.0.1:18090
python3 scripts/navigation/fixture.py restore \
  --client-module /absolute/path/to/local/halo-client.py \
  --backup .evidence/navigation/menu-restore.json \
  --base http://127.0.0.1:18090
```

播种前先生成完整计划，备份主菜单配置为0600；同名且不相容的合成资源拒绝覆盖。恢复只更新menu设置，保留主题、正文、其他系统组以及任务的非主菜单资源。重复播种沿用相同资源。

Hexo 在单独目录复制合成source及配置，改独立URL与本夹具menu，再用固定上游生成，在已确认空闲的独立端口启动。不能覆盖14000等基础对照站；保存所有复制输入SHA-256与这两处语义差异。

## 作者与独立审查复验

先安装当前源码生成的ZIP，并核验已安装文件/包哈希一致。每次改源码或合入master后重新构建与复验；相同alpha版本名会缓存旧资源，运行器每次新建独立headless会话。

```sh
pnpm verify
node scripts/navigation/check-browser.mjs http://127.0.0.1:18090 .evidence/navigation/two-level
# 激活 empty.json 后：
node scripts/navigation/check-browser.mjs http://127.0.0.1:18090 .evidence/navigation/empty --empty
```

真实浏览器运行器要求 PATH 提供 `agent-browser`，以工作树与进程独有会话启动headless Chromium；不会连接用户GUI或默认会话。该命令是有浏览器环境时的显式验收，当前CI的 `pnpm verify` 只自动跑夹具映射/拒绝无效输入等离线测试，不应误称CI已执行真实浏览器回归。

两级场景覆盖1440×1000/390×844、亮暗：Tab到父按钮、Enter/Space展开、Tab进入叶链接、Escape分层关闭及回归；鼠标hover可打开且Escape能在静止指针下关闭；子链接分别按Enter和指针导航；抽屉关闭hidden/inert、打开移焦点、Tab/ShiftTab循环、背景inert与滚动锁、按钮/遮罩关闭；桌面子菜单焦点缩到手机入口，手机抽屉扩大到桌面释放状态；重复初始化复用控制器；恢复overflow-x/y、优先级及其他内联样式。空菜单和搜索插件不可用不会破坏入口及关闭。

运行器还覆盖抽屉关闭时的390→1440、768→769按钮焦点回归，以及正文链接/正文失焦后不抢焦点的反例。它保存每项断言、导航局部axe（固定运行时版本记录在原始JSON）、焦点状态及截图。截图等待字体、可见懒加载图片与有限动画；没有注入修饰布局的CSS。报告中的axe违规和需人工判断需逐条保留，断言通过不代表全站或整个A11Y合同已验收。320px边界、恢复材料、源SHA/ZIP/插件/浏览器清单和独立审查记录随本地证据摘要补充。
