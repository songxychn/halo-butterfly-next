import { t } from '../core/i18n';
/**
 * Adapted from Butterfly 5.7.0 source/js/main.js runJustifiedGallery (Apache-2.0).
 * Same InfiniteGrid 4.13.0 justified engine, gap 5 and row size range 150–600.
 * Halo consumes already rendered HTML; it does not parse Hexo tags at runtime.
 * Source/license: third-party-licenses/UPSTREAM-ATTRIBUTION.txt.
 */
import { JustifiedInfiniteGrid } from '@egjs/infinitegrid';
import { GALLERY_KEY } from '../core/article-gallery.ts';
import { fetchGallery, galleryImages, galleryOptions, MAX_GALLERY_BYTES } from '../core/gallery-data.ts';
import type { GalleryImage } from '../core/gallery-data.ts';
import { onPageCleanup } from '../core/page-lifecycle.ts';

const instances = new WeakSet<HTMLElement>();
const brokenImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#555"/><text x="150" y="105" text-anchor="middle" fill="white" font-size="18">图片加载失败</text></svg>');

function initialize(gallery: HTMLElement) {
  if (instances.has(gallery)) return;
  const container = gallery.querySelector<HTMLElement>(':scope > .gallery-items');
  if (!container) return;
  instances.add(gallery);
  const source = container.textContent?.trim() || '';
  const options = galleryOptions(gallery);
  const document = gallery.ownerDocument;
  const status = document.createElement('p');
  status.className = 'gallery-status'; status.setAttribute('role', 'status');
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'gallery-more'; button.hidden = true;
  const sentinel = document.createElement('div'); sentinel.className = 'gallery-sentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  gallery.append(status, button, sentinel);
  gallery.classList.add('loaded');
  // JSON remains text-only until validated; never interpolate it into HTML.
  container.textContent = '';
  let active = true, busy = false, loaded = false, cursor = 0, batch = 0;
  let images: GalleryImage[] = [], grid: JustifiedInfiniteGrid | undefined;
  let request: AbortController | undefined, observer: IntersectionObserver | undefined;
  const pendingImages = new Set<() => void>();
  const hadGroup = gallery.getAttribute('data-lightbox-group');
  const group = gallery.getAttribute('data-lightbox-group') || 'article-gallery-' + crypto.randomUUID();
  gallery.setAttribute('data-lightbox-group', group);
  const showMore = () => {
    const remaining = cursor < images.length;
    button.hidden = !remaining;
    button.disabled = busy;
    button.textContent = t('ui.loadMore');
    gallery.setAttribute('aria-busy', String(busy));
  };
  const item = async (data: GalleryImage) => {
    const element = document.createElement('div'); element.className = 'item';
    const image = document.createElement('img');
    image.alt = data.alt; image.title = data.title; image.decoding = 'async';
    image.loading = 'eager'; image.referrerPolicy = 'no-referrer';
    image.setAttribute('data-grid-maintained-target', 'true');
    element.append(image);
    await new Promise<void>(resolve => {
      let done = false;
      const finish = (failed = false) => {
        if (done) return;
        done = true; clearTimeout(timer);
        image.onload = image.onerror = null; pendingImages.delete(cancel);
        if (failed) {
          image.src = brokenImage; image.width = 300; image.height = 200;
          image.alt = t('ui.imageError') + (data.alt ? '：' + data.alt : '');
          element.setAttribute('data-no-lightbox', '');
        } else { image.width = image.naturalWidth; image.height = image.naturalHeight; }
        resolve();
      };
      const cancel = () => { image.removeAttribute('src'); finish(true); };
      const timer = setTimeout(() => finish(true), 8000);
      pendingImages.add(cancel);
      image.onload = () => finish(); image.onerror = () => finish(true);
      image.src = data.url;
    });
    return element;
  };
  const append = async () => {
    if (!active || busy || cursor >= images.length) return;
    busy = true; showMore(); status.textContent = t('ui.loadingImages');
    const keyboardFocus = document.activeElement === button;
    const next = Math.min(images.length, cursor + (cursor === 0 ? options.first : options.limit));
    const elements = await Promise.all(images.slice(cursor, next).map(item));
    if (!active) return;
    cursor = next;
    grid ??= new JustifiedInfiniteGrid(container, {
      gap: 5, sizeRange: [150, 600], useTransform: true,
      useResizeObserver: true, useRecycle: false,
    });
    // A short first batch may not push the sentinel out of view. Re-observe
    // after layout so automatic loading continues one batch at a time.
    grid.once('renderComplete', () => {
      if (!active) return;
      if (keyboardFocus && button.hidden) elements[0]?.querySelector<HTMLElement>('.theme-lightbox-trigger')?.focus({ preventScroll: true });
      if (!options.button && cursor < images.length) { observer?.unobserve(sentinel); observer?.observe(sentinel); }
    });
    grid.append(elements, ++batch);
    busy = false; showMore();
    status.textContent = t('ui.imagesLoaded', cursor, images.length);
  };
  const load = async () => {
    if (!active || busy) return;
    busy = true; button.hidden = true; status.textContent = t('ui.readingGallery');
    gallery.setAttribute('aria-busy', 'true');
    request = new AbortController();
    const timeout = setTimeout(() => request?.abort(), 8000);
    try {
      if (gallery.dataset.type === 'url') images = await fetchGallery(source, document.baseURI, request.signal);
      else {
        if (new TextEncoder().encode(source).length > MAX_GALLERY_BYTES) throw new Error(t('ui.errorGallerySize'));
        images = galleryImages(JSON.parse(source), document.baseURI);
      }
      if (!active) return;
      loaded = true; busy = false;
      if (!images.length) { status.textContent = t('ui.emptyImages'); showMore(); return; }
      if (!options.button && 'IntersectionObserver' in window) {
        observer = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) void append();
        }, { rootMargin: '200px' });
      }
      await append();
    } catch {
      if (!active) return;
      busy = false; status.textContent = t('ui.galleryError');
      button.hidden = false; button.disabled = false; button.textContent = t('ui.retry');
      gallery.setAttribute('aria-busy', 'false');
    } finally { clearTimeout(timeout); }
  };
  const click = () => { void (loaded ? append() : load()); };
  button.addEventListener('click', click);
  // Handles a gallery in an initially hidden tab, resizing, and sidebar toggles.
  const resize = new ResizeObserver(() => {
    if (active && container.clientWidth > 0) grid?.renderItems();
  });
  resize.observe(gallery);
  onPageCleanup(() => {
    active = false; request?.abort(); observer?.disconnect(); resize.disconnect();
    pendingImages.forEach(cancel => cancel()); grid?.destroy();
    button.removeEventListener('click', click); status.remove(); button.remove(); sentinel.remove();
    container.textContent = source; gallery.classList.remove('loaded'); gallery.removeAttribute('aria-busy');
    if (hadGroup === null) gallery.removeAttribute('data-lightbox-group');
    else gallery.setAttribute('data-lightbox-group', hadGroup);
    instances.delete(gallery);
  });
  void load();
}

window[GALLERY_KEY] = article => article.querySelectorAll<HTMLElement>('.gallery-container').forEach(initialize);
