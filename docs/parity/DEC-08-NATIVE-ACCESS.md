# DEC-08 补充：原生内容访问控制

日期：2026-10-25。维护者明确选择：「1.0 按 Halo 原生访问控制替代，不兼容 Hexo 密码解密协议」。这是能力映射决定，不代表验收通过，也不授权发布。

固定上游 Butterfly `f223b1888b42b2b336068e6c959ed90a3cd7c8f3` 的 `page.encrypt` 和 `page.origin` 用于 Hexo 加密文章的目录及解密后恢复。1.0 不提供密码输入、客户端解密、`hexo-blog-decrypt` 事件或加密插件协议兼容；由 Halo 服务端决定当前请求是否能读取正文，目录只处理服务端已授权输出的内容。

映射保持 Halo 原生语义：`PUBLIC` 为公开内容；`INTERNAL`、`PRIVATE` 按核心实际权限规则处理。此前询问中的「登录可见」表述不准确，不承诺任意登录用户都可读取 `INTERNAL`。Halo 2.27.1 默认主题文章路由的谓词为：已发布、未删除，且公开或当前用户为作者。依据是正式包中 `DefaultQueryPostPredicateResolver` 字节码及[对应源码](https://github.com/halo-dev/halo/blob/v2.27.1/application/src/main/java/run/halo/app/theme/router/DefaultQueryPostPredicateResolver.java)。主题不覆写或放宽核心权限。

`page-data:encrypt`、`page-data:origin` 保留原 ID 和上游来源，按此新契约验收，不作为不适用或延期项扣除分母，也不因本决定直接记为 verified。需要记录固定 Halo JAR、主题包与源提交，实际检查匿名请求的正文/摘要/目录不泄露、作者合法读取、公开状态恢复；普通登录用户、浏览器目录和公共发现端点分别保留各自的证据边界。不得把后台管理员 API 可读冒充普通访客有权读取。

限定 HTTP 验收入口：`scripts/acceptance/comments/run.py --cases access-only`，复用已固定实验环境、随机自有内容、包逐文件校验及恢复检查。实际结果另行登记；脚本存在不代表已通过。
