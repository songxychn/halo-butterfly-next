# 双站对照环境

本环境为功能矩阵提供可重复的基础样例。Hexo 参考站固定到 Butterfly **5.7.0** / `f223b1888b42b2b336068e6c959ed90a3cd7c8f3`，Halo 固定为 **2.26.1**。HTML/HTTP 成功只代表环境就绪，不能替代视觉、交互或插件验收。

## 初始化与运行

需要 Python 3.9+、Java 21+（本机实测 Corretto 25）、Node.js 24、pnpm 11.19.0、Git、curl、OpenSSL。工具必须在 PATH 中；脚本没有个人目录默认值。首次联网获取依赖，之后可使用本地缓存。两个站点只监听 loopback，默认 Halo `18091`、Hexo `14000`；已被其他进程占用时拒绝启动。

在要验收的主题 checkout 中构建；`--source-sha` 必须来自实际构建 checkout，不能填运行脚本所在 worktree 的其他 SHA。它是调用方声明，主题包字节由 SHA-256 单独标识。未提交的主题修改应先提交后用于正式证据。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
python3 scripts/lab/lab.py bootstrap \
  --package dist/halo-butterfly-next-0.1.0-alpha.1.zip \
  --source-sha "$(git rev-parse HEAD)"
python3 scripts/lab/lab.py health
python3 scripts/lab/lab.py evidence
```

默认运行目录是当前脚本所属仓库的 `.runtime/comparison`，不依赖历史 Halo 数据库。`bootstrap` 会验证 JAR SHA-256、检出固定上游提交、安装冻结锁依赖、生成 Hexo 页面、启动两个进程、初始化 Halo、安装主题并播种。脚本保留进程用于后续浏览器验收；退出命令不会停止站点。

环境变量可配置 `LAB_RUNTIME`、`HALO_PORT`、`HEXO_PORT`。创建第二套环境时三个值一起调整。运行目录非空且缺少本工具的 `lab.json` 时拒绝认领；已有实验环境不能改端口。可选的 `HALO_JAR_SOURCE` 指向已有官方 JAR，`HEXO_SOURCE` 指向已有 Git 克隆，仅作为缓存，仍验证固定摘要/提交及干净源码。没有这些变量时直接使用官方源。

```sh
# 单独准备依赖和生成参考站，或恢复已准备好的站点
python3 scripts/lab/lab.py prepare
python3 scripts/lab/lab.py start

# 有意升级主题时使用 install；不会重新播种或覆盖配置
python3 scripts/lab/lab.py install \
  --package /path/to/intended-theme.zip \
  --source-sha ACTUAL_BUILD_COMMIT_SHA

