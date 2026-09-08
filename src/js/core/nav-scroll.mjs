/** Scroll appearance for Halo nav. Matches Butterfly 5.7.0 scrollFn + nav.fixed. */
export const NAV_SCROLL_THRESHOLD = 56;

export function isNavAlwaysPinned(fixed) {
  return fixed === true;
}

/**
 * @returns {{style: boolean, active: boolean}|null} null means leave current classes unchanged
 */
export function navScrollAppearance({scrollTop, previousTop, threshold = NAV_SCROLL_THRESHOLD}) {
  if (scrollTop > threshold) {
    return {style: true, active: previousTop > scrollTop};
  }
  if (scrollTop === 0) {
    return {style: false, active: false};
  }
  return null;
}
