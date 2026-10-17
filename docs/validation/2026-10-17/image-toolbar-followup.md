# 普通图片工具保存与重开验收

2026-10-17（Asia/Shanghai）。补验官方富文本编辑器的“图片→输入链接”路径：保存、重开，追加真实键盘文字，再次保存和重开，最后发布并读取匿名初始 HTML。没有用 HTML／Markdown 块替代，没有修改产品、官方插件或编辑器内部事务。

**第八批三引擎均完成保存、重开和发布流程：2 例属性一致，WebKit 1 例观察到后续新增尺寸属性。** 图片 URL 和再次编辑的文字均保留；不能将流程完成写成所有属性始终一致。前七批失败和单引擎诊断分别保留。[机器摘要](image-toolbar-followup.json)保留每批原始报告、冻结脚本指纹和独立审查。

## 身份与方法

产品 `d678d3f839347554d7f100996f87b23b571888df`，`candidate-d678d3f.zip` SHA256 `93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e`；官方 Halo 2.26.1 JAR SHA256 `7a1d6ea0800e8940672aab99a7328b7bd9520e297677169594328004a41991bc`。自有实例为 `http://127.0.0.1:18865`，官方 `hybrid-edit-block 1.7.0` 保持原状态；本次普通插图使用 Halo 自带编辑器，不是该插件的内容块。

工具开发基点为 `89e0871d4c24693e9dda62e90c008ba79ee28602`，运行含未提交工具，各批以冻结脚本 SHA256 归属。前后逐字节核对包内 269 个已安装文件，工具 HEAD 不代表安装产品变化。

每例输入带随机 run 参数的本地图片 URL，实际 UI 保存请求和响应、`headSnapshot` 存储 raw／HTML、重开 DOM、匿名 `article.render` 分别归档。第二次使用键盘追加唯一标记，核对请求、存储、重开和公开正文。初次实际保存的属性作为后续比较基准，不预设 lazy、alt 或响应式结构；NodeView DOM 单独记录，不当成公开 HTML。

## 各批结果

| 批次／run ID | 完成情况 | 说明 |
| --- | --- | --- |
| 01 `0f082db978003026` | 三引擎 0/3；清理 2 个对象 | 等待 img 超时。没有原生事件取证，首批原因未确定。 |
| 02 `01c8df54d2380ca0` | 三引擎 0/3；清理 1 个对象 | 加失焦／重新点击仍失败；未证实最初 lazy 模型时序假说。 |
| 03 `649349ec88d69b6b` | Chromium 诊断 0/1；清理 1 个对象 | 重复点击按钮隐藏仍打开的弹层；Enter 未送到输入框。 |
| 04 `e6d3c9ddc5cc5fab` | Chromium 诊断 1/1；清理 1 个对象 | 可见状态和原生焦点明确后完成完整保存路径。 |
| 05 `0a678b3cff230ae6` | 三引擎 1/3；清理 3 个对象 | WebKit 完成；Chromium 等输入可见超时，Firefox 点击被占位元素拦截后输入框移除。 |
| 06 `e2cefc50471bb235` | Chromium 诊断 1/1；清理 1 个对象 | 改为 Tab／Shift+Tab 原生键盘遍历，完成完整保存路径。 |
| 07 `a5c4c7fc855dbca8` | 三引擎 2/3；清理 2 个对象 | Chromium／WebKit 完成；Firefox 原生焦点即时断言失败。 |
| 08 `5d4e1e6781451d6f` | 三引擎流程 3/3；清理 3 个对象 | Chromium／Firefox 属性一致；WebKit 重开后新增 `width="1600px"`，记录为 `observed-differences`。 |

所有批次的登记对象均按唯一名称、run 标记标题和真实服务端创建时间清理并确认删除，前后主题配置、插件状态／配置、原有文章／单页 spec 与包／插件 JAR 身份一致。清理数按实际对象记录；不能因失败在首次显式保存之前，就声称服务器绝对没有创建对象。这组站点快照**未额外核对 system settings 或原有正文的 release 内容字节**。

## 诊断证据与工具修正

第三批原生 input／change／blur 已发生，但点击标题后弹层仍是 `aria-hidden=false`／`--shown`；再次点击“输入链接”将其隐藏。Enter 前后焦点在按钮，输入框没有 keydown／keyup，Enter 后弹层又显示。第四批真实点击可见输入框后，记录了 `isTrusted=true` 的 Enter keydown／keyup capture 和 bubble，并完成保存。这能定位第三批的焦点遗漏，不能倒推首批相同，更不能用诊断耗时掩盖第五批失败。

第六批开始采用 `fill → Tab → Shift+Tab → 检查可见与焦点 → Enter`，避免点击标题触发弹层关闭。第七批 Firefox 在即时焦点断言处失败；稍后的失败快照已显示输入框持有焦点。官方 Input 组件另有 100ms 异步 autofocus 源码，因此后续仅将即时断言改为在既有 20 秒上限内等待原生焦点；第八批三引擎均记录输入框原生焦点与可信 Enter 并完成流程，不把第七批改判通过。没有强制点击、DOM 事件注入、编辑器事务或增加固定延时。

生产包诊断的 Vue `parents` 为空，**没有读到 Vue 模型值**。原生 inputValue 不能证明模型同步；最初从 `v-model.lazy` 推测的原因未证实。静态 JAR 中某处 Image 默认 `loading: lazy` 同样不能代替实际保存输出。

## 实际内容及能力边界

第八批三引擎在 `saved → reopened → second-saved → second-stored → second-reopened → initial` 六阶段均保留输入图片 URL，保存和匿名初始正文均**没有 loading 属性**。Chromium／Firefox 的属性始终为 src 与 `width="1600px"`；WebKit 首次保存只有 src，重开及后续阶段新增 `width="1600px"`。报告分别保留 3 条后续保存／存储／公开正文差异和 2 条 NodeView 差异，不将这项尺寸观察归为主题缺陷，也不声称全部属性原样不变。第二次请求、存储、重开和公开正文的键盘标记均存在，存储 raw／HTML 与提交一致。作者没有通过本工具设置 alt／srcset／picture，不能把这些属性缺席说成被编辑器删除。

这支持已完成路径保留图片与再次编辑内容，**不证明普通图片初始请求已延迟**。需要保留显式 lazy／eager、srcset／picture 时，继续引用官方 HTML 块的独立证据；主题解析后补属性不能替代初始 HTML。

此前同一产品包的[原生 blur 生命周期](../2026-10-16/image-blur-followup.md)批次 `c5976f645fd0e220` 为 9/9：三引擎各含 1440／390 JavaScript 和 390 无 JavaScript 场景，限定覆盖显式 eager、响应式 picture 候选、原生加载／失败及无脚本可读。本轮仅核对报告指纹，没有重跑，也不将它并入新作者工具通过数。

本次不覆盖附件上传、替代文本编辑、其他编辑器、完整 D03／EXT-03、真机 Safari、屏幕阅读器或完整性能。普通作者初始 loading 映射与历史页面连接失败保留；Halo 连接问题等官方修复，没有临时代理、keep-alive 参数或补丁 JAR。最终工具 SHA256 为 `15e1e2be65ed2e71ceb31a662b95fd794aec2e20e12d3012a462afdf3daaf7b8`。独立审查重新解析第八批 18 份阶段 HTML，并核对 96 个文件指纹；审查记录及前七批审查的指纹见机器摘要。原始正文、诊断和运行数据留在 `.runtime`，仓库只收录摘要与指纹。
