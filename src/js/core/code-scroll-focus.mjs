function isScrollable(element) {
  const style = getComputedStyle(element);
  return element.clientWidth > 0 && element.clientHeight > 0 && (
    (/^(auto|scroll)$/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1) ||
    (/^(auto|scroll)$/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1));
}

// Give the actual scrolling code element a keyboard stop, including after
// resizing, expanding and loading a font. Preserve author-supplied tab order.
export function bindCodeScrollFocus(root) {
  if (!root) return () => {};
  const codes = [...root.querySelectorAll('pre, pre > code')]
    .filter(code => !code.hasAttribute('tabindex'));
  const update = () => {
    for (const code of codes) {
      if (isScrollable(code)) code.setAttribute('tabindex', '0');
      else code.removeAttribute('tabindex');
    }
  };
  const observer = new ResizeObserver(update);
  codes.forEach(code => observer.observe(code));
  document.fonts?.ready.then(update);
  update();
  return update;
}

// Prism reparents the focused pre/code, which can move focus to BODY. Capture
// only a reader currently in this block; never pull focus back from elsewhere.
export function preserveCodeReadingFocus(root, prepare = () => {}) {
  const document = root?.ownerDocument;
  const active = document?.activeElement;
  if (!active || !root.contains(active) || !active.matches('pre, pre > code')) return () => {};
  const pre = active.matches('pre') ? active : active.parentElement;
  const code = pre.querySelector('code');
  const left = pre.scrollLeft + (code?.scrollLeft || 0);
  const top = pre.scrollTop + (code?.scrollTop || 0);
  return () => {
    if (!root.contains(pre) || ![active, document.body].includes(document.activeElement)) return;
    prepare(pre);
    const currentCode = pre.querySelector('code');
    const target = [currentCode, pre].find(element => element && isScrollable(element)) || active;
    // If wrapping removed overflow, restore the reader without adding a tab stop.
    // Explicit author tabindex values are never changed.
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
      target.addEventListener('blur', () => {
        if (target.getAttribute('tabindex') === '-1') target.removeAttribute('tabindex');
      }, {once: true});
    }
    target.focus({preventScroll: true});
    pre.scrollLeft = pre.scrollTop = 0;
    if (currentCode) currentCode.scrollLeft = currentCode.scrollTop = 0;
    target.scrollLeft = left;
    target.scrollTop = top;
  };
}
