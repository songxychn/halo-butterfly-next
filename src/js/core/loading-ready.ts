// The document is usable before optional images, fonts and plugin requests finish.
export function whenContentReady(done: () => void, doc = document) {
  if (doc.readyState !== 'loading' || doc.getElementById?.('theme-content-ready')) {
    done();
    return;
  }
  // DOMContentLoaded also waits for defer scripts. The end-of-body marker lets
  // readable SSR content appear while those optional enhancements download.
  const ready = () => {
    doc.removeEventListener('halo-butterfly-next:content-ready', ready);
    doc.removeEventListener('DOMContentLoaded', ready);
    done();
  };
  doc.addEventListener('halo-butterfly-next:content-ready', ready, { once: true });
  doc.addEventListener('DOMContentLoaded', ready, { once: true });
}
