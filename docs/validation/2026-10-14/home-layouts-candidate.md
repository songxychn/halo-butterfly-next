# 当前候选首页布局验收

在独占 Halo `18431` / Hexo `14431` 执行。普通merge根候选 `22b16be` 得到 `7561e0070c22ba8496c37ca01241873146b8f937`，文件树与根候选一致。固定Butterfly 5.7.0源码 `f223b1888b42b2b336068e6c959ed90a3cd7c8f3` 保持干净；参考输入digest与既有seed相同，Halo/Hexo共同夹具内容验证通过。

## 完整对照：317 / 318，保留失败

安装包SHA-256 `8605a997712fb5b1d57311721ac117464d3c0b054d13ac7899f179a1bbb7e929`。13场景覆盖首页布局1–7、缺省/无效值回退、关闭5/7封面、关闭6摘要与顶图。每场景用Chromium、Firefox、WebKit在1440×1000、390×844和明暗模式做双站对照；布局6另测768/769/2000断点、文章跳转/返回、第二页和分类/标签范围。

检查卡片排序、图片位置与占比、文字位置/内边距/字号/行高、叠字遮罩、瀑布流列数与较短列填充、无重叠、无视口溢出、条件资源、开关与原生链接。两站配置已恢复。旧候选ZIP也保留在原运行目录。

**唯一失败**：布局6、Chromium桌面浅色，进入文章返回首页后，`/lab/cover-golden-mountain.webp` 在现有5秒资源完成阶段仍pending。对应30项中其余29项通过。总计Halo 161/162、Hexo156/156。没有自动重试、扩大超时或以另一成功运行替换原结果；现有脚本没有请求状态/网络栈ledger，不直接归因平台#338，也不宣称其已解决。`page:home` 应保持 `verification-failed`，不提升verified。

## 截图发现与修复

人工检查布局1及7截图，发现日期图标是缺字符方框。`far fa-calendar-alt fa-bolt` 使后置bolt样式覆盖日历码点，但regular字重没有该闪电字形。`d345a5c` 将其改为 `fa-regular fa-calendar-days`；根代理已独立审查通过，无其他产品修改。

定向验收源码 `32db6310481fe1cd5da9be34572e447db853fb99`，ZIP `c3620dd1ab4355dba2c65fddfbf9a125ea9da3b39285b8470233e54deb9822e0`。在1/5/6/7布局、三引擎、桌面浅色/手机深色分别注入封面404，以及封面和备用图同时404：**48/48通过**、配置恢复成功。正常备用图可显示；备用图也失败时图片隐藏，卡片文字可读，无重叠/溢出；日期图标实际computed content为U+F073、字重400，修复后截图可见正常日历。该48项不冒充新包重新完成全部318项。

Bun1.4.0 `verify` 733/0，安装包264文件检查通过。

## 复现与证据

运行前按仓库说明准备独占实验室；命令需要显式LAB_RUNTIME/HALO_PORT/HEXO_PORT并匹配已安装包与source-sha：

```sh
python3 scripts/home-layouts/check.py --package <installed.zip> --source-sha <sha> --output .runtime/<new-output> --reference-runtime node
python3 scripts/home-layouts/cover-failure.py --package <installed.zip> --source-sha <sha> --output .runtime/<new-output>
```

Node24.11仅用于固定历史Hexo生成器，主题构建测试仍为Bun1.4.0；本lane曾记录的Bun生成器module.require错误没有删除，也未修改上游源码绕过。完整报告/截图位于 `.runtime/home-layouts-candidate-7561e00/`；定向报告/截图位于 `.runtime/home-cover-failure-32db631/`。逐场景摘要和摘要哈希见[机器证据](home-layouts-candidate.json)。

未覆盖实际Safari/手机硬件、屏幕阅读器、所有空数据/外部坏图组合、正式性能预算、发布候选升级回退或发布审批。已有插件留在本lane，但本轮只声明首页功能范围。没有修改矩阵状态或公开部署。
