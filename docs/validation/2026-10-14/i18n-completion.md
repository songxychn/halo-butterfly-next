# 国际化实现及限定验收（2026-10-14）

提供 226 个消息键，七套界面语言与额外 zh 地区回退。原生 Halo 模板消息、浏览器消息快照、无脚本回退、无障碍标签和 CSS 文案均已接入。站点自定义内容和插件内部文案保持其原有所有权。说明与可复现命令见 [国际化](../../INTERNATIONALIZATION.md)。

## 验证

- `bun run verify`：Bun 1.4.0，695 项测试通过，0 失败，包检查 261 文件；包含所有语言键、参数和源引用一致性，全部 i18n 文件进入 ZIP 且逐字节相同。
- 真实 Halo 2.26.1，独占 loopback `18105`，新建本地数据，安装当前 ZIP，12 篇文章及单页种子。Chromium、Firefox、WebKit **各 28 案例，共 84 案例通过**。
- 九种显式语言/地区（en、ja、ko、zh-CN、zh-HK、zh-TW、de、en-GB、zh-SG），检查语言标题、JS 文案、根 lang、英文/中文回退、缺失键、CSS 字符串和无横向溢出。
- 首页、归档、标签、文章、单页、404；1440 桌面浅色、390 手机浅色及手机深色；无脚本日语分类页。每页检查HTTP状态、JS异常、缺失键和溢出。
- 文章/单页注解设为 ja/ko，UI为en；正文 lang 与 OG locale 使用注解，根 html lang 保持en。原生分享输入与版权链接保留，文字翻译不移除子控件。
- 另有4项HTTP检查：query优先于cookie、cookie优先于站点语言、站点zh-CN优先于Accept-Language ko、无效正文注解回退en。
- 浏览器输出与3种视口截图保留在 `.runtime/i18n-validation/<engine>/`；JSON附带全部案例和引擎版本。未访问生产或测试服务器。

安装包 SHA-256：`8db688cacfbce5145298649cd15aac45ac95dbefb05d3e469af6571e9c834768`。本报告对应基线 `3138789f3cf6bbcad91bf4364aa2417d19985366` 上的本次工作区实现；最终提交号由Git记录，不能用基线号冒充本次实现提交。

## 实测边界

站点 locale 优先级以 Halo v2.26.1 源码和实测为准：query → cookie → 站点基本设置language → Accept-Language。当前官网文档将系统设置描述为用户偏好，本次未沿用该不准确解释。

逐页注解为**内容语言和OG语言**覆盖，未强制更改整页UI locale；`page-data:language`不能据此冒充完整逐页UI覆盖已验收。简繁按钮继续只负责字形转换。尚无母语人工审校、真机/Safari应用验收和全插件页面语言验收；本次不得替代1.0完整验收。

可选Hexo参考准备在 `hexo clean` 返回2，因此用拥有标识的实验室 `start(halo_only=True)`、`Client(initialize=True)`、`install`、`seed(reference=False)`启动真正Halo，并补齐固定fixture附件。没有弱化Halo断言，也没有声称完成Hexo并排对照。

## 矩阵建议

JSON中的 `matrixDelta` 建议将七个language条目和site-config:language改为 `implemented-unverified`，保留逐页language为待映射并写明已完成的内容语言覆盖。没有修改共享矩阵或增加全功能verified条目。
