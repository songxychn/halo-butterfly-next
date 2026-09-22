// A late/failed highlighter must not delay the page or hide the original code.
const enhancedRoots = new WeakSet();

export function enhanceCodeWhenReady({root, enabled, ready, getPrism, enhance}) {
  if (!enabled || !root?.querySelector('pre code')) return Promise.resolve(false);
  return Promise.resolve(ready).then(loaded => {
    const prism = getPrism();
    if (!loaded || !prism?.highlightAllUnder || enhancedRoots.has(root)) return false;
    enhancedRoots.add(root);
    enhance(prism);
    return true;
  }, () => false);
}
