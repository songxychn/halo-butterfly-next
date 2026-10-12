/** Shared across separately bundled page entries; only theme-owned work is tracked. */
class PageScope {
  active = true;
  cleanups = new Set<() => void>();
  add(cleanup: () => void) {
    if (this.active) this.cleanups.add(cleanup);
    else cleanup();
  }
  dispose() {
    if (!this.active) return;
    this.active = false;
    for (const cleanup of [...this.cleanups].reverse()) {
      try { cleanup(); } catch (error) { console.debug('Theme cleanup failed', error); }
    }
    this.cleanups.clear();
  }
}
const key = Symbol.for('halo-butterfly-next.page-scope');
declare global { interface Window { [key]?: PageScope } }
export function pageScope() {
  return window[key] ??= new PageScope();
}
export function disposePage() { window[key]?.dispose(); }
export function beginPage() {
  disposePage();
  window[key] = new PageScope();
}
export function onPageCleanup(cleanup: () => void) {
  if (typeof window !== 'undefined') pageScope().add(cleanup);
}
type Events = WindowEventMap & DocumentEventMap & HTMLElementEventMap & MediaQueryListEventMap;
export function pageListen<K extends keyof Events>(target: EventTarget, type: K,
  listener: (event: Events[K]) => void, options?: boolean | AddEventListenerOptions) {
  target.addEventListener(type, listener as EventListener, options);
  onPageCleanup(() => target.removeEventListener(type, listener as EventListener, options));
}
