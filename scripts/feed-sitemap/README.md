# RSS／站点地图验收工具

`followup.py` 和 `absent.py` 是当前候选补充工具。它们只操作本工作树 `.runtime` 内已标记、已播种、正在运行的自有 Halo 2.26.1 实例，校验官方 JAR、固定插件、实际安装包与产品提交。不会启动 Halo、部署到外部站点或设置连接绕行。

- `followup.py`：固定 11 个 HTTP 阶段，覆盖公开／草稿／私密内容、发布更新、入口／canonical、设置开关、官方插件启停；另调用 `reader-client.py` 完成 4 个真实 reader 库阶段。
- `reader-client.py`：由主脚本生成限定计划后启动，使用公共 reader API、SQLite、`reader==3.26`、`plugins=[]`；不是桌面／移动阅读器 GUI 自动化。不直接调用编辑生产站点的接口。
- `absent.py`：固定 4 个实际卸载／重装阶段。事前备份两个官方 JAR 和配置，finally 恢复；只在独占的合成实验实例执行。
- `check.py`、`uninstalled.py`、`browser.py`、`browser.mjs` 和 `contrast.mjs` 保留历史批次入口；它们的旧报告不能替代新候选字节核验。

## 准备与运行

仅使用已拥有的实验实例。两个当前工具共用 `<LAB_RUNTIME>/authored-image-editor.lock`，必须与图片作者、编辑器、插件生命周期等写入验收串行运行。读取该实例的 `lab.json` 和 `installed-package.json`，将下列路径和完整 SHA 换成实际已冻结值；不要直接复制旧候选 SHA 到不同产品包上。

阅读器要求 Python 3.11 或更新版本，使用独立虚拟环境；不要使用系统可能指向旧版本的 `python3` 创建该环境。首次准备依赖需要网络；记录环境版本，并在每个新批次前冻结脚本与版本清单。不要修改全局 Python 环境。

```bash
python3.11 -m venv .runtime/rss-sitemap-followup/venv
.runtime/rss-sitemap-followup/venv/bin/python -m pip install 'reader==3.26' 'sgmllib3k==1.0.0'
.runtime/rss-sitemap-followup/venv/bin/python -m pip freeze > .runtime/rss-sitemap-followup/reader-requirements.txt

python3 scripts/feed-sitemap/followup.py \
  --runtime "$PWD/.runtime/authored-images/halo-lab" \
  --package "$PWD/.runtime/performance-followup/evidence/candidate-d678d3f.zip" \
  --source-sha d678d3f839347554d7f100996f87b23b571888df \
  --reader-python "$PWD/.runtime/rss-sitemap-followup/venv/bin/python" \
  --allow-synthetic-writes yes
```

检查主批结果及恢复状态后，再单独执行实际卸载／重装：

```bash
python3 scripts/feed-sitemap/absent.py \
  --runtime "$PWD/.runtime/authored-images/halo-lab" \
  --package "$PWD/.runtime/performance-followup/evidence/candidate-d678d3f.zip" \
  --source-sha d678d3f839347554d7f100996f87b23b571888df \
  --allow-synthetic-writes yes
```

原始输出分别位于 `<LAB_RUNTIME>/feed-sitemap-followup/<runId>/` 和 `<LAB_RUNTIME>/feed-sitemap-absent-followup/<runId>/`。每次随机生成新目录，失败不覆盖。验收工具不会自动重跑测量；只有发布、Sitemap 缓存、插件状态和删除确认使用预定有限轮询。网络及解析错误直接保留为失败。

`reader` 的传递依赖可能随安装时间变化，复核本轮结果应使用本轮归档的完整版本清单，而不是仅凭上述两个顶层版本推断环境一致。本次发现安装环境缺少 `sgmllib`：保留首批失败，加入 `sgmllib3k==1.0.0` 后才新建第二批；没有修改阅读器源码或给 Halo 增加兼容补丁。

## 证据和恢复边界

主批只创建带随机 run label、唯一名称／标题的三篇合成文章，用服务端真实 `creationTimestamp` 和可选 UID 绑定身份。finally 删除这些文章并确认 404，恢复主题配置与两个插件原始状态，核对其他配置、插件、已有正文及安装文件。卸载工具还恢复插件配置存在性和 data，并区分目标插件重建时间变化与内容／配置变化。

出现恢复失败时保留锁和报告，先根据本批私有快照核对，不删除未知锁后继续运行。不要在两批之间更换产品、复用其他实例数据库或同时执行配置写入。私有快照、凭据、数据库、插件 JAR 和完整原始正文均留在被忽略的 `.runtime`，仓库只保存筛选后的摘要与指纹。

主批 `requests.path` 是归档响应文件名；端点须结合阶段 proof 键和脚本读取。卸载批的 `requests.path` 才是 HTTP 路径，`response` 为归档文件名。首次公开内容的历史 reader 数据库未在转私密后再次刷新；只有全新 reader 的私密排除已验证，不推导历史缓存删除。

结果解释及原始指纹见 [2026-10-17 验收记录](../../docs/validation/2026-10-17/rss-sitemap-followup.md)。本工具不宣布完整 1.0、性能、页面连接可靠性、真机或 GUI 阅读器验收通过。
