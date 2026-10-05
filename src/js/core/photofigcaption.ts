/** Butterfly photofigcaption: title first, alt as fallback; keep editor captions. */
export function resolvePhotoFigcaption(value: unknown): boolean {
  return value === true || value === 'true';
}

export function photoCaptionText(image: Pick<HTMLImageElement, 'title' | 'alt'>): string {
  return image.title || image.alt || '';
}

/** Add captions without replacing images, links, picture sources or lightbox triggers. */
export function applyPhotoFigcaptions(article: HTMLElement | null, enabled: unknown): number {
  if (!article || !resolvePhotoFigcaption(enabled)) return 0;
  let added = 0;
  for (const image of article.querySelectorAll<HTMLImageElement>('img')) {
    if (image.hasAttribute('data-theme-photofigcaption') || image.closest('pre, code, button, svg')) continue;
    const text = photoCaptionText(image);
    if (!text.trim()) continue;
    const figure = image.closest('figure');
    // An editor's caption describes the whole figure, including multi-image figures.
    if (figure?.querySelector('figcaption, .img-alt')) continue;
    let target: Element = image;
    // Keep captions outside single-image links and Viewer.js controls. Shared links
    // retain one adjacent caption per image without moving or duplicating the link.
    const wrapper = image.closest('a, .theme-lightbox-trigger, picture');
    if (wrapper && article.contains(wrapper) && wrapper.querySelectorAll('img').length === 1) {
      target = wrapper;
      const outer = wrapper.parentElement?.closest('a, .theme-lightbox-trigger');
      if (outer && article.contains(outer) && outer.querySelectorAll('img').length === 1) target = outer;
    }
    if (target.nextElementSibling?.matches('figcaption, .img-alt, .theme-photofigcaption')) continue;
    const standaloneFigure = figure && figure.querySelectorAll('img').length === 1;
    const caption = article.ownerDocument.createElement(standaloneFigure ? 'figcaption' : 'span');
    caption.className = 'theme-photofigcaption';
    caption.textContent = text;
    if (standaloneFigure) figure.append(caption);
    else target.after(caption);
    image.setAttribute('data-theme-photofigcaption', 'true');
    added++;
  }
  return added;
}
