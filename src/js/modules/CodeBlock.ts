import { t } from '../core/i18n';
import { copyText, useToBool } from '../core/_util.ts';
import { resolveCodeShrink } from '../core/code-shrink.ts';
import { bindCodeScrollFocus, preserveCodeReadingFocus } from '../core/code-scroll-focus.ts';
import { enhanceCodeWhenReady, loadPrismAfterPaint } from '../core/prism-ready.ts';
import { preserveDeferredCodeScroll } from '../core/deferred-code-scroll.ts';

export default class CodeBlock {
  name = 'codeBlock';

  #renderDom = document.querySelector<HTMLElement>('article.render');

  #conf = MainApp.conf;

  #attrs = MainApp.attrs;

  constructor() {
    this.#codeTheme(MainApp.useTheme.getMode());
    MainApp.useTheme.change((mode) => this.#codeTheme(mode));
    const root = this.#renderDom;
    const refreshScrollFocus = bindCodeScrollFocus(root);
    if (!root || !this.#flag('enable_code') || !root.querySelector('pre code')) return;

    const enhanceWithRestoredScroll = preserveDeferredCodeScroll();
    MainApp.prismReady = loadPrismAfterPaint({
      source: MainApp.prismSource,
      domReady: MainApp.codeDomReady,
    });
    enhanceCodeWhenReady({
      root,
      enabled: this.#flag('enable_code'),
      ready: MainApp.prismReady,
      getPrism: () => window.Prism,
      enhance: (prism) => {
        const restoreReadingFocus = preserveCodeReadingFocus(root, (pre) => {
          const wrap = pre.parentElement?.classList.contains('code-toolbar') ? pre.parentElement : null;
          if (wrap?.classList.contains('closed')) {
            this.#setCodeExpanded(wrap, wrap.querySelector<HTMLElement>('.code-expander'), true);
          }
          refreshScrollFocus();
        });
        enhanceWithRestoredScroll(() => {
          this.#code(root, prism);
          this.#codeToolbar(root);
          refreshScrollFocus();
          restoreReadingFocus();
        });
      },
    });
  }

  #flag(name: keyof import('../types.ts').ThemeConfig) {
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
    return resolveCodeShrink(this.#conf?.code_shrink);
  }

  #code(root: HTMLElement, prism: import('../types.ts').PrismApi) {
    root.classList.add('single_code_select');
    if (this.#flag('enable_code_line')) root.classList.add('line-numbers');
    prism.highlightAllUnder(root);
    this.#codeTheme(MainApp.useTheme.getMode());
  }

  #codeTheme(mode: import('../types.ts').ColorScheme) {
    const codeLight = document.querySelector<HTMLLinkElement>('#codeLight');
    const codeDark = document.querySelector<HTMLLinkElement>('#codeDark');
    if (!codeLight || !codeDark) return;
    codeLight.disabled = mode === 'dark';
    codeDark.disabled = mode === 'light';
  }

  #codeToolbar(root: HTMLElement) {
    const pres = Array.from(root.querySelectorAll<HTMLElement>('pre'));
    for (const pre of pres) {
      const wrap = pre.parentElement?.classList.contains('code-toolbar') ? pre.parentElement : null;
      const toolbar = pre.nextElementSibling?.classList.contains('toolbar')
        ? (pre.nextElementSibling as HTMLElement)
        : null;
      if (!wrap || !toolbar) continue;

      if (this.#flag('enable_code_mac_style')) wrap.classList.add('mac-style');
      if (this.#flag('enable_code_word_wrap')) wrap.classList.add('word-wrap');

      if (this.#flag('enable_code_title')) toolbar.classList.add('enable-title');
      else toolbar.querySelector('.toolbar-item')?.remove();

      if (this.#flag('enable_code_hr')) toolbar.classList.add('enable-hr');

      this.#codeToolbarCustom(toolbar, pre, wrap);
      this.#applyHeightLimit(wrap, pre);
    }

    setTimeout(() => {
      for (const pre of pres) pre.classList.add('code-success');
    }, 200);
  }

  #codeToolbarCustom(toolbar: HTMLElement, pre: HTMLElement, wrap: HTMLElement) {
    const customItem = document.createElement('div');
    customItem.className = 'custom-item';
    toolbar.appendChild(customItem);

    if (this.#copyEnabled()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.setAttribute('aria-label', t('ui.copyCode'));
      button.title = t('ui.copyCode');
      button.innerHTML = '<i class="fas fa-paste" aria-hidden="true"></i>';
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const code = pre.querySelector<HTMLElement>(":scope > code[class*='language-']") || pre.querySelector('code');
        void copyText(code?.textContent ?? '').then((ok) => this.#copyFeedback(button, ok));
      });
      customItem.appendChild(button);
    }

    const shrink = this.#shrinkMode();
    if (shrink !== 'none') {
      const initiallyClosed = shrink === 'true';
      if (initiallyClosed) wrap.classList.add('closed');
      const label = initiallyClosed ? t('ui.expandCode') : t('ui.collapseCode');
      const expander = document.createElement('button');
      expander.type = 'button';
      expander.className = 'code-expander';
      expander.setAttribute('aria-label', label);
      expander.title = label;
      expander.setAttribute('aria-expanded', initiallyClosed ? 'false' : 'true');
      expander.innerHTML = '<i class="fa-solid fa-caret-down" aria-hidden="true"></i>';
      expander.addEventListener('click', () => {
        this.#setCodeExpanded(wrap, expander, wrap.classList.contains('closed'));
      });
      customItem.appendChild(expander);
    }

    if (this.#flag('enable_code_fullpage')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fullpage-button';
      button.setAttribute('aria-label', t('ui.fullscreenCode'));
      button.title = t('ui.fullscreenCode');
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center" aria-hidden="true"></i>';
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.#toggleFullpage(wrap, button);
      });
      customItem.appendChild(button);
    }

    if (!customItem.children.length) customItem.remove();
  }

