import { onPageCleanup } from './page-lifecycle.ts';
import type { ThemeConfig } from '../types.ts';

export function imageLoadingOptions(config: ThemeConfig) {
  return {
    enabled: config.lazyload_enable !== false && config.lazyload_enable !== 'false',
    native: config.lazyload_native !== false && config.lazyload_native !== 'false',
    field: config.lazyload_field === 'post' ? 'post' : 'site',
    blur: config.lazyload_blur === true || config.lazyload_blur === 'true',
  };
}
/** Keep real src/srcset for native loading and progressively enhance deferred author images. */
export function initializeImageLoading(config: ThemeConfig) {
  const options = imageLoadingOptions(config);
  let observer: IntersectionObserver | undefined;
  const cleanups: (() => void)[] = [];
  const reveal = (image: HTMLImageElement) => {
    if (image.dataset.lazySrcset) { image.srcset = image.dataset.lazySrcset; delete image.dataset.lazySrcset; }
    if (image.dataset.lazySrc) { image.src = image.dataset.lazySrc; delete image.dataset.lazySrc; }
    observer?.unobserve(image);
  };
  if (options.enabled && !options.native && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) reveal(entry.target as HTMLImageElement);
    }, { rootMargin: '200px' });
  }
  document.querySelectorAll<HTMLImageElement>('#Butterfly img').forEach(image => {
    if (image.dataset.fallbackBound) return;
    image.dataset.fallbackBound = 'true';
    const included = options.enabled && (options.field === 'site' || !!image.closest('article.render'));
    const finish = () => image.classList.remove('theme-image-pending');
    const error = () => {
      finish();
      if (image.dataset.lazySrc) return; // A failed placeholder must not replace a deferred real image.
      const fallback = image.dataset.themeImageFallback;
      if (!image.hasAttribute('data-theme-image-fallback')) return;
      image.removeAttribute('srcset'); image.removeAttribute('sizes');
      delete image.dataset.lazySrc; delete image.dataset.lazySrcset;
      let alternate = '';
      try {
        const url = new URL(fallback || '', document.baseURI);
        if (fallback && ['http:', 'https:', 'data:'].includes(url.protocol)) alternate = url.href;
      } catch {}
      if (alternate && image.dataset.fallbackTried !== 'true' && alternate !== image.src) {
        image.dataset.fallbackTried = 'true'; image.src = alternate;
      } else {
        image.removeAttribute('src'); image.classList.add('image-failed');
      }
    };
    image.addEventListener('load', finish); image.addEventListener('error', error);
    cleanups.push(() => { image.removeEventListener('load', finish); image.removeEventListener('error', error); delete image.dataset.fallbackBound; });
    const authorEager = image.loading === 'eager' && !image.hasAttribute('data-theme-image');
    if (!included || authorEager) {
      if (image.hasAttribute('data-theme-image')) image.loading = 'eager';
      reveal(image); finish();
      if (image.complete && image.naturalWidth === 0 && !image.dataset.lazySrc) error();
      return;
    }
    if (options.blur && (image.dataset.lazySrc || !(image.complete && image.naturalWidth > 0))) image.classList.add('theme-image-pending');
    if (options.native || !observer) {
      if (!authorEager) image.loading = 'lazy';
      reveal(image);
    } else if (image.dataset.lazySrc) observer.observe(image);
    // Existing author src/srcset may already be requested. Never replace them with a placeholder.
    if (image.complete && image.naturalWidth === 0 && !image.dataset.lazySrc) error();
  });
  onPageCleanup(() => { observer?.disconnect(); cleanups.forEach(cleanup => cleanup()); });
}
