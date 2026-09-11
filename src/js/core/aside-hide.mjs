/**
 * 对齐 Butterfly 5.7.0 aside.hide
 * （_config.yml / source/css/_layout/aside.styl，f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 默认 false；仅显式 true 才给 html 加 hide-aside。
 * 须 aside.enable；不做 aside.mobile，不复用作者卡片 aside.button，不做右下角开关 / localStorage。
 */

export const ASIDE_HIDE_DEFAULT = false;

function isExplicitTrue(value) {
  return value === true || value === 'true';
}

function isExplicitFalse(value) {
  return value === false || value === 'false';
}

/** 默认 false；仅显式 true 开启初始隐藏。 */
export function resolveAsideHide(value) {
  if (isExplicitTrue(value)) return true;
  return ASIDE_HIDE_DEFAULT;
}

/** 上游 htmlClassHideAside = theme.aside.enable && theme.aside.hide。 */
export function shouldApplyHideAside(asideEnable, hide) {
  if (isExplicitFalse(asideEnable)) return false;
  if (asideEnable === '' || asideEnable == null) return false;
  return resolveAsideHide(hide);
}
