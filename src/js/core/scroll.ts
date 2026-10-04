/**
 * @date: 2024/2/23
 * @author: 小红
 * @fileName: naveScroll
 * @Description: 滚动触发导航侧边的一些事件
 */
import $ from 'jquery';
import {useThrottle} from './_util.ts';
import {isNavAlwaysPinned, navScrollAppearance} from './nav-scroll.ts';
import { bindRightsideScrollPercent } from './rightside.ts';

export default class Scroll {
  #CHANGE_FN: ((max: number, previous: number, top: number) => void) | null = null; // 回调
  #sideBtnDom = $('#Butterfly > .side-btn');
  #navDom = $('.header > .nav');
  #max = 56; // 最大值
  #num = 0; // 上一次滚动值
  #fixed = false;
  #goUpPercent: ((top: number) => void) | null = null;

  // 初始化
  constructor() {
    this.#fixed = isNavAlwaysPinned(window.MainApp?.conf?.nav_fixed);
    this.#goUpPercent = bindRightsideScrollPercent();
    window.addEventListener('scroll', useThrottle(() => {
      let scrollTop = window.scrollY || document.documentElement.scrollTop;

      // 激活头部导航栏
      this.#activeNav(scrollTop);

      // 激活侧边按钮
      this.#activeBtn(scrollTop);

      this.#goUpPercent && this.#goUpPercent(scrollTop);
      this.#CHANGE_FN && this.#CHANGE_FN(this.#max, this.#num, scrollTop);
      this.#num = scrollTop;
    }, 200));
  }

  // 激活头部导航栏
  #activeNav(scrollTop: number) {
    const next = navScrollAppearance({
      scrollTop,
      previousTop: this.#num,
      threshold: this.#max,
      alwaysPinned: this.#fixed,
    });
    if (!next) return;
    this.#navDom.toggleClass('style', next.style);
    this.#navDom.toggleClass('active', next.active);
  }

  // 激活侧边按钮
  #activeBtn(scrollTop: number) {
    // 滚动到顶部取消按钮。上游 #rightside.rightside-show；Halo 仍用 .active。
    if(scrollTop < this.#max && scrollTop <= 2) {
      this.#sideBtnDom.removeClass('active rightside-show');
    }

    // 向下滚动激活侧边按钮
    if(scrollTop > this.#max && this.#num <= scrollTop) {
      this.#sideBtnDom.addClass('active rightside-show');
    }
  }


  /**
   *  回调
   */
  change(fn: (max: number, previous: number, top: number) => void) {
    this.#CHANGE_FN = fn;
  }

}
 
 
