import { t } from './i18n.ts';
import { initializeArchiveTitle } from './listing-options.ts';
import { initializeFooterBackground } from './decorative-background.ts';
import { initializeAppearance } from './appearance.ts';
import Navigation from './navigation.ts';
import { initializeAsideOptions } from './aside-options.ts';
import { initializeImageLoading } from './image-loading.ts';
import { applyRelativeDates } from './relative-date.ts';
import { bindHideAsideButton } from './aside-hide-button.ts';
import { bindRightsideConfig, bindReadmode } from './rightside.ts';
import { bindDarkmode } from './darkmode.ts';
import { bindCommentJump } from './comment-jump.ts';
import { bindCopyAttribution } from './copy-attribution.ts';
import { initializeSiteContent } from './site-content.ts';
import { initializeEffects } from './effects-loader.ts';

export default class Common {
  constructor() {
    initializeImageLoading(MainApp.conf);
    new Navigation();
    this.#bindScrollDown();

    if (MainApp.conf.enable_aside && MainApp.conf.enable_webInfo) this.#runDay();

    initializeAsideOptions(document, MainApp.conf.aside_tag_colors);
    initializeAppearance(MainApp.conf.appearance);
    initializeFooterBackground();
    initializeEffects();
    applyRelativeDates();
    initializeArchiveTitle();
    bindHideAsideButton();
    bindRightsideConfig();
    bindReadmode();
    if (document.getElementById('translateLink')) {
      void import('./translate.ts').then(({ bindTranslate }) => bindTranslate());
    }
    bindDarkmode();
    bindCommentJump();
    bindCopyAttribution();
    initializeSiteContent();
  }

  #runDay() {
    const dom = document.querySelector<HTMLElement>('.main > .aside .aside-webInfo .run-day');
    if (!dom) return;
    const siteDate = new Date(dom.getAttribute('data-date') || '');
    if (Number.isNaN(siteDate.getTime())) return;
    const day = Math.floor((Date.now() - siteDate.getTime()) / 86_400_000);
    dom.textContent = day + t('ui.dayUnit');
  }

  backTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  #bindScrollDown() {
    const el = document.getElementById('scroll-down');
    if (!el) return;
    el.addEventListener('click', () => {
      const main = document.querySelector<HTMLElement>('#Butterfly > .main');
      if (!main) return;
      window.scrollTo({ top: main.offsetTop, behavior: 'smooth' });
    });
  }
}
