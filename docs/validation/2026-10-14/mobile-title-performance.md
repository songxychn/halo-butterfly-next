# 首屏文字绘制延迟：定位与修复

在[核心验收](core-acceptance.md)的固定默认配置、无可选插件、Halo 2.26.1 实验室上继续诊断。基线是 `34c9e8958eb1be30fe33b9acf4b6793efda49b3a` 产品包；工具采用已修正 locale 的 Lighthouse 13.4.1，Chrome 153.0.8010.12。此处只处理已确认的首屏文字延迟，不代替完整性能合同或线上真实用户数据。

## trace 与模拟图

原首页样本的模拟 LCP 是 6095.5ms，而 trace 的实际 FCP/LCP 为 150/360ms；LCP 元素是 `.above-title`，不是顶图。LCP breakdown 的 85.1ms TTFB＋274.6ms element render delay 是未限速 trace 的分解，不能误写成模拟 6.1s 的分解。

使用固定 Lighthouse 自身的 `LanternLargestContentfulPaint.request` 读取原始 trace/DevTools log，精确重算出原值：optimistic 3754.743ms、pessimistic 8436.324ms，均值 6095.5335ms。前者终点是 158220B solid 图标字体；后者包括在 LCP 之前完成的八张 Low priority 原图、三份图标字体与首页 JS，带宽竞争使 JS 到 8406.324ms 才结束。原图仍使用原生 loading=lazy，但浏览器已按近屏距离预取；它们并不是 LCP 元素。

长文模拟 LCP 2778.918ms，trace FCP/LCP 都是约163ms，元素是首段正文；optimistic/pessimistic 为2703.918/2853.918ms，终点均为 solid 图标字体。post CSS 与 FontAwesome CSS 仍占阻塞链。599937B Prism 包在 trace 约200ms 才发起，晚于163ms文字LCP，不能把此样本的LCP归咎于该包；它仍属于独立资源体积成本。

这是合成限速依赖图与实际 trace 的区别，不意味着可忽略模拟结果。对图标资源裁剪或封面响应式变体的进一步改造需要另行验证可配置图标、上传资源和正文使用场景，本次没有删除功能来压缩跑分。方法边界参见[Chrome 的 LCP 分解指南](https://web.dev/articles/optimize-lcp)。

## 已确认原因与产品改动

手机标题原本从 opacity:0、scale(.7) 以200ms入场。用基线安装包CSS做响应级局部对照，两组都采用相同拦截，只切换标题/副标题动画；三次基线 FCP→标题LCP 间隔为220/232/232ms，三次取消动画均为0ms。这是同页首绘阶段的因果探针，绝对加载时长不作为正式性能分数。

`ec900463a92bec5f3fbf9ef0812dcccdedf73c3f` 使手机页头标题及首页副标题直接显示。独立审查指出原副标题768px包含边界与标题767px边界不一致；`9a27dc3` 将仅动画断点统一为 max-width:767px，原字号断点保留。768px以上CSS视口保留1s入场；无JS手机也直接显示。

## 实际安装回归

Bun 1.4.0 `verify`：722通过、0失败，264文件安装包。最终包安装于独占18115实验室。三引擎×390/767/768/1440×亮暗，加三引擎无JS，共27项检查标题/副标题动画一致、最终可见、宽度与JS异常。

测试脚本初版用networkidle后立即断言桌面opacity=1，早于1s桌面动画完成；已改为等待元素真实有限动画结束。边界初版还把 Playwright 的viewport宽度直接当成CSS媒体视口，WebKit在768时实际`matchMedia('(max-width:767px)')`为true（innerWidth仍768，页面有滚动条），因此两元素正确走手机分支；最终按真实media query断言，并继续检查390/767/1440的预期分支。原失败日志保留，不将这些测试前提错误宣称产品修复。

Lighthouse复验和精确证据摘要见同名JSON；诊断样本不足完整合同，不能报告性能验收已通过。

## 有限复测结果

同一Halo/fixture/config/content/plugins哈希下，最终新包首页两个有效移动样本分别为LCP **4653.996/4654.500ms**、TBT0、CLS0；trace FCP=LCP分别为149/146ms，标题确实在首绘可读。原首页只有一个6095.534ms样本，因此不报告稳定百分比改进，也不把4.65s标为预算通过。请求数19、JS解压232833B、传输约1270955B基本不变；修复消除的是人为绘制延迟，没有掩盖资源体积问题。

长文新样本LCP2778.456ms/TBT62.5ms/CLS0.000847，与原单样本接近；但collector的**采集后station登录失败**，原报告保留error/incomplete，缺少当时的完整前后预检保证。后来单独只读station成功，内容逐字段等于采集前快照；此后验观察不回写原报告，登录失败根因仍未确定。

该轮CPU窗口经root/PJAX/Moments协调，全程一个Lighthouse进程。首页报告仍因2/10样本而incomplete，长文因1/10样本和postflight错误而incomplete；真实用户性能、完整同条件5次中位数和完整1.0门禁仍待验收。
