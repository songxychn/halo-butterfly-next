# Halo 2.27.1 正文与界面语言补验

按维护者确认的 [1.0 原生语言方案](../../parity/DEC-08-NATIVE-LANGUAGE.md)，正文与界面分开。固定产品 `1eb27c3e83f9377a094680b3f099518c4d0e1fad`，ZIP `96334b9a37200c11137ca134316c6e6b1ad9c88584d644119ba38a88c465a7f9`，官方 Halo 2.27.1。明细、工具与原报告哈希见[机器记录](native-language.json)。

核对发现原 `og:locale` 输出 `ja`、`ko`，缺少 [Open Graph 要求的地区部分](https://ogp.me/#optional)。现输出 `ja_JP`、`ko_KR`；无地区的英语/中文使用 `en_US` / `zh_CN`，已有有效地区保留，例如 `en_GB`、`zh_SG`、`zh_HK`。不把 OG 格式要求扩散到正文 BCP 47 `lang` 值。与评论修复包 `6587691` 逐文件对比，269 个安装文件中仅 `templates/views/seo.html` 改变。

Post、SinglePage 各九个 HTTP 场景，共 **18/18**：

| 场景 | UI / 正文 / OG |
| --- | --- |
| 正文 ja，query=en，Cookie=ko，Accept=ja | en / ja / ja_JP |
| 正文空，query=ko | ko / ko / ko_KR |
| 正文非法，query=zh-TW | zh-TW / zh-TW / zh_TW |
| 正文 ko，无 query，Cookie=ja | ja / ko / ko_KR |
| 正文空，无 query/Cookie，站点 zh-CN，Accept=en | zh-CN / zh-CN / zh_CN |
| 未支持 query=de | en / en / en_US |
| query=en-GB | en-GB / en-GB / en_GB |
| query=zh-SG | zh-SG / zh-SG / zh_SG |
| 正文 zh-HK，query=en | en / zh-HK / zh_HK |

前三个场景另以三引擎 × 390/1440 宽度 × 两种主体验证，共 **36/36**，同时核对浏览器复制代码文案、唯一 OG/正文标记、作者正文保留，以及关闭浏览器后的请求/控制台/页面错误。两个批次均自动恢复注解、原站点/插件配置和自有夹具清理。

`bun run verify` 通过 796 项测试、类型/矩阵检查及 269 文件包检查。没有人工母语审校、真实 Safari/手机、所有站点默认语言或全部插件本地化证据；未新增 verified，不发布 1.0。
