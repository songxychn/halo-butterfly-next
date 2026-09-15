/**
 * 对齐 Butterfly 5.7.0 mask.header / mask.footer
 * （_config.yml / head.styl / footer.styl，f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 默认均为 true；仅显式 false 关闭。
 * mask.header：有第一屏 .above 时才出 :before（无第一屏 = not-top-img）。
 * mask.footer 仍由 footer.mjs 处理。不做 aside.hide / aside.mobile。
 */

export const MASK_HEADER_DEFAULT = true;

function isExplicitFalse(value) {
  return value === false || value === 'false';
}

function isExplicitTrue(value) {
  return value === true || value === 'true';
}

/** 默认 true；仅显式 false 关闭。 */
export function resolveMaskHeader(value) {
  if (isExplicitFalse(value)) return false;
  if (isExplicitTrue(value)) return true;
  return MASK_HEADER_DEFAULT;
}

/** 上游 #page-header:not(.not-top-img):before。无第一屏不加遮罩。 */
export function shouldRenderHeaderMask(enableAbove, maskHeader) {
  if (enableAbove === false || enableAbove === 'false') return false;
  return resolveMaskHeader(maskHeader);
}
