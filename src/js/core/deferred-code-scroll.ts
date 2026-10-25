import { onPageCleanup } from './page-lifecycle.ts';

// Preserve an already restored offset across one deferred Prism enhancement.
// PJAX owns manual restoration. Native WebKit restores before Prism and then
// adds its layout growth again; Blink/Gecko instead use interim native anchors.
export function preserveDeferredCodeScroll(view: Window = window) {
  const navigation = view.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  // iOS browser brands use WebKit too. This is not a real-device certification.
  const agent = view.navigator.userAgent;
  const webkit = /AppleWebKit\//.test(agent) && !/(?:Chrome|Chromium|Edg|OPR)\//.test(agent);
  const native = webkit && navigation?.type === 'back_forward';
  let eligible = native || view.history.scrollRestoration === 'manual';
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  const cancel = () => { eligible = false; remove(); };
  const remove = () => events.forEach(type => view.removeEventListener(type, cancel, true));
  if (eligible) {
    events.forEach(type => view.addEventListener(type, cancel, {capture: true, passive: true}));
    onPageCleanup(cancel);
  }
  return (enhance: () => void) => {
    const restore = eligible && (view.history.scrollRestoration === 'manual' || native) &&
      (view.scrollX > 0 || view.scrollY > 0);
    const x = view.scrollX, y = view.scrollY;
    cancel();
    if (!restore) return enhance();
    const style = view.document.documentElement.style;
    const anchor = style.getPropertyValue('overflow-anchor');
    const priority = style.getPropertyPriority('overflow-anchor');
    // Gecko can apply anchoring after the synchronous layout flush. Suppress it
    // through the next paint; no later callback changes the reader's position.
    style.setProperty('overflow-anchor', 'none', 'important');
    let pending = true;
    const restoreStyle = () => {
      if (!pending) return;
      pending = false;
      if (anchor) style.setProperty('overflow-anchor', anchor, priority);
      else style.removeProperty('overflow-anchor');
    };
    onPageCleanup(restoreStyle);
    try {
      enhance();
      view.document.documentElement.getBoundingClientRect();
      view.scrollTo({left: x, top: y, behavior: 'instant'});
    } finally {
      view.requestAnimationFrame(() => view.requestAnimationFrame(restoreStyle));
    }
  };
}