# 仅关闭该运行目录记录且命令身份匹配的进程
python3 scripts/lab/lab.py stop
```

重复 `bootstrap` 不创建重复文章，不重新安装同一主题包，不覆盖已有 Halo 配置。它验证内容、配置及参考站输入文件；发生漂移时停止并保留现场。新版本夹具用新运行目录和端口重建，旧数据库保留供回溯。`seed` 可恢复首次播种在创建与发布之间中断的内容；已经完整播种的环境只执行一致性校验。初始化完成后立即核对并保存 Halo 唯一的欢迎文章、默认分类和 Halo 标签原始快照（`initial-content.json`，权限 0600）。首次播种仅按这份 fresh 快照的精确 ID 取消发布欢迎文章、解除它的分类标签关联；确认没有其他文章引用、初始分类标签配置未被改动后，移除这两个默认分类标签，避免干扰双方统计。欢迎正文和全部初始对象仍保存在快照中，清理对象 ID 与快照摘要写入 `initial-cleanup.json`。没有 fresh 快照、存在其他文章引用或对象被编辑时拒绝清理；额外文章不会被批量取消发布。

## 共用夹具与基础配置

`fixtures/comparison/content.json` 是双方内容真相源，包含 12 篇文章、1 个自定义页面、分类、标签、导航、固定 UTC 发布时间与分页大小。首篇 `article.html` 覆盖标题层级、代码、表格、列表、图片、内部链接。`assets/` 两张 SVG 为本项目原创合成图，双方 `/lab/*` 提供相同字节；Halo 通过专用附件资源映射读取新运行目录中的 `halo/data/attachments/lab`，不会修改主题 ZIP 或安装后的模板。

Hexo 的程序、生成器、渲染器及启用的浏览器依赖都由独立的 `fixtures/comparison/hexo/pnpm-lock.yaml` 固定。上游源码和完整第三方资源仅存在运行目录中，不进入仓库或发布包。Halo JAR 摘要在 `versions.json` 中固定，来源为 [Halo 官方 2.26.1 发布资产](https://github.com/halo-dev/halo/releases/tag/v2.26.1)；站点路径和日期按 [Hexo 官方配置](https://hexo.io/docs/configuration) 设置。

| 共同语义 | Hexo 映射 | Halo 映射 |
| --- | --- | --- |
| 站点标题/描述/作者 | `_config.yml` 与作者卡片 | system ConfigMap 与合成维护者资料 |
| 日期/语言 | 固定日期、Asia/Shanghai、zh-CN | 固定 publishTime、站点 zh-CN；JVM 与浏览器验收固定 Asia/Shanghai |
| 每页 10 篇、按日期倒序 | index/archives generator | system.post.pageSize 与固定 publishTime |
| 首页/归档/分类/标签顶部图 | 对应 `*_img` | 各组 `above_background` |
| 导航与头像 | theme.menu / avatar | 独立 comparison-primary Menu、MenuItem annotations.icon / 合成维护者 avatar |
| 亮暗模式 | darkmode、关闭自动切换 | style.mode=user |
| 首页动态字幕 | 基础配置关闭 subtitle | 基础配置使用空 typewriter 文本 |
| 评论/搜索/代码插件 | 基础配置不接入评论或搜索服务 | 首次初始化停用新实例的可选插件；后续启用视为配置漂移并保留 |

基础配置不测试动画字幕、评论或搜索插件。这些是待建的独立场景，不能从基础环境结果记作通过。Halo 当前没有统一的懒加载关闭选项；Hexo 基础环境关闭懒加载，Halo 仍执行真实懒加载。无封面回退、代码高亮实现及其他视觉差异保留可见，不用 CSS 覆盖伪装一致。

## 证据和浏览器稳定条件

`evidence` 输出 `.runtime/comparison/evidence.json`：版本与夹具摘要、调用方声明的主题源提交、ZIP 摘要、20 条核心路由、共享图像摘要、HTML 中实际引用的本地脚本/CSS/图片加载结果、插件版本与启停状态。它还逐项校验双方 12 篇文章的标题、日期、分类、标签、封面及正文，核对发布集、分类与标签全集、首页顺序和导航顺序/链接/图标，并检查配置漂移。时间戳与动态 HTML 摘要仅用于识别本轮证据，不要求跨运行逐字相等。

浏览器对照使用 `versions.json` 中的桌面 1440×1000、手机 390×844、zh-CN、Asia/Shanghai 及亮暗模式。使用独立无头浏览器，不连接现有 Chrome。截图前等待文档、字体及可见图片完成加载；逐段滚动触发真实懒加载，再返回目标位置并等待导航过渡完成。不要通过注入样式隐藏缺陷。相同滚动位置记录两个站点的实际渲染、浏览器版本、视口、模式、当前配置及异常。无头手机视口不代表触屏真机验收。

凭据仅存在 `halo/credentials.json`，首次生成随机密码，权限强制为 `0600`；脚本不打印密码。数据库、凭据、JAR、上游源码、日志、截图及详细证据都在已忽略的 `.runtime` 中。可提交的验收记录应摘录结果、命令、提交和摘要，不复制这些运行材料。

本工具的离线保护测试随 `pnpm check` 执行，也可单独运行 `python3 -B scripts/lab/test_lab.py`。

## 首轮可重复运行记录（2026-09-06）

使用最终初始化逻辑创建全新 Halo 数据库，第一次创建 13 个内容对象（12 篇文章、1 个单页）；第二次 `bootstrap` 创建 0 个对象并通过内容/配置不变校验。完整 `pnpm check` 7 项通过，其中实验环境包装测试包含 15 项 Python 保护测试。停机恢复后重新通过 `health` 和 `evidence`。

| 证据 | 本轮结果 |
| --- | --- |
| 主题构建源提交 | `bbc1ebe5c5726cf36f52949455e1a97120637cac` |
| 主题 ZIP SHA-256 | `92e7bfeff60a753aeef2cbcd57f1d148e5f589e5fd3b6df3eec27944b836800a` |
| HTTP 核心路由 | 两站各 10 条，共 20 条通过 |
| 共用 SVG | 两站各 2 个，4 项摘要一致 |
| 页面脚本/CSS/图片引用 | Halo 27 个、Hexo 6 个本地资源 HTTP 200，响应类型均为资源而非 HTML |
| 文章语义 | 12 篇标题、日期、分类、标签、封面、发布正文和首页顺序通过；分类/标签全集及菜单图标一致 |
| JVM 实际属性 | `jcmd <owned-pid> VM.system_properties` 返回 `java.version=25`、`user.timezone=Asia/Shanghai` |
| 插件基线 | 新实例的 8 个可选插件全部停用；具体版本留在本地 evidence.json |

独立审查补强了多 token `rel`（例如 `preload stylesheet`）的资源收集，并拒绝将 HTTP 200 的 HTML/XHTML 回退页视为成功资源。最新资源证据同时记录 Content-Type。

独立浏览器对照还发现 fresh Halo 的默认分类标签残留、菜单图标字段未映射。修正后再次从空数据库重建，并检查完整分类标签集合及菜单字段。默认内容的身份快照和清理记录随本轮本地证据保存。

本轮没有将视觉差异或跨浏览器交互标记为通过；由集成负责人用同一夹具继续独立验收。
