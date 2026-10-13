import DOMPurify from 'dompurify';
import { onPageCleanup, pageListen } from './page-lifecycle.ts';

export interface FeedItem { key: string; author: string; avatar: string; date: string; tags: string[]; content: string; html: boolean }
const MAX_BYTES = 1024 * 1024;
const bound = (value: unknown, fallback: number, max: number) => {
  const n = Number(value);
  return value !== '' && value != null && Number.isFinite(n) ? Math.max(1, Math.min(max, Math.floor(n))) : fallback;
};
export function momentDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
}
export function feedUrl(value: string, origin: string) {
  try {
    const url = new URL(value, origin);
    if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.origin === origin))) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
export function formatMomentDate(value: string, zone = 'UTC', locale = 'zh-CN') {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: zone };
  try { return new Intl.DateTimeFormat(locale, opts).format(date); }
  catch { return new Intl.DateTimeFormat('zh-CN', { ...opts, timeZone: 'UTC' }).format(date); }
}
export function nativeMomentPage(value: string, page: number, total: number) {
  try {
    const url = new URL(value);
    if (!/^\/moments(?:\/page\/[1-9]\d*)?\/?$/.test(url.pathname) || !Number.isSafeInteger(page) || page < 1 || page > total) return null;
    url.pathname = page === 1 ? '/moments' : `/moments/page/${page}`;
    url.hash = '';
    return url.pathname + url.search;
  } catch { return null; }
}
/** Filter/sort before slicing and paginate the result; never hide native server rows. */
export function parseMomentFeed(value: unknown, options: { origin: string; limit?: unknown; since?: string }) {
  const raw = Array.isArray(value) ? value : (value as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(raw) || raw.length > 1000) throw new Error('Expected at most 1000 feed items');
  if (options.since && !momentDate(options.since)) throw new Error('Invalid feed start date');
  const keys = new Set<string>();
  const items: FeedItem[] = raw.map(value => {
    if (!value || typeof value !== 'object') throw new Error('Invalid feed item');
    const x = value as Record<string, unknown>;
    if (typeof x.key !== 'string' || !x.key.trim() || x.key.length > 200 || keys.has(x.key) || !momentDate(x.date)) throw new Error('Invalid key or date');
    const html = typeof x.html === 'string', content = html ? x.html : x.content;
    if (typeof content !== 'string' || content.length > 100000) throw new Error('Invalid feed content');
    keys.add(x.key);
    return { key: x.key, date: x.date as string, author: typeof x.author === 'string' ? x.author.slice(0, 200) : '访客',
      avatar: typeof x.avatar === 'string' ? feedUrl(x.avatar, options.origin) || '' : '',
      tags: Array.isArray(x.tags) ? x.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 20).map(tag => tag.slice(0, 100)) : [], content, html };
  });
  return items.filter(x => !options.since || Date.parse(x.date) >= Date.parse(options.since))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.key.localeCompare(b.key))
    .slice(0, bound(options.limit, 100, 1000));
}
export async function readMomentFeed(response: Response) {
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Feed unavailable or too large');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BYTES) throw new Error('Feed too large');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel(); }
}
export function initializeMoments(root: Document = document) {
  const win = root.defaultView;
  if (!win) return;
  for (const node of root.querySelectorAll<HTMLElement>('time[data-moment-date][datetime]')) {
    node.textContent = formatMomentDate(node.getAttribute('datetime') || '', node.dataset.timeZone || 'UTC', root.documentElement.lang || 'zh-CN');
  }
  const jump = root.querySelector<HTMLFormElement>('[data-moment-page-jump]');
  if (jump) {
    const input = jump.elements.namedItem('page') as HTMLInputElement;
    const total = Number(jump.dataset.totalPages);
    jump.hidden = false;
    pageListen(jump, 'submit', event => {
      event.preventDefault();
      const href = nativeMomentPage(win.location.href, Number(input.value), total);
      if (href) win.location.assign(href);
      else input.reportValidity();
    });
  }
  const feed = root.querySelector<HTMLElement>('[data-moment-feed]');
  if (!feed) return;
  const list = feed.querySelector<HTMLElement>('[data-feed-items]')!;
  const status = feed.querySelector<HTMLElement>('[data-feed-status]')!;
  const retry = feed.querySelector<HTMLButtonElement>('[data-feed-retry]')!;
  const pager = feed.querySelector<HTMLFormElement>('[data-feed-pager]')!;
  const previous = pager.querySelector<HTMLButtonElement>('[data-feed-previous]')!;
  const next = pager.querySelector<HTMLButtonElement>('[data-feed-next]')!;
  const input = pager.elements.namedItem('page') as HTMLInputElement;
  const pageSize = bound(feed.dataset.pageSize, 10, 50);
  let items: FeedItem[] = [], page = 1, active = true, running = false;
  const controller = new AbortController();
  onPageCleanup(() => { active = false; controller.abort(); });
  const show = () => {
    if (!active) return;
    const total = Math.max(1, Math.ceil(items.length / pageSize));
    page = Math.max(1, Math.min(total, page));
    const fragment = root.createDocumentFragment();
    for (const item of items.slice((page - 1) * pageSize, page * pageSize)) {
      const li = root.createElement('li'); li.className = 'item'; li.dataset.momentKey = item.key;
      const header = root.createElement('header'); header.className = 'moment-byline';
      if (item.avatar) {
        const avatar = root.createElement('img'); avatar.src = item.avatar; avatar.alt = ''; avatar.width = avatar.height = 40; avatar.loading = 'lazy'; avatar.className = 'moment-avatar';
        avatar.addEventListener('error', () => avatar.remove(), { once: true }); header.append(avatar);
      }
      const author = root.createElement('span'); author.textContent = item.author;
      const time = root.createElement('time'); time.dateTime = item.date;
      time.textContent = formatMomentDate(item.date, feed.dataset.timeZone || 'UTC', root.documentElement.lang || 'zh-CN');
      header.append(author, time);
      const content = root.createElement('div'); content.className = 'h';
      if (item.html) {
        content.innerHTML = DOMPurify.sanitize(item.content, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'img', 'details', 'summary', 'mark'], ALLOWED_ATTR: ['href', 'src', 'alt', 'title'], ALLOW_DATA_ATTR: false });
        for (const node of content.querySelectorAll<HTMLAnchorElement | HTMLImageElement>('a[href],img[src]')) {
          const attr = node.tagName === 'A' ? 'href' : 'src', url = feedUrl(node.getAttribute(attr) || '', win.location.origin);
          if (url) node.setAttribute(attr, url); else node.removeAttribute(attr);
          if (node.tagName === 'IMG') (node as HTMLImageElement).loading = 'lazy';
          else node.setAttribute('rel', 'nofollow noopener noreferrer');
        }
      } else content.textContent = item.content;
      const footer = root.createElement('footer'); footer.className = 'moment-footer';
      for (const tag of item.tags) { const span = root.createElement('span'); span.className = 'moment-tag'; span.textContent = '#' + tag; footer.append(span); }
      li.append(header, content, footer); fragment.append(li);
    }
    list.replaceChildren(fragment); pager.hidden = total <= 1;
    input.value = String(page); input.max = String(total); previous.disabled = page === 1; next.disabled = page === total;
    pager.querySelector<HTMLElement>('[data-feed-total]')!.textContent = `共 ${total} 页`;
    status.textContent = items.length ? `共 ${items.length} 条动态，第 ${page} / ${total} 页` : '暂无动态';
  };
  pageListen(previous, 'click', () => { page--; show(); });
  pageListen(next, 'click', () => { page++; show(); });
  pageListen(pager, 'submit', event => { event.preventDefault(); if (input.reportValidity()) { page = Number(input.value); show(); } });
  const load = async () => {
    if (running || !active) return;
    running = true; retry.hidden = true; status.textContent = '正在加载动态…'; feed.setAttribute('aria-busy', 'true');
    const attempt = new AbortController();
    const abort = () => attempt.abort();
    controller.signal.addEventListener('abort', abort, { once: true });
    const timeout = win.setTimeout(abort, 10000);
    try {
      const url = feedUrl(feed.dataset.source || '', win.location.origin);
      if (!url) throw new Error('Invalid feed URL');
      const response = await win.fetch(url, { credentials: 'omit', headers: { Accept: 'application/json' }, signal: attempt.signal, referrerPolicy: 'no-referrer' });
      items = parseMomentFeed(await readMomentFeed(response), { origin: win.location.origin, limit: feed.dataset.limit, since: feed.dataset.since });
      if (active) { feed.dataset.feedState = 'loaded'; page = 1; show(); }
    } catch {
      if (active) { feed.dataset.feedState = 'failed'; status.textContent = '外部动态暂时无法加载，本地瞬间不受影响。'; retry.hidden = false; }
    } finally { win.clearTimeout(timeout); controller.signal.removeEventListener('abort', abort); running = false; if (active) feed.setAttribute('aria-busy', 'false'); }
  };
  pageListen(retry, 'click', () => { void load(); });
  void load();
}
