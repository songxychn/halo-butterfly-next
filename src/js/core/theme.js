/**
 * @date: 2024/2/23
 * @author: 小红
 * @fileName: _theme
 * @Description: 主题切换
 */
import {useIsDaytime} from './_util';

export default class Theme {
  #LOCALSTORAGE_KEY = 'butterfly-next.color-scheme';
  #ATTR_KEY = 'colorScheme'; // 根元素主题属性
  #CHANGE_FN = null; // 主题切换回调
  mode = 'light'; // 主题模式

  // 初始化主题模式
  constructor() {
    const mes = {
      auto: () => useIsDaytime() ? 'light' : 'dark',
      user: () => (() => { try { return localStorage.getItem(this.#LOCALSTORAGE_KEY) || 'light'; } catch { return 'light'; } })(),
      light: () => 'light',
      dark: () => 'dark',
    };
    this.setMode((mes[MainApp.conf.style_mode] || mes.user)());
  }

  // 设置主题模式
  setMode(theme) {
    this.mode = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset[this.#ATTR_KEY] = this.mode;
    try { localStorage.setItem(this.#LOCALSTORAGE_KEY, this.mode); } catch {}
    this.#CHANGE_FN && this.#CHANGE_FN(this.mode);
  }

  // 获取主题模式
  getMode() {
    return this.mode;
  }

  // 切换主题模式
  toggleMode() {
    this.setMode(this.mode === 'light' ? 'dark' : 'light');
  }

  // 主题模式切换回调
  change(fn) {
    this.#CHANGE_FN = fn;
  }
}
