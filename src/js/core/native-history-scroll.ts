import { onPageCleanup } from './page-lifecycle.ts';

const key = 'butterflyNativeScroll';
export function saveNativeHistoryScroll(view: Window = window) {
  const state = view.history.state;
  view.history.replaceState({...(state && typeof state === 'object' ? state : {}),
    [key]: {x: view.scrollX, y: view.scrollY}}, '', view.location.href);
}

// On native Back/Forward, WebKit restores the old offset before deferred Prism
// changes the document height. Its scroll anchoring then adds that height again.
// Keep the restored offset across this one synchronous enhancement only. Normal
// loads, PJAX and readers who have already interacted keep their usual behavior.
export function preserveNativeHistoryScroll(view: Window = window) {
  const navigation = view.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const saved = view.history.state?.[key];
  let eligible = navigation?.type === 'back_forward' &&
    Number.isFinite(saved?.x) && Number.isFinite(saved?.y) && saved.x >= 0 && saved.y >= 0;
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  const cancel = () => { eligible = false; remove(); };
  const remove = () => events.forEach(type => view.removeEventListener(type, cancel, true));
  if (eligible) {
    events.forEach(type => view.addEventListener(type, cancel, {capture: true, passive: true}));
    onPageCleanup(cancel);
  }
  return (enhance: () => void) => {
    const restore = eligible && view.history.scrollRestoration === 'auto';
    cancel();
    enhance();
    if (restore) {
      // Flush the enhanced layout before correcting the browser's adjustment.
      view.document.documentElement.getBoundingClientRect();
      view.scrollTo({left: saved.x, top: saved.y, behavior: 'instant'});
    }
  };
}
