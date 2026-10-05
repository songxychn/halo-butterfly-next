# vanilla-lazyload 来源与许可补齐

## 结论与身份

本次解决 [#370](https://github.com/songxychn/halo-butterfly-next/issues/370) 的继承代码来源/许可缺口，**不修改懒加载运行实现、不发布版本**。候选仍需完成其他真实 Halo/人工验收及最终发布确认。

- 许可补齐源码：`eb06db995608ac817468a22e5627b4e8caf7813c`，基于 master `5e7c3d95faa704c0cce012c70d115111bdb329a4`。
- 新 ZIP：`halo-butterfly-next-0.1.0-alpha.3.zip`，129 文件，2,798,306 字节；SHA-256 `c0c73dedbf7b2c98d1936991470d5f80a38319cbe31a5815a217e3d071dc2be2`。
- 原 ZIP：`ad051bff7684fb4f91409f21dd9b07cf3a33178d4071dceb85759626ece0bcd1`。原 127 个文件全部逐字节相同，无移除、无修改；仅新增 `templates/assets/licenses/vanilla-lazyload-LICENSE.txt` 和 `vanilla-lazyload-NOTICE.txt`。

因此不重复运行页面/图片交互来证明许可文本改动。旧真实 Halo、安装/升级/回退和 Linux 报告仍绑定原 `1951fef/ad051bff` 及其夹具，不能称为“对新包重新执行了这些检查”；本次通过完整运行文件一致性建立有限复用关系。#338 的失败及维护者已接受的上游限制不变。

## 来源核查

`src/vendor/lazyload.js` 与继承提交 `3af8a6d694922310df6bd05eb3804c7b55b1f48c` 的 `src/js/core/_lazyLoad.js` 字节一致，SHA-256 `3cc48f446e07188a623a39b1633d16a38bb0d39f3d9e5a07b95224a296354614`。

分别从官方 npm 包提取工厂函数并按作用域声明位置统一 277 个局部绑定名后，与 **17.3.0、17.3.1** 的结构均完全一致；17.4.0 存在实际逻辑差异。准确继承版本无法唯一确定。继承代码还将官方 UMD 包装改成 `const LazyLoad=factory; export default LazyLoad()`，因此不声称它是官方 17.3.1 文件的原样副本。

固定官方 [17.3.1 tarball](https://registry.npmjs.org/vanilla-lazyload/-/vanilla-lazyload-17.3.1.tgz) 作为许可与比对参照，已核对 npm metadata 的 SHA-512 integrity。其 MIT 原文包含 `Copyright (c) 2015 Andrea Verlicchi`，与 [固定 GitHub 提交 LICENSE](https://github.com/verlok/vanilla-lazyload/blob/3b6132e8a7de990c1197d3098de4959577d7b50a/LICENSE) 字节一致，SHA-256 `c7d094b1fa2bd1097d50191c0a4a6c9e482ff6263bc5329e364e23db7b1a28a7`。版权及全部许可原文随源码和新 ZIP 分发；NOTICE 是本项目撰写的继承/改写说明。

[来源 JSON](../../../third-party-licenses/vanilla-lazyload-source.json) 保存下载位置、继承路径、原始摘要及版本边界；[比较脚本](../../../scripts/licenses/compare-lazyload.mjs)先验证双边原始摘要，再比较工厂结构，不将相似度评分视作来源证明。相同工作由独立审查者用另一次官方下载及独立工厂提取进行核对。

## 验证与审查

- `bun run verify`：578 项通过，无失败或跳过，类型/矩阵/构建与 129 文件包检查通过。
- 从上述精确源码 `git archive` 到新目录，冻结依赖安装后构建，新 ZIP 摘要一致。
- 删除/篡改 LICENSE、删除/篡改 NOTICE 四个负向场景均被实际 `check-package.mjs` 拒绝；原包恢复后再次通过。检查还锁定继承实现和官方 LICENSE 的 SHA-256，后续改动需重新核查来源。
- 独立实现审查通过 `eb06db9`：原运行文件一致、官方许可正确、归属措辞准确、比较脚本没有跳过工厂逻辑；最终 PR 审查和 CI 绑定其实际提交。
- 独立限定资源审查通过：`eb06db9` 源码归档705文件（669文本、36二进制），相对原审查无新增/改变二进制，仅删除wallpaper；14张site照片、8份字体及既有资源字节核对一致，包内许可材料23→25。无运行目录、数据库、日志或密钥路径入归档。扩大到带引号JSON键的凭据扫描有6个既有合成测试命中，未发现实际凭据；与历史5次命中属于不同扫描口径，不改写旧报告。当前候选 `resourcesAndLicenses=passed`。
- 资源门禁范围为当前跟踪源码及发行包，结合此前完整审查和本次增量/字节比对；不追溯担保完整 Git 历史或旧发行包，也不将单项资源检查等同于发行批准。原始发现及新包处置分别记录。

可公开摘要见 [lazyload-license.json](lazyload-license.json)。下载包、临时变异 ZIP、原始日志及重建目录保留在忽略目录 `.runtime/lazyload-license/`，不进入源码归档。此任务未创建 tag/Release、没有向上游提交内容或变更线上 demo。
