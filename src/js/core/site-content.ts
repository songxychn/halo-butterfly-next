import DOMPurify from 'dompurify';
import { onPageCleanup, pageListen } from './page-lifecycle.ts';

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
    const j = Math.floor((Number.isFinite(sample) ? Math.min(.999999999999, Math.max(0, sample)) : 0) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function sanitizeSiteHtml(value: string, doc: Document) {
  const fragment = doc.createElement('div');
  fragment.innerHTML = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'span', 'small', 'a', 'ul', 'ol', 'li', 'img', 'blockquote', 'code', 'pre', 'details', 'summary', 'mark'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title'], ALLOW_DATA_ATTR: false,
  });
  for (const node of fragment.querySelectorAll<HTMLAnchorElement | HTMLImageElement>('a[href],img[src]')) {
    const attr = node.tagName === 'A' ? 'href' : 'src';
    const url = siteLink(node.getAttribute(attr), doc.location.origin, attr === 'href');
    if (url) node.setAttribute(attr, url); else node.removeAttribute(attr);
    if (node.tagName === 'A') node.setAttribute('rel', 'noopener noreferrer');
    else (node as HTMLImageElement).loading = 'lazy';
  }
  return fragment.innerHTML;
}
export function initializeSiteContent(root: Document = document) {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('[data-site-link]')) {
    const url = siteLink(link.getAttribute('href'), root.location.origin);
    if (url) link.href = url; else link.removeAttribute('href');
  }
  for (const icon of root.querySelectorAll<HTMLElement>('[data-social-icon]')) {
    if (icon.dataset.iconBound) continue;
    const value = icon.dataset.icon || '';
    const markup = DOMPurify.sanitize(value, { ALLOWED_TAGS: ['i', 'span', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon'], ALLOWED_ATTR: ['class', 'viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'points', 'aria-hidden'], ALLOW_DATA_ATTR: false });
    if (markup.trim()) icon.innerHTML = markup;
    icon.dataset.iconBound = 'true';
  }
  for (const link of root.querySelectorAll<HTMLElement>('[data-social-color]')) {
    for (const [key, prop] of [['socialColor', '--social-color'], ['socialDarkColor', '--social-dark-color']]) {
      const color = siteColor(link.dataset[key], value => root.defaultView?.CSS.supports('color', value) ?? false);
      if (color) link.style.setProperty(prop, color);
    }
  }
  for (const column of root.querySelectorAll<HTMLElement>('[data-footer-grow]')) column.style.flexGrow = String(footerGrow(column.dataset.footerGrow));
  for (const node of root.querySelectorAll<HTMLElement>('[data-site-html]')) {
    if (node.dataset.siteHtmlBound) continue;
    node.innerHTML = sanitizeSiteHtml(node.textContent || '', root);
    node.dataset.siteHtmlBound = 'true';
  }
}
interface FriendLink { name: string; url: string; logo: string; description: string }
interface FriendGroup { name: string; description: string; links: FriendLink[] }
export function parseFriendGroups(value: unknown, origin: string): FriendGroup[] {
  const groups = Array.isArray(value) ? value : (value as { groups?: unknown[] } | null)?.groups;
  if (!Array.isArray(groups) || groups.length > 50) throw new Error('Expected at most 50 groups');
  let count = 0;
  return groups.map(value => {
    if (!value || typeof value !== 'object') throw new Error('Invalid group');
    const group = value as Record<string, unknown>;
    if (typeof group.name !== 'string' || group.name.length > 200 || !Array.isArray(group.links)) throw new Error('Invalid group fields');
    count += group.links.length;
    if (count > 500) throw new Error('Too many links');
    const links = group.links.map(value => {
      if (!value || typeof value !== 'object') throw new Error('Invalid link');
      const item = value as Record<string, unknown>, url = siteLink(item.url, origin, false);
      if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200 || !url) throw new Error('Invalid link fields');
      return { name: item.name, url, logo: siteLink(item.logo, origin, false) || '', description: typeof item.description === 'string' ? item.description.slice(0, 2000) : '' };
    });
    return { name: group.name, description: typeof group.description === 'string' ? group.description.slice(0, 5000) : '', links };
  });
}
export async function readPublicJson(response: Response) {
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > 1024 * 1024) throw new Error('Source unavailable or too large');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength; if (size > 1024 * 1024) throw new Error('Source too large');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel(); }
}
export function initializeLinks(root: Document = document) {
  const win = root.defaultView;
  if (!win) return;
  const random = root.querySelector('[data-link-random="true"]') !== null;
  if (random) for (const list of root.querySelectorAll<HTMLElement>('[data-link-list]')) {
    if (list.dataset.linkShuffled) continue;
    list.replaceChildren(...shuffled([...list.children])); list.dataset.linkShuffled = 'true';
  }
  const container = root.querySelector<HTMLElement>('[data-remote-links]');
  if (!container) return;
  const status = container.querySelector<HTMLElement>('[data-links-status]')!;
  const output = container.querySelector<HTMLElement>('[data-links-items]')!;
  const retry = container.querySelector<HTMLButtonElement>('[data-links-retry]')!;
  let active = true, running = false;
  const controller = new AbortController();
  onPageCleanup(() => { active = false; controller.abort(); });
  const load = async () => {
    if (!active || running) return;
    running = true; retry.hidden = true; status.textContent = container.dataset.i18nLoading || '正在加载友链…'; container.setAttribute('aria-busy', 'true');
    const attempt = new AbortController(), abort = () => attempt.abort();
    controller.signal.addEventListener('abort', abort, { once: true });
    const timeout = win.setTimeout(abort, 10000);
    try {
      const url = siteLink(container.dataset.source, win.location.origin, false);
      if (!url || (new URL(url).protocol !== 'https:' && new URL(url).origin !== win.location.origin)) throw new Error('Use HTTPS or same origin');
      const response = await win.fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: attempt.signal, headers: { Accept: 'application/json' } });
      const groups = parseFriendGroups(await readPublicJson(response), win.location.origin);
      if (!active) return;
      const fragment = root.createDocumentFragment();
      for (const group of groups) {
        const section = root.createElement('section'); section.className = 'item';
        const title = root.createElement('h2'); title.className = 'name'; title.textContent = group.name;
        const description = root.createElement('p'); description.className = 'group-description'; description.textContent = group.description;
        const list = root.createElement('div'); list.className = 'list';
        for (const link of random ? shuffled(group.links) : group.links) {
          const anchor = root.createElement('a'); anchor.className = 'link'; anchor.href = link.url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
          const fallback = root.createElement('span'); fallback.className = 'friend-initial'; fallback.textContent = Array.from(link.name)[0] || '';
          anchor.append(fallback);
          if (link.logo) {
            fallback.hidden = true;
            const logo = root.createElement('img'); logo.className = 'logo'; logo.alt = ''; logo.width = logo.height = 60; logo.loading = 'lazy'; logo.src = link.logo;
            logo.addEventListener('load', () => { fallback.hidden = true; });
            logo.addEventListener('error', () => { logo.remove(); fallback.hidden = false; }, { once: true }); anchor.prepend(logo);
          }
          const info = root.createElement('div'); info.className = 'info';
          const name = root.createElement('p'); name.className = 'n'; name.textContent = link.name;
          const desc = root.createElement('p'); desc.className = 'd'; desc.textContent = link.description;
          info.append(name, desc); anchor.append(info); list.append(anchor);
        }
        section.append(title, description, list); fragment.append(section);
      }
      output.replaceChildren(fragment); container.dataset.linksState = 'loaded'; status.textContent = groups.length ? '' : (container.dataset.i18nEmpty || '暂无远端友链');
    } catch {
      if (active) { container.dataset.linksState = 'failed'; status.textContent = container.dataset.i18nError || '远端友链暂时无法加载，本地友链不受影响。'; retry.hidden = false; }
    } finally {win.clearTimeout(timeout);controller.signal.removeEventListener('abort',abort);running=false;if(active)container.setAttribute('aria-busy','false');}
  };
  pageListen(retry, 'click', () => { void load(); });
  void load();
}
