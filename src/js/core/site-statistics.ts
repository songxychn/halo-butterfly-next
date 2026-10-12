import { readingMetrics } from './post-meta.ts';

const API = '/apis/api.content.halo.run/v1alpha1/posts';
const CACHE_KEY = 'halo-butterfly-next:total-words:v1';
const TTL = 5 * 60 * 1000;
type RequestJson = (url: string) => Promise<unknown>;
interface PostList { items: {metadata: {name: string}}[]; total: number; hasNext: boolean }

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
  const run = async () => {
    output.textContent = '统计中…';
    const signature = output.dataset.siteWordcount ?? '';
    try {
      try {
        const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null');
        if (saved?.signature === signature && Date.now() - saved.at >= 0 && Date.now() - saved.at < TTL && Number.isSafeInteger(saved.count) && saved.count >= 0) {
          output.textContent = `${saved.count} 字`; output.dataset.state = 'ready'; return;
        }
      } catch { /* Storage is optional. */ }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      let count;
      try {
        count = await countPublishedWords(async url => {
          const response = await fetch(url, {credentials: 'omit', signal: controller.signal});
          if (!response.ok) throw new Error('Statistics unavailable');
          return response.json();
        });
      } finally { clearTimeout(timer); controller.abort(); }
      output.textContent = `${count} 字`; output.dataset.state = 'ready';
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({signature, count, at: Date.now()})); } catch { /* Optional cache. */ }
    } catch { output.textContent = '暂不可用'; output.dataset.state = 'failed'; }
  };
  if (typeof IntersectionObserver === 'undefined') { void run(); return; }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void run(); }
  }, {rootMargin: '100px'});
  observer.observe(output);
}
