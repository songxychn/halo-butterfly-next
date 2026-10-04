/** Scroll appearance for Halo nav. Matches Butterfly 5.7.0 scrollFn + nav.fixed. */
export const NAV_SCROLL_THRESHOLD = 56;

export function isNavAlwaysPinned(fixed: unknown) {
  return fixed === true;
}

/**
 * @param {{scrollTop: number, previousTop: number, threshold?: number, alwaysPinned?: boolean}} opts
 * @returns {{style: boolean, active: boolean}|null} null means leave current classes unchanged
 *
 * `alwaysPinned` (nav.fixed=true) still toggles `.style` past the threshold so
 * post-title switching can bind to `.style.has-post`, but never sets `.active`
 * (no hide-on-scroll-down). Pinned visibility is CSS: `.fixed.style { top: 0 }`.
 */
export function navScrollAppearance({
  scrollTop,
  previousTop,
  threshold = NAV_SCROLL_THRESHOLD,
  alwaysPinned = false,
}: {scrollTop: number; previousTop: number; threshold?: number; alwaysPinned?: boolean}) {
  if (scrollTop > threshold) {
    return {
      style: true,
      active: alwaysPinned ? false : previousTop > scrollTop,
    };
  }
  if (scrollTop === 0) {
    return {style: false, active: false};
  }
  return null;
}
