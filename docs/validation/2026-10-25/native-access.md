# Halo 原生访问控制映射与限定验证

按维护者确认的 [DEC-08 补充](../../parity/DEC-08-NATIVE-ACCESS.md)，1.0 采用 Halo 原生权限，不兼容 Hexo 密码解密协议。正式 Halo 2.27.1、主题源 `65876917bd7ff31b18455a3e48a205dd5e1ded76`，包 `7f91d07597b6fa35ee99e2adde573891c9dc9548a9e1a137f414c7d33d24e08a`；完整身份与结果见[机器记录](native-access.json)。未修改核心、插件或访问权限实现。

Post 与 SinglePage 各按 PUBLIC → INTERNAL → PRIVATE → PUBLIC 检查，共 **48 次 HTTP 请求通过**。非公开状态下，匿名主题详情返回 404，详情 API 不返回正文，公开列表、首页及归档不包含自有内容的标题/摘要；同一内容的登录作者能读取正文；改回公开后匿名可读。两批合成内容清理和原配置恢复核验通过。

首个 SinglePage 批次因断言要求未授权详情 API 必须返回 401/403/404 而失败。实际响应为 HTTP 200、零字节；对应官方 `SinglePageQueryEndpoint.getByName` 对空结果没有转换为 404。保留该失败，只针对这个确切端点允许原生空响应，未允许任意 200 或含正文的响应。修正后的新批完整通过，不改判原报告。

`INTERNAL` 不等于任意登录用户可读：官方默认文章路由要求已发布、未删除且公开或当前用户为作者。本批使用内容作者身份，未把后台管理 API 当作访客读取证据。非作者登录、浏览器目录操作、搜索/Feed/Sitemap 的非公开发现负例及完整合同仍需各自证据，不能由这 48 次请求推定通过。

`page-data:encrypt` 与 `page-data:origin` 的实质取舍和技术映射已解决，转为 implemented-unverified；保留原来源与 ID，分母不变，新增 verified 为 0。不发布 1.0。
