import { getScrollPercent } from './toc.ts';
/**
 * 对齐 Butterfly 5.7.0 layout/includes/rightside.pug + source/js/main.js
 * （f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 齿轮 #rightside-config 切换 #rightside-config-hide.show。
 * rightside_scroll_percent 默认 false；仅显式 true 在 #go-up 显示百分比。
 * readmode 默认 true；仅显式 false 不渲染。仅文章页。繁简见 translate.ts。
 * 不复用作者卡片 aside.button。不把 footer 模板升 verified。
 */

export function toggleRightsideConfigHide(hideEl: Element | null) {
  if (!hideEl || !hideEl.classList) return false;
  hideEl.classList.toggle('show');
  return hideEl.classList.contains('show');
}

const RIGHTSIDE_ITEMS = {
  readmode: 'readmode',
  translate: 'translateLink',
  darkmode: 'darkmode',
  hideAside: 'hide-aside-btn',
  toc: 'mobile-toc-button',
} as const;

type RightsideItem = keyof typeof RIGHTSIDE_ITEMS;

const DEFAULT_HIDE: RightsideItem[] = ['readmode', 'translate', 'darkmode', 'hideAside'];
const DEFAULT_SHOW: RightsideItem[] = ['toc'];

/** Empty groups use upstream defaults; unsupported names are ignored, first occurrence wins. */
export function resolveRightsideItemOrder(enabled: unknown, hide: unknown, show: unknown) {
  const seen = new Set<RightsideItem>();
  const parse = (value: unknown, fallback: RightsideItem[]) => {
    const names = isExplicitTrue(enabled) && typeof value === 'string' && value.trim()
      ? value.split(',').map(name => name.trim())
      : fallback;
    return names.filter((name): name is RightsideItem => {
      if (!Object.hasOwn(RIGHTSIDE_ITEMS, name) || seen.has(name as RightsideItem)) return false;
      seen.add(name as RightsideItem);
      return true;
    });
  };
  return { hide: parse(hide, DEFAULT_HIDE), show: parse(show, DEFAULT_SHOW) };
}

/** Move only feature-gated, existing buttons. Reapply when Render adds the mobile TOC. */
export function applyRightsideItemOrder(root: Document = document) {
  const toolbar = root.getElementById('rightside');
  const hide = root.getElementById('rightside-config-hide');
  const show = root.getElementById('rightside-config-show');
  const gear = root.getElementById('rightside-config');
  const goUp = root.getElementById('go-up');
  if (!toolbar || !hide || !show || !goUp) return;
  const order = resolveRightsideItemOrder(toolbar.dataset.itemOrderEnable, toolbar.dataset.itemOrderHide, toolbar.dataset.itemOrderShow);
  const selected = new Set([...order.hide, ...order.show]);
  for (const [name, id] of Object.entries(RIGHTSIDE_ITEMS)) {
    const button = toolbar.querySelector<HTMLElement>(`#${id}`);
    if (button) {
      button.hidden = !selected.has(name as RightsideItem);
      button.inert = button.hidden;
    }
  }
  for (const name of order.hide) {
    const button = toolbar.querySelector<HTMLElement>(`#${RIGHTSIDE_ITEMS[name]}`);
    if (button) hide.appendChild(button);
  }
  for (const name of order.show) {
    const button = toolbar.querySelector<HTMLElement>(`#${RIGHTSIDE_ITEMS[name]}`);
    if (button) show.insertBefore(button, goUp);
  }
  const hasHiddenItems = order.hide.some(name => hide.querySelector(`#${RIGHTSIDE_ITEMS[name]}`));
  if (gear) {
    gear.hidden = !hasHiddenItems;
    if (!hasHiddenItems) hide.classList.remove('show');
    gear.setAttribute('aria-expanded', String(hasHiddenItems && hide.classList.contains('show')));
  }
  hide.inert = !hasHiddenItems || !hide.classList.contains('show');
}