  #setCodeExpanded(wrap: HTMLElement, button: HTMLElement | null, expanded: boolean) {
    wrap.classList.toggle('closed', !expanded);
    if (!button) return;
    const label = expanded ? t('ui.collapseCode') : t('ui.expandCode');
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  #fullpageWrap: HTMLElement | null = null;
  #fullpageButton: HTMLElement | null = null;
  #scrollLock: { body: string; html: string } | null = null;
  #escBound = false;

  #toggleFullpage(wrap: HTMLElement, button: HTMLElement) {
    this.#setFullpage(wrap, button, !wrap.classList.contains('code-fullpage'));
  }

  #setFullpage(wrap: HTMLElement, button: HTMLElement | null, on: boolean) {
    if (on) {
      if (this.#fullpageWrap && this.#fullpageWrap !== wrap) {
        this.#setFullpage(this.#fullpageWrap, this.#fullpageButton, false);
      }
      wrap.classList.add('code-fullpage');
      this.#fullpageWrap = wrap;
      this.#fullpageButton = button;
      this.#lockScroll();
      this.#syncFullpageButton(button, true);
      this.#bindEsc();
      return;
    }
    wrap.classList.remove('code-fullpage');
    this.#syncFullpageButton(button, false);
    if (this.#fullpageWrap === wrap) {
      this.#fullpageWrap = null;
      this.#fullpageButton = null;
      this.#unlockScroll();
      this.#unbindEsc();
    }
  }

  #syncFullpageButton(button: HTMLElement | null, on: boolean) {
    if (!button) return;
    const icon = button.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-down-left-and-up-right-to-center', on);
      icon.classList.toggle('fa-up-right-and-down-left-from-center', !on);
    }
    const label = on ? t('ui.exitFullscreen') : t('ui.fullscreenCode');
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', label);
    button.title = label;
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

  #onFullpageKeydown = (event: KeyboardEvent) => {
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

  #copyFeedback(button: HTMLElement, ok: boolean) {
    const text = ok ? t('ui.copied') : t('ui.copyFailed');
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

  #applyHeightLimit(wrap: HTMLElement, pre: HTMLElement) {
    const limit = this.#heightLimitPx();
    if (!limit) return;
    const code = pre.querySelector<HTMLElement>(':scope > code');
    if (!code || code.scrollHeight <= limit) return;
    wrap.classList.add('has-height-limit');
    wrap.style.setProperty('--code-height-limit', `${limit}px`);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-expand-btn';
    btn.setAttribute('aria-label', t('ui.expandCode'));
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<i class="fas fa-angle-double-down" aria-hidden="true"></i>';
    btn.addEventListener('click', () => {
      wrap.classList.toggle('expand-done');
      const expanded = wrap.classList.contains('expand-done');
      btn.setAttribute('aria-expanded', String(expanded));
      btn.setAttribute('aria-label', expanded ? t('ui.hideCode') : t('ui.expandCode'));
    });
    wrap.appendChild(btn);
  }
}
