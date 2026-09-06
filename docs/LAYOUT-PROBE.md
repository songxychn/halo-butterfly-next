# 公共布局测试插件

本夹具用真实 Halo 插件自有模板验证 `layout :: html(head, content)`，包括显式 head 和 `head=null`。它是本地合成测试工具，不随主题安装包分发，也不向主题注入业务数据。当前 fallback 路由成功只证明插件夹具可用，不能记为主题 PLG-05 通过。

## 固定依赖与构建

需要 Python 3.9+、Java/Javac 21+；本机编译器为 Corretto 25，输出 `--release 21` 字节码。`fixtures/layout-probe/fixture.json` 固定官方 Halo 2.26.1 JAR 的 SHA-256 及其内部编译依赖版本。构建在确认官方摘要后，才抽取 API、Spring、Reactor、PF4J 和 reactive-streams；不会执行下载的 JAR，也不会将这些依赖重新打包进测试插件。

```sh
python3 -B scripts/lab/layout-probe.py build \
  --halo-jar /path/to/verified/halo-2.26.1.jar
```

默认产物位于当前 checkout 的 `.runtime/layout-probe-build/plugin-halo-butterfly-layout-probe-0.0.1.jar`，旁边的 `.build.json` 记录源提交、工作区是否干净、JAR 摘要、编译器、夹具摘要和每个编译依赖摘要。正式验收前应提交代码并重新构建；不将带未提交修改的构建归因于干净提交。

需要复核可重复性时，在同一编译器下使用两个独立 `--artifact` 路径构建，比较 JAR SHA-256。ZIP 条目排序、时间戳、压缩参数和权限固定，Java 不包含调试路径。不同编译器版本需分别留证，不能假定其输出完全相同。构建失败会保留已有产物；错误的官方 JAR 在调用编译器之前被拒绝。

插件只包含一个配置类、显式组件索引、两张模板、插件描述、manifest、原项目 GPL-3.0 许可证及夹具身份 JSON。源模板存放在 `fixtures/layout-probe/resources/`，打包为插件的 `templates/`；不会修改主题生成目录。

## 独立实验环境

运行操作依赖已合并的 [双站环境](COMPARISON-LAB.md)及 `scripts/lab/lab.py`；构建和离线测试不依赖运行站。若该工具尚未进入当前分支，应先合并其已审查提交。不要复制旧数据库、个人目录或认证 helper 作为默认依赖。

本工具默认使用自己的 `.runtime/probe-lab`、Halo `18092`、Hexo `14001`，与双站默认 `18091/14000` 隔离。启动前确认两个端口空闲，再在当前 checkout 执行：

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
LAB_RUNTIME="$PWD/.runtime/probe-lab" HALO_PORT=18092 HEXO_PORT=14001 \
  HALO_JAR_SOURCE=/path/to/verified/halo-2.26.1.jar \
  python3 -B scripts/lab/lab.py bootstrap \
    --package dist/halo-butterfly-next-0.1.0-alpha.1.zip \
    --source-sha "$(git rev-parse HEAD)"

python3 -B scripts/lab/layout-probe.py exercise --expect-layout fallback
```

也可通过 `--runtime`、`--halo-port`、`--hexo-port` 三个参数显式指定另一套专属实验环境。工具要求现有 `lab.json` 的目录归属及端口一致、播种已完成，并复用实验工具的实际进程归属检查和 Client。只允许访问 `127.0.0.1` 的该实验站，不会连接正式站或读取其他运行目录的凭据。

## 生命周期与成功条件

一次 `exercise` 使用一个认证会话，串行执行：

1. 夹具缺失时，两路由均为 404；已存在夹具时必须先匹配本实验的归属记录和实际安装 JAR 摘要，否则拒绝覆盖。
2. 安装并启用，验证 `/__layout-probe/head` 和 `/__layout-probe/no-head`。
3. 停用，两路由均为 404。
4. 再启用，两路由再次通过。
5. 通过 Plugin 资源 API 卸载，等待资源删除，两路由均为 404。
6. 重新安装并启用，保留专属实验站与夹具，供后续主题验收。

每个启用场景要求 HTTP 200、HTML 类型、没有跳转、响应头 `X-Layout-Probe-Template` 指向实际插件自有模板、正文标记各一次、标题恰好一个。显式 head 必须输出指定标题和 meta；空 head 必须使用合成站点标题且无该 meta。若主题提供了同名覆盖模板，插件主动返回失败，避免把主题自有模板伪装成公共布局测试。

`--expect-layout fallback` 要求 Theme 状态为 `MISSING` 或 `INVALID`；`--expect-layout supported` 要求 `SUPPORTED`。状态检查与真实模板渲染同时进行，不能以状态字符串替代路由结果。每一步写入专属运行目录的 `layout-probe-evidence.json`，含构建与主题包摘要、源提交、期望/实际布局状态、路由结果及限制。失败保留现场及部分结果，不自动升级主题或重建数据库。

切换到已审查的新主题后，先按双站文档执行显式 `install`，再运行 `exercise --expect-layout supported`。这个结果仍需结合亮暗/手机/键盘、主题资源和 head/页脚不重复、独立审查及对应提交 CI，才能判断 PLG-05。测试夹具作者不得审自己的夹具。

夹具启用会有意改变实验环境的插件基线，因此不要用再次 `bootstrap`/基础环境 `evidence` 来覆盖该变化；这些命令可能按设计报告插件漂移。插件场景使用本工具的独立证据。结束全部验收前保留站点；停止时使用相同 `LAB_RUNTIME/HALO_PORT/HEXO_PORT` 调用 `lab.py stop`，不得按端口杀其他进程。

## 接口来源与离线保护

真实 Halo 2.26.1 API 包已确认 `BasePlugin(PluginContext)`、`TemplateNameResolver` 以及 `run.halo.app.theme.router.ModelConst.TEMPLATE_ID`。插件组件通过 `META-INF/plugin-components.idx` 加入 Spring 上下文，路由在上下文关闭时注销。参照 [官方插件模板集成](https://docs.halo.run/developer-guide/plugin/api-reference/server/template-for-theme)与 [公共布局契约](https://docs.halo.run/developer-guide/theme/page-layout)。

离线检查随 `pnpm check` 执行，也可单独运行：

```sh
node --test tests/layout-probe.test.mjs
```

保护场景包括确定性 JAR、路径越界、错误官方摘要不执行编译器/不覆盖旧产物、实验目录和端口归属、未播种环境、错误 HTML、主题覆盖模板、重复 head/正文。离线通过不表示已经实际安装、启停或卸载；实际结果单独附在运行证据和后续验收记录中。
