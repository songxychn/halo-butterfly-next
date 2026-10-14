# 最低 Halo 2.20.2 的内容计数与 PJAX 回退

2026-10-14，验收源码 `26cb42dbfe47ceda5c7fa51b51d5f118f03b85a0` 对应 ZIP，SHA-256 `e19ddac447b75460812be241144c16ab901c89ddd5392f2464e8c5c2288f09c5`。复用本任务自有 Halo 2.20.2 合成 H2 实验室，回环端口 18125；JAR 来源及哈希见 [核心验收](minimum-halo-current.md)。此记录补充此前 PJAX 默认关闭的范围，不把核心验收扩展为所有旧版本功能认证。

## 风险与修复边界

官方 [HaloTrackerProcessor](https://github.com/halo-dev/halo/blob/v2.20.2/application/src/main/java/run/halo/app/theme/dialect/HaloTrackerProcessor.java) 及固定 JAR 的 `javap` 字节码确认：2.20.2 不读取 `SKIP_TRACKER`，仍直接注入带当前内容身份的原生 `/halo-tracker.js`。仅设置该上下文键无法阻止旧版本原生上报。

补丁在发现同源原生 tracker 且 group/plural/name 精确匹配当前主题 subject 时跳过主题上报。原生脚本仍作为未适配脚本阻止 PJAX，不放开其持久 history wrapper。因此最低版本内容页保持原生导航；列表页不会继承离开文章的 tracker 身份。该兼容回退不代表旧版本内容页完整 PJAX 已支持。

## 真实浏览器结果

Chromium 无头移动端，PJAX 开启与关闭分别执行：文章 → 归档 → 自定义单页 → 首页 → 文章，共 **10/10 通过**。

| 每种模式的页面 | Counter 请求 | 身份 | 导航 |
| --- | --- | --- | --- |
| 文章首次载入 | 1，HTTP 200 | posts / minimum-compatibility | 新文档 |
| 归档 | 0 | 无遗留身份上报 | 新文档 |
| 自定义单页 | 1，HTTP 200 | singlepages / minimum-tracker-page | 新文档 |
| 首页 | 0 | 无遗留身份上报 | 新文档 |
| 返回文章 | 1，HTTP 200 | posts / minimum-compatibility | 新文档 |

每步记录实际主框架 navigation request、counter payload/响应及旧 window 标记消失；等待文档 load 后额外观察 650ms，未出现重复请求或 pageerror。内容页保留一个原生 tracker script；PJAX 开启时主题 subject 同时存在，但不另行上报。关闭时按原生路径正常上报。完整记录见 [结构化结果](minimum-halo-tracker.json)。

配置恢复至安装后、开启测试前的完整 `data` 并回读相等。仅停止拥有的 PID 52286 / 18125。脚本、逐步 HTML、日志和原始 JSON 留于 `.runtime/minimum-halo/`。第一次安装误传短 SHA，被安装守卫拒绝，随后误启动的检查因旧配置 PJAX=false 正确失败；改用完整 SHA 成功安装后完成上述结果，初始失败单独保留。

限于 Chromium、合成内容与无可选插件场景。此证据不替代 2.26.1 PJAX 全矩阵、真实设备、屏幕阅读器或完整最低版本功能认证。
