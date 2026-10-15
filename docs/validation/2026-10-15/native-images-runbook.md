# 原生图片验收运行说明

此脚本针对已安装候选的已有实现，分别保存初始 HTTP HTML 与浏览器初始化后的状态。它不会将后补 `loading="lazy"` 计作初始请求已延迟；普通作者图片没有原生属性的路径单列为待映射。

## 运行范围

- native/site、native/post（blur=true）、关闭懒加载三个配置。blur=true 仅覆盖该配置下正常加载，不单独断言模糊占位视觉或加载后 class 清理，不代表 blur 选项完整验收。
- 主题卡片的初始真实 src、loading 属性与范围；作者显式 lazy/eager、src/srcset/picture；文章首屏封面的高优先级 preload。
- 实际图片加载、响应式候选、显式失败回退、无回退作者坏图的 URL/alt 保留。
- Chromium/Firefox/WebKit 两种宽度；Chromium 两宽度额外关闭 JavaScript。
- native/site 每个浏览器/宽度进行五次真正 PJAX 切换，以 window sentinel 排除完整刷新伪装，检查新图片初始化、picture 结构和重复灯箱包装。
- 不断言进入视口前严格零请求。记录请求时间与首次滚动时间，仅用于描述实际浏览器策略。

独占 comparison lab，确认其他配置/内容验收已退出后运行；两条命令均仅连接本工作树 `.runtime` 中标记并归属本任务的 loopback Halo。下列 SHA 必须替换为当前实际安装并冻结的完整候选 SHA：

```bash
LAB_RUNTIME="$PWD/.runtime/platform-acceptance/halo-lab" \
BASE_URL="http://127.0.0.1:18615" \
THEME_SOURCE_SHA="<installed-40-character-sha>" \
ALLOW_SYNTHETIC_WRITES=yes \
bun scripts/images/check-native.mjs
```

`BASE_URL` 的端口必须与 runtime 的 `lab.json` 一致，不照抄示例端口。脚本校验 installed-package 声明、dist 包哈希和该提交到工作区的产品差异；文档/验收工具后续提交可单列 `runnerHead`，不能把变化的产品归到旧 SHA。

脚本只新建带唯一 owner 标记的两篇合成文章，以各自 HTML 验证图片。Python 控制器保存 0600 私有设置快照，所有正常结束/断言失败/输入 EOF 路径在 finally 删除自身文章、恢复设置并读回核对。浏览器仅允许当前 loopback origin 的读取和既有公开访问量 endpoint，使用全新无头上下文，不使用现有浏览器、登录 Cookie 或管理账户。控制器认证和浏览器访问严格分开。

报告与初始 HTML 写入 `<LAB_RUNTIME>/native-images/<runId>/`，配置恢复结果另存 `native-images-restoration-<runId>.json`。遇到强制杀进程/机器关闭，应按对应 private 快照人工恢复并确认锁文件归属，不能删除未知锁后直接继续。脚本不发布验收结果，不修改矩阵，不升为 verified。

## 已知边界

- 主题正文 `th:utext` 保留原作者 HTML。显式 `loading="lazy"` 可以初始生效；无属性的作者图片目前由 JS 后补 lazy，初始延迟效果未证明。脚本会将这个差异留在 `gaps`，不会偷偷替换为严格延迟目标或已完成状态。
- `<picture>` 灯箱包装缺陷已另行修复并有[独立合成浏览器证据](picture-responsive.md)；真实 Halo 验收应安装包含该修复的新候选，不能将旧包的失败报告覆盖成新结果。
- 无 JavaScript 时显式失败回退逻辑不执行，正常图片、srcset/picture、alt 和正文仍须保留。脚本不承诺作者坏图离线可见。
- 这是限定功能验收；无头 WebKit、手机宽度与触摸模拟不等于实际 Safari/真机。屏幕阅读器、整包性能和完整双站 1.0 门禁继续单列。
