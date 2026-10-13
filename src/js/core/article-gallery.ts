import { t } from './i18n';
import { loadManagedResource, resolveResource } from './external-resource.ts';
import { onPageCleanup } from './page-lifecycle.ts';

export const GALLERY_KEY = Symbol.for('halo-butterfly-next.article-gallery');
declare global { interface Window { [GALLERY_KEY]?: (article: HTMLElement) => void } }

/** The layout engine is a separate entry: ordinary articles never download it. */
export function initializeArticleGallery(article: HTMLElement) {
  if (!article.querySelector('.gallery-container')) return;
  let active = true;
  onPageCleanup(() => { active = false; });
  const start = () => { if (active && article.isConnected) window[GALLERY_KEY]?.(article); };
  if (window[GALLERY_KEY]) { start(); return; }
  const base = MainApp.conf.assets_link;
  if (typeof base !== 'string') return;
  const local = base + 'js/gallery.min.js' + (MainApp.resources?.version === false ? '' : '?v=' + encodeURIComponent(MainApp.version || ''));
  const source = resolveResource('gallery', local, MainApp.resources, MainApp.version, 'js/gallery.min.js');
  void (async () => {
    await loadManagedResource(source, local, { attributes: { 'data-theme-script': 'gallery' }, valid: () => typeof window[GALLERY_KEY] === 'function' });
    if (window[GALLERY_KEY]) start();
    else if (active) {
      article.querySelectorAll<HTMLElement>('.gallery-container').forEach(gallery => {
        gallery.classList.add('loaded');
        const message = article.ownerDocument.createElement('p');
        message.className = 'gallery-status'; message.setAttribute('role', 'status');
        message.textContent = t('ui.galleryEnhanceError');
        gallery.append(message);
      });
    }
  })();
}
