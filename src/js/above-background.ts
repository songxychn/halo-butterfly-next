// Inlined after the page configuration, before styles and deferred page bundles.
// Setting a property through CSSOM keeps configurable URLs out of CSS/HTML source.
const conf = window.MainApp.conf;
if (conf.enable_above && typeof conf.above_background === 'string' && conf.above_background) {
  const style = document.createElement('span').style;
  style.backgroundImage = `url(${JSON.stringify(conf.above_background)})`;
  if (style.backgroundImage) {
    document.documentElement.style.setProperty('--above-background', style.backgroundImage);
  }
}
