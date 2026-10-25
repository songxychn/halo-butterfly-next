import { onPageCleanup } from './page-lifecycle.ts';

// On native Back/Forward, WebKit restores the old offset before deferred Prism
// changes the document height. Its scroll anchoring then adds that height again.
// Keep the restored offset across this one synchronous enhancement only. Normal
// loads, PJAX and readers who have already interacted keep their usual behavior.
export function preserveNativeHistoryScroll(view: Window = window) {
  const navigation = view.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  // Blink/Gecko can restore an interim anchor offset before Prism. Correcting
  // that value breaks their own restoration; this fix is specific to WebKit.
  // iOS browser brands still use WebKit and intentionally remain included.
  const agent = view.navigator.userAgent;
  const webkit = /AppleWebKit\//.test(agent) && !/(?:Chrome|Chromium|Edg|OPR)\//.test(agent);
  let eligible = webkit && navigation?.type === 'back_forward';
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  const cancel = () => { eligible = false; remove(); };
  const remove = () => events.forEach(type => view.removeEventListener(type, cancel, true));
  if (eligible) {
    events.forEach(type => view.addEventListener(type, cancel, {capture: true, passive: true}));
    onPageCleanup(cancel);
  }
  return (enhance: () => void) => {
    const restore = eligible && view.history.scrollRestoration === 'auto' && (view.scrollX > 0 || view.scrollY > 0);
    const x = view.scrollX, y = view.scrollY;
    cancel();
    enhance();
    if (restore) {
      // Flush the enhanced layout before correcting the browser's adjustment.
      view.document.documentElement.getBoundingClientRect();
      view.scrollTo({left: x, top: y, behavior: 'instant'});
    }
  };
}
