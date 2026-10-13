/** Best-effort connection hints; never block a resource or speculate about disabled features. */
export function preconnectResource(source: unknown, document: Document = globalThis.document, anonymous = false) {
  try {
    if (typeof source !== 'string' || !source || /[\s\\<>"'`]/.test(source)) return false;
    const url = new URL(source, document.baseURI), page = new URL(document.baseURI);
    if (url.protocol !== 'https:' || url.username || url.password || url.origin === page.origin) return false;
    const hints = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel~="preconnect"]')];
    if (hints.some(node => new URL(node.href, document.baseURI).origin === url.origin &&
      (node.crossOrigin === 'anonymous' || node.hasAttribute('crossorigin') && node.crossOrigin === '') === anonymous)) return false;
    // Bound speculative connections even when many independent integrations are enabled.
    if (new Set(hints.map(node => new URL(node.href, document.baseURI).origin)).size >= 6 &&
      !hints.some(node => new URL(node.href, document.baseURI).origin === url.origin)) return false;
    const link = document.createElement('link');
    link.rel = 'preconnect'; link.href = url.origin;
    link.dataset.themeResourceHint = '';
    if (anonymous) link.crossOrigin = 'anonymous';
    document.head.append(link);
    return true;
  } catch { return false; }
}
