# 配置迁移指南

本主题提供离线配置迁移脚本，可将旧版 `halo-theme-butterfly`（2.0.5 / 2.0.7）或 `halo-butterfly-next` 1.x 导出的配置 JSON 转换为当前版本结构，并输出变更与待复核报告。

## 使用方法

```sh
# 从原版 halo-theme-butterfly 迁移
bun run migrate --input old-config.json --from 2.0.7 --output next-config.json

# 从 halo-butterfly-next 1.x 迁移
bun run migrate --input v1-config.json --from 1.0.0 --output next-config.json
```

执行完成后请检查生成的迁移报告，重点确认：

- 已移除的第三方服务（如旧版分析、聊天、广告 SDK、远程动态/友链聚合、PJAX 等）配置不再保留；
- 旧版代码注入区的自定义脚本请按需人工复核后再导入；
- 建议先备份现有配置再在 Halo 控制台导入新配置，以便随时回退。