export function bindRightsideConfig(root = typeof document !== 'undefined' ? document : null) {
  if (!root || typeof root.getElementById !== 'function') return;
  applyRightsideItemOrder(root);
  const btn = root.getElementById('rightside-config');
  const hide = root.getElementById('rightside-config-hide');
  if (!btn || !hide) return;
  hide.inert = !hide.classList.contains('show');
  btn.addEventListener('click', () => {
    const expanded = toggleRightsideConfigHide(hide);
    hide.inert = !expanded;
    btn.setAttribute('aria-expanded', String(expanded));
  });
  hide.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !hide.classList.contains('show')) return;
    hide.classList.remove('show');
    hide.inert = true;
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  });
}


export const RIGHTSIDE_SCROLL_PERCENT_DEFAULT = false;
export const SHOW_PERCENT_MAX = 95;

function isExplicitTrue(value: unknown) {
  return value === true || value === 'true';
}

/** 上游默认 false；仅显式 true 开启。 */
export function resolveRightsideScrollPercent(value: unknown) {
  return isExplicitTrue(value);
}

export function shouldShowGoUpPercent(percent: number) {
  return percent < SHOW_PERCENT_MAX;
}

export function updateGoUpPercent(goUpEl: Element | null, percentEl: Element | null, currentTop: number, ele: HTMLElement, viewport?: import('./toc.ts').ScrollViewport) {
  if (!goUpEl || !percentEl) return;
  const percent = getScrollPercent(currentTop, ele, viewport);
  if (shouldShowGoUpPercent(percent)) {
    goUpEl.classList.add('show-percent');
    percentEl.textContent = String(percent);
  } else {
    goUpEl.classList.remove('show-percent');
  }
}

export function bindRightsideScrollPercent(root = typeof document !== 'undefined' ? document : null) {
  if (!root || typeof root.getElementById !== 'function') return null;
  if (!resolveRightsideScrollPercent(typeof window !== 'undefined' ? window.MainApp?.conf?.rightside_scroll_percent : undefined)) {
    return null;
  }
  const goUp = root.getElementById('go-up');
  const percentEl = goUp?.querySelector?.('.scroll-percent');
  if (!goUp || !percentEl) return null;
  return (scrollTop: number) => {
    updateGoUpPercent(goUp, percentEl, scrollTop, document.body);
  };
}

export const READMODE_DEFAULT = true;

function isExplicitFalse(value: unknown) {
  return value === false || value === 'false';
}

/** 上游默认 true；仅显式 false 关闭。 */
export function resolveReadmode(value: unknown) {
  if (isExplicitFalse(value)) return false;
  return READMODE_DEFAULT;
}

/** 上游 globalPageType === 'post' && readmode。 */
export function shouldShowReadmodeButton(readmodeValue: unknown, isPost: boolean) {
  return Boolean(isPost) && resolveReadmode(readmodeValue);
}

export function createExitReadmodeButton(doc: Document) {
  if (!doc || typeof doc.createElement !== 'function') return null;
  const el = doc.createElement('button');
  el.type = 'button';
  el.className = 'fas fa-sign-out-alt exit-readmode';
  el.title = '退出阅读模式';
  return el;
}

export function enterReadMode(body: HTMLElement | null, doc: Document) {
  if (!body || !body.classList) return null;
  const newEle = createExitReadmodeButton(doc);
  if (!newEle) return null;
  const exitReadMode = () => {
    body.classList.remove('read-mode');
    newEle.remove();
    newEle.removeEventListener('click', exitReadMode);
  };
  body.classList.add('read-mode');
  newEle.addEventListener('click', exitReadMode);
  body.appendChild(newEle);
  return newEle;
}

export function bindReadmode(root = typeof document !== 'undefined' ? document : null) {
  if (!root || typeof root.getElementById !== 'function') return;
  const btn = root.getElementById('readmode');
  if (!btn) return;
  const body = root.body || (typeof document !== 'undefined' ? document.body : null);
  btn.addEventListener('click', () => {
    enterReadMode(body, root);
  });
}
