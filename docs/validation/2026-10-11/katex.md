# KaTeX 主题适配验证

2026-10-11，隔离回环 Halo 2.26.1；KaTeX 插件 3.0.0（内置 0.16.25，最低 Halo 2.22.2），插件前台渲染关闭。插件来源、JAR SHA-256 与编辑器输出由 [版本锁](../../../fixtures/math/versions.json)固定。本次不修改公开 demo 或发布安装包。

## 方法与身份

使用独立实验室（默认 `127.0.0.1:18400`，端口冲突时通过 `HALO_PORT` / `HEXO_PORT` 指定空闲端口），仅安装自有数据目录，凭据为随机生成的 0600 文件。固定夹具包含行内、分式、矩阵、显式 `\tag{7}`、50 项超长公式、非法命令、空公式和包含 HTML 字面的文本。相同内容用于文章与单页，包含 `inherit` / `false` / `true` 注解。

MathML 夹具由已校验 JAR 内的 KaTeX 生成，严格复现默认编辑器源码的 `output:mathml`、`throwOnError:false`、`strict:false`、`maxSize:300` 参数，然后通过真实 Halo API 保存和发布。**这验证保存格式与前台读取，不证明默认编辑器 UI 录入流程通过。**

浏览器固定 Playwright 1.63.0 的隔离 Chromium / Firefox / WebKit，1440×1000、390×844，亮/暗。没有连接用户浏览器或访问生产站点。未使用网络代理、合成页面或 HTTP 响应替换来代替 Halo 渲染；资源阻断组明确登记为注入失败场景。

复现命令（先按版本锁下载插件并校验；`HALO_JAR_SOURCE` 指向比较实验室锁定的官方 JAR）：

```sh
bun run verify
bun scripts/browser/install.mjs
HALO_JAR_SOURCE=/path/to/halo-2.26.1.jar python3 scripts/math/lab.py bootstrap \
  --package dist/halo-butterfly-next-0.1.0-alpha.4.zip \
  --source-sha "$(git rev-parse HEAD)" \
  --plugin /path/to/plugin-katex-3.0.0.jar
bun scripts/math/check.mjs --phase candidate --label final
python3 scripts/math/lab.py config-off
bun scripts/math/check.mjs --phase candidate --engine chromium --global off --label global-off
python3 scripts/math/lab.py config-on
python3 scripts/math/lab.py disable
bun scripts/math/check.mjs --phase candidate --routes core --label plugin-disabled
python3 scripts/math/lab.py enable
bun scripts/math/check.mjs --phase candidate --routes core --resources blocked --label plugin-resources-blocked
python3 scripts/math/lab.py stop
```

每组输出位于 `.runtime/math/runs/<label>/report.json`，登记 Git HEAD、工作树是否修改、实际安装包 SHA-256/调用者归属、插件锁与每用例结果。最终 PR 描述绑定最终提交、安装包和实际完成的组数；开发快照不作为 `verified` 证据。前后截图分别保存在 `before-fixed` 与 `final`（同夹具、同模式/视口），供本地查看。

## 检查范围与已发现问题

- 文章/单页均保留 8 个原生 MathML 及完整 TeX 注解，显示作者编号，不扫描价格 `$5` 或代码示例。
- 默认启用、全局关闭与逐篇强制开启/关闭分别检查；源码模式不移除原始 MathML。独立选项检查关闭复制、隐藏滚动条、幂等初始化、晚到原始公式与字面 HTML；控件之外不解析 TeX。
- 长公式局部滚动、页面宽度不超视口、聚焦后方向键、按钮名称/焦点、复制成功和拒绝反馈。
- 复制按钮使用受控 Clipboard API，选区复制使用合成事件记录处理器写入数据；**不是系统剪贴板或真实辅助技术验收**。Firefox 会限制合成 DataTransfer 存储，检查改为截取 `setData` 参数，保留真实事件分派。
- 基线三引擎 12/12 组完成，截图确认超长公式撑宽页面。首轮 WebKit 默认方向键不可靠，主题加入显式方向键/Home/End 处理；修复后的 WebKit 核心 8/8 组通过。首轮原始报告保留在 `.runtime/math/runs/development-fixed`，不当作最终通过材料。
- 插件停用与插件资源阻断检查已保存 MathML 的阅读和主题增强；原始未渲染内容的源码回退由独立选项夹具检查，不宣称插件缺失时完成数学渲染。

## 1.0 仍未通过的门禁

实测无公式首页仍包含插件 CSS，默认前台渲染关闭时不包含插件 JS。插件 3.0.0 无法通过主题设置实现全局/逐页资源按需加载；显示开关只切换公式/源码。这个限制没有从合同中删除。

尚未验证实际未安装状态的完整编辑流程、不满足插件最低版本时的真实安装拒绝、其他编辑器、前台渲染开启时的全部错误/生命周期、真实 Safari/手机/屏幕阅读器，以及最终候选独立审查、完整 CI 和性能门禁。7 条数学保留项仅提升为 `implemented-unverified`，0 条 `verified`。主题最低 Halo 版本保持 ≥2.20.2，不把可选插件最低版本当作全主题兼容已验证范围。
