/**
 * @date: 2024/2/25
 * @author: 小红
 * @fileName: codeBlock
 * @Description: 代码块
 */
import $ from 'jquery';
import Clipboard from 'clipboard';
import {useToBool} from '../core/_util';

export default class codeBlock {
  name = 'codeBlock';

  #renderDom = $('article.render');

  #conf = MainApp.conf;

  #attrs = MainApp.attrs;

  constructor() {
    if (this.#flag('enable_code')) {
      this.#code();
      this.#codeToolbar();
    }
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

  #code() {
    this.#renderDom.addClass('single_code_select');
    if (this.#flag('enable_code_line')) this.#renderDom.addClass('line-numbers');
    if (window.Prism) window.Prism.highlightAllUnder(this.#renderDom[0]);
    this.#codeTheme(MainApp.useTheme.getMode());
    MainApp.useTheme.change((mode) => this.#codeTheme(mode));
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

      this.#codeToolbarCustom(toolbar, pre);
      this.#applyHeightLimit(wrap, pre);
    });

    setTimeout(() => pres.addClass('code-success'), 200);
  }

  #codeToolbarCustom(toolbar, pre) {
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

    if (this.#flag('enable_code_expander')) {
      const expander = $('<button type="button" class="code-expander" aria-label="折叠代码" title="折叠代码" aria-expanded="true"><i class="fa-solid fa-caret-down" aria-hidden="true"></i></button>');
      expander.on('click', function() {
        pre.children('code').toggle();
        toolbar.toggleClass('enable-expander');
        $(this).attr('aria-expanded', String(!toolbar.hasClass('enable-expander')));
      });
      customItem.append(expander);
    }

    if (!customItem.children().length) customItem.remove();
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
