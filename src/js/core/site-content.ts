/** Only explicit public navigation schemes. Credentials never belong in visible links. */
export function siteLink(value: unknown, origin: string, contact = true) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), origin);
    if (url.username || url.password || !['http:', 'https:', ...(contact ? ['mailto:', 'tel:'] : [])].includes(url.protocol)) return null;
    return url.href;
  } catch { return null; }
}

export function siteColor(value: unknown, supports: (value: string) => boolean) {
  if (typeof value !== 'string' || !value.trim() || value.length > 100 || /[;{}<>\r\n]|\b(?:url|var|env)\s*\(/i.test(value)) return '';
  return supports(value.trim()) ? value.trim() : '';
}

export function footerGrow(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 && number <= 12 ? number : 1;
}

export function shuffled<T>(values: readonly T[], random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const sample = random();
    const j = Math.floor((Number.isFinite(sample) ? Math.min(0.999999999999, Math.max(0, sample)) : 0) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function sanitizeSiteHtml(value: string, doc: Document) {
  const { default: DOMPurify } = await import('dompurify');
  const fragment = doc.createElement('div');
  fragment.innerHTML = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'span', 'small', 'a', 'ul', 'ol', 'li', 'img', 'blockquote', 'code', 'pre', 'details', 'summary', 'mark'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
    ALLOW_DATA_ATTR: false,
  });
  for (const node of fragment.querySelectorAll<HTMLAnchorElement | HTMLImageElement>('a[href],img[src]')) {
    const attr = node.tagName === 'A' ? 'href' : 'src';
    const url = siteLink(node.getAttribute(attr), doc.baseURI, attr === 'href');
    if (url) node.setAttribute(attr, url); else node.removeAttribute(attr);
    if (node.tagName === 'A') node.setAttribute('rel', 'noopener noreferrer');
    else (node as HTMLImageElement).loading = 'lazy';
  }
  return fragment.innerHTML;
}

export function initializeSiteContent(root: Document = document) {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('[data-site-link]')) {
    const url = siteLink(link.getAttribute('href'), root.baseURI);
    if (url) link.href = url; else link.removeAttribute('href');
  }
  for (const link of root.querySelectorAll<HTMLElement>('[data-social-color]')) {
    for (const [key, prop] of [['socialColor', '--social-color'], ['socialDarkColor', '--social-dark-color']]) {
      const color = siteColor(link.dataset[key], value => root.defaultView?.CSS.supports('color', value) ?? false);
      if (color) link.style.setProperty(prop, color);
    }
  }
  for (const column of root.querySelectorAll<HTMLElement>('[data-footer-grow]')) {
    column.style.flexGrow = String(footerGrow(column.dataset.footerGrow));
  }

  const icons = [...root.querySelectorAll<HTMLElement>('[data-social-icon]')];
  const htmlNodes = [...root.querySelectorAll<HTMLElement>('[data-site-html]')];
  if (!icons.length && !htmlNodes.length) return;

  void import('dompurify').then(({ default: DOMPurify }) => {
    for (const icon of icons) {
      const value = icon.dataset.icon || '';
      const markup = DOMPurify.sanitize(value, {
        ALLOWED_TAGS: ['i', 'span', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon'],
        ALLOWED_ATTR: ['class', 'viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'points', 'aria-hidden'],
        ALLOW_DATA_ATTR: false,
      });
      if (markup.trim()) icon.innerHTML = markup;
    }
    for (const node of htmlNodes) {
      void sanitizeSiteHtml(node.textContent || '', root).then(clean => {
        node.innerHTML = clean;
      });
    }
  });
}

export function initializeLinks(root: Document = document) {
  const random = root.querySelector('[data-link-random="true"]') !== null;
  if (!random) return;
  for (const list of root.querySelectorAll<HTMLElement>('[data-link-list]')) {
    list.replaceChildren(...shuffled([...list.children]));
  }
}
