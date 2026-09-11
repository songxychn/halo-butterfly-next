/**
 * @date: 2024/2/25
 * @author: 小红
 * @fileName: Render
 * @Description: 渲染html
 */
import $ from 'jquery';
import {useDelay} from '../core/_util';
import tocBot from 'tocbot';
import {
  applyTocNumbers,
  getScrollPercent,
  resolveCollapseDepth,
  resolveNumber,
  resolveExpand,
  resolveScrollPercent,
} from '../core/toc.mjs';
import {
  capRelatedPosts,
  resolveLimit,
} from '../core/related-post.mjs';

export default class Render {
  name = 'Render';

  #renderDom = $('article.render'); // 文章渲染区域

  #tocStickyDom = $('.aside .is-sticky');

  #conf = MainApp.conf;

  constructor() {
    this.#h();
    this.#domObserver();
    this.#tocBotH5();
    this.#copyRight();
    this.#relatedPosts();
  }

  /**
   * h标题
   */
  #h() {
    if(this.#conf.enable_h_icon) this.#renderDom.addClass('enable_h_icon');
  }

  #domObserver() {
    const renderDom = document.querySelector('article.render');
    if (!renderDom) return;

    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        if(entry.contentRect.height > 0) {
          this.#tocBot();
          observer.disconnect();
        }
      }
    });
    observer.observe(renderDom);
  }

  /**
   * 设置目录。对齐 toc.number / expand / scroll_percent。
   */
  #tocBot() {
    const tocEl = document.querySelector('.aside-toc > .toc');
    if (!tocEl) return;

    const expand = resolveExpand(this.#conf.toc_expand);
    tocEl.classList.toggle('is-expand', expand);
    tocEl.classList.toggle('is-numbered', resolveNumber(this.#conf.toc_number));

    tocBot.init({
      contentSelector: 'article.render',
      tocSelector: '.aside-toc > .toc',
      headingSelector: 'h1,h2,h3,h4,h5,h6',
      hasInnerContainers: true,
      scrollSmooth: true,
      includeTitleTags: true,
      scrollSmoothDuration: 280,
      throttleTimeout: 30,
      collapseDepth: resolveCollapseDepth(this.#conf.toc_expand),
      headingsOffset: 20, // 目录中高亮的偏移值，和scrollSmoothOffset有关联
      scrollSmoothOffset: -20, // 屏幕滚动的偏移值（这里和导航条固定也有关联）
      fixedSidebarOffset: 'auto',
      onClick: (e) => e.preventDefault(),
      scrollEndCallback: function(e) {
      },
    });

    const article = document.querySelector('article.render');
    const percentEl = document.querySelector('.aside-toc .toc-percentage');
    const showPercent = resolveScrollPercent(this.#conf.toc_scroll_percent);

    MainApp.useScroll.change((max, num, scrollTop) => {
      if (showPercent && percentEl && article) {
        percentEl.textContent = String(getScrollPercent(scrollTop, article));
      }
      if(scrollTop < max || window.innerWidth <= 1100) return;
      if(num <= scrollTop) {
        this.#tocStickyDom.css('top', '');
      }
      else {
        this.#tocStickyDom.css('top', '70px');
      }
    });

    const toc = $('.aside-toc > .toc');

    if(!toc.html()) toc.html('暂无目录~');
    else applyTocNumbers(tocEl, resolveNumber(this.#conf.toc_number));

  }

  /**
   * h5目录
   */
  #tocBotH5() {
    const adeToc = this.#tocStickyDom.find('.aside-toc');
    if (!adeToc.length) return;

    const sideBtn = $('.side-btn');

    const tocBtn = $(`<button  class="button h5-toc" type="button"  title="文章目录" ><i class="fa-solid fa-list"></i></button>`);

    sideBtn.prepend(tocBtn);

    tocBtn.on('click', async () => {
      adeToc.toggle('fast');

      await useDelay(500);

      adeToc.css('display') === 'none' && adeToc.attr('style', '');
    });
  }

  /**
   * 版权
   */
  #copyRight() {
    const a = $('.copy-right a.permalink');

    a.attr('href', window.location.href);

    a.html(decodeURI(window.location.href));
  }

  /**
   * 相关文章：按 data-post-name 去重并截断到 related_post.limit。
   */
  #relatedPosts() {
    const list = document.querySelector('.relatedPosts-list');
    if (!list) return;
    capRelatedPosts(list, resolveLimit(this.#conf.related_post_limit), list.getAttribute('data-current-post'));
  }

}
