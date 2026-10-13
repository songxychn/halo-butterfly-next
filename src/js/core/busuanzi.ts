import { pageScope } from './page-lifecycle.ts';

const registryKey = Symbol.for('halo-butterfly-next.busuanzi');
type Callback = (data: unknown) => void;
declare global { interface Window {
  __haloThemeBusuanzi?: Record<string, Callback>;
  [registryKey]?: { sequence: number; callbacks: Record<string, Callback> };
} }
/** Default provider's JSONP protocol. Late responses resolve to a shared no-op,
 * without keeping disposed page nodes or a growing list of callback functions.
 */
export function initializeBusuanzi(root: Document = document) {
  const win = root.defaultView;
  if (!win) return;
  const fields = ['site_pv', 'page_pv', 'site_uv'].map(key => ({key,
    value: root.getElementById('busuanzi_value_' + key),
    container: root.getElementById('busuanzi_container_' + key),
  })).filter(field => field.value);
  if (!fields.length || fields[0].value!.dataset.counterStarted) return;
  fields[0].value!.dataset.counterStarted = 'true';
  if (!win[registryKey]) {
    const callbacks = Object.create(null) as Record<string, Callback>, noop = () => {};
    win[registryKey] = {sequence: 0, callbacks};
    win.__haloThemeBusuanzi = new Proxy(callbacks, {get: (target, key) => typeof key === 'string' && target[key] || noop});
  }
  const state = win[registryKey]!, key = 'c' + ++state.sequence, scope = pageScope();
  const script = root.createElement('script');
  script.dataset.themeScript = 'busuanzi-request'; script.dataset.visitCounter = 'busuanzi'; script.async = true;
  // This is how Busuanzi obtains page identity; do not substitute the old page.
  script.referrerPolicy = 'no-referrer-when-downgrade';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => { clearTimeout(timer); script.remove(); script.onload = script.onerror = null; delete state.callbacks[key]; };
  scope.add(cleanup);
  state.callbacks[key] = data => {
    if (scope.active && data && typeof data === 'object') {
      for (const field of fields) {
        const value = (data as Record<string, unknown>)[field.key];
        if (Number.isSafeInteger(value) && (value as number) >= 0) {
          field.value!.textContent = String(value);
          if (field.container) field.container.style.display = 'inline';
        }
      }
    }
    cleanup();
  };
  timer = setTimeout(cleanup, 8000); script.onload = script.onerror = cleanup;
  script.src = 'https://busuanzi.ibruce.info/busuanzi?jsonpCallback=__haloThemeBusuanzi.' + key;
  root.head.append(script);
}
