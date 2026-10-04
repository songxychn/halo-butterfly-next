/**
 * 解析上游 Butterfly 5.7.0 code_blocks.shrink 三态。
 * true：有按钮且初始折叠；false：有按钮且初始展开；none：无按钮。
 * 旧 Halo 布尔 enable_code_expander：true → 上游 false；false → 上游 none。
 */
export function resolveCodeShrink(value: unknown) {
  if (value === true) return 'false';
  if (value === false) return 'none';
  if (value == null || value === '') return 'false';
  const s = String(value).trim().toLowerCase();
  if (s === 'none' || s === 'true' || s === 'false') return s;
  return 'false';
}
