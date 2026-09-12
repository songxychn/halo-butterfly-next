/**
 * 对齐 Butterfly 5.7.0 darkmode 按钮（_config.yml / layout/includes/rightside.pug
 * #darkmode / source/js/main.js darkmode，f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * Halo 新组 darkmode.enable / darkmode.button 默认 true；仅显式 false 关闭。
 * 二者都非显式 false 才渲染 #darkmode。点击走既有 Theme.toggleMode，不走 innerHTML。
 * 不做 autoChangeMode / start / end / 完整 darkmode.styl / item_order / snackbar。
 * 不复用作者卡片 aside.button。不把已落地 config 升 verified。
 */

export const DARKMODE_ENABLE_DEFAULT = true;
export const DARKMODE_BUTTON_DEFAULT = true;

function isExplicitFalse(value) {
  return value === false || value === 'false';
}

/** 上游默认 true；仅显式 false 关闭。 */
export function resolveDarkmodeEnable(value) {
  if (isExplicitFalse(value)) return false;
  return DARKMODE_ENABLE_DEFAULT;
}

/** 上游默认 true；仅显式 false 关闭。 */
export function resolveDarkmodeButton(value) {
  if (isExplicitFalse(value)) return false;
  return DARKMODE_BUTTON_DEFAULT;
}

/** 上游 darkmode.enable && darkmode.button。 */
export function shouldShowDarkmodeButton(enableValue, buttonValue) {
  return resolveDarkmodeEnable(enableValue) && resolveDarkmodeButton(buttonValue);
}

export function toggleColorScheme(theme) {
  if (!theme || typeof theme.toggleMode !== 'function') return null;
  theme.toggleMode();
  return typeof theme.getMode === 'function' ? theme.getMode() : null;
}

export function bindDarkmode(root = typeof document !== 'undefined' ? document : null) {
  if (!root || typeof root.getElementById !== 'function') return;
  const btn = root.getElementById('darkmode');
  if (!btn) return;
  btn.addEventListener('click', () => {
    try {
      toggleColorScheme(typeof MainApp !== 'undefined' ? MainApp.useTheme : null);
    } catch {}
  });
}
