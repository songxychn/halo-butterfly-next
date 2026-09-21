// Give the actual scrolling code element a keyboard stop, including after
// resizing, expanding and loading a font. Preserve author-supplied tab order.
export function bindCodeScrollFocus(root) {
  if (!root) return;
  const codes = [...root.querySelectorAll('pre > code')]
    .filter(code => !code.hasAttribute('tabindex'));
  const update = () => {
    for (const code of codes) {
      const style = getComputedStyle(code);
      const scrollable = code.clientWidth > 0 && code.clientHeight > 0 && (
        (/^(auto|scroll)$/.test(style.overflowX) && code.scrollWidth > code.clientWidth + 1) ||
        (/^(auto|scroll)$/.test(style.overflowY) && code.scrollHeight > code.clientHeight + 1));
      if (scrollable) code.setAttribute('tabindex', '0');
      else code.removeAttribute('tabindex');
    }
  };
  const observer = new ResizeObserver(update);
  codes.forEach(code => observer.observe(code));
  document.fonts?.ready.then(update);
  update();
}
