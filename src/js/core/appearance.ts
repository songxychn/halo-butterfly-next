/** Configuration values are applied with CSSOM, never interpolated into a stylesheet. */
export type Appearance = Record<string, unknown>;
const record = (value: unknown): Appearance => value && typeof value === 'object' ? value as Appearance : {};
export const enabled = (value: unknown) => value === true || value === 'true';
export function cssValue(property: string, value: unknown, supports = CSS.supports) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && !/[;{}<>]|url\(|var\(|expression\(/i.test(text) && supports(property, text) ? text : '';
}
export function iconCharacter(value: unknown, fallback = '\uf2dc') {
  const match = typeof value === 'string' && value.trim().match(/^\\?([0-9a-f]{4,6})$/i);
  const code = match ? parseInt(match[1], 16) : 0;
  return code >= 0xe000 && code <= 0xf8ff ? String.fromCodePoint(code) : fallback;
}
export function applyAppearance(input: unknown, root = document.documentElement) {
  const conf = record(input), font = record(conf.font), title = record(conf.blog_title_font), hr = record(conf.hr_icon), beautify = record(conf.beautify);
  const set = (variable: string, property: string, value: unknown) => {
    const valid = cssValue(property, value);
    if (valid) root.style.setProperty(variable, valid); else root.style.removeProperty(variable);
  };
  set('--global-font-size', 'font-size', font.global_font_size);
  set('--global-font-family', 'font-family', font.font_family);
  set('--code-font-size', 'font-size', font.code_font_size);
  set('--code-font-family', 'font-family', font.code_font_family);
  set('--title-font-family', 'font-family', title.font_family);
  set('--hr-icon-top', 'top', hr.icon_top);
  set('--heading-icon-color', 'color', beautify.title_prefix_icon_color);
  root.style.setProperty('--hr-icon-content', JSON.stringify(iconCharacter(hr.icon)));
  root.style.setProperty('--heading-icon-content', JSON.stringify(iconCharacter(beautify.title_prefix_icon, '\uf0c1')));
  root.classList.toggle('appearance-code-size', Boolean(cssValue('font-size', font.code_font_size)));
  root.classList.toggle('appearance-code-family', Boolean(cssValue('font-family', font.code_font_family)));
  root.classList.toggle('appearance-justify', enabled(conf.text_align_justify));
  root.classList.toggle('appearance-enter', enabled(conf.enter_transitions));
  root.classList.toggle('appearance-avatar', conf.avatar_effect !== false && conf.avatar_effect !== 'false');
  root.classList.toggle('appearance-no-hr-icon', hr.enable === false || hr.enable === 'false');
  root.classList.toggle('appearance-beautify-post', enabled(beautify.enable) && beautify.field !== 'site');
  root.classList.toggle('appearance-beautify-site', enabled(beautify.enable) && beautify.field === 'site');
  const color = record(conf.theme_color);
  const variables: Record<string, string> = {
      main: '--theme', paginator: '--paginator-color', button_hover: '--btn-hover-color', text_selection: '--selection-color',
      link_color: '--article-link-color', meta_color: '--card-meta', hr_color: '--hr-color',
      code_foreground: '--code-color', code_background: '--code-background-color', toc_color: '--toc-active-color',
      blockquote_padding_color: '--blockquote-border-color', blockquote_background_color: '--blockquote-background-color', scrollbar_color: '--scrollbar-color',
  };
  for (const [key, variable] of Object.entries(variables)) set(variable, 'color', enabled(color.enable) ? color[key] : '');
}

const metaObservers = new WeakMap<Document, MutationObserver>();

export function initializeAppearance(conf: unknown, root = document) {
  const appearance = record(conf), title = record(appearance.blog_title_font);
  const href = typeof title.font_link === 'string' ? title.font_link.trim() : '';
  if (href && !root.getElementById('appearance-title-font')) {
    try {
      const url = new URL(href, root.baseURI);
      if ((url.protocol === 'https:' || (url.origin === location.origin && url.protocol === location.protocol)) && !url.username && !url.password) {
        const link = root.createElement('link');
        link.id = 'appearance-title-font'; link.rel = 'stylesheet'; link.href = url.href;
        root.head.append(link);
      }
    } catch { /* Empty/invalid URLs retain system fonts. */ }
  }
  const color = record(appearance.theme_color);
  metaObservers.get(root)?.disconnect();
  if (enabled(color.enable)) {
    let meta = root.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) { meta = root.createElement('meta'); meta.name = 'theme-color'; root.head.append(meta); }
    const update = () => {
      const value = cssValue('color', color[root.documentElement.dataset.colorScheme === 'dark' ? 'meta_theme_color_dark' : 'meta_theme_color_light']);
      if (value) meta!.content = value; else meta!.removeAttribute('content');
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(root.documentElement, {attributes: true, attributeFilter:['data-color-scheme']});
    metaObservers.set(root, observer);
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-cover-color]')) {
    const value = cssValue('color', element.dataset.coverColor);
    if (value) element.style.backgroundColor = value;
  }
  for (const image of root.querySelectorAll<HTMLImageElement>('img[data-image-fallback]')) {
    if (image.dataset.fallbackBound) continue;
    image.dataset.fallbackBound = 'true';
    const failed = () => {
      // Halo may add srcset for attachment resizing; it must not override the fallback.
      image.removeAttribute('srcset'); image.removeAttribute('sizes');
      const fallback = image.dataset.imageFallback;
      let alternate = '';
      try {
        const url = new URL(fallback || '', root.baseURI);
        if (fallback && ['http:', 'https:', 'data:'].includes(url.protocol)) alternate = url.href;
      } catch {}
      if (alternate && image.dataset.fallbackTried !== 'true' && alternate !== image.src) {
        image.dataset.fallbackTried = 'true'; image.src = alternate;
      } else { image.removeAttribute('src'); image.classList.add('image-failed'); }
    };
    image.addEventListener('error', failed);
    if (image.complete && image.naturalWidth === 0) failed();
  }
}
