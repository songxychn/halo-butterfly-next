/**
 * 对齐 Butterfly 5.7.0 aside.mobile
 * （_config.yml / source/css/_layout/aside.styl，f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 默认 true；仅显式 false 才给 html 加 aside-mobile-off（窄屏隐藏卡片，目录除外）。
 * 须 aside.enable；不复用作者卡片 aside.button，不做右下角开关 / localStorage，不改 aside.hide。
 */

export const ASIDE_MOBILE_DEFAULT = true;

function isExplicitFalse(value: unknown) {
  return value === false || value === 'false';
}

function isExplicitTrue(value: unknown) {
  return value === true || value === 'true';
}

/** 默认 true；仅显式 false 关闭窄屏卡片。 */
export function resolveAsideMobile(value: unknown) {
  if (isExplicitFalse(value)) return false;
  if (isExplicitTrue(value)) return true;
  return ASIDE_MOBILE_DEFAULT;
}

/** 上游 compile-time aside.mobile == false → 窄屏隐藏卡片。须 aside.enable。 */
export function shouldApplyAsideMobileOff(asideEnable: unknown, mobile: unknown) {
  if (isExplicitFalse(asideEnable)) return false;
  if (asideEnable === '' || asideEnable == null) return false;
  return resolveAsideMobile(mobile) === false;
}
