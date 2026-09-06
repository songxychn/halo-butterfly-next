# 首页字幕开关

本功能对应 [#14](https://github.com/songxychn/halo-butterfly-next/issues/14)，只处理字幕开关、打字效果开关、静态首项及现有自定义 API 的取值/失败分支，不表示完整 `subtitle` 域已对齐。固定参考为 Butterfly 5.7.0 提交 `f223b1888b42b2b336068e6c959ed90a3cd7c8f3`。

## 配置映射与行为

| Halo 首页配置 | 上游对应 | 本包行为 |
| --- | --- | --- |
| `index.enable_subtitle` | `subtitle.enable` | `false` 时服务器不输出字幕节点，前端不创建 Typed、不请求随机文案；第一屏关闭时同样不执行 |
| `index.subtitle_effect` | `subtitle.effect` | `false` 时用 `textContent` 显示首项，不创建 Typed；默认 `true` |
| `index.typewriter_custom_text` | `subtitle.sub` 的本地映射 | 保留 `\|&\|` 分隔和移除换行的旧规则；静态显示第一项，即使第一项为空也不跳到后续项 |
| `index.enable_typewriter_random_text`、`typewriter_random_api`、`typewriter_api_value_format` | 既有 Halo 自定义来源 | 保留任意自定义 API 配置；本包不新增或宣称已验证上游的三种来源提供方 |

上游 [`_config.yml:151-169`](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/_config.yml#L151) 默认关闭字幕。本主题已有版本默认显示字幕，因此新开关默认 `true`，直接升级时缺失或为 `null` 的新增开关也按开启处理；这是有意保留的默认值兼容差异。只有显式布尔 `false` 关闭，迁移工具继续检查字段类型。原版 2.0.5/2.0.7 迁移依靠当前设置默认值补齐开关，不改变原文案转换，也不覆盖显式 `false`。

上游 [`header/index.pug:37-40`](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/header/index.pug#L37) 控制字幕节点，[`subtitle.pug:27-44`](https://github.com/jerryc127/hexo-theme-butterfly/blob/f223b1888b42b2b336068e6c959ed90a3cd7c8f3/layout/includes/third-party/subtitle.pug#L27) 区分动态与纯文本静态分支。随机来源启用时，上游静态分支仍可显示服务返回的内容；本主题同样在静态模式取远程字符串，失败后显示自定义第一项。

## 空值和来源失败

- 空文案、只含空白的列表或缺少文案时保持空显示，不创建 Typed，也不循环输出配置警告。
- 随机来源未启用或 URL 为空时不发请求，直接使用本地文案。
- 请求失败、5 秒超时、非成功 HTTP、JSON 无效、路径缺失/不存在、结果不是非空字符串时回退本地文案；本地为空则保持空显示。
- TEXT 响应作为纯文本；配置 JSON 路径（如 `data.content`）或响应标为 JSON 时解析 JSON。路径只读取自有字段，嵌套缺项不抛出未捕获异常。
- 请求强制使用 `dataType: 'text'`，不根据服务响应类型执行脚本。静态分支用 `textContent`，Typed 也设置 `contentType: null`；文案中的 HTML 标签作为可见文字，不解释为 HTML。该行为也适用于旧站中配置的标签。

打字速度暂保留本主题既有 200ms，上游默认 150ms；`typed_option` 全参数、来源提供方枚举、字幕完整视觉对齐继续按矩阵推进，不在本包替代或关闭。

## 验证边界

`node --test tests/subtitle.test.mjs` 检查禁用/第一屏关闭、静态安全首项、缺配置兼容、空值、TEXT/JSON 取值、失败回退及旧版配置迁移。实际 Halo 升级与浏览器场景使用专属实验站，并分别记录完整源码 SHA、主题包/夹具/配置摘要、1440×1000 与 390×844 的亮暗结果和随机请求计数；不连接真实第三方文案服务。单元测试不替代真实页面验收，无头手机视口不替代真机。
