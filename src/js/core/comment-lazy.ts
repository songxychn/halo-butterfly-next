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

/** Require the explicit plugin contract; old global preloads are not a fallback. */
function commentResourceUrl(root: Document, kind: 'module' | 'style') {
  if (root.querySelector<HTMLMetaElement>('meta[name="halo-comment-widget-contract"]')?.content !== '1') {
    throw new Error('Official comment resource contract is unavailable');
  }
  const raw = root.querySelector<HTMLMetaElement>(`meta[name="halo-comment-widget-${kind}"]`)?.content;
  if (!raw) throw new Error('Official comment resource metadata is unavailable');
  const url = new URL(raw, root.baseURI);
  const expected = kind === 'module' ? MODULE_PATH : '/plugins/PluginCommentWidget/assets/static/index.css';
  if (url.origin !== root.location.origin || url.pathname !== expected || url.username || url.password || !url.searchParams.get('version')) {
    throw new Error('Invalid official comment resource URL');
  }
  return url.href;
}

export function commentModuleUrl(root: Document, attempt = 0) {
  const url = new URL(commentResourceUrl(root, 'module'));
  if (attempt) url.searchParams.set('theme-comment-retry', String(attempt));
  return url.href;
}

const styles = new WeakMap<Document, { url: string; node: HTMLLinkElement; promise: Promise<void> }>();
/** The cache follows the actual head node, which PJAX replaces between pages. */
export function loadCommentStyle(root: Document, timeoutMs = 8000) {
  const url = commentResourceUrl(root, 'style');
  const moduleVersion = new URL(commentResourceUrl(root, 'module')).searchParams.get('version');
  if (new URL(url).searchParams.get('version') !== moduleVersion) throw new Error('Mismatched comment resources');
  const previous = styles.get(root);
  if (previous?.url === url && previous.node.isConnected) return previous.promise;
  const node = root.createElement('link');
  node.rel = 'stylesheet'; node.href = url;
  node.setAttribute('data-theme-comment-style', '');
  let resolve!: () => void, reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  const finish = (ok: boolean) => {
    clearTimeout(timer); node.onload = node.onerror = null;
    if (ok) resolve();
    else {
      node.remove();
      if (styles.get(root)?.node === node) styles.delete(root);
      reject(new Error('Comment stylesheet failed'));
    }
  };
  const timer = setTimeout(() => finish(false), timeoutMs);
  node.onload = () => finish(true); node.onerror = () => finish(false);
  styles.set(root, { url, node, promise });
  root.head.append(node);
  return promise;
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
  let state: 'idle' | 'loading' | 'mounted' | 'failed' | 'unsupported' = host.querySelector('comment-widget') ? 'mounted' : 'idle';
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
    if (!active || state === 'loading' || state === 'mounted' || state === 'unsupported') return;
    observer?.disconnect();
    const current = ++generation;
    display('loading', t('ui.commentLoading'));
    try {
      const url = commentModuleUrl(root, attempt++);
      const [module] = await Promise.race([
        Promise.all([importModule(url), loadCommentStyle(root, options.timeoutMs)]),
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
      const oldToasts = new Set(root.querySelectorAll('lit-toast-container'));
      host.append(widget);
      // The official component creates a body-level toast host synchronously in
      // connectedCallback. Only hosts created by this mount are theme-managed;
      // removing the old body disconnects them together with their subject.
      root.querySelectorAll('lit-toast-container').forEach(toast => {
        if (!oldToasts.has(toast)) toast.setAttribute('data-theme-comment-toast', '');
      });
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
  try {
    const moduleVersion = new URL(commentResourceUrl(root, 'module')).searchParams.get('version');
    if (new URL(commentResourceUrl(root, 'style')).searchParams.get('version') !== moduleVersion) throw new Error('Mismatched comment resources');
  } catch {
    display('unsupported', t('ui.commentUnsupported'));
    return;
  }
  if (target.dataset.commentEager === 'true' || win.location.hash === '#post-comment' || !('IntersectionObserver' in win)) trigger();
  else {
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) trigger();
    }, { rootMargin: '300px 0px' });
    observer.observe(region);
  }
}
