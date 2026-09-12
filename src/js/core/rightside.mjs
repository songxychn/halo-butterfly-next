import { getScrollPercent } from './toc.mjs';
/**
 * 对齐 Butterfly 5.7.0 layout/includes/rightside.pug + source/js/main.js
 * （f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 齿轮 #rightside-config 切换 #rightside-config-hide.show。
 * rightside_scroll_percent 默认 false；仅显式 true 在 #go-up 显示百分比。
 * 不做 readmode / translate / chat / comment / item_order / rightside_bottom。
 * 不复用作者卡片 aside.button。不把 footer 模板升 verified。
 */

export function toggleRightsideConfigHide(hideEl) {
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

function isExplicitTrue(value) {
  return value === true || value === 'true';
}

/** 上游默认 false；仅显式 true 开启。 */
export function resolveRightsideScrollPercent(value) {
  return isExplicitTrue(value);
}

export function shouldShowGoUpPercent(percent) {
  return percent < SHOW_PERCENT_MAX;
}

export function updateGoUpPercent(goUpEl, percentEl, currentTop, ele, viewport) {
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
  return (scrollTop) => {
    updateGoUpPercent(goUp, percentEl, scrollTop, document.body);
  };
}
