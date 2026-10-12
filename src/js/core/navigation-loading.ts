import { beginPage, disposePage, onPageCleanup } from './page-lifecycle.ts';
import type { ThemeConfig } from '../types.ts';

export const enabled = (value: unknown) => value === true || value === 'true';
const forbidden = /^\/(?:console|uc|login|logout|signup|oauth2?|apis|actuator|themes|upload)(?:\/|$)/i;
export function navigationURL(href: string, current: string, exclude: unknown = '') {
  try {
    const base = new URL(current), url = new URL(href, base);
    if (!/^https?:$/.test(url.protocol) || url.origin !== base.origin || url.username || url.password || forbidden.test(decodeURIComponent(url.pathname))) return null;
    if (/\.[a-z0-9]{1,8}$/i.test(url.pathname) && !/\.html?$/i.test(url.pathname)) return null;
    if (url.pathname === base.pathname && url.search === base.search) return null;
    const entries = Array.isArray(exclude) ? exclude : String(exclude || '').split(/\r?\n/);
    for (const entry of entries) {
      const path = String(entry).trim();
      if (!path) continue;
      if (path.endsWith('*') ? url.pathname.startsWith(path.slice(0, -1)) :
        [url.pathname, url.pathname + url.search, url.href].includes(path)) return null;
    }
    return url;
  } catch { return null; }
}

const scriptKinds = new Set(['config', 'page-config', 'above', 'code-config', 'entry', 'masonry', 'loading', 'ready', 'prism']);
const inert = (script: HTMLScriptElement) => !!script.type && !/^(?:text\/javascript|application\/javascript|module)$/i.test(script.type);
/** Unknown executable scripts/custom elements retain their native document lifecycle. */
export function supportsPartialNavigation(doc: Document) {
  if (doc.documentElement.dataset.themeNavigation !== '1' || doc.querySelector('base,iframe,object,embed,meta[http-equiv="refresh" i]')) return false;
  if (doc.querySelector('#Butterfly.plugin, halo-comment, [data-no-pjax]')) return false;
  if ([...doc.querySelectorAll('*')].some(node => node.localName.includes('-') && node.localName !== 'th:block')) return false;
  return [...doc.scripts].every(script => inert(script) || scriptKinds.has(script.dataset.themeScript || ''));
}

const key = Symbol.for('halo-butterfly-next.navigation-loading');
interface NavigatorState { active?: AbortController; installed: boolean; url: string; busy: boolean; canNavigate: boolean }
declare global { interface Window { [key]?: NavigatorState } }
const stateKey = 'butterflyNavigation';
function historyData() {
  const state: unknown = history.state;
  return state && typeof state === 'object' ? state as Record<string, unknown> : {};
}
function saveScroll() {
  history.replaceState({ ...historyData(), [stateKey]: { x: scrollX, y: scrollY } }, '', location.href);
}
function linkFor(event: Event) {
  const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
  if (!anchor || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self' || anchor.closest('[data-no-pjax], [data-no-prefetch], [contenteditable], .theme-lightbox-trigger') || /external/i.test(anchor.rel)) return null;
  return anchor;
}
function scriptCopy(old: HTMLScriptElement) {
  const script = document.createElement('script');
  for (const attr of old.attributes) if (!['async', 'defer'].includes(attr.name)) script.setAttribute(attr.name, attr.value);
  script.textContent = old.textContent;
  return script;
}
function execute(script: HTMLScriptElement, parent: HTMLElement, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Navigation cancelled'));
    const next = scriptCopy(script);
    const timer = setTimeout(() => finish(new Error('Script timed out')), 8000);
    const abort = () => finish(new Error('Navigation cancelled'));
    const finish = (error?: Error) => {
      clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (error) { next.remove(); reject(error); } else resolve();
    };
    signal.addEventListener('abort', abort, { once: true });
    next.onload = () => finish();
    next.onerror = () => finish(new Error('Script failed'));
    parent.append(next);
    if (!next.src) finish();
  });
}
async function navigate(url: URL, pop: boolean, restore: {x: number; y: number} | undefined, state: NavigatorState) {
  state.active?.abort();
  const request = new AbortController();
  state.active = request;
  const timer = setTimeout(() => request.abort(), 10000);
  let committing = false;
  document.documentElement.classList.add('theme-navigating');
  document.dispatchEvent(new Event('pjax:send'));
  try {
    const response = await fetch(url.href, { signal: request.signal, credentials: 'same-origin', headers: { Accept: 'text/html' } });
    if (!response.ok || response.redirected || !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('Full navigation required');
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error('Document too large');
    const next = new DOMParser().parseFromString(html, 'text/html');
    const entry = next.querySelector<HTMLScriptElement>('script[data-theme-script="entry"]');
    if (!supportsPartialNavigation(next) || !entry?.src || !next.getElementById('baseScript') || !next.getElementById('Butterfly')) throw new Error('Full navigation required');
    // Never execute a newly fetched external script outside this theme's asset root.
    const assets = new URL(window.MainApp.conf.assets_link || '/themes/halo-butterfly-next/assets/', location.href);
    for (const script of next.scripts) {
      if (!script.hasAttribute('src')) continue;
      const source = new URL(script.getAttribute('src')!, url);
      if (source.origin !== assets.origin || !source.pathname.startsWith(assets.pathname)) throw new Error('Foreign page script');
    }
    // Load target styles before replacement so failed CSS leaves a normal navigation.
    const styles: HTMLLinkElement[] = [];
    try {
      await Promise.all([...next.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')].map(link => new Promise<void>((resolve, reject) => {
        const clone = link.cloneNode(true) as HTMLLinkElement;
        clone.href = new URL(link.getAttribute('href') || '', url).href;
        clone.media = 'not all';
        const timeout = setTimeout(() => reject(new Error('Stylesheet timed out')), 8000);
        clone.onload = () => { clearTimeout(timeout); resolve(); };
        clone.onerror = () => { clearTimeout(timeout); reject(new Error('Stylesheet failed')); };
        document.head.append(clone); styles.push(clone);
      })));
    } finally { styles.forEach(style => style.remove()); }
    if (request.signal.aborted) throw new Error('Navigation cancelled');
    clearTimeout(timer);
    state.busy = committing = true;
    if (!pop) saveScroll();
    disposePage();
    document.dispatchEvent(new Event('halo-butterfly-next:before-replace'));
    beginPage();
    const scripts = [...next.scripts].filter(script => !inert(script));
    scripts.forEach(script => script.remove());
    document.head.replaceChildren(...next.head.childNodes);
    document.body.replaceWith(document.adoptNode(next.body));
    // Preserve the current color/aside choice; server classes include page-specific defaults.
    document.documentElement.lang = next.documentElement.lang;
    document.documentElement.className = next.documentElement.className;
    document.documentElement.classList.add('theme-navigating');
    if (!pop) history.pushState({ [stateKey]: { x: 0, y: 0 } }, '', url.href);
    state.url = url.href;
    for (const script of scripts.filter(s => ['config', 'page-config', 'above', 'code-config'].includes(s.dataset.themeScript || ''))) {
      await execute(script, document.head, request.signal);
    }
    await execute(entry, document.body, request.signal);
    if (!window.MainApp.useCommon) throw new Error('Page initialization failed');
    for (const script of scripts.filter(s => s.dataset.themeScript === 'masonry')) await execute(script, document.body, request.signal);
    document.body.classList.remove('loading', 'read-mode');
    const main = document.querySelector<HTMLElement>('main');
    main?.setAttribute('tabindex', '-1'); main?.focus({ preventScroll: true });
    let target: HTMLElement | null = null;
    try { target = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null; } catch {}
    if (pop && restore && Number.isFinite(restore.x) && Number.isFinite(restore.y)) window.scrollTo({ left: restore.x, top: restore.y, behavior: 'instant' });
    else if (target) target.scrollIntoView();
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.dispatchEvent(new Event('pjax:complete'));
  } catch (error) {
    console.debug('Theme navigation fallback', error);
    // A newer click owns navigation now. A timeout/error for the current one reloads normally.
    if (state.active === request) {
      document.dispatchEvent(new Event('pjax:error'));
      location.assign(url.href);
    }
  } finally {
    clearTimeout(timer);
    if (state.active === request) {
      document.documentElement.classList.remove('theme-navigating');
      state.active = undefined;
    }
    if (committing) state.busy = false;
  }
}

