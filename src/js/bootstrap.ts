import {resolveInitialColorScheme} from './core/color-scheme.ts';
import {applyAppearance} from './core/appearance.ts';
import {haloSetting} from './core/halo-settings.ts';
import {resolveResource} from './core/external-resource.ts';
import {preconnectResource} from './core/resource-hints.ts';
// Only the current page's critical bundles are warmed before the parser reaches them.
// Optional SDK hosts are handled by their loader after the feature is actually enabled.
try {
  const app = window.MainApp, page = String(app.conf.resource_page || '');
  if (/^[a-z0-9_-]+$/.test(page)) {
    // Avoid nested array literals: [[...]] is a Thymeleaf inline expression delimiter.
    const files = {main_css: `css/${page}.min.css`, main: `js/${page}.min.js`,
      fontawesome: 'plugins/fontawesome/css/all.min.css'};
    for (const [key, file] of Object.entries(files)) {
      const url = resolveResource(app.conf.assets_link + file, app.resources, app.version, file);
      preconnectResource(url);
      // Font files use CORS, unlike the CSS file that discovers them.
      if (key === 'fontawesome') preconnectResource(url, document, true);
    }
  }
} catch {}
try {
  const conf = window.MainApp.conf;
  conf.appearance = haloSetting(conf.appearance) as Record<string, unknown>;
  conf.effects = haloSetting(conf.effects) as Record<string, unknown>;
  conf.aside_tag_colors = haloSetting(conf.aside_tag_colors);
  applyAppearance(conf.appearance);
} catch {}
// Inlined by the build before first paint; Halo expressions stay in the template.
try {
  const conf = window.MainApp.conf;
  let saved = null;
  try { saved = localStorage.getItem('halo-butterfly-next.color-scheme'); } catch {}
  let prefersDark = false;
  try { prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch {}
  document.documentElement.dataset.colorScheme = resolveInitialColorScheme({
    styleMode: conf.style_mode, saved, prefersDark,
    start: conf.darkmode_night_start, end: conf.darkmode_night_end,
  });
} catch { document.documentElement.dataset.colorScheme = 'light'; }
try {
  const restoreAside = window.MainApp.conf.restore_aside;
  if (restoreAside) {
    const raw = localStorage.getItem('aside-status');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.expiry && Date.now() > data.expiry) localStorage.removeItem('aside-status');
      else if (data.value !== undefined) document.documentElement.classList.toggle('hide-aside', data.value === 'hide');
    }
  }
} catch {}

// Capture readiness before deferred page bundles execute.
window.MainApp.codeDomReady = new Promise(resolve => {
  if (document.readyState === 'interactive' || document.readyState === 'complete') resolve(undefined);
  else document.addEventListener('DOMContentLoaded', resolve, {once: true});
});
