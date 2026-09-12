/**
 * 对齐 Butterfly 5.7.0 darkmode 按钮（_config.yml / layout/includes/rightside.pug
 * #darkmode / source/js/main.js darkmode，f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * Halo 新组 darkmode.enable / darkmode.button 默认 true；仅显式 false 关闭。
 * 二者都非显式 false 才渲染 #darkmode。点击走既有 Theme.toggleMode，不走 innerHTML。
 * autoChangeMode 默认 false；1 跟随系统，2 按小时（start/end 空回退 6/18）。
 * 不做完整 darkmode.styl / item_order / snackbar。不复用作者卡片 aside.button。
 * 不把已落地 config 升 verified。
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

export const AUTO_CHANGE_MODE_DEFAULT = false;
export const DARKMODE_START_DEFAULT = 6;
export const DARKMODE_END_DEFAULT = 18;

/** 上游默认 false；仅 1 / 2 开启对应策略。 */
export function resolveAutoChangeMode(value) {
  if (value === 1 || value === '1') return 1;
  if (value === 2 || value === '2') return 2;
  return AUTO_CHANGE_MODE_DEFAULT;
}

/** 空 / 非法回退；0 与 24 有效。 */
export function resolveHourBound(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const h = Math.trunc(n);
  if (h < 0 || h > 24) return fallback;
  return h;
}

/** 上游 inject_head_js.js isNight。 */
export function isNightHour(hour, start, end) {
  return start < end
    ? hour < start || hour >= end
    : hour >= start || hour < end;
}

/**
 * style.mode 的 light/dark 强制。已存 light/dark 优先。
 * autoChangeMode 1 跟随系统（无偏好时回退小时窗口）；2 按小时。
 * false 时：style.mode==auto 仍按小时（兼容 Halo 自动模式）；否则无已存则 light。
 */
export function resolveInitialColorScheme({
  styleMode,
  autoChangeMode,
  start,
  end,
  saved,
  prefersDark,
  prefersLight,
  hour,
} = {}) {
  if (styleMode === 'light' || styleMode === 'dark') return styleMode;
  if (saved === 'light' || saved === 'dark') return saved;
  const mode = resolveAutoChangeMode(autoChangeMode);
  const startHour = resolveHourBound(start, DARKMODE_START_DEFAULT);
  const endHour = resolveHourBound(end, DARKMODE_END_DEFAULT);
  const currentHour = Number.isFinite(Number(hour)) ? Number(hour) : 0;
  const effective = mode !== false ? mode : (styleMode === 'auto' ? 2 : false);
  if (effective === 1) {
    if (prefersLight === true) return 'light';
    if (prefersDark === true) return 'dark';
    return isNightHour(currentHour, startHour, endHour) ? 'dark' : 'light';
  }
  if (effective === 2) {
    return isNightHour(currentHour, startHour, endHour) ? 'dark' : 'light';
  }
  return 'light';
}

export function shouldListenPrefersColorScheme({ styleMode, autoChangeMode, saved } = {}) {
  if (styleMode === 'light' || styleMode === 'dark') return false;
  if (saved === 'light' || saved === 'dark') return false;
  return resolveAutoChangeMode(autoChangeMode) === 1;
}
