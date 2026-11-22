import { useThrottle } from './_util.ts';
import { isNavAlwaysPinned, navScrollAppearance } from './nav-scroll.ts';
import { bindRightsideScrollPercent } from './rightside.ts';

type ScrollListener = (max: number, previous: number, top: number) => void;

export default class Scroll {
  #listeners: ScrollListener[] = [];
  #sideBtnDom = document.querySelector<HTMLElement>('#Butterfly > .side-btn');
  #navDom = document.querySelector<HTMLElement>('.header > .nav');
  #max = 56;
  #num = 0;
  #fixed = false;
  #goUpPercent: ((top: number) => void) | null = null;

  constructor() {
    this.#fixed = isNavAlwaysPinned(window.MainApp?.conf?.nav_fixed);
    this.#goUpPercent = bindRightsideScrollPercent();
    window.addEventListener('scroll', useThrottle(() => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      this.#activeNav(scrollTop);
      this.#activeBtn(scrollTop);
      this.#goUpPercent?.(scrollTop);
      for (const listener of this.#listeners) listener(this.#max, this.#num, scrollTop);
      this.#num = scrollTop;
    }, 200));
  }

  #activeNav(scrollTop: number) {
    if (!this.#navDom) return;
    const next = navScrollAppearance({
      scrollTop,
      previousTop: this.#num,
      threshold: this.#max,
      alwaysPinned: this.#fixed,
    });
    if (!next) return;
    this.#navDom.classList.toggle('style', next.style);
    this.#navDom.classList.toggle('active', next.active);
  }

  #activeBtn(scrollTop: number) {
    if (!this.#sideBtnDom) return;
    if (scrollTop < this.#max && scrollTop <= 2) {
      this.#sideBtnDom.classList.remove('active', 'rightside-show');
    }
    if (scrollTop > this.#max && this.#num <= scrollTop) {
      this.#sideBtnDom.classList.add('active', 'rightside-show');
    }
  }

  change(fn: ScrollListener) {
    this.#listeners.push(fn);
  }
}
