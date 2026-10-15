# Umami 公开汇总接口候选补丁

本目录保存对现有 [halo-sigs/plugin-umami](https://github.com/halo-sigs/plugin-umami)
的最小扩展源码补丁，不包含二进制或凭据；尚未向上游提交或发布。

- 上游正式基线：`v1.5.0`，`196a36de74da490436fec7e09edef65f47d6f4d2`。
- 候选版本：`1.5.0-next.1`，最低 Halo `2.27.0`、Java 21。
- 候选提交：`f6d3c8d954a78d298276bfbb2149556be3be9e48`；构建工具升级到 Gradle 9.5.0 / Halo devtools 0.8.0，以支持 Java 21 组件索引。
- Umami 服务协议：仅固定自托管 `v3.4.0`；不宣称兼容 Cloud 或旧版。
- 不做旧 Halo 版本回移，依赖只从 Maven Central 解析。

## 重建

```sh
git clone https://github.com/halo-sigs/plugin-umami.git
cd plugin-umami
git switch --detach 196a36de74da490436fec7e09edef65f47d6f4d2
git switch -c codex/public-statistics
git am /absolute/path/to/integrations/patches/umami/0001-public-statistics.patch
corepack pnpm@9.15.9 --dir console install --frozen-lockfile
corepack pnpm@9.15.9 --dir console run build
./gradlew clean test build -x buildFrontend
```

配置代理的环境需要显式向 Gradle 传 `-Dhttps.proxyHost`、
`-Dhttps.proxyPort`（以及相同 HTTP 参数）；Gradle 不自动读取 `HTTPS_PROXY`。
`-x buildFrontend` 要在上面的前端构建成功后使用，避免上游构建任务误用
本机其他 pnpm 版本。完整说明与统计口径在应用补丁后的 `PUBLIC-STATS.md`。

## 主题接入

公开读取地址：`/apis/api.umami.halo.run/v1alpha1/stats`，可选 `?path=/archives/example/`。
返回主题现有契约的 `site_uv`、`site_pv`，带路径时另含 `page_pv`；请求不需要认证。
不接受客户端指定上游地址、站点 ID、统计区间或认证参数。

配置顺序：

1. 在插件原有设置中固定 Umami 站点地址及 UUID。
2. 在 Halo 进程环境设置固定名称 `HALO_UMAMI_STATS_API_KEY`，重启生效。
   密钥不进入 ConfigMap（原插件查看角色可读取它）、主题配置或响应。
3. 设置 `basic.statsStartAt` 为实际 UTC 起始时刻，开启默认关闭的
   `basic.publicStatsEnabled`。
4. 主题 Umami 统计接口填写上述同源 URL；若由主题加载追踪脚本，开启插件
   `basic.disableTracker`，避免浏览器双重统计。RSS 遥测不受该开关影响。
   插件 endpoint、websiteId 或 scriptName 缺失/空白时不注入追踪脚本，
   未配置插件不会再生成 `null/umami.js` 相对请求。

安全及可用性边界：上游 HTTPS（仅回环 HTTP 供本地验证）；每个请求总超时
3 秒，缓存 60 秒，合并相同请求，最多 256 个缓存键，每个 Halo 进程每分钟
最多 60 次新上游请求。错误也短暂缓存；不伪造 0，不返回上游错误正文。
禁用 404、无效请求 400、限流 429、配置或上游故障 503。

UV 使用整个起始日至缓存刷新时刻的 Umami visitors，不累加每日 UV；
页面按精确 path 过滤，保留大小写、百分号编码及末尾斜杠。明确拒绝
`.` / `..` 路径段（包括前导 `/../`、大小写 `%2e` 及字面/编码混合）；
其它百分号字节不解码或改写。Umami 的逗号
过滤语法会扩展为多值，故本接口拒绝含逗号的 pathname。站点与页面缓存
刷新时间最多可能相差 60 秒；不承诺恢复删除或未收集的数据。

## 已执行验证（2026-10-15）

pnpm 9.15.9 控制台构建通过，Gradle `test build -x buildFrontend` 通过，
52 项测试全部通过（40 项汇总接口、12 项追踪开关/缺配置）。在干净上游基线检出中
`git apply --check` 通过。源码补丁及本地构建 JAR 的 SHA-256 见 `manifest.json`；
不承诺不同构建环境下 JAR 字节完全相同。

## 验收边界

补丁内单元/路由测试使用固定 API 响应，覆盖映射、鉴权隔离、配置关闭、
严格参数、缓存、限流、并发、超时和错误响应，不代表真实账户验收。
真实 Umami 账户对账、凭据吊销及轮换、生产网络与流量、其它 Umami
版本仍待验证。上游提交、正式分发和生产部署尚未执行。
