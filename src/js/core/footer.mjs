/**
 * 页脚所有权 / 框架版权 / 自定义文案。
 * 对齐 Butterfly 5.7.0 _config.yml footer + layout/includes/footer.pug
 * （f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 默认：owner.enable true、owner.since 2025、copyright.enable true、
 * copyright.version true、custom_text 空。
 * owner / copyright 仅显式 false 关闭。since 与当前年不同且非空时显示
 * 「© since - current By author」，否则「© current By author」。
 * 作者用站点名称。custom_text 有内容才渲染；可见文本走转义，不做 HTML。
 * 不做 footer.nav、footer_img、reward。
 */

export const DEFAULTS = {
  owner: { enable: true, since: 2025 },
  copyright: { enable: true, version: true },
  custom_text: '',
};

function isExplicitFalse(value) {
  return value === false || value === 'false';
}

function isExplicitTrue(value) {
  return value === true || value === 'true';
}

/** 默认 true；仅显式 false 关闭。 */
export function resolveEnable(value, fallback = true) {
  if (isExplicitFalse(value)) return false;
  if (isExplicitTrue(value)) return true;
  return fallback;
}

export function resolveOwnerEnable(value) {
  return resolveEnable(value, DEFAULTS.owner.enable);
}

export function resolveCopyrightEnable(value) {
  return resolveEnable(value, DEFAULTS.copyright.enable);
}

export function resolveCopyrightVersion(value) {
  return resolveEnable(value, DEFAULTS.copyright.version);
}

/**
 * 解析起始年。空 / 非正数 / 非有限 → null（只显示当前年）。
 * 对齐 pug：`sinceYear && sinceYear != currentYear`。
 */
export function resolveSinceYear(value) {
  if (value == null || value === '') return null;
  const n = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function formatOwnerCopyright(sinceYear, currentYear, author) {
  const year = String(currentYear);
  const name = author == null ? '' : String(author);
  if (sinceYear != null && String(sinceYear) !== year) {
    return `© ${sinceYear} - ${year} By ${name}`;
  }
  return `© ${year} By ${name}`;
}

/** 空串不渲染；保留内部空白供 pre-wrap。 */
export function resolveCustomText(value) {
  if (value == null) return '';
  return String(value);
}
