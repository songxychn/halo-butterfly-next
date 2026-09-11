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
 * footer.nav 默认空；扁平 title/url，不做 html / 嵌套列。
 * footer_img 默认空（上游 false）：空 / false 不套背景；true 本刀不复用页头。
 * 非空 URL 才写 background-image。不做 mask.footer。
 */

export const DEFAULTS = {
  owner: { enable: true, since: 2025 },
  copyright: { enable: true, version: true },
  custom_text: '',
  nav: [],
  footer_img: '',
};

const ABSOLUTE_URL = /^(?:[a-z][a-z\d+.-]*:)?\/\//i;
const RELATIVE_URL = /^(\.\/|\.\.\/|\/|[^/]+\/).*$/;
const COLOR = /^(#|rgb|rgba|hsl|hsla)/i;
const SIMPLE_FILE = /\.(png|jpg|jpeg|gif|bmp|webp|svg|tiff)$/i;

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

/** pug `if nav`：非空且至少一项同时有 title 与 url。不做 html 子项。 */
export function visibleNavItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => {
    if (!item || typeof item !== 'object') return false;
    const title = item.title == null ? '' : String(item.title).trim();
    const url = item.url == null ? '' : String(item.url).trim();
    return title !== '' && url !== '';
  });
}

export function shouldRenderNav(items) {
  return visibleNavItems(items).length > 0;
}

/** 上游 false / 空 → 不渲染；true 复用页头，本刀不套背景。 */
export function shouldRenderFooterImg(value) {
  if (value === false || value === 'false' || value === true || value === 'true') return false;
  if (value == null) return false;
  return String(value).trim() !== '';
}

/**
 * 对齐 getBgPath（scripts/helpers/page.js）。本刀模板只走 URL 的
 * background-image；颜色/简写供单测对照，模板不输出。
 */
export function footerImgStyle(value) {
  if (!shouldRenderFooterImg(value)) return '';
  const path = String(value).trim();
  if (COLOR.test(path)) return `background-color: ${path};`;
  if (ABSOLUTE_URL.test(path) || RELATIVE_URL.test(path) || SIMPLE_FILE.test(path)) {
    return `background-image: url(${path});`;
  }
  return `background: ${path};`;
}
