/** One owned AddToAny instance. Never reinitialize kits: the pinned SDK retains them. */
const key = Symbol.for('halo-butterfly-next.addtoany');
const loaderURL = 'https://static.addtoany.com/menu/page.js';
const coreURL = 'https://static.addtoany.com/menu/modules/core.iho16r34.js';
const utilityURL = 'https://static.addtoany.com/menu/sm.25.html#type=core&event=load';
interface AddToAnyState {
  kit: HTMLElement; main: HTMLElement; parking: HTMLElement; loader: HTMLScriptElement;
  core?: HTMLScriptElement; locale?: HTMLScriptElement; style?: HTMLStyleElement; frame?: HTMLIFrameElement;
  items: string; ready: boolean; url: string; title: string;
}
interface AddToAnyWindow extends Window {
  [key]?: AddToAnyState;
  a2a?: { main?: HTMLElement };
  a2a_config?: Record<string, unknown>;
}
function state() { return (window as AddToAnyWindow)[key]; }
function menuOpen(s: AddToAnyState) {
  return [...s.main.querySelectorAll<HTMLElement>('.a2a_menu, #a2a_modal, #a2a_overlay')]
    .some(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden');
}
export function addToAnyCanNavigate(doc: Document) {
  const s = state();
  if (!s) return true;
  if (!s.ready || !s.main.isConnected || s.main.parentNode !== document.body || !s.style?.isConnected ||
      s.frame?.src !== utilityURL || !s.main.contains(s.frame) || menuOpen(s)) return false;
  const region = doc.querySelector<HTMLElement>('[data-post-share]');
  return !region || (region.dataset.postShare === 'addtoany' &&
    (region.dataset.items || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean).join(',') === s.items);
}
export function isOwnedAddToAnyNode(node: Element) {
  const s = state();
  return !!s?.ready && (node === s.loader || node === s.core || node === s.locale || node === s.frame);
}
/** Keep the utility iframe and its body/head ancestors connected. */
export function replaceWithAddToAny(next: Document) {
  const s = state();
  if (!s?.ready) return false;
  s.parking.append(s.kit);
  for (const node of [...document.head.childNodes]) if (node !== s.style && node !== s.core && node !== s.locale) node.remove();
  document.head.append(...next.head.childNodes);
  for (const node of [...document.body.childNodes]) if (node !== s.main && node !== s.loader) node.remove();
  for (const attr of [...document.body.attributes]) document.body.removeAttribute(attr.name);
  for (const attr of next.body.attributes) document.body.setAttribute(attr.name, attr.value);
  document.body.append(...next.body.childNodes);
  return true;
}
export function mountAddToAny(host: HTMLElement, items: string[], url: string, title: string) {
  const win = window as AddToAnyWindow;
  let s = win[key];
  if (s) {
    if (s.items !== items.join(',')) throw new Error('AddToAny configuration requires native navigation');
    s.url = url; s.title = title;
    s.kit.dataset.a2aUrl = url; s.kit.dataset.a2aTitle = title;
    host.replaceWith(s.kit);
    return;
  }
  // An independently injected instance has no theme-owned lifecycle contract.
  if (win.a2a || win.a2a_config || document.getElementById('a2a_menu_container')) throw new Error('Unmanaged AddToAny instance');
  const main = document.createElement('div'); main.id = 'a2a_menu_container';
  const parking = document.createElement('div'); parking.hidden = true;
  const loader = document.createElement('script'); loader.src = loaderURL; loader.async = true;
  // Moving page.js is fail-closed; its audited content selects the immutable core filename above.
  loader.integrity = 'sha384-sh2U6Mq80dAQd/AdTRL4UEAG9JZOG4KwZyqEiRlncEGpKT29DFI7wXqp4zmJFbBT';
  loader.crossOrigin = 'anonymous';
  s = win[key] = {kit: host, main, parking, loader, items: items.join(','), ready: false, url, title};
  const owned = s;
  win.a2a_config = {num_services: items.length, callbacks: [{
    share: () => ({url: owned.url, title: owned.title}),
    ready: () => {
      const core = [...document.scripts].find(script => script.src === coreURL);
      const frame = main.querySelector<HTMLIFrameElement>('#a2a_sm_ifr');
      const styles = [...document.head.querySelectorAll('style')].filter(style => style.textContent?.includes('.a2a_menu'));
      if (win.a2a?.main !== main || !core || frame?.src !== utilityURL || styles.length !== 1) return;
      owned.locale = [...document.scripts].find(script => script.src === 'https://static.addtoany.com/menu/locale/zh-CN.js');
      owned.core = core; owned.frame = frame; owned.style = styles[0];
      main.append(parking); owned.ready = true;
      document.dispatchEvent(new Event('halo-butterfly-next:analytics-ready'));
    },
  }]};
  document.body.append(main, loader);
}
