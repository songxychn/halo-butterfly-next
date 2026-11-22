import { parse } from 'yaml';
import { readFileSync } from 'node:fs';

const { version: targetVersion } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function isLegacyBanner(value) {
  try {
    const url = new URL(value);
    return ((url.hostname === 'unpkg.com' || url.hostname.endsWith('.jsdelivr.net')) &&
      /^\/(?:npm\/)?halo-theme-butterfly(?:@[^/]+)?\/(?:docs\/)?above\.png$/.test(url.pathname)) ||
      (url.hostname.endsWith('.jsdelivr.net') && /^\/gh\/dhjddcn\/halo-theme-butterfly@[^/]+\/docs\/above\.png$/.test(url.pathname));
  } catch { return false; }
}

function assertSafe(value) {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) throw new Error(`不允许的配置字段：${key}`);
      assertSafe(child);
    }
  }
}

export function readConfig(text) {
  const input = parse(text, { maxAliasCount: 0 });
  assertSafe(input);
  if (!isObject(input)) throw new Error('配置必须是分组对象或 Halo ConfigMap');
  if (input.kind === 'ConfigMap') {
    if (!isObject(input.data)) throw new Error('ConfigMap.data 必须是对象');
    const data = {};
    for (const [group, value] of Object.entries(input.data)) {
      if (typeof value !== 'string') throw new Error(`ConfigMap.data.${group} 必须是 JSON 字符串`);
      try { data[group] = JSON.parse(value); }
      catch { throw new Error(`ConfigMap.data.${group} 不是有效 JSON`); }
    }
    assertSafe(data);
    return data;
  }
  if ('kind' in input || 'apiVersion' in input) throw new Error('仅支持 Halo ConfigMap 或原始分组配置');
  return input;
}

export function defaultsFromSettings(settings) {
  const fields = nodes => {
    const result = {};
    for (const node of nodes || []) {
      if (!node.name) { Object.assign(result, fields(node.children)); continue; }
      result[node.name] = node.$formkit === 'group'
        ? { ...fields(node.children), ...structuredClone(node.value || {}) }
        : structuredClone(node.value ?? '');
    }
    return result;
  };
  return Object.fromEntries(settings.spec.forms.map(form => [form.group, fields(form.formSchema)]));
}

const legacy205ToV1 = {
  'loading.enable_random_img': 'loading.img.random_enable',
  'loading.random_img': 'loading.img.random_link',
  'loading.preload': 'loading.img.preload',
  'loading.err': 'loading.img.err',
  'code.enable': 'render.enable_code',
  'code.enable_title': 'render.enable_code_title',
  'code.enable_hr': 'render.enable_code_hr',
  'code.enable_line': 'render.enable_code_line',
  'code.enable_copy': 'render.enable_code_copy',
  'code.enable_expander': 'render.code_shrink',
  'code.theme_light': 'render.code_theme_light',
  'code.theme_dark': 'render.code_theme_dark',
  'post.enable_h_title': 'render.enable_h_icon',
};

const v1GroupToV2Prefix = {
  base: 'general',
  error404: 'general.error404',
  CDN: 'general.cdn',
  inject: 'general.inject',
  style: 'appearance',
  darkmode: 'appearance.darkmode',
  card: 'appearance.card',
  mask: 'appearance.mask',
  effects: 'appearance.effects',
  index: 'home',
  cover: 'home.cover',
  image: 'home.image',
  toc: 'post.toc',
  anchor: 'post.anchor',
  wordcount: 'post.wordcount',
  copy: 'post.copy',
  share: 'post.share',
  busuanzi: 'post.stats',
  render: 'code',
  math: 'code.math',
  mermaid: 'code.mermaid',
  chartjs: 'code.chartjs',
  abcjs: 'code.abcjs',
  archives: 'pages.archives',
  tags: 'pages.tags',
  categories: 'pages.categories',
  single: 'pages.single',
  moments: 'pages.moments',
  links: 'pages.links',
  rightside: 'interaction.rightside',
  loading: 'interaction.loading',
  snackbar: 'interaction.snackbar',
  lazyload: 'interaction.lazyload',
  translate: 'interaction.translate',
  subscription: 'seo.subscription',
};

