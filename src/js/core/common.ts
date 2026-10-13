/**
 * @date: 2024/3/2
 * @author: 小红
 * @fileName: _aside
 * @Description:common
 */
import $ from 'jquery';
import { initializeFooterBackground } from './decorative-background.ts';
import {initializeAppearance, enabled} from './appearance.ts';
import Navigation from './navigation.ts';
import { initializeAsideOptions } from './aside-options.ts';
import { initializeImageLoading } from './image-loading.ts';
import { applyRelativeDates } from './relative-date.ts';
import { bindHideAsideButton } from './aside-hide-button.ts';
import { bindRightsideConfig, bindReadmode } from './rightside.ts';
import { bindTranslate } from './translate.ts';
import { bindDarkmode } from './darkmode.ts';
import { initializeNewestComments } from './newest-comments.ts';
import { bindCommentJump } from './comment-jump.ts';
import { initializeLazyComments } from './comment-lazy.ts';
import { initializeSiteWordcount, initializeVisitCounters } from './site-statistics.ts';
import { bindCopyAttribution } from './copy-attribution.ts';
import { resolveResource, loadManagedResource } from './external-resource.ts';

export default class Common {

  constructor() {
    this.#createSingleAction(); //创建单一行为事件
    this.#bindScrollDown();

    if(MainApp.conf.enable_aside && MainApp.conf.enable_webInfo) this.#runDay(); //站点运行时间

    initializeAsideOptions(document, MainApp.conf.aside_tag_colors);
    initializeAppearance(MainApp.conf.appearance);
    initializeFooterBackground();
    const effects = MainApp.conf.effects;
    if (effects && Object.values(effects).some(value => value && typeof value === 'object' && enabled((value as Record<string, unknown>).enable)) && !document.getElementById('appearance-effects') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const file = 'js/effects.min.js', local = MainApp.conf.assets_link + file;
      void loadManagedResource(resolveResource('effects', local, MainApp.resources, MainApp.version, file), local,
        {attributes: {id: 'appearance-effects'}});
    }
    applyRelativeDates();
    bindHideAsideButton();
    bindRightsideConfig();
    bindReadmode();
    bindTranslate();
    bindDarkmode();
    initializeNewestComments();
    initializeLazyComments();
    bindCommentJump();
    initializeVisitCounters();
    initializeSiteWordcount();
    bindCopyAttribution();

  }

  // 站点运行时间
  #runDay() {
    const dom = $('.main > .aside .aside-webInfo .run-day');

    if(!dom.length) return;

    const siteDate = new Date(dom.attr('data-date') || '');

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
    initializeImageLoading(MainApp.conf);

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
      const main = document.querySelector<HTMLElement>('#Butterfly > .main');
      if (!main) return;
      $('html,body').animate({scrollTop: main.offsetTop}, 300);
    });
  }

}
 
 
