/**
 * @date: 2024/3/2
 * @author: 小红
 * @fileName: _aside
 * @Description:common
 */
import $ from 'jquery';
import Navigation from './navigation';
import { initializeAsideOptions } from './aside-options.mjs';
import LazyLoad from './_lazyLoad';
import { applyRelativeDates } from './relative-date.mjs';
import { bindHideAsideButton } from './aside-hide-button.mjs';
import { bindRightsideConfig, bindReadmode } from './rightside.mjs';
import { bindTranslate } from './translate.mjs';
import { bindDarkmode } from './darkmode.mjs';

export default class Common {

  constructor() {
    if(window.MainApp.conf.enable_above && window.MainApp.conf.above_background) this.#loadAboveBackgroundImg(); //第一屏图片预加载 

    this.#createSingleAction(); //创建单一行为事件
    this.#bindScrollDown();

    if(MainApp.conf.enable_aside && MainApp.conf.enable_webInfo) this.#runDay(); //站点运行时间

    initializeAsideOptions();
    applyRelativeDates();
    bindHideAsideButton();
    bindRightsideConfig();
    bindReadmode();
    bindTranslate();
    bindDarkmode();

  }

  // 站点运行时间
  #runDay() {
    const dom = $('.main > .aside .aside-webInfo .run-day');

    if(!dom.length) return;

    const siteDate = new Date(dom.attr('data-date'));

    if(siteDate.toString() === 'Invalid Date') return;

    const currentDate = new Date();

    const date = currentDate.getTime() - siteDate.getTime();

    const day = parseInt((date / (1000 * 24 * 60 * 60)).toString());

    dom.html(day + ' 天');
  }

  /**
   * 创建单一行为事件
   */
  #createSingleAction() {
    //图片懒加载
    new LazyLoad({
      elements_selector: 'img', threshold: 0, data_src: 'lazy-src',
    });

    new Navigation();
  }

  //返回顶部
  backTop() {
    $('html,body').animate({scrollTop: 0}, 300);
  }

  // 首页 #scroll-down：对齐 5.7.0 main.js 滚到内容区（Halo 为 #Butterfly > .main）
  #bindScrollDown() {
    const el = document.getElementById('scroll-down');
    if (!el) return;
    el.addEventListener('click', () => {
      const main = document.querySelector('#Butterfly > .main');
      if (!main) return;
      $('html,body').animate({scrollTop: main.offsetTop}, 300);
    });
  }

  //第一屏图片预加载
  #loadAboveBackgroundImg() {
    const img = new Image();
    img.src = window.MainApp.conf.above_background;
    img.onload = () => {
      const above = document.querySelector('.header > .above');
      if (above) above.style.backgroundImage = `url(${img.src})`;
    };
    img.onerror = () => {
      console.error('第一屏图片预加载失败');
    };
  }
}
 
 
