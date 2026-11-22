import { resolveInitialColorScheme } from './core/color-scheme.ts';
import { applyAppearance } from './core/appearance.ts';
import { haloSetting } from './core/halo-settings.ts';
import { resolveResource } from './core/external-resource.ts';
import { preconnectResource } from './core/resource-hints.ts';
import type { ThemeApp } from './types.ts';

function readJsonAttr(el: Element | null, name: string): Record<string, unknown> | null {
  const raw = el?.getAttribute(name);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const current = typeof document !== 'undefined' ? document.currentScript : null;
const payload = readJsonAttr(current, 'data-config');
if (payload) {
  const conf = (payload.conf ?? {}) as Record<string, unknown>;
  window.MainApp = {
    messages: (payload.messages ?? {}) as Record<string, string>,
    conf,
    attrs: {},
    modules: {},
    resources: (payload.resources ?? {}) as ThemeApp['resources'],
    version: String(payload.version ?? ''),
  } as unknown as ThemeApp;
}

const app = window.MainApp;
app.merge = (script) => {
  if (!script) return;
  const conf = readJsonAttr(script, 'data-conf');
  if (conf) Object.assign(app.conf, haloSetting(conf) as Record<string, unknown>);
  const attrs = readJsonAttr(script, 'data-attrs');
  if (attrs) Object.assign(app.attrs, attrs);
  const bodyRenderers = readJsonAttr(script, 'data-body-renderers');
  if (bodyRenderers) app.conf.body_renderers = bodyRenderers as ThemeApp['conf']['body_renderers'];
  const items = script.getAttribute('data-items');
  if (items) {
    try { app.data = JSON.parse(items); } catch {}
  }
  const prism = script.getAttribute('data-prism');
  if (prism) app.prismSource = prism;
};

// Warm critical asset origins before parser reaches page bundles.
const page = String(app.conf.resource_page || '');
if (/^[a-z0-9_-]+$/.test(page)) {
  const files = {
    main_css: `css/${page}.min.css`,
    main: `js/${page}.min.js`,
    fontawesome: 'plugins/fontawesome/css/all.min.css',
  };
  for (const [key, file] of Object.entries(files)) {
    const url = resolveResource((app.conf.assets_link || '') + file, app.resources, app.version, file);
    preconnectResource(url);
    if (key === 'fontawesome') preconnectResource(url, document, true);
  }
}

app.conf.appearance = haloSetting(app.conf.appearance) as Record<string, unknown>;
app.conf.effects = haloSetting(app.conf.effects) as Record<string, unknown>;
app.conf.aside_tag_colors = haloSetting(app.conf.aside_tag_colors);
applyAppearance(app.conf.appearance);

let saved: string | null = null;
try { saved = localStorage.getItem('halo-butterfly-next.color-scheme'); } catch {}
let prefersDark = false;
try { prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch {}
document.documentElement.dataset.colorScheme = resolveInitialColorScheme({
  styleMode: app.conf.style_mode,
  saved,
  prefersDark,
  start: app.conf.darkmode_night_start,
  end: app.conf.darkmode_night_end,
});

if (app.conf.restore_aside) {
  try {
    const raw = localStorage.getItem('aside-status');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.expiry && Date.now() > data.expiry) localStorage.removeItem('aside-status');
      else if (data.value !== undefined) document.documentElement.classList.toggle('hide-aside', data.value === 'hide');
    }
  } catch {}
}

// Capture readiness before deferred page bundles execute.
app.codeDomReady = new Promise(resolve => {
  if (document.readyState === 'interactive' || document.readyState === 'complete') resolve(undefined);
  else document.addEventListener('DOMContentLoaded', resolve, { once: true });
});
