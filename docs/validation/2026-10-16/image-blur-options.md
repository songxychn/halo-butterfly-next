# 原生 blur 开关、范围、刷新及缓存补验

2026-10-16，继续使用产品 `d678d3f839347554d7f100996f87b23b571888df` / ZIP `93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e`，Halo 2.26.1 独占 `18855`。[机器证据](image-blur-options.json)与[此前 CSS 生命周期 9/9](image-blur-followup.md)独立保存，**本批并非全部通过**，不覆盖旧报告。

## 固定范围与结果

新增 `check-blur-options.mjs`，夹具仅增加 post/blur=false、site/blur=true 两个可恢复配置。三引擎各在 390 宽度执行四个组合：post true / post false / site true / site false。每个组合均验证首次导航与刷新，受控延后正文原生 lazy 图片和正文外真实上一篇/下一篇主题图片的响应交付；记录配置范围、pending class、计算样式、实际图片解码及解除状态。另用三引擎独立、不带 route 拦截的上下文测试缓存，避免 Playwright 路由拦截禁用 HTTP 缓存。

| 批次 | 结果 | 解释 |
| --- | --- | --- |
| `083d77ca7c4a6402` | **10/15** | 9 个 post true/post false/site false 配置场景通过，每例包含首次与刷新；Chromium 缓存证据通过。site true 三场景和 Firefox/WebKit 缓存证据失败，全部保留。 |
| `9ee814962c8510ac` | **3/3** | 仅补三引擎 site true 的首次及刷新，先等待既有 CSS 过渡到稳定状态；不重跑其余组合或缓存案例。 |

site true 首轮失败来自采样时点：正文外 pagination 封面已有 `filter 375ms ease-in .2s` 过渡，采集到 class 已加入而 `filter` 尚为 `blur(0px) brightness(1)`。正文图片已为 50px。修正采集器后，在原 10 秒门禁内等待计算样式到达预期值，并在加载后等待其恢复为 `none`；三个新场景均完成。没有产品修改，没有关闭过渡或延长导航/等待阈值。旧工具副本和哈希保留，新结果不改写首批失败。

因此，这些证据支持原生模式下 **blur 开关、site/post 对正文内外图片的作用范围，以及刷新后的相同行为**。它们仍是分别记录的限定批次，不能把首批改成 15/15，也不代表所有覆盖优先级、非原生占位或完整 1.0 通过。

## 缓存证据仍有缺口

缓存案例先加载真实 Halo 页面，再刷新同一 URL。用 `MutationObserver` 记录作者 plain 图片绑定处理时是否已成功解码且没有 pending，同时要求该图片的 Resource Timing 为 `transferSize=0`、`decodedBodySize>0`，作为实际缓存命中的证据。

- Chromium 同时满足两个条件，缓存命中后图片保持清晰、URL 不变。
- Firefox 没有返回该图片的 Resource Timing 条目。
- WebKit 返回条目但 `transferSize/encodedBodySize/decodedBodySize` 均为 0，不能独立证明命中。

三个引擎的绑定观测均为已解码且无 pending，但这不足以替代缓存来源证据。Firefox/WebKit 两例保留为**缓存证据不足**，没有重跑或降低断言；也不能把采集 API 证据不足判为主题缓存缺陷。

## 身份与恢复

前后 269 个已安装文件逐一与同一 ZIP 字节一致，主题/系统配置摘要、8 个停用插件清单及 13 个原内容对象一致；每批新建的两篇文章均已删除，恢复报告通过。自有 Halo 已停止；Hexo 未启动，其他实验室未动。

普通作者图片初始 HTML 的 loading 缺口仍在；CSS blur 不生成低清缩略图。此前报告保留历史事实，本补充仅增加上述原生范围/开关/刷新证据；非原生占位、真正设备/Safari、完整配置覆盖及历史页面加载失败继续保持原状态。
