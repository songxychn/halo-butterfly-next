/**
 * @date: 2024/7/2
 * @author: 小红
 * @fileName: _decorator
 * @Description: 装饰器
 */

export {default as AmplifyImg} from '../modules/AmplifyImg';
import Clipboard from 'clipboard';
import $ from 'jquery';
import tocBot from 'tocbot';
import {useCodeSettings, useDelay, useToBool} from '../core/_util';
import {formatPermalinkText} from './post-copyright.mjs';

/**
 * 渲染文本
 */
export class renderContent {
  renderDom = $('article.render'); // 文章渲染区域

  constructor() {
    this.attrs = this.useConfig.attrs;
    this.render = this.useConfig.render;
    
    this.rct();
    this.code();
  }

  rct() {
    // h1~h6标题图标
    if(this.render['enable_h_icon']) this.renderDom.addClass('enable_h_icon');

    // 目录
    this.setTocBot();

    // 版权设置
    this.setCopyrightSetting();
  }

  /**
   * 设置目录
   */
  setTocBot() {
    tocBot.init({
      contentSelector: 'article.render',
      tocSelector: '.aside-toc > .toc',
      headingSelector: 'h1, h2, h3, h4, h5, h6',
      hasInnerContainers: true,
      scrollSmooth: true,
      includeTitleTags: true,
      scrollSmoothDuration: 280,
      throttleTimeout: 30,
      headingsOffset: 80, // 目录中高亮的偏移值，和scrollSmoothOffset有关联
      scrollSmoothOffset: -80, // 屏幕滚动的偏移值（这里和导航条固定也有关联）
      fixedSidebarOffset: 'auto',
      onClick: (e) => e.preventDefault(),
      scrollEndCallback: function(e) {
      },
    });

    const isStickyDom = $('.aside .is-sticky');

    // toc fixed
    useScroll.change((max, num, scrollTop) => {
      if(scrollTop < max || window.innerWidth <= 1100) return;
      if(num <= scrollTop) {
        isStickyDom.css('top', '');
      }
      else {
        isStickyDom.css('top', '70px');
      }
    });

    const toc = $('.aside-toc > .toc');

    if(!toc.html()) toc.html('暂无目录~');

    // 设置移动端h5目录
    const h5Toc = async () => {
      const adToc = isStickyDom.find('.aside-toc');

      adToc.toggle('fast');

      await useDelay(500);

      adToc.css('display') === 'none' && adToc.attr('style', '');
    };

    h5Toc().then(r => null);
  }

  /**
   *文章版权设置
   */
  setCopyrightSetting() {
    const a = $('.copy-right a.permalink');
    if (!a.length) return;
    const href = window.location.href;
    a.attr('href', href);
    const decodeFlag = (typeof MainApp !== 'undefined' && MainApp.conf)
      ? MainApp.conf.post_copyright_decode
      : false;
    a.text(formatPermalinkText(href, decodeFlag));
  }

  code() {
    if(!this.render['enable_code']) return; 
  }

  /**
   * 设置代码主题
   */
  setCodeTheme() {
    if(!codeLight || !codeDark) return;

    codeLight.disabled = mode === 'dark';

    codeDark.disabled = mode === 'light';
  }
}


