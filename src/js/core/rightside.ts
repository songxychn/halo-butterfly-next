import { getScrollPercent } from './toc.ts';
/**
 * 对齐 Butterfly 5.7.0 layout/includes/rightside.pug + source/js/main.js
 * （f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 齿轮 #rightside-config 切换 #rightside-config-hide.show。
 * rightside_scroll_percent 默认 false；仅显式 true 在 #go-up 显示百分比。
 * readmode 默认 true；仅显式 false 不渲染。仅文章页。繁简见 translate.mjs。不做 chat / comment / item_order。
 * 不复用作者卡片 aside.button。不把 footer 模板升 verified。
 */

export function toggleRightsideConfigHide(hideEl: Element | null) {
  if (!hideEl || !hideEl.classList) return false;
  hideEl.classList.toggle('show');
  return hideEl.classList.contains('show');
}

export function bindRightsideConfig(root = typeof document !== 'undefined' ? document : null) {
  if (!root || typeof root.getElementById !== 'function') return;
  const btn = root.getElementById('rightside-config');
  const hide = root.getElementById('rightside-config-hide');
  if (!btn || !hide) return;
  btn.addEventListener('click', () => {
    toggleRightsideConfigHide(hide);
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
