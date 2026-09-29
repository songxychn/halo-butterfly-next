/** Exact same-site page matching; anchors and command links are not pages. */
export function isCurrentMenuLink(href, currentHref) {
  if (!href || href.trim().startsWith('#')) return false;
  try {
    const current = new URL(currentHref);
    const target = new URL(href, current);
    const path = value => value.replace(/\/+$/, '') || '/';
    return ['http:', 'https:'].includes(target.protocol) && target.origin === current.origin &&
      !target.hash && path(target.pathname) === path(current.pathname) &&
      (!target.search || target.search === current.search);
  } catch {
    return false;
  }
}
