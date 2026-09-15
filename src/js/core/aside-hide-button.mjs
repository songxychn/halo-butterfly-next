/**
 * 对齐 Butterfly 5.7.0 上游 aside.button 隐藏开关
 * （_config.yml / layout/includes/rightside.pug / source/js/main.js /
 *   scripts/helpers/inject_head_js.js，f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * Halo 现有 aside.button 是作者卡片 name/link，与上游布尔撞名。
 * 本键 aside.hide_button 默认 true；仅显式 false 不渲染 #hide-aside-btn。
 * 须 aside.enable。不改 aside.hide / aside.mobile。不做完整 rightside。
 */

export const ASIDE_HIDE_BUTTON_DEFAULT = true;
export const ASIDE_STATUS_KEY = 'aside-status';
export const ASIDE_STATUS_TTL_DAYS = 2;

function isExplicitFalse(value) {
  return value === false || value === 'false';
}

function isExplicitTrue(value) {
  return value === true || value === 'true';
}

/** 默认 true；仅显式 false 关闭开关。 */
export function resolveAsideHideButton(value) {
  if (isExplicitFalse(value)) return false;
  if (isExplicitTrue(value)) return true;
  return ASIDE_HIDE_BUTTON_DEFAULT;
}

/** 上游 rightside：aside.enable && aside.button。 */
export function shouldShowHideAsideButton(asideEnable, hideButton) {
  if (isExplicitFalse(asideEnable)) return false;
  if (asideEnable === '' || asideEnable == null) return false;
  return resolveAsideHideButton(hideButton);
}

/** 上游 createAsideStatusJs：仅 aside.enable && aside.button 时恢复 localStorage。 */
export function shouldRestoreAsideStatus(asideEnable, hideButton) {
  return shouldShowHideAsideButton(asideEnable, hideButton);
}

/** 上游 click：已有 hide-aside 则存 show，否则存 hide，再 toggle。 */
export function nextAsideStatus(currentlyHidden) {
  return currentlyHidden ? 'show' : 'hide';
}

export function readAsideStatus(storage) {
  const itemStr = storage.getItem(ASIDE_STATUS_KEY);
  if (!itemStr) return undefined;
  try {
    const data = JSON.parse(itemStr);
    if (data.expiry && Date.now() > data.expiry) {
      storage.removeItem(ASIDE_STATUS_KEY);
      return undefined;
    }
    return data.value;
  } catch {
    storage.removeItem(ASIDE_STATUS_KEY);
    return undefined;
  }
}

export function writeAsideStatus(value, ttlDays = ASIDE_STATUS_TTL_DAYS, storage, now = Date.now()) {
  const data = { value };
  if (ttlDays != null) data.expiry = now + ttlDays * 86400000;
  storage.setItem(ASIDE_STATUS_KEY, JSON.stringify(data));
}

export function applyAsideStatus(classList, status) {
  if (status === undefined) return;
  classList.toggle('hide-aside', status === 'hide');
}

export function restoreAsideStatus(classList, storage, asideEnable, hideButton) {
  if (!shouldRestoreAsideStatus(asideEnable, hideButton)) return;
  applyAsideStatus(classList, readAsideStatus(storage));
}

export function onHideAsideButtonClick(classList, storage) {
  const saveStatus = nextAsideStatus(classList.contains('hide-aside'));
  writeAsideStatus(saveStatus, ASIDE_STATUS_TTL_DAYS, storage);
  classList.toggle('hide-aside');
}

export function bindHideAsideButton(root = typeof document !== 'undefined' ? document : null) {
  if (!root || typeof root.getElementById !== 'function') return;
  const btn = root.getElementById('hide-aside-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    try {
      onHideAsideButtonClick(document.documentElement.classList, localStorage);
    } catch {}
  });
}
