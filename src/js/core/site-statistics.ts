import { t } from './i18n';
import { initializeBusuanzi } from './busuanzi.ts';
import { readingMetrics } from './post-meta.ts';
import { onPageCleanup } from './page-lifecycle.ts';
import { resolveResource, loadManagedResource } from './external-resource.ts';

const API = '/apis/api.content.halo.run/v1alpha1/posts';
const CACHE_KEY = 'halo-butterfly-next:total-words:v1';
const TTL = 5 * 60 * 1000;
type RequestJson = (url: string) => Promise<unknown>;
interface PostList { items: {metadata: {name: string}}[]; total: number; hasNext: boolean }

/** Provider-specific IDs exist only when a Busuanzi counter is actually rendered. */
export function initializeVisitCounters(root = document) {
  if (!root.querySelector('#busuanzi_value_page_pv, #busuanzi_value_site_pv, #busuanzi_value_site_uv') || root.querySelector('script[data-visit-counter]')) return;
  const official = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
  const source = resolveResource('busuanzi', official, window.MainApp?.resources, window.MainApp?.version);
  if (source === official) { initializeBusuanzi(root); return; }
  // A configured replacement script has no guaranteed page lifecycle protocol.
  void loadManagedResource(source, official, {document: root, attributes: {'data-visit-counter': 'busuanzi'}});
}

/** Read only the anonymous, published Post API. */
export async function countPublishedWords(requestJson: RequestJson) {
  const names = new Set<string>();
  let total: number | undefined;
  for (let page = 1; ; page++) {
    const result = await requestJson(`${API}?page=${page}&size=100&sort=metadata.name,asc`) as PostList;
    if (!Array.isArray(result?.items) || !Number.isSafeInteger(result.total) || result.total < 0 || typeof result.hasNext !== 'boolean') throw new Error('Invalid post list');
    if (total !== undefined && total !== result.total) throw new Error('Publication changed during counting');
    total = result.total;
    for (const post of result.items) {
      const name = post?.metadata?.name;
      if (typeof name !== 'string' || !name || names.has(name)) throw new Error('Invalid/duplicate published post');
      names.add(name);
    }
    if (!result.hasNext) break;
    if (!result.items.length || names.size >= total) throw new Error('Incomplete pagination');
  }
  if (names.size !== total) throw new Error('Incomplete publication list');
  const pending = [...names];
  let count = 0;
  await Promise.all(Array.from({length: Math.min(2, pending.length)}, async () => {
    while (pending.length) {
      const name = pending.shift()!;
      const post = await requestJson(`${API}/${encodeURIComponent(name)}`) as {content?: {content?: string}};
      if (typeof post?.content?.content !== 'string') throw new Error('Missing published body');
      count += readingMetrics(post.content.content).count;
    }
  }));
  return count;
}

export function initializeSiteWordcount(root = document) {
  const output = root.querySelector<HTMLElement>('[data-site-wordcount]');
  if (!output || output.dataset.started) return;
  output.dataset.started = 'true';
  let active = true;
  let controller: AbortController | undefined;
  let observer: IntersectionObserver | undefined;
  onPageCleanup(() => { active = false; observer?.disconnect(); controller?.abort(); });
  const run = async () => {
    if (!active) return;
    output.textContent = t('ui.statistics');
    const signature = output.dataset.siteWordcount ?? '';
    try {
      try {
        const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null');
        if (saved?.signature === signature && Date.now() - saved.at >= 0 && Date.now() - saved.at < TTL && Number.isSafeInteger(saved.count) && saved.count >= 0) {
          output.textContent = t('ui.wordUnit', saved.count); output.dataset.state = 'ready'; return;
        }
      } catch { /* Storage is optional. */ }
      const request = new AbortController();
      controller = request;
      const timer = setTimeout(() => request.abort(), 60000);
      let count;
      try {
        count = await countPublishedWords(async url => {
          const response = await fetch(url, {credentials: 'omit', signal: request.signal});
          if (!response.ok) throw new Error('Statistics unavailable');
          return response.json();
        });
      } finally { clearTimeout(timer); request.abort(); }
      if (!active) return;
      output.textContent = t('ui.wordUnit', count); output.dataset.state = 'ready';
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({signature, count, at: Date.now()})); } catch { /* Optional cache. */ }
    } catch { if (active) { output.textContent = t('ui.unavailable'); output.dataset.state = 'failed'; } }
  };
  if (typeof IntersectionObserver === 'undefined') { void run(); return; }
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer!.disconnect(); void run(); }
  }, {rootMargin: '100px'});
  observer.observe(output);
}
