# A01 后续：原始响应与 JSON 自有键

最终产品提交 `a7893ac9dc33da9bc58835bc9c286b9ffab5ed37`（包含 `54d4dcc` + `386fdb8`，最后一提交仅纠正验收页脚选择器）。安装包 SHA-256 `9bb1ae04f0d84874a95a3031f70a863af908f66b394658221801f3007fac0def`。完整数据见 [机器证据](safe-embedding-followup.json)。

## 对上一轮结论的纠正

旧 `ddf473a` 的33项运行结果保留，但撤销它能够证明HTML脚本边界有效的结论。旧复合载荷同时含开闭script，可能互相抵消tokenizer状态。新原始HTTP断言发现Thymeleaf先对JavaScript模板表达式解码，导致源码中Unicode转义替换串在SpEL求值前变回字面尖括号。CSS拒绝规则、DOMPurify和SEO原有测试的独立结果不因此重写。

最终构建器使用平台Jackson把原值编码成JSON，再编码成字符串封装，浏览器用JSON.parse还原；原生合法JSON的自有 `__proto__` / `constructor` 键保持数据，不触发对象字面量原型设置。反斜杠从平台序列化双引号的结果中在求值时取出，再拼接转义码，避免模板预解码；没有eval或手写序列化器。

## 验证

- Bun 1.4.0 verify：708/0；包检查256文件。最终增加的测试断言另跑5/0；未修改产品后重复扩大测试。
- 真实独占Halo 2.26.1 `127.0.0.1:18431`：Chromium/Firefox/WebKit 合计36/36，所有变更已恢复。
- 21项恶意配置/HTML/JSON-LD/真实列表数据消费者检查，逐响应断言不存在字面 `<!--<script>`；精确检查字符串、数字、布尔、null、嵌套对象和ISO日期。
- 3项独立**无闭合** `<!--<script>` 检查：原始HTTP安全、MainApp保持原值、后续footer存在、无页面异常。原始HTML及SHA已保存，不能以浏览器重新序列化DOM代替原HTTP证据。
- 8项无JS CSS恶意/无效输入回退，4项正常CSS亮暗/JS与无JS组合，保留服务端配置能力。
- 自有特殊键通过JSON.stringify文本返回后解析比较，并在页面内断言Object.hasOwn，避免Playwright对象返回协议剥离特殊键造成假阴性。全局对象原型未污染。
- 失败诊断不改变30s导航超时、不重试：失败项保存URL、资源类型/请求状态/HTTP码/失败原因、页面异常、console错误及页面HTML；已在真实断言失败中确认生成。历史失败目录保留。

本轮没有在父集成实验室运行，最终组合证据由根任务记录。独立代理 `/root/pjax` 已审查编码链，无阻塞发现。
