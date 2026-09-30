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
 * 模板结构对齐 footer.pug：.footer-separator、框架/主题链；有 nav 时
 * .footer-other--nav。custom_text 仍 th:text，无新增 th:utext。
 * footer_img 默认空（上游 false）：空 / false 不套背景；true 不复用页头。
 * 非空 URL 才写 background-image。mask.footer 默认 true，仅显式 false 关闭；
 * 有背景且未关闭时才加遮罩。不做 mask.header。不做完整 footer.styl 配色。
 */

export const DEFAULTS = {
  owner: { enable: true, since: 2025 },
  copyright: { enable: true, version: true },
  custom_text: '',
  nav: [],
  footer_img: '',
};

/** 上游 mask.footer 默认 true。 */
export const MASK_FOOTER_DEFAULT = true;

const ABSOLUTE_URL = /^(?:[a-z][a-z\d+.-]*:)?\/\//i;
const RELATIVE_URL = /^(\.\/|\.\.\/|\/|[^/]+\/).*$/;
const COLOR = /^(#|rgb|rgba|hsl|hsla)/i;
const SIMPLE_FILE = /\.(png|jpg|jpeg|gif|bmp|webp|svg|tiff)$/i;

function isExplicitFalse(value: unknown) {
  return value === false || value === 'false';
}

function isExplicitTrue(value: unknown) {
  return value === true || value === 'true';
}

/** 默认 true；仅显式 false 关闭。 */
export function resolveEnable(value: unknown, fallback = true) {
  if (isExplicitFalse(value)) return false;
  if (isExplicitTrue(value)) return true;
  return fallback;
}

export function resolveOwnerEnable(value: unknown) {
  return resolveEnable(value, DEFAULTS.owner.enable);
}

export function resolveCopyrightEnable(value: unknown) {
  return resolveEnable(value, DEFAULTS.copyright.enable);
}

export function resolveCopyrightVersion(value: unknown) {
  return resolveEnable(value, DEFAULTS.copyright.version);
}

/**
 * 解析起始年。空 / 非正数 / 非有限 → null（只显示当前年）。
 * 对齐 pug：`sinceYear && sinceYear != currentYear`。
 */
export function resolveSinceYear(value: unknown) {
  if (value == null || value === '') return null;
  const n = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function formatOwnerCopyright(sinceYear: unknown, currentYear: unknown, author: unknown) {
  const year = String(currentYear);
  const name = author == null ? '' : String(author);
  if (sinceYear != null && String(sinceYear) !== year) {
    return `© ${sinceYear} - ${year} By ${name}`;
  }
  return `© ${year} By ${name}`;
}

/** 空串不渲染；保留内部空白供 pre-wrap。 */
export function resolveCustomText(value: unknown) {
  if (value == null) return '';
  return String(value);
}

/** pug `if nav`：非空且至少一项同时有 title 与 url。不做 html 子项。 */
export function visibleNavItems(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => {
    if (!item || typeof item !== 'object') return false;
    const title = item.title == null ? '' : String(item.title).trim();
    const url = item.url == null ? '' : String(item.url).trim();
    return title !== '' && url !== '';
  });
}

export function shouldRenderNav(items: unknown) {
  return visibleNavItems(items).length > 0;
}

/** 上游 false / 空 → 不渲染；true 复用页头，本刀不套背景。 */
export function shouldRenderFooterImg(value: unknown) {
  if (value === false || value === 'false' || value === true || value === 'true') return false;
  if (value == null) return false;
  return String(value).trim() !== '';
}

/**
 * 对齐 getBgPath（scripts/helpers/page.js）。本刀模板只走 URL 的
 * background-image；颜色/简写供单测对照，模板不输出。
 */
export function footerImgStyle(value: unknown) {
  if (!shouldRenderFooterImg(value)) return '';
  const path = String(value).trim();
  if (COLOR.test(path)) return `background-color: ${path};`;
  if (ABSOLUTE_URL.test(path) || RELATIVE_URL.test(path) || SIMPLE_FILE.test(path)) {
    return `background-image: url(${path});`;
  }
  return `background: ${path};`;
}

/** 默认 true；仅显式 false 关闭。 */
export function resolveMaskFooter(value: unknown) {
  if (value === false || value === 'false') return false;
  if (value === true || value === 'true') return true;
  return MASK_FOOTER_DEFAULT;
}

/** 上游：footer_img != false && mask.footer。本刀 URL 背景 + 默认开遮罩。 */
export function shouldRenderFooterMask(footerImg: unknown, maskFooter: unknown) {
  return shouldRenderFooterImg(footerImg) && resolveMaskFooter(maskFooter);
}
