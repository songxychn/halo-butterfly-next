# 核心页面自动无障碍规则扫描

`scripts/accessibility/check-core.mjs` 使用固定 axe-core 4.12.1 和仓库固定的无头 Chromium，扫描 comparison 的10条核心路由 × 桌面/手机 × 亮暗，共40页。执行 WCAG 2 A/AA、2.1 AA、2.2 AA 标签规则，保留所有 violation 和 incomplete；任一违规、页面异常或被阻止请求都会判失败。incomplete需要人工判断，不因自动规则无违规而视为全部合规。

先安装现有浏览器工具，再在独立运行目录准备axe，避免把验收依赖加入主题包：

```sh
bun scripts/browser/install.mjs
mkdir -p .runtime/plugin-a11y
cat > .runtime/plugin-a11y/package.json <<'JSON'
{"name":"local-core-a11y","private":true,"dependencies":{"axe-core":"4.12.1"}}
JSON
bun install --cwd .runtime/plugin-a11y --ignore-scripts
BASE_URL=http://127.0.0.1:18105 LAB_RUNTIME=/absolute/owned/comparison-lab \
  bun scripts/accessibility/check-core.mjs
```

目标仅允许与拥有标记匹配的本地127.0.0.1端口；只读请求和正常公开访问计数允许，其他写入/外部请求被阻止并记录。工具不改变配置、插件或正文，前后核对安装记录未变化。输出目录含完整报告、axe字节摘要、版本、候选包归属和每页节点诊断。

检查使用未展开隐藏控件的常规页面状态；键盘交互另由浏览器矩阵检查。真实手机、Safari应用、屏幕阅读器、键盘全路径、自动工具的incomplete项和视觉判断仍需单独验收，不能用本扫描替代。
