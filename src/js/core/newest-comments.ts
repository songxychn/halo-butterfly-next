import { t, uiLocale } from './i18n';
import { onPageCleanup, pageListen } from './page-lifecycle.ts';
/** Halo public comments, merged across the public Post/SinglePage/Moment inventory.
 * The public API requires an exact subject. Never use console APIs or cookies.
 */
export interface CommentSubject {
  kind: 'Post' | 'SinglePage' | 'Moment'; name: string; href: string; revision: string;
}
export interface RecentComment {
  id: string; subject: string; nickname: string; excerpt: string; date: string; avatar: string;
}
interface CacheEntry { locale: string; expires: number; revision: string; limit: number; items: RecentComment[] }
const CACHE_KEY = 'halo-butterfly-next.newest-comments.v1';
export const commentGroup = (kind: CommentSubject['kind']) => kind === 'Moment' ? 'moment.halo.run' : 'content.halo.run';
const boundedNumber = (value: unknown, fallback: number, min: number, max: number) => {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
};
export const commentLimit = (value: unknown) => boundedNumber(value, 6, 1, 20);
export const commentCacheMinutes = (value: unknown) => boundedNumber(value, 10, 0, 60);
export const subjectKey = (subject: Pick<CommentSubject, 'kind' | 'name'>) => `${subject.kind}/${subject.name}`;

export function sameOriginCommentHref(value: string, origin: string) {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = 'post-comment';
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}
export function commentAvatar(value: unknown, origin: string) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, origin);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

/** Markup is never inserted into the live page; entity decoding is text-only. */
export function commentExcerpt(html: string, decode: (value: string) => string = value => value) {
  const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<pre\b[^>]*>[\s\S]*?<\/pre\s*>/gi, t('ui.codePlaceholder'))
    .replace(/<code\b[^>]*>[\s\S]*?<\/code\s*>/gi, t('ui.codePlaceholder'))
    .replace(/<img\b[^>]*>/gi, t('ui.imagePlaceholder'))
    .replace(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi, t('ui.linkPlaceholder'))
    .replace(/<[^>]*>/g, ' ');
  const chars = Array.from(decode(text).replace(/\s+/g, ' ').trim());
  return chars.length > 150 ? chars.slice(0, 150).join('') + '…' : chars.join('');
}

export function publicComment(value: unknown, subject: CommentSubject, origin: string, decode?: (value: string) => string): RecentComment | null {
  if (!value || typeof value !== 'object') return null;
  const { metadata, spec, owner } = value as Record<string, any>;
  const ref = spec?.subjectRef;
  if (!metadata || metadata.deletionTimestamp || typeof metadata.name !== 'string' ||
      spec?.approved !== true || spec.hidden !== false || spec.parentRef || ref?.group !== commentGroup(subject.kind) ||
      ref?.kind !== subject.kind || ref?.name !== subject.name) return null;
  const date = typeof spec.creationTime === 'string' ? spec.creationTime : metadata.creationTimestamp;
  if (typeof date !== 'string' || !Number.isFinite(Date.parse(date))) return null;
  return {
    id: metadata.name, subject: subjectKey(subject),
    nickname: typeof owner?.displayName === 'string' ? owner.displayName.slice(0, 200) : t('ui.guest'),
    excerpt: commentExcerpt(typeof spec.content === 'string' ? spec.content : '', decode),
    date, avatar: commentAvatar(owner?.avatar, origin),
  };
}

/** Taking N from every subject is sufficient for the global top N. */
export function rankComments(items: RecentComment[], limit: number) {
  return [...new Map(items.map(item => [item.id, item])).values()]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function readCommentCache(storage: Pick<Storage, 'getItem'> | null, subjects: CommentSubject[], limit: number, now: number, origin: string, locale = uiLocale()) {
  const result = new Map<string, CacheEntry>();
  if (!storage) return result;
  try {
    const parsed = JSON.parse(storage.getItem(CACHE_KEY) || '{}');
    for (const subject of subjects) {
      const key = subjectKey(subject), entry = parsed[key];
      if (!entry || !Number.isFinite(entry.expires) || entry.expires <= now || entry.expires > now + 60 * 60000 ||
          entry.locale !== locale || entry.revision !== subject.revision || entry.limit !== limit || !Array.isArray(entry.items) || entry.items.length > limit) continue;
      const valid = entry.items.every((item: RecentComment) => item && typeof item.id === 'string' && item.subject === key &&
        typeof item.nickname === 'string' && item.nickname.length <= 200 && typeof item.excerpt === 'string' && Array.from(item.excerpt).length <= 151 &&
        typeof item.date === 'string' && Number.isFinite(Date.parse(item.date)) && typeof item.avatar === 'string' && commentAvatar(item.avatar, origin) === item.avatar);
      if (valid) result.set(key, entry);
    }
  } catch { /* Storage denied or corrupt: query normally. */ }
  return result;
}

export async function fetchNewestComments(subjects: CommentSubject[], limit: number, minutes: number, options: {
  origin: string; locale?: string; storage?: Storage | null; fetch?: typeof fetch; now?: number; decode?: (value: string) => string;
}) {
  const now = options.now ?? Date.now(), locale = options.locale ?? uiLocale();
  const cache = minutes > 0 ? readCommentCache(options.storage ?? null, subjects, limit, now, options.origin, locale) : new Map<string, CacheEntry>();
  const request = options.fetch ?? fetch;
  const controller = new AbortController();
  onPageCleanup(() => controller.abort());
  const items: RecentComment[] = [];
  let cursor = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(4, subjects.length) }, async () => {
      while (cursor < subjects.length && !controller.signal.aborted) {
        const subject = subjects[cursor++], key = subjectKey(subject);
        const cached = cache.get(key);
        if (cached) { items.push(...cached.items); continue; }
        const url = new URL('/apis/api.halo.run/v1alpha1/comments', options.origin);
        url.search = new URLSearchParams({ group: commentGroup(subject.kind), kind: subject.kind, name: subject.name, page: '1', size: String(limit), sort: 'spec.creationTime,desc', withReplies: 'false' }).toString();
        const timeout = setTimeout(() => controller.abort(), 10000);
        let response: Response;
        let data: {items?: unknown[]};
        try {
          response = await request(url.href, { credentials: 'omit', headers: { Accept: 'application/json' }, signal: controller.signal });
          if (!response.ok) throw new Error('Public comments unavailable');
          data = await response.json();
        } finally { clearTimeout(timeout); }
        controller.signal.throwIfAborted();
        if (!Array.isArray(data.items)) throw new Error('Invalid public comments response');
        const comments = data.items.map(value => publicComment(value, subject, options.origin, options.decode)).filter((item): item is RecentComment => !!item);
        items.push(...comments);
        cache.set(key, { locale, expires: now + minutes * 60000, revision: subject.revision, limit, items: comments });
      }
    }));
    controller.signal.throwIfAborted();
    if (options.storage) {
      try {
        if (minutes > 0) options.storage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cache)));
        else options.storage.removeItem(CACHE_KEY);
      } catch { /* Private browsing / quota failure must not break comments. */ }
    }
    return rankComments(items, limit);
  } catch (error) {
    controller.abort();
    throw error; // Never present a partial list as the global latest comments.
  }
}

