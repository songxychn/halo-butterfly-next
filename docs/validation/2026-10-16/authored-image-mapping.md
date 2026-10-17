# 作者正文图片初始 loading 映射

2026-10-16，只读核对产品 `d678d3f839347554d7f100996f87b23b571888df` 与 Halo 2.26.1。此记录是 D03 的来源/消费者映射及后续建议，不是范围裁定，不修改 `mapping-required` 或增加插件开发任务。

| 来源 | 消费者与实际结果 |
| --- | --- |
| 主题自有卡片图片 | [components.html 第 3–15 行](../../../src/html/views/components.html#L3)的 `lazyLoadImg` 在原生模式下根据 enable/field 于服务端输出真实 src 与 lazy/eager；这条路径可以提供初始 HTML 属性。native=false 的占位/延后路径不属于本轮原生模式结论。 |
| Halo 文章/单页的已处理 HTML | [post.html 第 75 行](../../../src/html/post.html#L75)、[page.html 第 54 行](../../../src/html/page.html#L54)直接 `th:utext` 输出正文；任意作者 img 不经过主题图片 fragment，已有 lazy/eager/srcset/picture 保持原样。 |
| 作者未声明 loading 的 img | [common.ts 第 81 行](../../../src/js/core/common.ts#L81)调用 [image-loading.ts 第 28–75 行](../../../src/js/core/image-loading.ts#L28)，在 DOM 已存在后按范围补 loading=lazy；此前浏览器可能已发出请求，不能据此证明初始请求延迟。[实际初始 HTML 与生命周期记录](image-blur-followup.md)保留该缺口。 |

官方 [Halo v2.26.1 PostPublicQueryServiceImpl 第 194–233 行](https://github.com/halo-dev/halo/blob/v2.26.1/application/src/main/java/run/halo/app/theme/finders/impl/PostPublicQueryServiceImpl.java#L194)显示：读取内容快照后，串联启用的 `ReactivePostContentHandler`，再生成 ContentVo 交给主题。[公开内容处理扩展点](https://docs.halo.run/developer-guide/plugin/extension-points/server/post-content)属于插件能力。[官方模板工具文档](https://docs.halo.run/developer-guide/theme/thymeleaf)没有列出供主题直接安全解析并改写任意正文 img 的工具；不能假设可从模板任意调用内部解析器。实际锁定 Halo JAR 内 `api-2.26.1.jar` 同时含文章和单页的 `ReactivePostContentHandler` / `ReactiveSinglePageContentHandler` 接口，但本次未验证它们在主题最低 Halo 版本下的插件兼容性。

建议 1.0 继续保留作者显式 `loading="lazy"`、首屏显式 eager，并准确说明主题卡片与作者正文的边界。这条路径不增加运行组件，维护成本较低；但它并不能自动覆盖全部存量无属性正文，也不据此关闭合同未决项。

后续[作者图片编辑专项](authored-image-editor.md)已补齐三引擎 HTML/Markdown 块及 Chromium 合成粘贴、文章/单页 API 的限定矩阵。HTML 块与 HTML API 保留测试属性；标准 Markdown 图片初始仍无 loading。Markdown 块内 HTML 的重开源文本转换、普通富文本粘贴的过滤分别记录，不宣称所有编辑入口都保留。[再次保存补证](content-editor-followup.md)确认 HTML 块保留测试属性，Markdown 块内原生 HTML 的属性转换会影响再次保存后的公开正文。普通插入图片工具、其他编辑器和完整 D03/EXT-03 仍待验；不自动覆盖无属性的存量正文。

如果最终要求自动覆盖所有无属性正文，应另行评估通过公开内容处理扩展提供服务端 HTML 解析的可选能力。维护成本包括文章/单页双入口、处理器顺序、首屏图片例外、关闭行为、缓存及卸载回退、最低 Halo 版本组合。**本轮不默认引入自研插件，不改官方插件，不用正则替换正文，也不把 JS 后补或把正文搬入 template 当成已解决。**
