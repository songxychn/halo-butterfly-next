import { t } from './i18n';
import { onPageCleanup } from './page-lifecycle.ts';

const LOAD_EVENT = 'theme:load-comments';
const MODULE_PATH = '/plugins/PluginCommentWidget/assets/static/comment-widget.js';
type Widget = HTMLElement & { group: string; kind: string; name: string; version: string };
type WidgetModule = { CommentWidget?: unknown };
type Options = {
  importModule?: (url: string) => Promise<WidgetModule>;
  timeoutMs?: number;
};

/** Use the active plugin's versioned URL, never a hard-coded or external SDK. */
export function commentModuleUrl(root: Document, attempt = 0) {
  for (const link of root.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"][href]')) {
    const url = new URL(link.href, root.baseURI);
    if (url.origin !== root.location.origin || url.pathname !== MODULE_PATH) continue;
    if (attempt) url.searchParams.set('theme-comment-retry', String(attempt));
    return url.href;
  }
  throw new Error('Official comment module is unavailable');
}

/** Jump links request mounting before moving focus/scroll. */
export function requestLazyComments(root: Document = document) {
  root.getElementById('post-comment')?.dispatchEvent(new Event(LOAD_EVENT));
}

export function initializeLazyComments(root: Document = document, options: Options = {}) {
  const region = root.getElementById('post-comment');
  const target = region?.querySelector<HTMLElement>('[data-comment-lazy]');
  const host = target?.querySelector<HTMLElement>('[data-comment-host]');
  const status = target?.querySelector<HTMLElement>('[data-comment-status]');
  const retry = target?.querySelector<HTMLButtonElement>('[data-comment-retry]');
  const win = root.defaultView;
  if (!region || !target || !host || !status || !retry || !win || target.dataset.commentLazyBound === 'true') return;
  target.dataset.commentLazyBound = 'true';
  const importModule = options.importModule ?? (url => import(/* @vite-ignore */ url));
  let state: 'idle' | 'loading' | 'mounted' | 'failed' = host.querySelector('comment-widget') ? 'mounted' : 'idle';
  let active = true, attempt = 0, generation = 0;
  let timer: number | undefined;
  let observer: IntersectionObserver | undefined;
  const display = (next: typeof state, text: string) => {
    state = next;
    target.dataset.commentState = next;
    target.setAttribute('aria-busy', String(next === 'loading'));
    status.textContent = text;
    retry.hidden = next !== 'failed';
  };
  const load = async () => {
    if (!active || state === 'loading' || state === 'mounted') return;
    observer?.disconnect();
    const current = ++generation;
    display('loading', t('ui.commentLoading'));
    try {
      const url = commentModuleUrl(root, attempt++);
      const module = await Promise.race([
        importModule(url),
        new Promise<never>((_, reject) => {
          timer = win.setTimeout(() => reject(new Error('Comment module timeout')), options.timeoutMs ?? 8000);
        }),
      ]);
      if (!active || current !== generation || !target.isConnected) return;
      // This is the same public component/subject API used by the official init().
      // Mount directly: its init() adds another viewport observer and retains it.
      if (!module.CommentWidget || !win.customElements.get('comment-widget')) throw new Error('Unsupported comment component');
      const { group, kind, name } = target.dataset;
      if (!((group === 'content.halo.run' && ['Post', 'SinglePage'].includes(kind ?? '')) || (group === 'moment.halo.run' && kind === 'Moment')) || !name) throw new Error('Invalid comment subject');
      const widget = root.createElement('comment-widget') as Widget;
      Object.assign(widget, { group, kind, name, version: 'v1alpha1' });
      host.append(widget);
      display('mounted', '');
      // Data, login, submission and reply failures stay with the official UI.
      // Once mounted, never replace a user's editor to retry a theme load.
    } catch {
      if (active && current === generation) display('failed', t('ui.commentError'));
    } finally {
      if (current === generation) win.clearTimeout(timer);
    }
  };
  const trigger = () => { void load(); };
  region.addEventListener(LOAD_EVENT, trigger);
  retry.addEventListener('click', trigger);
  onPageCleanup(() => {
    active = false;
    generation++;
    win.clearTimeout(timer);
    observer?.disconnect();
    region.removeEventListener(LOAD_EVENT, trigger);
    retry.removeEventListener('click', trigger);
    delete target.dataset.commentLazyBound;
  });
  display(state, state === 'mounted' ? '' : t('ui.commentHint'));
  if (state === 'mounted') return;
  if (target.dataset.commentEager === 'true' || win.location.hash === '#post-comment' || !('IntersectionObserver' in win)) trigger();
  else {
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) trigger();
    }, { rootMargin: '300px 0px' });
    observer.observe(region);
  }
}
