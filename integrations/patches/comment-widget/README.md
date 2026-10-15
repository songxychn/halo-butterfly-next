# CommentWidget 按需资源补丁

此处保存本地可复验补丁，不代表官方发布或上游已接收。

- 上游：<https://github.com/halo-dev/plugin-comment-widget>
- 正式基线：`v3.4.0` / `ae278ec1be30bc197e99557090d62f34d76823de`
- 本地版本：`3.4.0-theme-demand.1`；Halo 最低版本沿用 `>=2.27.0`。
- 范围：仅 head 资源协议、协议测试与版本号；不修改评论存储、权限、验证码、编辑器或打包后的前端代码。

## 应用与构建

在独立目录克隆上游并检出上述精确 SHA，然后运行：

```sh
git apply /absolute/path/to/integrations/patches/comment-widget/0001-theme-managed-resources.patch
./gradlew build
```

需要 Java 21、Node 24、pnpm 12.4.2（上游锁定）与下载依赖所需网络。Gradle Wrapper 固定 9.5.0。产物为 `build/libs/plugin-comment-widget-3.4.0-theme-demand.1.jar`。若本机 Corepack 不识别 pnpm 12 的可执行文件布局（报找不到 `bin/pnpm.cjs`），直接执行 Gradle 安装的原生 pnpm，再让 Gradle 完成 Java 测试和封装：

```sh
./gradlew :packages:pnpmSetup
(cd packages && ./.gradle/pnpm/pnpm-v12.4.2/bin/pnpm install --frozen-lockfile)
(cd packages && ./.gradle/pnpm/pnpm-v12.4.2/bin/pnpm -r run build)
./gradlew build -x :packages:pnpmBuild -x :packages:pnpmInstall
```

也可使用仓库提供的封装命令：`python3 integrations/patches/comment-widget/build.py --work /path/to/new-checkout --output /path/to/plugin.jar`。它拒绝复用已有目录，完整构建前后端并记录源码、补丁和实际 JAR 摘要；不同机器的构建产物摘要以各自记录为准，不假定二进制逐字可重复。

不修改全局 Corepack 或 pnpm。需要代理时给 Gradle 显式传入当前环境对应的 `-Dhttps.proxyHost` / `-Dhttps.proxyPort`，JVM 不会自动采用 `HTTPS_PROXY`。

## 协议

主题在 head 的祖先 Thymeleaf 上下文中声明 `haloCommentResourcesManaged = ${true}`。插件只对该请求中严格的布尔 `true` 接管资源；未声明、false、字符串 true 的页面仍得到原来的 preload 和 stylesheet，切换主题不依赖全局开关。

接管模式 head 输出三个不会发起下载的 meta：

- `halo-comment-widget-contract`：`1`
- `halo-comment-widget-module`：带插件版本的同源 `comment-widget.js` 地址
- `halo-comment-widget-style`：同版本的同源 `index.css` 地址

模板只用 `pluginFinder.available('PluginCommentWidget')` 检查插件是否可用；不把本地带后缀的版本号放进 Halo 版本范围表达式（Halo 2.27 的解析器不接受该范围）。是否支持按需加载由浏览器读取协议元数据严格判定。主题负责触发加载及组件挂载；禁止把原版 3.4.0 的版本号视为已经支持此协议。主题会校验协议、资源路径、同源和版本一致性；接口缺失时展示安装支持版本的说明，不尝试旧预加载接口或无限重试。

默认关闭主题“评论懒加载”时立即加载；开启后在接近评论区、评论跳转或直接锚点时加载。JS 与 CSS 都成功才挂载组件。CSS 失败/超时允许重试，PJAX 替换 head 后重新挂载 CSS，已有编辑器不会因重复初始化被重建。

## 验证边界

补丁包含两项 Java 测试（非下载元数据和请求级显式 opt-in）。主题测试覆盖资源延迟、同源/契约/版本校验、CSS 失败和超时重试、页面清理、head 替换、重复初始化、Post/SinglePage/Moment、立即模式和不支持提示。真实 Halo 2.27.0 中的模板上下文顺序、网络请求和其他主题回归由平台组合验收记录；单元测试不能代替该验收。
