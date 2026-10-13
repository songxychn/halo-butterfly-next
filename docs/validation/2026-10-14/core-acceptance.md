# 集成候选核心验收与性能诊断

2026-10-14，Halo2.26.1/Bun1.4.0。先将root `33c6b1580f8e8df0948469b1c5c5f6527ba16156`合入隔离分支形成`1cab0728433b0d2260a80a58cd1708ed4dec37a9`（额外只有编辑器脚本/证据），再按真实问题提交修复。各报告精确主题SHA、包哈希、原始报告路径/摘要见同名JSON；不能将本轮结果套用到之后的root提交。

## 核心三引擎矩阵

原有`scripts/browser/run.mjs`十路由×桌面/手机×亮暗：Chromium40/40、Firefox39/40、WebKit40/40，总119/120，整体**失败**。全部原断言保留。

唯一失败在Firefox1440浅色`/archives/preview-2/`：可见图片`/lab/cover-golden-mountain.webp`请求ID12一直未收到response，15秒可见图等待及5秒资源完成门禁超时；文档readyState为complete，字体完成，loading已结束，JS异常0，其余图片正常。记录pending请求、生命周期、诊断截图及全部资源。表现接近已知#338的请求停滞形态，但本轮没有独立确立相同根因，不能自动归因或把失败改判通过；没有通过重复运行洗掉此失败。

原始报告：`.runtime/browser-matrix/runs/2026-10-13T18-58-27-884Z-643c4abf/report.json`。WebKit仅是自动化引擎，不是真实Safari。

## 无障碍实际发现与修复

axe-core4.12.1按WCAG2A/AA、2.1AA、2.2AA扫描相同40页。初轮2页桌面浅色文章目录严重color-contrast违规：当前链接#49b1f5对白底2.36:1。`appearance.scss`的定制颜色fallback覆盖了已有可读正文链接色；`34c9e89`将fallback改回`--article-link-color`，显式自定义颜色仍优先。

安装该提交后同样40页全跑：**0 violations**。仍有40条color-contrast incomplete需要人工判断（例如背景图片区域），并不构成完整合规认证。新脚本与复跑说明见[核心自动规则扫描](../../ACCESSIBILITY-CHECKS.md)。

## 核心性能行为与Lighthouse

固定长文（20节、8代码块、2表格、12本地图）通过原有`core-browser.mjs`30项检查：三引擎桌面/手机、亮暗、菜单/目录/复制/灯箱、延迟增强包正文、无JS阅读等。全部30通过，不等于性能指标或插件场景通过。

首Lighthouse诊断产出原始报告后，被旧validator以`Wrong Lighthouse setting: locale`拒绝。固定Lighthouse13.4.1官方`lookupLocale`将zh-CN规范为zh，而旧工具要求输出仍为zh-CN。`91d3238`直接请求支持值zh，保持原有严格相等/URL/错误/资源/阈值校验；新增locale漂移拒绝回归。旧失败报告保留，不修改原始LHR或改判。依据：[固定版本locale解析](https://github.com/GoogleChrome/lighthouse/blob/v13.4.1/core/config/config-helpers.js)。修复后`bun run verify`722通过、0失败，安装包264文件；工具改动未改变已安装主题包字节。

在新cohort串行取得两条有效mobile诊断样本（固定默认配置、禁用可选插件，严格前后预检一致）：

| 页面 | LCP | TBT | CLS | 主题JS解压 | 主题CSS解压 |
| --- | --- | --- | --- | --- | --- |
| 首页 | 6095.5ms | 0ms | 0 | 232833B | 291885B |
| 长文 | 2778.9ms | 60.5ms | 0.000847 | 947244B | 341187B |

每页仅1个移动样本，无5次中位数/桌面/基线/推荐插件组合，采集器按设计退出2、合同维持incomplete。数值提示需进一步定位性能问题，不能单样本断言完整预算通过/失败，也不能与不同配置哈希的旧版本直接宣称可比。LHR、trace、DevTools日志保存在`.runtime/performance/runs/candidate-34c9e89-fixed-diagnostic/`，未修改。

## 环境与剩余边界

核心矩阵/axe使用独占18105；准备性能时发现14005由历史aside-a11y进程占用，未停止或复用，另建全新18115/14015实验室。固定旧版Hexo7.3.0在Bun1.4.0因module.require不兼容失败，参考站使用本机已有Node24.11.0真实生成；主题构建/测试仍用Bun1.4.0，未改变校验或伪造参考站。

性能采用与其他代理明确协调的CPU窗口，每次只运行一个Lighthouse进程。该共享开发机结果不是固定CI基线。真实Safari/设备/屏幕阅读器、人工视觉/键盘全路径、自动incomplete项、完整性能160样本与完整1.0验收仍未完成。
