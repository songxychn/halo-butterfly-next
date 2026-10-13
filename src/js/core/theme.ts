import {onPageCleanup, pageListen} from './page-lifecycle.ts';
import {nextColorBoundary, resolveInitialColorScheme, resolveMode} from './color-scheme.ts';
import type {ColorScheme} from '../types.ts';
export default class Theme {
  #key = 'halo-butterfly-next.color-scheme';
  #chosen: string | null = null;
  #callbacks = new Set<(mode: ColorScheme) => void>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  mode: ColorScheme = 'light';
  constructor() {
    try { this.#chosen = localStorage.getItem(this.#key); } catch {}
    this.#refresh();
    if (resolveMode(MainApp.conf.style_mode) === 'system') {
      try { pageListen(window.matchMedia('(prefers-color-scheme: dark)'), 'change', () => this.#refresh()); } catch {}
    }
    pageListen(window, 'focus', () => this.#refresh());
    pageListen(document, 'visibilitychange', () => this.#refresh());
    onPageCleanup(() => { clearTimeout(this.#timer); this.#callbacks.clear(); });
  }
  #refresh() {
    const conf = MainApp.conf;
    let prefersDark = false;
    try { prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch {}
    this.setMode(resolveInitialColorScheme({styleMode: conf.style_mode, saved: this.#chosen,
      start: conf.darkmode_night_start, end: conf.darkmode_night_end, prefersDark}), {persist: false});
    clearTimeout(this.#timer);
    if (resolveMode(conf.style_mode) === 'schedule') this.#timer = setTimeout(() => this.#refresh(), nextColorBoundary(new Date(), conf.darkmode_night_start, conf.darkmode_night_end) + 20);
  }
  setMode(theme: unknown, {persist = true} = {}) {
    const mode = theme === 'dark' ? 'dark' : 'light';
    const changed = mode !== this.mode;
    this.mode = mode;
    document.documentElement.dataset.colorScheme = mode;
    if (persist) {
      this.#chosen = mode;
      try { localStorage.setItem(this.#key, mode); } catch {}
    }
    if (changed) for (const callback of this.#callbacks) callback(mode);
  }
  resetMode() {
    this.#chosen = null;
    try { localStorage.removeItem(this.#key); } catch {}
    this.#refresh();
  }
  getMode() { return this.mode; }
  toggleMode() {
    const policy = resolveMode(MainApp.conf.style_mode);
    if (policy === 'light' || policy === 'dark') return;
    this.setMode(this.mode === 'light' ? 'dark' : 'light');
  }
  change(fn: (mode: ColorScheme) => void) {
    this.#callbacks.add(fn);
    const remove = () => { this.#callbacks.delete(fn); };
    onPageCleanup(remove);
    return remove;
  }
}
