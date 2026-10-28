import { enabled } from './appearance.ts';
import { pageScope } from './page-lifecycle.ts';
import { resolveResource, loadManagedResource } from './external-resource.ts';

export function initializeEffects() {
  const config = window.MainApp.conf.effects;
  if (!config || !Object.values(config).some(value => value && typeof value === 'object' && enabled((value as Record<string, unknown>).enable))) return;
  const scope = pageScope();
  const mount = () => { if (scope.active && window.ThemeEffects) scope.add(window.ThemeEffects(config)); };
  if (window.ThemeEffects) { mount(); return; }
  const file = 'js/effects.min.js', local = MainApp.conf.assets_link + file;
  void loadManagedResource(resolveResource(local, MainApp.resources, MainApp.version, file), local, {
    attributes: {id: 'appearance-effects', 'data-theme-script': 'effects', 'data-resource-key': 'effects', 'data-resource-file': file},
    valid: () => typeof window.ThemeEffects === 'function',
  }).then(loaded => { if (loaded) mount(); });
}
