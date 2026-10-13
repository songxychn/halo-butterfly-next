# D06 逐篇覆盖与列表选项限定验收

日期：2026-10-14。Halo 2.26.1；Bun 1.4.0；隔离实例 http://127.0.0.1:18105。实现与输入契约见 [能力说明](../../AUTHOR-LISTING-OPTIONS.md)。基础提交 `8a1c50cadf0e9de57f4c9683dd9089ee55dc717c`，安装测试的候选包 SHA-256：`f4fe625ca3d306199a7b36756ee3320403ed16dddd53ebf293d37ef9d5570545`。

## 已实现

- Post/SinglePage `aside` 和 `highlight_shrink` 注解：显式值覆盖全局、继承和非法值回退。
- 文章版权作者、作者链接、原文链接、纯文本声明、许可证名称/链接；服务端链接保留及危险协议回退。
- 标签云 native/name/length/random 顺序、升降序、完整排序后截断、字号范围和单位；无脚本提供所有链接。
- 归档年月标题与分组、显式标题和同站菜单名称（自动名称为渐进增强）。
- 站点 Java 日期格式白名单；非法格式回退，机器日期与缓存键不变。

## 执行结果

`bun run verify`：698 个测试通过、0 失败，类型/矩阵/构建/安装包检查通过（261 文件）。新增字段同步默认配置快照；没有复用旧性能测量作为新候选证据。

| 引擎 | 版本 | 实际 Halo 案例 |
| --- | --- | --- |
| chromium | 153.0.8010.12 | 47 通过 |
| firefox | 155.0 | 47 通过 |
| webkit | 26.6 | 47 通过 |

共141例：configured/inherit/unsafe × 1440浅色、390浅色、390深色 × 5条路由（每引擎45例），再加每引擎2例无脚本页面。所有135个脚本页面无pageerror、无横向溢出。断言包括逐篇开关、代码aria-expanded、版权文本转义/链接回退、日期、排序后数量/字号、菜单/年月标题、分组开关。截图在忽略的 `.runtime/author-options/<engine>/`，报告摘要/哈希见同名JSON。

Chromium/Firefox完整47例完成后，最终补上图表默认字号保持和连续时区字符拒绝。最终包WebKit47例涵盖`XXXXXX`回退；此前两引擎使用`BAD[date]`。最终包另用Chromium检查默认chart模式3个标签未新增内联字号，通过并还原原配置。首轮WebKit在30例通过后，切换unsafe配置时本地登录瞬时失败；整轮重试47例通过，未降低任何页面断言。

## 复跑与边界

先按比较实验室流程创建拥有标记的独占实例、安装候选包和fixture；浏览器脚本只接受显式且匹配该实例的BASE_URL/HALO_PORT。例：

```sh
BASE_URL=http://127.0.0.1:18105 HALO_PORT=18105 HEXO_PORT=14005 BROWSER=webkit bun scripts/author-options/check-browser.mjs
```

脚本修改仅本地fixture文章、单页、标签及主题配置，保留unsafe测试profile；勿对生产使用。未安装额外插件，浏览器外部请求被阻断。真实移动设备、Safari应用、性能跑分和完整1.0发布验收未执行。

`archive_dir`/`archive_generator`依然属于Halo原生路由/内容分页配置；没有添加主题路由生成器，也不声称此类Hexo配置已对齐。日期只支持文档列出的Java格式子集；正文继续使用通用Markdown/HTML，版权说明为纯文本。自动菜单名与标签参数需要JavaScript，服务端有完整可读回退。

矩阵建议将同名JSON的11项推进至`implemented-unverified`。年月两项/页面补充证据，`getArchiveLength`不因本批顺带升级。独立审查、合并后的回归及完整验收仍是单独门禁。