export function mapV1PathToV2(v1Path) {
  if (v1Path === 'base.enable_seo') return 'seo.enable';
  const dot = v1Path.indexOf('.');
  if (dot < 0) return v1GroupToV2Prefix[v1Path] || v1Path;
  const group = v1Path.slice(0, dot);
  const rest = v1Path.slice(dot + 1);
  const mapped = v1GroupToV2Prefix[group];
  return mapped ? `${mapped}.${rest}` : v1Path;
}

export function migrateConfig(input, from, defaults) {
  if (!['2.0.5', '2.0.7', '0.1.0-alpha.4', '1.0.0'].includes(from)) {
    throw new Error('必须明确指定 --from 2.0.5、2.0.7、0.1.0-alpha.4 或 1.0.0');
  }
  assertSafe(input);
  if (!isObject(input)) throw new Error('配置必须是对象');
  const config = structuredClone(defaults);
  const changes = [];
  const report = (field, action, target = undefined) => changes.push({ field, action, ...(target ? { target } : {}) });
  const get = key => key.split('.').reduce((node, part) => isObject(node) && Object.hasOwn(node, part) ? node[part] : undefined, config);

  const assign = (source, target, value, action = 'copied') => {
    const current = get(target);
    if (current === undefined) { report(source, 'unsupported'); return; }
    if (typeof current !== typeof value || Array.isArray(current) !== Array.isArray(value) || value === null) {
      report(source, 'type-mismatch'); return;
    }
    const parts = target.split('.');
    const parent = parts.slice(0, -1).reduce((node, part) => node[part], config);
    parent[parts.at(-1)] = structuredClone(value);
    report(source, action, target);
  };

  const handled = new Set();
  const put = (source, target, value) => { assign(source, target, value, 'converted'); handled.add(source); };
  const discard = (key, action = 'removed-legacy-field') => { handled.add(key); report(key, action); };
  const own = (group, key) => isObject(input[group]) && Object.hasOwn(input[group], key);

  const index = isObject(input.index) ? input.index : {};
  if (own('index', 'index_layout') || own('index', 'post_layout')) {
    const current = String(index.index_layout ?? '');
    put('index.index_layout', 'home.index_layout', /^[1-7]$/.test(current) ? current : index.post_layout === 'tile' ? '6' : '3');
    if (own('index', 'post_layout')) discard('index.post_layout');
    if (!/^[1-7]$/.test(current) && index.post_layout === 'tile') report('index.post_layout', 'experience-changed');
  }

  const style = isObject(input.style) ? input.style : {};
  const dark = isObject(input.darkmode) ? input.darkmode : {};
  if (own('style', 'mode') || own('darkmode', 'autoChangeMode')) {
    const automatic = Number(dark.autoChangeMode);
    const mode = ['light', 'dark', 'system', 'schedule'].includes(style.mode) ? style.mode
      : automatic === 1 ? 'system' : automatic === 2 || style.mode === 'auto' ? 'schedule' : 'system';
    put('style.mode', 'appearance.mode', mode);
    if (own('darkmode', 'autoChangeMode')) discard('darkmode.autoChangeMode');
    if (style.mode === 'user' && ![1, 2].includes(automatic)) report('style.mode', 'experience-changed');
  }

  if (own('darkmode', 'start') || own('darkmode', 'end')) {
    const hour = (v, fallback) => {
      if (v === null || v === undefined || v === '') return fallback;
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 && n <= 24 ? n : null;
    };
    const oldStart = hour(dark.start, 6), oldEnd = hour(dark.end, 18);
    const reversed = oldStart !== null && oldEnd !== null && oldStart < oldEnd;
    let start = reversed ? oldEnd : oldStart, end = reversed ? oldStart : oldEnd;
    if (start !== null) start %= 24;
    if (end !== null) end %= 24;
    if (start === null || end === null || start === end) { start = 18; end = 6; report('darkmode.start/end', 'manual-review'); }
    put(reversed ? 'darkmode.end' : 'darkmode.start', 'appearance.darkmode.night_start', start);
    put(reversed ? 'darkmode.start' : 'darkmode.end', 'appearance.darkmode.night_end', end);
  }

  if (own('darkmode', 'enable')) {
    put('darkmode.button', 'appearance.darkmode.button', dark.enable !== false && dark.enable !== 'false' && dark.button !== false && dark.button !== 'false');
    discard('darkmode.enable');
  }

  for (const [group, name] of [['render', 'enable_code_expander'], ...(from === '2.0.5' ? [['code', 'enable_expander']] : [])]) {
    if (!own(group, name)) continue;
    const value = input[group][name];
    const converted = value === true || value === 'false' ? 'expanded' : value === false || value === 'none' ? 'disabled' : value === 'true' ? 'collapsed' : null;
    const key = `${group}.${name}`;
    if (converted) put(key, 'code.code_shrink', converted);
    else discard(key, 'manual-review');
  }

  if (own('index', 'enable_above')) {
    if (!own('single', 'enable_above')) put('single.enable_above', 'pages.single.enable_above', index.enable_above);
    if (!own('image', 'other_pages_above')) put('image.other_pages_above', 'home.image.other_pages_above', index.enable_above);
  }
  if (own('index', 'above_background')) report('index.above_background', 'removed-implicit-inheritance');

  const cdn = isObject(input.CDN) ? input.CDN : {};
  const expand = (value, name, version, file) => typeof value === 'string' ? value.replaceAll('${name}', name).replaceAll('${version}', version).replaceAll('${file}', file) : '';
  const safe = value => {
    if (typeof value !== 'string' || /[\s\\<>"'`$]/.test(value) || (!value.startsWith('https://') && !/^\/(?!\/)/.test(value))) return false;
    try { const url = new URL(value, 'https://example.invalid'); return !url.username && !url.password; } catch { return false; }
  };
  if (Object.keys(cdn).length) {
    const root = typeof cdn.asset_base === 'string' ? cdn.asset_base.trim() : '';
    if (cdn.internal_provider === 'local') {
      put('CDN.asset_base', 'general.cdn.asset_base', '');
      if (root || cdn.custom_format) report('CDN.asset_base', 'reset-assets-to-package');
    } else if (root) {
      const concrete = expand(root, 'halo-butterfly-next', targetVersion, '');
      if (!/\$\{(?!name\}|version\})/.test(root) && safe(concrete) && !/[?#]/.test(concrete)) put('CDN.asset_base', 'general.cdn.asset_base', root);
      else discard('CDN.asset_base', 'manual-review');
    } else if (cdn.internal_provider === 'custom' || (!cdn.internal_provider && cdn.custom_format)) {
      const template = typeof cdn.custom_format === 'string' ? cdn.custom_format.trim() : '';
      const prefix = template.endsWith('/${file}') ? template.slice(0, -8) : '';
      const concrete = expand(prefix, 'halo-butterfly-next', targetVersion, '');
      if (prefix && !/\$\{(?!name\}|version\})/.test(prefix) && safe(concrete) && !/[?#]/.test(concrete)) put('CDN.custom_format', 'general.cdn.asset_base', prefix);
      else report('CDN.custom_format', 'manual-review');
    }
    if (own('CDN', 'internal_provider')) discard('CDN.internal_provider');
    if (own('CDN', 'third_party_provider')) discard('CDN.third_party_provider', 'removed-feature');
    if (own('CDN', 'custom_format')) handled.add('CDN.custom_format');
  }

  if (own('share', 'use') && ['sharejs', 'addtoany'].includes(input.share.use)) {
    assign('share.use', 'post.share.use', 'native', 'experience-changed');
    handled.add('share.use');
  }
  if (input.busuanzi?.provider === 'busuanzi') {
    for (const key of ['site_pv', 'page_pv']) {
      assign(`busuanzi.${key}`, `post.stats.${key}`, false, 'experience-changed');
      handled.add(`busuanzi.${key}`);
    }
  }

  const removed = /^(?:(?:pjax|analytics|chat|google_adsense|ad)(?:\.|$)|moments\.(?:source|title|page_size|limit|since)$|links\.source$|loading\.instantpage$|wordcount\.total_wordcount$|busuanzi\.(?:provider|site_uv)$|share\.(?:sharejs|addtoany)(?:\.|$)|CDN\.option(?:\.|$)|aside\.card_newest_comments(?:\.|$)|aside\.enable_custom$|comments\.lazyload$|seo\.google_plus$|style\.font_family$|index\.(?:subtitle_source|typewriter_random_api|typewriter_api_value_format|enable_typewriter_random_text)$)/;

  const visit = (value, source) => {
    if (removed.test(source)) {
      report(source, source === 'style.font_family' ? 'reset-system-font' : 'removed-feature');
      return;
    }
    if (handled.has(source)) return;
    if (source === 'loading.source' || source === 'other') {
      report(source, 'reset-assets-to-package');
      return;
    }
    if (from === '2.0.5' && source === 'aside.button') {
      const parts = typeof value === 'string' ? value.split('&+&').map(part => part.trim()) : [];
      if (parts.length !== 2 || !parts.every(Boolean)) { report(source, 'manual-review'); return; }
      assign(source, 'aside.button', { name: parts[0], link: parts[1] }, 'converted');
      return;
    }
    if (from === '2.0.5' && source === 'socials.no_data') {
      if (!Array.isArray(value) || value.some(item => !isObject(item) || !['name', 'icon'].every(key => typeof item[key] === 'string') || (item.url != null && typeof item.url !== 'string'))) {
        report(source, 'manual-review');
        return;
      }
      assign(source, 'aside.social', value.map(item => ({ name: item.name, icon: item.icon, link: item.url ?? '' })), 'converted');
      value.forEach((item, i) => { if (item.url == null) report(`${source}.${i}.url`, 'manual-review'); });
      value.forEach((item, i) => Object.keys(item).filter(key => !['name', 'icon', 'url'].includes(key)).forEach(key => report(`${source}.${i}.${key}`, 'unsupported')));
      return;
    }
    if (from === '2.0.5' && source === 'index.typewriter') {
      if (typeof value !== 'string') { report(source, 'type-mismatch'); return; }
      assign(source, 'home.typewriter_custom_text', value.split('&+&').map(part => part.trim()).join('|&|'), 'converted');
      return;
    }
    if (isObject(value)) {
      for (const [key, child] of Object.entries(value)) visit(child, source ? `${source}.${key}` : key);
      return;
    }
    const v1Target = from === '2.0.5' ? legacy205ToV1[source] || source : source;
    const target = mapV1PathToV2(v1Target);
    if (source.endsWith('.above_background') && typeof value === 'string' && isLegacyBanner(value)) {
      assign(source, target, '/themes/halo-butterfly-next/assets/images/above.svg', 'reset-bundled-image');
      return;
    }
    assign(source, target, value, source === target ? 'copied' : 'converted');
  };

  visit(input, '');
  return {
    config,
    report: {
      from,
      targetTheme: 'halo-butterfly-next',
      targetVersion,
      changes,
      needsReview: changes.some(item => ['removed-feature', 'unsupported', 'manual-review', 'type-mismatch', 'experience-changed', 'removed-implicit-inheritance'].includes(item.action)),
    },
  };
}

export function asConfigMap(config) {
  return {
    apiVersion: 'v1alpha1',
    kind: 'ConfigMap',
    metadata: { name: 'halo-butterfly-next-configMap' },
    data: Object.fromEntries(Object.entries(config).map(([group, value]) => [group, JSON.stringify(value)])),
  };
}
