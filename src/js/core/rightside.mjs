/**
 * 对齐 Butterfly 5.7.0 layout/includes/rightside.pug + source/js/main.js
 * （f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 齿轮 #rightside-config 切换 #rightside-config-hide.show。
 * 不做 readmode / translate / chat / comment / item_order / scroll_percent。
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
