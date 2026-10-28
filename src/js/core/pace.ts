import { loadManagedResource, resolveResource, safeResourceUrl } from './external-resource.ts';
import { whenContentReady } from './loading-ready.ts';

export const paceEnabled = (config: {loading_enable?: unknown; loading_mode?: unknown}) =>
  config.loading_enable !== false && config.loading_enable !== 'false' && config.loading_mode !== 'animation';

interface PaceApi {
  options: {restartOnRequestAfter: number | false};
  start(): void; restart(): void; stop(): void;
  on(event: string, handler: () => void): void;
}
export function paceAPIReady(candidate: unknown): candidate is PaceApi {
  if (!candidate || typeof candidate !== 'object') return false;
  const api = candidate as Partial<PaceApi>;
  return !!api.options && typeof api.options === 'object' &&
    ['start', 'restart', 'stop', 'on'].every(method => typeof api[method as keyof PaceApi] === 'function');
}
const key = Symbol.for('halo-butterfly-next.pace');
interface PaceState {
  enabled: boolean; ready: boolean; style?: HTMLLinkElement;
  pending?: Promise<boolean>; watchdog?: ReturnType<typeof setTimeout>;
}
declare global { interface Window { Pace?: PaceApi; paceOptions?: Record<string, unknown>; [key]?: PaceState } }
const stateFor = () => window[key] ??= {enabled: false, ready: false};
function stop(state: PaceState) {
  clearTimeout(state.watchdog);
  if (paceAPIReady(window.Pace)) window.Pace.stop();
  document.documentElement.classList.remove('theme-pace-active');
}
function start(state: PaceState) {
  if (!state.enabled || !state.ready || !document.body) return;
  document.documentElement.classList.add('theme-pace-active');
  window.Pace?.restart();
}
/** Called inline in both layouts. Optional resources never gate readable SSR content. */
export function initializePace() {
  const state = stateFor(), app = window.MainApp;
  state.enabled = paceEnabled(app.conf);
  if (!state.enabled) {
    if (paceAPIReady(window.Pace)) window.Pace.options.restartOnRequestAfter = false;
    stop(state); state.style?.remove(); return Promise.resolve(false);
  }
  if (state.ready && paceAPIReady(window.Pace)) {
    if (state.style && !state.style.isConnected) document.head.append(state.style);
    window.Pace.options.restartOnRequestAfter = 500;
    return Promise.resolve(true);
  }
  if (state.pending) return state.pending;
  const js = 'plugins/pace/pace.min.js', css = 'plugins/pace/pace-theme-minimal.css';
  const localJS = app.conf.assets_link + js, localCSS = app.conf.assets_link + css;
  const explicitCSS = safeResourceUrl(app.conf.pace_css_url);
  const sourceCSS = explicitCSS || resolveResource(localCSS, app.resources, app.version, css);
  // No auto-start/restart until BOTH script API and CSS have loaded successfully.
  window.paceOptions = {
    startOnPageLoad: false, restartOnPushState: false, restartOnRequestAfter: false,
  };
  state.pending = Promise.all([
    loadManagedResource(sourceCSS, localCSS, {kind: 'style', attributes: {id: 'theme-pace-style'}}),
    loadManagedResource(resolveResource(localJS, app.resources, app.version, js), localJS,
      {attributes: {'data-theme-script': 'pace'}, valid: () => paceAPIReady(window.Pace)}),
  ]).then(([styled, loaded]) => {
    if (!styled || !loaded || !paceAPIReady(window.Pace)) return false;
    state.style = document.getElementById('theme-pace-style') as HTMLLinkElement;
    state.ready = true;
    const api = window.Pace;
    api.on('start', () => {
      if (!state.enabled) { stop(state); return; }
      document.documentElement.classList.add('theme-pace-active');
      clearTimeout(state.watchdog);
      state.watchdog = setTimeout(() => {
        state.ready = false; api.options.restartOnRequestAfter = false; stop(state);
      }, 30000);
    });
    api.on('hide', () => {
      clearTimeout(state.watchdog); document.documentElement.classList.remove('theme-pace-active');
    });
    if (!state.enabled) { state.style?.remove(); return false; }
    api.options.restartOnRequestAfter = 500;
    whenContentReady(() => start(state));
    return true;
  }).catch(() => false);
  return state.pending;
}
