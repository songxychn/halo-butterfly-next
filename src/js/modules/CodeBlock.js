/**
 * @date: 2024/2/25
 * @author: 小红
 * @fileName: codeBlock
 * @Description: 代码块
 */
import $ from 'jquery';
import Clipboard from 'clipboard';
import {useToBool} from '../core/_util';
import {resolveCodeShrink} from '../core/code-shrink.mjs';
import { bindCodeScrollFocus, preserveCodeReadingFocus } from '../core/code-scroll-focus.mjs';
import { enhanceCodeWhenReady, loadPrismAfterPaint } from '../core/prism-ready.mjs';

export default class codeBlock {
  name = 'codeBlock';

  #renderDom = $('article.render');

  #conf = MainApp.conf;

  #attrs = MainApp.attrs;

  constructor() {
    // Mode/navigation initialize with the page, independently of the optional highlighter.
    this.#codeTheme(MainApp.useTheme.getMode());
    MainApp.useTheme.change((mode) => this.#codeTheme(mode));
    const refreshScrollFocus = bindCodeScrollFocus(this.#renderDom[0]);
    if (!this.#flag('enable_code') || !this.#renderDom[0]?.querySelector('pre code')) return;
    MainApp.prismReady = loadPrismAfterPaint({
      source: MainApp.prismSource,
      domReady: MainApp.codeDomReady,
    });
    enhanceCodeWhenReady({
      root: this.#renderDom[0],
      enabled: this.#flag('enable_code'),
      ready: MainApp.prismReady,
      getPrism: () => window.Prism,
      enhance: (prism) => {
        const restoreReadingFocus = preserveCodeReadingFocus(this.#renderDom[0]);
        this.#code(prism);
        this.#codeToolbar();
        refreshScrollFocus();
        restoreReadingFocus();
      },
    });
  }

  #flag(name) {
    return useToBool(this.#conf?.[name]);
  }

  #copyEnabled() {
    if (!this.#flag('enable_code_copy')) return false;
    const attr = this.#attrs?.enable_code_copy;
    if (attr === undefined || attr === null || attr === '') return true;
    return useToBool(attr);
  }

  #heightLimitPx() {
    const value = this.#conf?.code_height_limit;
    if (value === false || value === 'false' || value == null || value === '') return false;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : false;
  }

  #shrinkMode() {
    return resolveCodeShrink(this.#conf?.enable_code_expander);
  }

  #code(prism) {
    this.#renderDom.addClass('single_code_select');
    if (this.#flag('enable_code_line')) this.#renderDom.addClass('line-numbers');
    prism.highlightAllUnder(this.#renderDom[0]);
    this.#codeTheme(MainApp.useTheme.getMode());
  }

  #codeTheme(mode) {
    const codeLight = document.getElementById('codeLight');
    const codeDark = document.getElementById('codeDark');
    if (!codeLight || !codeDark) return;
    codeLight.disabled = mode === 'dark';
    codeDark.disabled = mode === 'light';
  }

  #codeToolbar() {
    const pres = this.#renderDom.find('pre');
    pres.each((index, dom) => {
      const pre = $(dom);
      const wrap = pre.parent('.code-toolbar');
      const toolbar = pre.next('.toolbar');
      if (!toolbar.length) return;

      if (this.#flag('enable_code_mac_style')) wrap.addClass('mac-style');
      if (this.#flag('enable_code_word_wrap')) wrap.addClass('word-wrap');

      if (this.#flag('enable_code_title')) toolbar.addClass('enable-title');
      else toolbar.find('.toolbar-item').first().remove();

      if (this.#flag('enable_code_hr')) toolbar.addClass('enable-hr');

      this.#codeToolbarCustom(toolbar, pre, wrap);
      this.#applyHeightLimit(wrap, pre);
    });

    setTimeout(() => pres.addClass('code-success'), 200);
  }

  #codeToolbarCustom(toolbar, pre, wrap) {
    toolbar.append('<div class="custom-item"></div>');
    const customItem = toolbar.find('.custom-item');

    if (this.#copyEnabled()) {
      const button = $('<button type="button" class="code-copy" aria-label="复制代码" title="复制代码"><i class="fas fa-paste" aria-hidden="true"></i></button>');
      button.on('click', (e) => {
        e.preventDefault();
        const text = pre.children('code[class*=\'language-\']').text();
        this.#copyText(text, button[0], e);
      });
      customItem.append(button);
    }

    const shrink = this.#shrinkMode();
    if (shrink !== 'none') {
      const initiallyClosed = shrink === 'true';
      if (initiallyClosed) wrap.addClass('closed');
      const expander = $(`<button type="button" class="code-expander" aria-label="${initiallyClosed ? '展开代码' : '折叠代码'}" title="${initiallyClosed ? '展开代码' : '折叠代码'}" aria-expanded="${initiallyClosed ? 'false' : 'true'}"><i class="fa-solid fa-caret-down" aria-hidden="true"></i></button>`);
      expander.on('click', function() {
        wrap.toggleClass('closed');
        const closed = wrap.hasClass('closed');
        $(this).attr('aria-expanded', String(!closed));
        $(this).attr('aria-label', closed ? '展开代码' : '折叠代码');
        $(this).attr('title', closed ? '展开代码' : '折叠代码');
      });
      customItem.append(expander);
    }

    if (this.#flag('enable_code_fullpage')) {
      const button = $('<button type="button" class="fullpage-button" aria-label="全屏代码" title="全屏代码" aria-pressed="false"><i class="fa-solid fa-up-right-and-down-left-from-center" aria-hidden="true"></i></button>');
      button.on('click', (e) => {
        e.preventDefault();
        this.#toggleFullpage(wrap, button);
      });
      customItem.append(button);
    }

    if (!customItem.children().length) customItem.remove();
  }

  #fullpageWrap = null;
  #fullpageButton = null;
  #scrollLock = null;
  #escBound = false;

  #toggleFullpage(wrap, button) {
    if (!wrap?.length) return;
    this.#setFullpage(wrap, button, !wrap.hasClass('code-fullpage'));
  }

  #setFullpage(wrap, button, on) {
    if (on) {
      if (this.#fullpageWrap && this.#fullpageWrap[0] !== wrap[0]) {
        this.#setFullpage(this.#fullpageWrap, this.#fullpageButton, false);
      }
      wrap.addClass('code-fullpage');
      this.#fullpageWrap = wrap;
      this.#fullpageButton = button;
      this.#lockScroll();
      this.#syncFullpageButton(button, true);
      this.#bindEsc();
      return;
    }
    wrap.removeClass('code-fullpage');
    this.#syncFullpageButton(button, false);
    if (this.#fullpageWrap && this.#fullpageWrap[0] === wrap[0]) {
      this.#fullpageWrap = null;
      this.#fullpageButton = null;
      this.#unlockScroll();
      this.#unbindEsc();
    }
  }

  #syncFullpageButton(button, on) {
    if (!button?.length) return;
    const icon = button.find('i');
    icon.toggleClass('fa-down-left-and-up-right-to-center', on);
    icon.toggleClass('fa-up-right-and-down-left-from-center', !on);
    button.attr('aria-pressed', String(on));
    button.attr('aria-label', on ? '退出全屏' : '全屏代码');
    button.attr('title', on ? '退出全屏' : '全屏代码');
  }

  #lockScroll() {
    if (this.#scrollLock) return;
    this.#scrollLock = {
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
    };
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('code-fullpage');
    document.documentElement.classList.add('code-fullpage');
  }

  #unlockScroll() {
    if (!this.#scrollLock) return;
    document.body.style.overflow = this.#scrollLock.body;
    document.documentElement.style.overflow = this.#scrollLock.html;
    document.body.classList.remove('code-fullpage');
    document.documentElement.classList.remove('code-fullpage');
    this.#scrollLock = null;
  }

  #onFullpageKeydown = (event) => {
    if (event.key !== 'Escape' && event.key !== 'Esc') return;
    if (!this.#fullpageWrap) return;
    event.preventDefault();
    this.#setFullpage(this.#fullpageWrap, this.#fullpageButton, false);
  };

  #bindEsc() {
    if (this.#escBound) return;
    document.addEventListener('keydown', this.#onFullpageKeydown);
    this.#escBound = true;
  }

  #unbindEsc() {
    if (!this.#escBound) return;
    document.removeEventListener('keydown', this.#onFullpageKeydown);
    this.#escBound = false;
  }

  #copyText(text, button, event) {
    const finish = (ok) => this.#copyFeedback(button, ok);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => finish(true)).catch(() => this.#clipboardJs(text, button, event, finish));
      return;
    }
    this.#clipboardJs(text, button, event, finish);
  }

  #clipboardJs(text, button, event, finish) {
    const clipboard = new Clipboard(button, {text: () => text});
    clipboard.on('success', () => {
      clipboard.destroy();
      finish(true);
    });
    clipboard.on('error', () => {
      clipboard.destroy();
      finish(false);
    });
    clipboard.onClick(event);
  }

