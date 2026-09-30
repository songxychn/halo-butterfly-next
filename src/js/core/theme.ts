/**
 * @date: 2024/2/23
 * @author: 小红
 * @fileName: _theme
 * @Description: 主题切换
 */
import { resolveInitialColorScheme, shouldListenPrefersColorScheme } from './darkmode.ts';

export default class Theme {
  #LOCALSTORAGE_KEY = 'halo-butterfly-next.color-scheme';
  #ATTR_KEY = 'colorScheme'; // 根元素主题属性
  #CHANGE_FN: ((mode: import('../types.ts').ColorScheme) => void) | null = null; // 主题切换回调
  mode: import('../types.ts').ColorScheme = 'light'; // 主题模式

  // 初始化主题模式
  constructor() {
    const conf = typeof MainApp !== 'undefined' && MainApp.conf ? MainApp.conf : {};
    let saved = null;
    try { saved = localStorage.getItem(this.#LOCALSTORAGE_KEY); } catch {}
    let prefersDark = false;
    let prefersLight = false;
    try {
      prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    } catch {}
    const theme = resolveInitialColorScheme({
      styleMode: conf.style_mode,
      autoChangeMode: conf.darkmode_autoChangeMode,
      start: conf.darkmode_start,
      end: conf.darkmode_end,
      saved,
      prefersDark,
      prefersLight,
      hour: new Date().getHours(),
    });
    this.setMode(theme, { persist: false });
    if (shouldListenPrefersColorScheme({
      styleMode: conf.style_mode,
      autoChangeMode: conf.darkmode_autoChangeMode,
      saved,
    })) {
      try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
          try {
            const chosen = localStorage.getItem(this.#LOCALSTORAGE_KEY);
            if (chosen === 'light' || chosen === 'dark') return;
          } catch {}
          this.setMode(event.matches ? 'dark' : 'light', { persist: false });
        });
      } catch {}
    }
  }

  // 设置主题模式。自动推导的初始值不写入 localStorage，避免把 autoChangeMode 1/2 冻成已选项。
  setMode(theme: unknown, { persist = true } = {}) {
    this.mode = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset[this.#ATTR_KEY] = this.mode;
    if (persist) {
      try { localStorage.setItem(this.#LOCALSTORAGE_KEY, this.mode); } catch {}
    }
    this.#CHANGE_FN && this.#CHANGE_FN(this.mode);
  }

  // 获取主题模式
  getMode() {
    return this.mode;
  }

  // 切换主题模式
  toggleMode() {
    this.setMode(this.mode === 'light' ? 'dark' : 'light', { persist: true });
  }

  // 主题模式切换回调
  change(fn: (mode: import('../types.ts').ColorScheme) => void) {
    this.#CHANGE_FN = fn;
  }
}
