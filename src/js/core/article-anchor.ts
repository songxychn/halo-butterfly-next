/** Chapter links keep author IDs and work even when the TOC is disabled. */
const HEADINGS = 'h1,h2,h3,h4,h5,h6';

export function headingSlug(text: string) {
  return text.trim().normalize('NFC').replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/\s+/g, '-') || 'section';
}

export function ensureHeadingIds(article: HTMLElement) {
  const headings = [...article.querySelectorAll<HTMLElement>(HEADINGS)];
  const used = new Set([...article.ownerDocument.querySelectorAll('[id]')].map(node => node.id));
  for (const heading of headings) {
    if (heading.id) continue;
    const base = headingSlug(heading.textContent || '');
    let id = base;
    let suffix = 1;
    while (used.has(id)) id = `${base}-${suffix++}`;
    heading.id = id;
    used.add(id);
  }
  return headings;
}

export function hashId(hash: string) {
  try { return decodeURIComponent(hash.replace(/^#/, '')); }
  catch { return hash.replace(/^#/, ''); }
}

/** Only same-document fragments belong to chapter navigation. */
export function localAnchorId(href: string, currentUrl: string) {
  try {
    const url = new URL(href, currentUrl);
    const current = new URL(currentUrl);
    if (url.origin !== current.origin || url.pathname !== current.pathname || url.search !== current.search || !url.hash) return null;
    return hashId(url.hash);
  } catch { return null; }
}

interface AnchorOptions { autoUpdate?: unknown; clickToScroll?: unknown }
const enabled = (value: unknown) => value === true || value === 'true';

export function bindArticleAnchors(article: HTMLElement, options: AnchorOptions = {}) {
  const doc = article.ownerDocument;
  const win = doc.defaultView;
  if (!win) return () => {};
  const headings = ensureHeadingIds(article);
  const autoUpdate = enabled(options.autoUpdate);
  const clickToScroll = enabled(options.clickToScroll);
  let frame = 0;
  let unlock = 0;
  let navigating = false;
  const permalinks: HTMLAnchorElement[] = [];
  const offset = 80;

  const updateUrl = (id: string, push: boolean) => {
    const hash = `#${encodeURIComponent(id)}`;
    if (hashId(win.location.hash) === id) return;
    const url = `${win.location.pathname}${win.location.search}${hash}`;
    if (push) win.history.pushState(win.history.state, '', url);
    else win.history.replaceState(win.history.state, '', url);
  };
  const scrollTo = (heading: HTMLElement, smooth: boolean) => {
    navigating = true;
    win.clearTimeout(unlock);
    win.scrollTo({ top: Math.max(0, heading.getBoundingClientRect().top + win.scrollY - offset), behavior: smooth && !win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
    unlock = win.setTimeout(() => { navigating = false; }, smooth ? 700 : 0);
  };
  const followHash = () => {
    const target = doc.getElementById(hashId(win.location.hash));
    if (target && article.contains(target)) scrollTo(target, false);
  };
  if (clickToScroll) {
    for (const heading of headings) {
      // A distinct native link preserves heading semantics and links inside headings.
      const link = doc.createElement('a');
      link.className = 'heading-anchor';
      link.href = `#${encodeURIComponent(heading.id)}`;
      link.setAttribute('aria-label', `链接到章节：${heading.textContent || heading.id}`);
      heading.append(link);
      permalinks.push(link);
    }
  }
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;
    const link = element.closest<HTMLAnchorElement>('a');
    let heading: HTMLElement | null = null;
    if (link) {
      if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      if (!link.matches('.aside-toc .toc-link, .heading-anchor')) return;
      const id = localAnchorId(link.href, win.location.href);
      heading = id ? doc.getElementById(id) : null;
    } else if (clickToScroll && !element.closest('button,input,textarea,select,[contenteditable]') && !win.getSelection()?.toString()) {
      heading = element.closest<HTMLElement>(HEADINGS);
    }
    if (!heading || !article.contains(heading)) return;
    event.preventDefault();
    updateUrl(heading.id, true);
    scrollTo(heading, true);
    // TOC/heading activation also places keyboard focus at the destination.
    const hadTabindex = heading.hasAttribute('tabindex');
    if (!hadTabindex) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    if (!hadTabindex) heading.addEventListener('blur', () => heading?.removeAttribute('tabindex'), { once: true });
  };
  const onScroll = () => {
    if (!autoUpdate || navigating || frame) return;
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      if (navigating) return;
      let current: HTMLElement | undefined;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > offset + 1) break;
        current = heading;
      }
      if (current) updateUrl(current.id, false);
    });
  };
  doc.addEventListener('click', onClick);
  win.addEventListener('scroll', onScroll, { passive: true });
  win.addEventListener('hashchange', followHash);
  win.addEventListener('popstate', followHash);
  win.addEventListener('load', followHash, { once: true });
  // IDs generated at runtime do not exist during the browser's initial fragment lookup.
  followHash();
  return () => {
    doc.removeEventListener('click', onClick);
    win.removeEventListener('scroll', onScroll);
    win.removeEventListener('hashchange', followHash);
    win.removeEventListener('popstate', followHash);
    win.removeEventListener('load', followHash);
    win.cancelAnimationFrame(frame);
    win.clearTimeout(unlock);
    for (const link of permalinks) link.remove();
  };
}
