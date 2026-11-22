import tocBot from 'tocbot';
import { t } from '../core/i18n';
import { bindArticleAnchors, ensureHeadingIds } from '../core/article-anchor.ts';
import { enhanceContent } from '../core/content-extensions.ts';
import { applyRightsideItemOrder } from '../core/rightside.ts';
import { applyPhotoFigcaptions } from '../core/photofigcaption.ts';
import {
  applyTocNumbers,
  getScrollPercent,
  resolveCollapseDepth,
  resolveNumber,
  resolveExpand,
  resolveScrollPercent,
} from '../core/toc.ts';
import {
  renderRelatedPosts,
  resolveLimit,
} from '../core/related-post.ts';
import { formatPermalinkText } from '../core/post-copyright.ts';
import { enhanceBodyRenderers } from '../core/body-renderers.ts';
import { enhanceMath } from '../core/math.ts';
import { bindRewards } from '../core/reward.ts';

export default class Render {
  name = 'Render';

  #article = document.querySelector<HTMLElement>('article.render');

  #tocStickyDom = document.querySelector<HTMLElement>('.aside .is-sticky');

  #conf = MainApp.conf;

  constructor() {
    const article = this.#article;
    if (article) {
      if (this.#conf.enable_h_icon) article.classList.add('enable_h_icon');
      enhanceBodyRenderers(article, this.#conf.body_renderers);
      enhanceMath(article, {
        enabled: this.#conf.math_enabled,
        copyTex: this.#conf.math_copy_tex,
        hideScrollbar: this.#conf.math_hide_scrollbar,
      });
      applyPhotoFigcaptions(article, this.#conf.photofigcaption);
      ensureHeadingIds(article);
      enhanceContent(article);
      bindArticleAnchors(article, {
        autoUpdate: this.#conf.anchor_auto_update,
        clickToScroll: this.#conf.anchor_click_to_scroll,
      });
      this.#domObserver(article);
    }
    this.#tocBotH5();
    this.#copyRight();
    this.#relatedPosts();
    bindRewards();
  }

  #domObserver(renderDom: HTMLElement) {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          this.#tocBot(renderDom);
          observer.disconnect();
          return;
        }
      }
    });
    observer.observe(renderDom);
  }

  #tocBot(article: HTMLElement) {
    const tocEl = document.querySelector<HTMLElement>('.aside-toc > .toc');
    if (!tocEl) return;

    const expand = resolveExpand(this.#conf.toc_expand);
    tocEl.classList.toggle('is-expand', expand);
    tocEl.classList.toggle('is-numbered', resolveNumber(this.#conf.toc_number));

    tocBot.init({
      contentSelector: 'article.render',
      tocSelector: '.aside-toc > .toc',
      headingSelector: 'h1,h2,h3,h4,h5,h6',
      hasInnerContainers: true,
      scrollSmooth: false,
      includeTitleTags: true,
      scrollSmoothDuration: 280,
      throttleTimeout: 30,
      collapseDepth: resolveCollapseDepth(this.#conf.toc_expand),
      headingsOffset: 20,
      scrollSmoothOffset: -20,
      fixedSidebarOffset: 'auto',
    });

    const percentEl = document.querySelector('.aside-toc .toc-percentage');
    const showPercent = resolveScrollPercent(this.#conf.toc_scroll_percent);

    MainApp.useScroll.change((max, num, scrollTop) => {
      if (showPercent && percentEl) {
        percentEl.textContent = String(getScrollPercent(scrollTop, article));
      }
      if (!this.#tocStickyDom || scrollTop < max || window.innerWidth <= 1100) return;
      this.#tocStickyDom.style.top = num <= scrollTop ? '' : '70px';
    });

    if (!tocEl.innerHTML) tocEl.textContent = t('ui.emptyToc');
    else applyTocNumbers(tocEl, resolveNumber(this.#conf.toc_number));
  }

  #tocBotH5() {
    const adeToc = this.#tocStickyDom?.querySelector<HTMLElement>('.aside-toc');
    if (!adeToc) return;

    const showPane = document.getElementById('rightside-config-show');
    const sideBtn = showPane || document.querySelector('.side-btn');
    if (!sideBtn) return;
    const goUp = document.getElementById('go-up');

    const tocBtn = document.createElement('button');
    tocBtn.id = 'mobile-toc-button';
    tocBtn.className = 'button h5-toc';
    tocBtn.type = 'button';
    tocBtn.title = t('ui.postToc');
    tocBtn.innerHTML = '<i class="fas fa-list-ul"></i>';

    if (goUp && showPane) showPane.insertBefore(tocBtn, goUp);
    else sideBtn.prepend(tocBtn);

    tocBtn.addEventListener('click', () => {
      const hidden = window.getComputedStyle(adeToc).display === 'none';
      adeToc.style.display = hidden ? 'block' : '';
    });
    applyRightsideItemOrder(document);
  }

  #copyRight() {
    const a = document.querySelector<HTMLAnchorElement>('.copy-right a.permalink');
    if (!a) return;
    const href = a.getAttribute('href')
      || document.querySelector<HTMLLinkElement>('link[rel=canonical]')?.href
      || window.location.href;
    a.setAttribute('href', href);
    a.textContent = formatPermalinkText(href, this.#conf.post_copyright_decode);
  }

  #relatedPosts() {
    const list = document.querySelector('.relatedPosts-list');
    if (!list) return;
    renderRelatedPosts(list, resolveLimit(this.#conf.related_post_limit));
  }
}
