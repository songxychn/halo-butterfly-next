# 参与维护

Halo Butterfly Next 是独立的 Halo 社区维护项目。先阅读 [阶段计划](docs/ROADMAP.md)，每个 PR 解决一个明确问题或一个上游功能差异。使用中文描述问题、行为变化和验证结果。

## AI 辅助开发约定

1. 先查 Halo 官方文档与当前源码，把目标、涉及页面和完成条件写进 issue。
2. 比较固定的 Hexo 上游 tag，记录参考文件。Pug、Stylus、Hexo 数据对象需要适配；不能把文件复制过来就视为完成。
3. 修改 `src/` 和构建脚本。`templates/`、`dist/` 为生成物，不手改、不提交。
4. 运行 `bun run verify`。模板或浏览器行为变化还需要真实 Halo 的桌面、手机、深色模式验证；记录插件及配置状态。
5. 更新差异清单、迁移说明和变更记录。AI 的实现与自评只是材料，发布前需要维护者审阅。

## 开发环境

Bun 1.4.0。提交依赖时同步提交锁文件，使用 `bun install --frozen-lockfile --ignore-scripts` 验证。

`bun run dev` 监听源码并重建本地安装包；它不启动 Halo，也不会自动覆盖站点主题。开发站点通过控制台上传 `dist/` 中的 ZIP 升级主题。

## CI 与按需下载安装包

`Verify theme` 在 PR 和 `master` 推送时执行完整验证、构建和安装包可重复性检查，默认不上传制品。

需要下载预览安装包时，在 GitHub Actions 中手动运行 `Verify theme`，勾选 `upload_artifact`。验证成功后会上传 `halo-butterfly-next-preview`，保留 7 天；未勾选时只执行验证。预览制品用于临时验收，正式版本通过 Release 提供。手动触发的 Linux/Halo 浏览器验收工作流仍保留其诊断材料上传。

## PR 验收材料

- 问题触发方式及修复后的行为。
- Halo、主题和相关插件版本；测试的配置、页面、浏览器和视口。
- 实际执行的构建、迁移、页面和交互检查。未执行的项目明确写出。
- 涉及旧配置时，给出迁移样例、默认值变化和回退方式。

发布采用独立语义版本，不沿用 Hexo 版本号。每个版本说明应列出对齐的上游 tag；只有达到对应功能验收条件，才能标为“已对齐”。

自维护浏览器代码统一使用 TypeScript（`src/js/**/*.ts`、`src/plugins/loading/*.ts`），运行 `bun run typecheck` 做严格类型检查；`bun run verify` 已包含此步骤。Bun 直接执行测试引用的 TypeScript，测试使用 `bun:test` 并隔离各文件的全局环境；类型检查仍由 `tsc --noEmit` 独立完成。第三方压缩库保留 JS，使用声明文件描述调用边界。模板只注入 Halo 数据，首屏逻辑由 `src/js/bootstrap.ts` 构建后同步内联，页面资源仍输出原有 `.min.js` 文件名。

前端迁移的独立浏览器回归：先运行 `bun run build` 和 `bun scripts/browser/install.mjs`，再运行 `bun scripts/typescript/smoke.mjs`。它用隔离的 Chromium、Firefox、WebKit 检查 13 个生成页面入口的桌面/手机视口、导航、图表、代码块及 Loading；报告写入 `.runtime/ts-migration/`。这是合成页面回归，真实 Halo 验收仍按实验室文档执行。灯箱专项回归使用 `bun scripts/lightbox/check.mjs`。
