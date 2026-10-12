# SEO 与注入限定作者验收

- 产品及运行器提交：`4322a2ed167be16d9deda19ddb10436b6e1e4c1e`，运行时 tracked tree 干净。
- Halo：2.26.1，隔离 loopback 实例 `127.0.0.1:18107`，固定合成比较夹具；未接触正式站点。
- 安装包 SHA-256：`877df1712ab249813cbb208d4a6d0ce71c9dae952e217d92f95a842246c48e2f`。
- `bun run verify` 通过，607 项测试、145 个包文件。
- [结构化结果](seo-injection.json)：52 项全部通过，临时主题配置、系统注入和单页模板均恢复，独立浏览器已关闭。

核心九类路由、分页与 query 排除；OG/Twitter/Facebook、站点验证属性转义、多平台及同名取最后一条；首页/文章 JSON-LD 范围、日期、作者、别名；绝对/相对/协议相对图片；控制字符、字面反斜杠、U+2028/U+2029、HTML 注释及 script tokenizer；SEO/JSON-LD 开关和旧配置；head/bottom 顺序、Halo 全局注入与注入内模板表达式不执行。合成 SinglePage 临时模板使用实际公共布局，检查插件自有 head 的保留。

浏览器：agent-browser 0.35.0，独立 headless Chromium，1440×1000 / 390×844，亮/暗，每组检查首页、分页、文章和公共布局。16 项浏览器检查包含实际注入脚本的执行顺序、canonical、JSON-LD 解析、Loading 结束、主题模式和页面异常。截图摘要存入 JSON，未将临时截图作为完整视觉合同证据。

补齐这些场景不等于 SEO-01 / PLG-06 或完整 1.0 验收。未安装真实生态 SEO 插件，未测真实 Safari/手机/屏幕阅读器，也未重新验收最低 Halo 版本。本批 JSON-LD 安全转义不代表其他脚本嵌入数据的全域安全审计。矩阵保持 implemented-unverified；独立审查和远程 CI 另行跟踪。