export function initializeNavigationLoading() {
  const config = window.MainApp.conf;
  const canNavigate = enabled(config.pjax_enable) && supportsPartialNavigation(document);
  history.scrollRestoration = canNavigate ? 'manual' : 'auto';
  initializePrefetch(config);
  if (window[key]?.installed) { window[key].canNavigate = canNavigate; return; }
  const state: NavigatorState = { installed: true, url: location.href, busy: false, canNavigate };
  window[key] = state;
  // Keep these two document-level handlers for the document lifetime, not one page.
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const anchor = linkFor(event), conf = window.MainApp.conf;
    if (!anchor || !enabled(conf.pjax_enable) || !supportsPartialNavigation(document)) return;
    const url = navigationURL(anchor.href, location.href, conf.pjax_exclude);
    if (!url) {
      if (!state.busy) { state.active?.abort(); state.active = undefined; document.documentElement.classList.remove('theme-navigating'); }
      return;
    }
    if (state.busy) { event.preventDefault(); return; }
    event.preventDefault();
    void navigate(url, false, undefined, state);
  });
  window.addEventListener('popstate', event => {
    const current = new URL(location.href), old = new URL(state.url);
    if (current.pathname === old.pathname && current.search === old.search) {
      state.url = current.href;
      state.active?.abort(); state.active = undefined;
      document.documentElement.classList.remove('theme-navigating');
      return;
    }
    if (state.busy || !enabled(window.MainApp.conf.pjax_enable) || !supportsPartialNavigation(document) || !navigationURL(current.href, old.href, window.MainApp.conf.pjax_exclude)) { location.reload(); return; }
    void navigate(current, true, event.state?.[stateKey], state);
  });
  // Record scrolling before traversal, including browsers that restore after popstate.
  window.addEventListener('scroll', () => { if (!state.busy && !state.active && state.canNavigate) saveScroll(); }, { passive: true });
}
function initializePrefetch(config: ThemeConfig) {
  if (!enabled(config.instantpage)) return;
  const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
  const links = new Map<string, HTMLLinkElement>();
  const prefetch = (event: Event) => {
    const anchor = linkFor(event);
    // Only public content/list links generated by this theme, or explicit author opt-in.
    if (!anchor?.matches('.home-layout a, .pagination a, .archive-list a, [data-theme-prefetch]')) return;
    const url = navigationURL(anchor.href, location.href, config.pjax_exclude);
    if (!url || url.search || links.has(url.href) || links.size >= 8) return;
    const link = document.createElement('link');
    link.rel = 'prefetch'; link.as = 'document'; link.href = url.href;
    document.head.append(link); links.set(url.href, link);
  };
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('focusin', prefetch);
  onPageCleanup(() => {
    document.removeEventListener('pointerover', prefetch); document.removeEventListener('focusin', prefetch);
    links.forEach(link => link.remove());
  });
}