  #copyFeedback(button, ok) {
    const text = ok ? '复制成功~' : '复制失败';
    if (ok) MainApp.useMessage.info(text);
    else MainApp.useMessage.error(text);
    const host = button.parentElement || button;
    host.querySelectorAll('.copy-notice').forEach((el) => el.remove());
    const notice = document.createElement('span');
    notice.className = `copy-notice${ok ? '' : ' is-error'}`;
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.textContent = text;
    button.insertAdjacentElement('afterend', notice);
    setTimeout(() => notice.remove(), 1600);
  }

  #applyHeightLimit(wrap, pre) {
    const limit = this.#heightLimitPx();
    if (!limit || !wrap.length) return;
    const code = pre.children('code')[0];
    if (!code || code.scrollHeight <= limit) return;
    wrap.addClass('has-height-limit');
    wrap[0].style.setProperty('--code-height-limit', `${limit}px`);
    const btn = $('<button type="button" class="code-expand-btn" aria-label="展开代码" aria-expanded="false"><i class="fas fa-angle-double-down" aria-hidden="true"></i></button>');
    btn.on('click', () => {
      wrap.toggleClass('expand-done');
      const expanded = wrap.hasClass('expand-done');
      btn.attr('aria-expanded', String(expanded));
      btn.attr('aria-label', expanded ? '收起代码' : '展开代码');
    });
    wrap.append(btn);
  }
}
