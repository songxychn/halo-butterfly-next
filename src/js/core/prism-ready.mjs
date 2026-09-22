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

// One request per document, including repeated module initialization. Two frame
// callbacks after DCL provide a paint opportunity; they do not assert a paint.
const loads = new WeakMap();
export function loadPrismAfterPaint({source, domReady, document = globalThis.document,
  requestFrame = callback => globalThis.requestAnimationFrame(callback)}) {
  if (loads.has(document)) return loads.get(document);
  const ready = Promise.resolve(domReady).then(() => new Promise(resolve => {
    if (!source) return resolve(false);
    requestFrame(() => requestFrame(() => {
      const script = document.createElement('script');
      script.async = true;
      script.setAttribute('data-manual', '');
      script.addEventListener('load', () => resolve(true), {once: true});
      script.addEventListener('error', () => resolve(false), {once: true});
      script.src = source;
      document.head.append(script);
    }));
  }), () => false);
  loads.set(document, ready);
  return ready;
}
