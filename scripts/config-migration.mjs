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
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) throw new Error(`不允许的配置字段：${key}`);
    assertSafe(child);
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

const legacyMappings = {
  'loading.enable_random_img': 'loading.img.random_enable',
  'loading.random_img': 'loading.img.random_link',
  'loading.preload': 'loading.img.preload',
  'loading.err': 'loading.img.err',
  'code.enable': 'render.enable_code',
  'code.enable_title': 'render.enable_code_title',
  'code.enable_hr': 'render.enable_code_hr',
  'code.enable_line': 'render.enable_code_line',
  'code.enable_copy': 'render.enable_code_copy',
  'code.enable_expander': 'render.enable_code_expander',
  'code.theme_light': 'render.code_theme_light',
  'code.theme_dark': 'render.code_theme_dark',
  'post.enable_h_title': 'render.enable_h_icon',
};

export function migrateConfig(input, from, defaults) {
  if (!['2.0.5', '2.0.7'].includes(from)) throw new Error('必须明确指定 --from 2.0.5 或 2.0.7');
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
  const visit = (value, source) => {
    // 旧的资源 CDN 指向原主题。独立版本只使用自身安装包中的 JS/CSS。
    if (source === 'loading.source' || source === 'other') {
      report(source, 'reset-assets-to-package'); return;
    }
    if (from === '2.0.5' && source === 'aside.button') {
      const parts = typeof value === 'string' ? value.split('&+&').map(part => part.trim()) : [];
      if (parts.length !== 2 || !parts.every(Boolean)) { report(source, 'manual-review'); return; }
      assign(source, 'aside.button', { name: parts[0], link: parts[1] }, 'converted'); return;
    }
    if (from === '2.0.5' && source === 'socials.no_data') {
      if (!Array.isArray(value) || value.some(item => !isObject(item) || !['name', 'icon'].every(key => typeof item[key] === 'string') || (item.url != null && typeof item.url !== 'string'))) {
        report(source, 'manual-review'); return;
      }
      assign(source, 'aside.social', value.map(item => ({ name: item.name, icon: item.icon, link: item.url ?? '' })), 'converted');
      value.forEach((item, i) => { if (item.url == null) report(`${source}.${i}.url`, 'manual-review'); });
      value.forEach((item, i) => Object.keys(item).filter(key => !['name', 'icon', 'url'].includes(key)).forEach(key => report(`${source}.${i}.${key}`, 'unsupported')));
      return;
    }
    if (from === '2.0.5' && source === 'index.typewriter') {
      if (typeof value !== 'string') { report(source, 'type-mismatch'); return; }
      assign(source, 'index.typewriter_custom_text', value.split('&+&').map(part => part.trim()).join('|&|'), 'converted'); return;
    }
    if (isObject(value)) {
      for (const [key, child] of Object.entries(value)) visit(child, source ? `${source}.${key}` : key);
      return;
    }
    const target = from === '2.0.5' ? legacyMappings[source] || source : source;
    if (source === 'style.font_family' && value !== 'null') {
      assign(source, target, 'null', 'reset-system-font'); return;
    }
    if (source.endsWith('.above_background') && typeof value === 'string' && isLegacyBanner(value)) {
      assign(source, target, '/themes/halo-butterfly-next/assets/images/above.svg', 'reset-bundled-image'); return;
    }
    assign(source, target, value, source === target ? 'copied' : 'converted');
  };
  visit(input, '');
  return { config, report: { from, targetTheme: 'halo-butterfly-next', targetVersion, changes,
    needsReview: changes.some(item => ['unsupported', 'manual-review', 'type-mismatch'].includes(item.action)) } };
}

export function asConfigMap(config) {
  return { apiVersion: 'v1alpha1', kind: 'ConfigMap', metadata: { name: 'halo-butterfly-next-configMap' },
    data: Object.fromEntries(Object.entries(config).map(([group, value]) => [group, JSON.stringify(value)])) };
}
