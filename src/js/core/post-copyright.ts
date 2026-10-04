/**
 * 文章版权。对齐 Butterfly 5.7.0
 * _config.yml post_copyright + layout/includes/post/post-copyright.pug
 * （f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 默认：enable true、decode false、author_href 空、license CC BY-NC-SA 4.0、
 * license_url https://creativecommons.org/licenses/by-nc-sa/4.0/ 。
 * enable 仅显式 false 关闭。decode 仅显式 true 才 decodeURI permalink。
 * 空 author_href 回退站点 URL。仅文章页。不做逐页覆盖、footer.nav。
 */

export const DEFAULTS = {
  enable: true,
  decode: false,
  author_href: '',
  license: 'CC BY-NC-SA 4.0',
  license_url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
};

function isExplicitFalse(value: unknown) {
  return value === false || value === 'false';
}

function isExplicitTrue(value: unknown) {
  return value === true || value === 'true';
}

/** 默认 true；仅显式 false 关闭。 */
export function resolveEnable(value: unknown) {
  if (isExplicitFalse(value)) return false;
  if (isExplicitTrue(value)) return true;
  return DEFAULTS.enable;
}

/** 默认 false；仅显式 true 才解码。 */
export function resolveDecode(value: unknown) {
  return isExplicitTrue(value);
}

/** 空 / 缺省回退站点 URL，再缺省为 `/`。 */
export function resolveAuthorHref(value: unknown, siteUrl: unknown) {
  if (value != null && String(value).trim() !== '') return String(value);
  if (siteUrl != null && String(siteUrl).trim() !== '') return String(siteUrl);
  return '/';
}

export function resolveLicense(value: unknown) {
  if (value == null) return DEFAULTS.license;
  const text = String(value);
  return text.trim() === '' ? DEFAULTS.license : text;
}

export function resolveLicenseUrl(value: unknown) {
  if (value == null) return DEFAULTS.license_url;
  const text = String(value);
  return text.trim() === '' ? DEFAULTS.license_url : text;
}

/**
 * pug：`theme.post_copyright.decode ? decodeURI(url) : url`。
 * 非法百分号序列时回退原文，避免抛错。
 */
export function formatPermalinkText(url: unknown, decodeFlag: unknown) {
  const href = url == null ? '' : String(url);
  if (!resolveDecode(decodeFlag)) return href;
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}

export function shouldRender(enable: unknown) {
  return resolveEnable(enable);
}
