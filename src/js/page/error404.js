import App from '../core/App';

@App([])
class Error404 {
  run_image_fallback() {
    const image = document.querySelector('.error-image');
    if (!image) return;
    const fallbacks = [image.dataset.siteBackground, image.dataset.fallback].filter(Boolean);
    const next = () => {
      let candidate = fallbacks.shift();
      while (candidate && candidate === image.getAttribute('src')) candidate = fallbacks.shift();
      if (candidate) {
        // Halo may add responsive candidates for the original URL. They take
        // precedence over src and must not survive a switch to a fallback.
        image.removeAttribute('srcset');
        image.removeAttribute('sizes');
        image.src = candidate;
      }
      else image.hidden = true;
    };
    image.addEventListener('error', next);
    // A failed image can finish before the page bundle attaches its listener.
    if (image.complete && image.naturalWidth === 0) next();
  }
}
