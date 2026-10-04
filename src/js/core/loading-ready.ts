// The document is usable before optional images, fonts and plugin requests finish.
export function whenContentReady(done: () => void, doc = document) {
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', done, { once: true });
  } else {
    done();
  }
}
