import { t } from './i18n';

import {resolveMode} from './color-scheme.ts';
export * from './color-scheme.ts';
export const DARKMODE_BUTTON_DEFAULT = true;
export function resolveDarkmodeButton(value: unknown) { return value !== false && value !== 'false'; }
export function shouldShowDarkmodeButton(button: unknown, mode: unknown) {
  const policy = resolveMode(mode);
  return resolveDarkmodeButton(button) && policy !== 'light' && policy !== 'dark';
}
export function toggleColorScheme(theme: {toggleMode(): void; getMode?(): string} | null | undefined) {
  if (!theme || typeof theme.toggleMode !== 'function') return null;
  theme.toggleMode(); return theme.getMode?.() ?? null;
}
export function bindDarkmode(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;
  const button = root.getElementById('darkmode');
  const reset = root.getElementById('darkmode-reset');
  if (button) button.addEventListener('click', () => {
    const mode = toggleColorScheme(MainApp.useTheme);
    if (MainApp.conf.snackbar_enable === true || MainApp.conf.snackbar_enable === 'true') MainApp.useMessage?.info(mode === 'dark' ? t('ui.darkMode') : t('ui.lightMode'));
  });
  if (reset) reset.addEventListener('click', () => MainApp.useTheme.resetMode());
}
