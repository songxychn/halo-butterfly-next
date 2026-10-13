/** Parse decoration through CSSOM, never interpolate configuration into a style sheet. */
export function decorativeBackground(value: unknown): { css: string; image?: string } | undefined {
  if (typeof value !== 'string') return;
  const raw = value.trim();
  if (!raw || raw === 'false' || raw === 'true') return;
  const style = document.createElement('span').style;
  // CSS supports colors, gradients and full background shorthand. Only property
  // values are accepted: declarations and HTML cannot escape this assignment.
  if (typeof CSS !== 'undefined' && CSS.supports('background', raw)) {
    style.background = raw;
    return { css: style.background };
  }
  try {
    const url = new URL(raw, document.baseURI);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return;
  } catch { return; }
  style.backgroundImage = `url(${JSON.stringify(raw)})`;
  return { css: `${style.backgroundImage} center / cover no-repeat`, image: raw };
}

export function initializeFooterBackground(): void {
  const footer = document.querySelector<HTMLElement>('footer[data-footer-background]');
  if (!footer) return;
  const raw = footer.dataset.footerBackground;
  const conf = window.MainApp.conf;
  const value = raw === 'true' ? (conf.above_background || conf.above_background_fallback) : raw;
  const background = decorativeBackground(value);
  if (!background) return;
  footer.style.background = background.css;
  footer.classList.add('footer--bg');
  footer.classList.toggle('footer--mask', footer.dataset.footerMask !== 'false');
}
