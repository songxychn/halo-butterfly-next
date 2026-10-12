// Inlined after the page configuration, before styles and deferred page bundles.
// Setting a property through CSSOM keeps configurable URLs out of CSS/HTML source.
const conf = window.MainApp.conf;
if (conf.enable_above === true) {
  const primary = conf.above_background?.trim() || '';
  const fallback = conf.above_background_fallback?.trim() || '';
  const candidates = [...new Set([primary, fallback].filter(Boolean))];
  const rootStyle = document.documentElement.style;
  const apply = (index: number): void => {
    if (window.MainApp.conf !== conf) return;
    const url = candidates[index];
    if (!url) {
      rootStyle.removeProperty('--above-background');
      return;
    }
    const style = document.createElement('span').style;
    style.backgroundImage = `url(${JSON.stringify(url)})`;
    rootStyle.setProperty('--above-background', style.backgroundImage);
    // Share the background/preload cache; a failed decorative image must not hide
    // the title or keep retrying the same URL indefinitely.
    const image = new Image();
    image.onerror = () => apply(index + 1);
    image.src = url;
  };
  apply(0);
}