export function formatCommentDate(value: string, locale = uiLocale()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  try { return new Intl.DateTimeFormat(locale, options).format(date); }
  catch { return new Intl.DateTimeFormat('zh-CN', options).format(date); }
}

export function initializeNewestComments(root: Document = document) {
  const card = root.querySelector<HTMLElement>('[data-newest-comments]');
  if (!card || card.dataset.commentsBound === 'true') return;
  card.dataset.commentsBound = 'true';
  const win = root.defaultView;
  if (!win) return;
  const list = card.querySelector<HTMLElement>('[data-comments-list]');
  const status = card.querySelector<HTMLElement>('[data-comments-status]');
  const retry = card.querySelector<HTMLButtonElement>('[data-comments-retry]');
  const inventory = card.querySelector<HTMLTemplateElement>('[data-comment-subjects]');
  if (!list || !status || !retry || !inventory) return;
  const subjects = new Map<string, CommentSubject>();
  for (const node of inventory.content.querySelectorAll<HTMLAnchorElement>('a[data-comment-kind]')) {
    const kind = node.dataset.commentKind, name = node.dataset.commentName;
    const href = sameOriginCommentHref(node.getAttribute('href') || '', win.location.origin);
    if (!['Post', 'SinglePage', 'Moment'].includes(kind || '') || !name || !href) continue;
    const subject: CommentSubject = { kind: kind as CommentSubject['kind'], name, href, revision: node.dataset.commentRevision || '' };
    subjects.set(subjectKey(subject), subject);
  }
  inventory.remove(); // Only public identities were emitted; no comment payload in HTML.
  const limit = commentLimit(card.dataset.limit), minutes = commentCacheMinutes(card.dataset.storage);
  let storage: Storage | null = null;
  try { storage = win.sessionStorage; } catch { /* Query without persistence. */ }
  const decode = (text: string) => {
    const element = root.createElement('textarea');
    element.innerHTML = text;
    return element.value;
  };
  let running = false, active = true;
  onPageCleanup(() => { active = false; });
  const load = async () => {
    if (running || !active) return;
    running = true;
    retry.hidden = true;
    status.textContent = t('ui.recentLoading');
    card.setAttribute('aria-busy', 'true');
    try {
      const comments = await fetchNewestComments([...subjects.values()], limit, minutes, { origin: win.location.origin, locale: uiLocale(root), storage, decode });
      if (!active) return;
      const fragment = root.createDocumentFragment();
      for (const comment of comments) {
        const subject = subjects.get(comment.subject);
        if (!subject) continue;
        const item = root.createElement('li');
        const link = root.createElement('a');
        link.href = subject.href;
        link.className = 'newest-comment-link';
        if (card.dataset.avatar !== 'false' && comment.avatar) {
          const img = root.createElement('img');
          img.src = comment.avatar; img.alt = ''; img.loading = 'lazy'; img.width = img.height = 36;
          img.addEventListener('error', () => img.remove(), { once: true });
          link.append(img);
        }
        const content = root.createElement('span');
        const excerpt = root.createElement('span');
        excerpt.className = 'newest-comment-excerpt'; excerpt.textContent = comment.excerpt || t('ui.viewComment');
        const byline = root.createElement('span');
        byline.className = 'newest-comment-byline';
        const time = root.createElement('time'); time.dateTime = comment.date;
        time.textContent = formatCommentDate(comment.date, uiLocale(root));
        byline.append(root.createTextNode(`${comment.nickname} · `), time);
        content.append(excerpt, byline); link.append(content); item.append(link); fragment.append(item);
      }
      list.replaceChildren(fragment);
      status.textContent = comments.length ? '' : t('ui.noComments');
      card.dataset.commentsState = 'loaded';
    } catch {
      if (!active) return;
      status.textContent = t('ui.recentError');
      retry.hidden = false;
      card.dataset.commentsState = 'failed';
    } finally {
      running = false;
      if (active) card.setAttribute('aria-busy', 'false');
    }
  };
  pageListen(retry, 'click', () => { void load(); });
  if (!('IntersectionObserver' in win)) { void load(); return; }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load(); }
  }, { rootMargin: '200px' });
  observer.observe(card);
  onPageCleanup(() => observer.disconnect());
}
