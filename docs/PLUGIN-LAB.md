# P+ 插件合成实验

本工具在独立 Halo 2.26.1 / Butterfly 5.7.0 对照站建立友链、图库、瞬间的可重复内容与首轮诊断。它为 PLG-01、PLG-04、PLG-06 提供证据入口，不代表这些合同已经完成，也不代表维护者批准删减或替换上游服务提供方。

## 固定身份与契约

`fixtures/plugins/versions.json` 固定官方 release JAR 摘要、内嵌 `plugin.yaml` 摘要、源提交、Finder 名和精确提交下的两份契约文档。下载后同时验证 JAR 与 manifest，安装后再核验 Halo 实际保存的 JAR。

| 插件 | 版本 / 最低 Halo | 模型、公开接口与路由 |
| --- | --- | --- |
| [PluginLinks](https://github.com/halo-sigs/plugin-links/releases/tag/v2.3.0) | 2.3.0 / >=2.25.0 | `core.halo.run/v1alpha1` 的 Link、LinkGroup；`linkFinder.groupBy/listBy/random/count`；匿名 `/apis/api.link.halo.run/v1alpha1/links`；`/links?group=...`，模板 links.html，groups/links/simpleGroups |
| [PluginPhotos](https://github.com/halo-sigs/plugin-photos/releases/tag/v2.1.2) | 2.1.2 / >=2.22.0 | `core.halo.run/v1alpha1` 的 Photo、PhotoGroup；`photoFinder`；匿名 `/apis/api.photo.halo.run/v1alpha1/photos`；`/photos?page=2&group=...`，模板 photos.html；详情 `/photos/{name}` 用 photo.html |
| [PluginMoments](https://github.com/halo-sigs/plugin-moments/releases/tag/v1.18.0) | 1.18.0 / >=2.26.0 | `moment.halo.run/v1alpha1` 的 Moment；`momentFinder`；匿名 `/apis/api.moment.halo.run/v1alpha1/moments`；`/moments/page/2?tag=...`，模板 moments.html；详情 `/moments/{name}` 用 moment.html |

图库 `groups` 是 PhotoGroupVo 列表，`photos` 是带 prevUrl/nextUrl 的分页。瞬间是 `spec.content.html/raw/medium`、`spec.releaseTime/visible/owner/tags`，并需要已审核公开内容才能用于匿名场景。不能将 displayName 当作插件 ID，不能按“图库/瞬间”名称猜测 API group。`minimumPluginVersionForFixture` 只说明本夹具锁定的精确版本，不冒称主题已实现最小版本检查。

Butterfly 的参考映射直接使用固定 5.7.0 的 `type: link` + `_data/link.yml`、`gallery` 标签、`type: shuoshuo` + `_data/shuoshuo.yml`。图集追加加载与 Halo 服务端分页是不同实现，不能仅凭相同图片数量裁定交互等价。图库按该上游 `plugins.yml` 锁定 `@egjs/infinitegrid@4.13.0`，npm tarball integrity 与实际运行脚本 SHA 在 `reference-asset.json`；脚本只放 runtime，不提交第三方资源。

## 新建独立站

需要基础实验工具的 Python 3.9+、Java 21+、Node 24、pnpm 11.19.0。先按 `docs/COMPARISON-LAB.md` 构建实际要测的主题。以下端口仅供本任务，不能复用其他维护者的站点或数据库。脚本只认已初始化且匹配的 lab.json、两个仍运行的所属进程、完整 seed.json；首轮认领时三个插件必须全部未安装。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
LAB_RUNTIME="$PWD/.runtime/plugin-lab" HALO_PORT=18094 HEXO_PORT=14004 \
  python3 -B scripts/lab/lab.py bootstrap \
  --package dist/halo-butterfly-next-0.1.0-alpha.1.zip \
  --source-sha "$(git rev-parse HEAD)"
python3 -B scripts/plugins/lab.py download
python3 -B scripts/plugins/lab.py install
python3 -B scripts/plugins/lab.py seed --scenario empty
```

可选 `HALO_JAR_SOURCE` / `HEXO_SOURCE` 只用于只读依赖缓存，仍验证固定 JAR 摘要和干净上游 SHA，不复制旧数据库或凭据。新站随机密码仅保存在 0600 的 credentials.json。若基础初始化与 Halo 自动插件安装竞争产生 409，等待该新站稳定后重新运行 `scripts/lab/lab.py seed`，不能修改旧站规避。

插件工具的 `--runtime`、`--halo-port`、`--hexo-port` 必须一起匹配已认领站，默认分别为本 checkout 的 `.runtime/plugin-lab`、18094、14004。`--artifacts` 默认 `.runtime/downloads`。执行 `install` 后不要再调用基础 `bootstrap/seed/evidence`：基础 profile 明确要求可选插件停用，并保护原始 Hexo 输入；P+ 是另一个 profile，应使用本工具的 verify 和 diagnose。

## 内容与安全边界

`content.json` 定义三个场景。empty 没有分组与内容；normal 每种内容一条、一个分组；populated 有两组、4 个友链、24 张图、12 条瞬间。Halo 图库默认每页 20，瞬间默认每页 10，能真实请求第二页；Butterfly gallery 标签首次显示 10 张，上游 5.7.0 的 shuoshuo 模板固定每页 8 条，报告按各自真实契约计数，不改上游代码抹平差异。友链页面是分组列表，本实验不伪造不存在的页面分页契约。

```sh
python3 -B scripts/plugins/lab.py seed --scenario normal
python3 -B scripts/plugins/lab.py seed --scenario populated
python3 -B scripts/plugins/lab.py verify
# 同场景第二次执行只核验，不重写 API 对象或 Hexo 内容
python3 -B scripts/plugins/lab.py seed --scenario populated
```

所有资源 ID 均以 pplus- 开头且带专属 owner label。`plugins-owner.json` 保存安装清单、实际规范化资源和参考输入摘要；切换场景前核对整个五类集合和所有已认领输入。任何额外资源、用户编辑、来源锁变化、主题 JAR 被替换时拒绝继续，保留现场。仅删除前一场景已认领且未漂移的精确 ID，按先子对象后分组的顺序处理。原来的文章、菜单、全站配置、评论数据以及插件设置不改写；RSS、申请、上传等业务操作不触发。

参考站内容使用同一份名称、正文、分组、日期和两张合成 SVG；双方 origin 不同，链接落在各自本地 about-preview 路径。参考输入的文件哈希和实际页面数量分别记录。图库按真实默认排序显示，元数据创建时间不是固定时钟模拟；不能把每次重建图片的字节相等当成数据库时间相等。

## 逻辑备份、恢复与启停

```sh
python3 -B scripts/plugins/lab.py backup
# 切换到其他已定义场景后，用前一命令给出的具体路径恢复
python3 -B scripts/plugins/lab.py restore --backup .runtime/plugin-lab/plugin-backups/ACTUAL.json
python3 -B scripts/plugins/lab.py disable
python3 -B scripts/plugins/lab.py enable
```

备份是五类合成资源 spec/owner 元数据与专属 Hexo 输入的逻辑快照，包含校验摘要、端口、版本锁、当前主题包和插件状态；文件 0600、命名唯一、不覆盖前次。恢复仅接受同 owner/端口/版本锁/主题包，且恢复前当前内容必须匹配上次记录。它**不是完整数据库/附件/配置备份**，规范化时仅排除 MomentReconciler 异步填写的 approvedTime（approved、visible、releaseTime 与正文仍严格核对），不恢复原始 resourceVersion/creationTimestamp/后台统计，不作为正式迁移回滚的证据。环境级完整恢复方式是保留旧 runtime，在另一个空目录与空闲端口重新 bootstrap 并播种；不要删除旧数据库。

启停命令只操作三个归属且 JAR 摘要一致的插件。已知满足版本启用、安装停用和恢复启用可以分别采集；本工具不降级真实插件、不伪造旧版兼容性。

## 独立无头诊断

使用已锁定的浏览器工具安装 Playwright（详见 `docs/BROWSER-VALIDATION.md`）。`diagnose.mjs` 的 `--browser-runtime` 必须显式指向该工具认领的缓存，验证 Playwright 版本与 lock 摘要；浏览器是新建的独立 Chromium 进程与 context，不连接现有 Chrome。缓存仅读，截图、临时目录、报告写入 P+ runtime 下新 UUID 目录。

`exercise` 顺序执行空/正常场景 smoke、正常场景逻辑备份、多组多页播种、恢复及语义相等检查、停用 smoke、恢复启用、populated 重复播种零写入检查，最后运行完整 populated 诊断。最终保留启用插件和 populated 内容供独立审查：

```sh
python3 -B scripts/plugins/lab.py exercise \
  --browser-runtime "$PWD/.runtime/browser-matrix" \
  --package dist/halo-butterfly-next-0.1.0-alpha.1.zip \
  --source-sha ACTUAL_THEME_BUILD_SHA
```

```sh
node scripts/browser/install.mjs
node scripts/plugins/diagnose.mjs \
  --lab-runtime "$PWD/.runtime/plugin-lab" \
  --browser-runtime "$PWD/.runtime/browser-matrix" \
  --theme-package dist/halo-butterfly-next-0.1.0-alpha.1.zip \
  --theme-source-sha ACTUAL_THEME_BUILD_SHA
# 每场景先 smoke（桌面亮色）；默认完整是桌面/手机视口 × 亮/暗
#  --profile smoke
# 停用后页面预期 404；API 实测为本地登录挑战 302（不跟随），恢复后再采集
#  --stage disabled
```

报告包含脚本源提交/工作区状态、主题源声明/ZIP SHA、实际插件版本/JAR SHA、引擎版本/执行文件 SHA、OS/模式/视口、公开 API 数量与字段、逐页 HTTP/资源/JS/横溢/内容数量、真实下一页链接、图片灯箱打开与 Escape、最终 HTML 和截图 SHA。静态和浏览器检查分开记录：API 正确不代表页面正确，缺少翻页入口即使第二页 URL 200 也不能通过。

读取当前 origin 的 GET/HEAD；唯一允许写入是正常浏览触发的精确公开计数 POST `/apis/api.halo.run/v1alpha1/trackers/counter`，会增加合成计数。外站、WebSocket、其余写入一律拒绝，不 mock 成功。等待真实字体、有限动画与可见图片；不注入 CSS 隐藏问题，截图失败或未就绪会标 diagnosticOnly。错误和未测状态保留，不能用截图覆盖 API/JS 错误。

## 首轮覆盖边界

- PLG-01：身份、当前兼容版、停用/恢复启用是本轮目标；未安装状态只保存首轮资源为空的记录，未测页面行为；低于最低版本未测。
- PLG-04：空/正常/多组/多页数据、两站页面、分页入口和图库基础灯箱是本轮目标；损坏图片、长内容、所有详情/筛选组合、媒体音视频、友链申请等许可交互仍未测。
- PLG-06：评论、高亮、灯箱、SEO 内容处理组合全部待测。三个内容插件同时启用不能冒称这些组合已通过。
- 浏览器：这里只使用 Playwright Chromium 与视口模拟，不代表 Safari/Firefox 稳定版或真机；全站导航可访问性和视觉一致性仍由独立任务验收。

保护测试：`node --test tests/plugin-guards.test.mjs`（包含 10 项 Python 边界测试）。主题产品缺陷应单独建 issue 与证据，不修改夹具或覆盖主题样式掩盖。
