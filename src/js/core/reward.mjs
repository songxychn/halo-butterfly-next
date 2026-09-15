/**
 * 打赏。对齐 Butterfly 5.7.0
 * _config.yml reward + layout/includes/post/reward.pug + layout/post.pug
 * （f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 默认：enable false、text 空、QR_code 空。
 * post.pug 条件为 enable && QR_code；仅显式 true 开启。
 * 空 text 回退「打赏」（上游 _p('donate')）。
 * 仅文章页；单页 page.html 不插入。
 * 不做 footer、related_post helper、逐页覆盖。
 */

export const DEFAULTS = {
  enable: false,
  text: '',
  QR_code: [],
};

function isExplicitTrue(value) {
  return value === true || value === 'true';
}

/** 默认 false；仅显式 true 开启。 */
export function resolveEnable(value) {
  return isExplicitTrue(value);
}

/** 空 / 缺省回退「打赏」。 */
export function resolveText(value) {
  if (value == null) return '打赏';
  const text = String(value);
  return text.trim() === '' ? '打赏' : text;
}

export function resolveClickTo(item) {
  if (!item || typeof item !== 'object') return '';
  const link = item.link == null ? '' : String(item.link);
  if (link.trim() !== '') return link;
  return item.img == null ? '' : String(item.img);
}

/** 对齐 post.pug `enable && QR_code`：开启且至少一项有 img。 */
export function shouldRender(enable, items) {
  if (!resolveEnable(enable)) return false;
  return visibleQrItems(items).length > 0;
}

export function visibleQrItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => item && String(item.img ?? '').trim() !== '');
}
