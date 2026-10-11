/**
 * Butterfly 5.7.0 source/js/main.js justifiedIndexPostUI, adapted to Halo.
 * Same InfiniteGrid 4.13.0 engine and gaps; loaded only for home layouts 6/7.
 * Apache-2.0 adaptation; engine and dependencies retain their own MIT licenses.
 * Source and license: third-party-licenses/UPSTREAM-ATTRIBUTION.txt.
 */
import { MasonryInfiniteGrid } from '@egjs/infinitegrid';

const container = document.querySelector<HTMLElement>('.home-layout.masonry');
let grid: MasonryInfiniteGrid | null = null;

function initialize() {
  if (!container || grid || !container.querySelector(':scope > .item')) return;
  grid = new MasonryInfiniteGrid(container, {
    gap: { horizontal: 10, vertical: 20 },
    useTransform: true,
    useResizeObserver: true,
  });
  grid.renderItems();
}

initialize();
// Loading can initially hide the content; font/visibility changes need a fresh
// measurement. ResizeObserver also follows sidebar and viewport width changes.
document.fonts.ready.then(() => grid?.renderItems());
window.addEventListener('load', () => grid?.renderItems(), { once: true });
window.addEventListener('pagehide', () => {
  grid?.destroy();
  grid = null;
});
window.addEventListener('pageshow', event => {
  if (event.persisted) initialize();
});
