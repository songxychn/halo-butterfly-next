# Lighthouse 结束后的同请求观察

结论：固定 10 例诊断中，2 例在 Lighthouse 返回后继续保留同一页面 20 秒，原未完成请求仍未响应或结束。与其对应的浏览器已发送数据、服务端 socket 接收队列持续非零，支持这些请求已到达服务器但未继续被应用读取；这不是浏览器尚未发出的普通排队。其余 8 例本轮未复现，不能据此撤销正式样本中的 45 秒字体、图片或脚本停滞。

机器记录：[performance-navigation-observations.json](performance-navigation-observations.json)；正式预算见[160 次采样报告](performance-full-matrix.md)。

## 固定诊断范围

基线固定：首页手机/桌面各一次，公共页手机一次/桌面两次。候选固定：长文手机/桌面各一次，图库手机两次，公共页手机一次。每例启动相同固定 Chrome 的全新匿名进程；保留原 Lighthouse 45 秒导航上限，完成采集和审计后额外观察 20 秒；不重试、不补入正式样本。

两侧仍是正式基线/候选包和相同九插件。一个内存中的 Python Client 贯穿全部诊断，每个路由前后重新读取包、插件 phase、配置、内容和当前身份，所有快照一致。诊断使用 programmatic Lighthouse 的自有 Page；解析配置与正式样本仅 `channel: cli→node` 和输出序列化 `output: [json]→json` 不同，性能/屏幕/节流设置相同。额外被动 CDP、NetLog 与每两秒 socket 观察只用于归因。

## 持续未完成的请求

| 版本/页面/设备 | LH 返回时刻（导航后） | 观察截止 | 持续请求 |
| --- | ---: | ---: | --- |
| baseline/home/desktop | 4.691s | 24.711s | /lab/cover-golden-mountain.webp, /lab/cover-turquoise-coast.webp |
| candidate/photos/mobile | 4.695s | 24.714s | /lab/cover-turquoise-coast.webp |

两版本分别关联了 URL_REQUEST → HTTP_STREAM_JOB → 复用 socket → 客户端端口，未把基线端口推断套用到候选。请求发出之后没有 socket 接收事件；对应 Java 服务端 socket 的 Recv-Q 在多次被动观察中持续非零，详细端口、字节数、观察墙钟和原始摘要保留于机器记录。

这是服务端连接未继续读取的证据，与既有连接队列问题的表现一致；本轮未应用运行时修复、DEBUG 重启或回滚对照，不能据此断言全部 18 个正式失败的根因相同，也未证明任何兼容性修复有效。

## 复放与原始证据

原始目录：`.runtime/performance-followup/evidence/navigation-observation-01/`。Node 和 Python 诊断脚本仍为本次任务的临时文件，其确切路径/SHA256、预定样本、配置差异和限定复放命令写入机器记录。复放需要自有 18845 实验站、确切包/插件锁和独占 CPU 窗口；原输出拒绝覆盖，新的实验必须使用新目录并记录脚本变化。

NetLog 在进程清理时缺少 JSON 容器结束符；原始字节保留并计算哈希，机器记录逐例标记截断与完整事件条数。分析只在内存补容器结尾，不恢复不存在的事件。关键请求发出/连接端口事件均为已有完整事件；同请求截止状态另有完整 CDP 观察日志。NetLog 默认模式已去除 Cookie 内容，匿名合成原始日志只保留于 ignored runtime，不进入仓库。

本次为新建专属实验站，没有替换既有站点。结束时保留候选 d678/93b6 包、冻结默认主题配置、推荐九插件和合成夹具供复验；最后前后快照一致。已停止自有 Halo PID52219，并确认18845不再监听；未启动Hexo。原始数据继续保留，未删除实验站目录。

完整诊断清单 `.runtime/performance-followup/evidence/navigation-observation-raw-manifest.json` 覆盖 79 个文件、108,528,168 字节，包括 CDP、LHR、trace、NetLog、socket队列、前后快照、运行日志和脚本副本；其 SHA256 绑定在机器记录。脚本副本单独保存在 `navigation-observation-01-scripts/`，未修改原始观测文件。
