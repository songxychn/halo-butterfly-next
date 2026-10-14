import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { t } from '../src/js/core/i18n.ts';

const root = new URL('../', import.meta.url);
async function files(dir) {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? files(new URL(e.name + '/', dir)) : new URL(e.name, dir)))).flat();
}
function messages(text) {
  const entries = text.split('\n').filter(line => line && !line.startsWith('#')).map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
  });
  assert.equal(new Set(entries.map(([key]) => key)).size, entries.length, 'duplicate messages');
  return Object.fromEntries(entries);
}
const names = ['default', 'en', 'ja', 'ko', 'zh', 'zh_CN', 'zh_HK', 'zh_TW'];
const catalogs = Object.fromEntries(await Promise.all(names.map(async name => [name, messages(await readFile(new URL(`i18n/${name}.properties`, root), 'utf8'))])));

test('all language catalogs cover identical keys and interpolation arguments', () => {
  for (const [name, catalog] of Object.entries(catalogs)) {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(catalogs.default).sort(), name);
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value.trim(), `${name}:${key}`);
      assert.deepEqual([...value.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), [...catalogs.default[key].matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), `${name}:${key}`);
    }
  }
  assert.equal(catalogs.en['ui.categories'], 'Categories');
  assert.equal(catalogs.ja['ui.categories'], 'カテゴリー');
  assert.equal(catalogs.ko['ui.categories'], '카테고리');
  assert.equal(catalogs.zh_TW['ui.tags'], '標籤');
});

test('every template/browser message reference exists and is safely inlined', async () => {
  for (const file of [...await files(new URL('src/html/', root)), ...await files(new URL('src/js/', root))]) {
    const text = await readFile(file, 'utf8');
    for (const [key] of text.matchAll(/ui\.[A-Za-z0-9]+/g)) assert.ok(catalogs.default[key], `${file}: ${key}`);
  }
  const config = await readFile(new URL('src/html/views/config.html', root), 'utf8');
  assert.match(config, /th:inline="javascript"/);
  assert.match(config, /\/\*\[\[#\{ui\.copyCode\}\]\]\*\//);
  const build = await readFile(new URL('scripts/build.mjs', root), 'utf8');
  assert.match(build, /filesUnder\(path.join\(root, 'i18n'\)\)/);
});

test('browser messages update after navigation and interpolate without executing markup', () => {
  const original = globalThis.window;
  try {
    globalThis.window = { MainApp: { messages: { 'ui.imageNumber': 'Image {0}: {1}' } } };
    assert.equal(t('ui.imageNumber', 2, '<img onerror=alert(1)>'), 'Image 2: <img onerror=alert(1)>');
    globalThis.window.MainApp.messages = { 'ui.imageNumber': '画像 {0}: {1}' };
    assert.equal(t('ui.imageNumber', 3, 'photo'), '画像 3: photo');
    assert.equal(t('ui.retry'), '重试');
    assert.equal(t('unknown'), 'unknown');
  } finally { if (original === undefined) delete globalThis.window; else globalThis.window = original; }
});

test('translating mixed content preserves share input and copyright links', async () => {
  const share = await readFile(new URL('src/html/views/share.html', root), 'utf8');
  const components = await readFile(new URL('src/html/views/components.html', root), 'utf8');
  assert.match(share, /<label><span th:text="#\{ui\.postLink\}">[^<]+<\/span> <input/);
  assert.match(components, /<span class="text"[^>]*><span th:text="#\{ui\.copyrightBefore\}">/);
  assert.doesNotMatch(components, /<span class="text" th:text="#\{ui\.copyrightBefore\}">/);
});


test('Moment fragment titles use a Thymeleaf message expression, not a bare utility call', async () => {
  for (const name of ['moments', 'moment']) {
    const html = await readFile(new URL(`src/html/${name}.html`, root), 'utf8');
    assert.match(html, /title = \$\{site\.title\} \+ ' - ' \+ #\{ui\.moments\}/);
  }
});

test('UI locale reads the active document on reentry and canonicalizes language tags', async () => {
  const {uiLocale}=await import('../src/js/core/i18n.ts');
  const root={documentElement:{lang:'zh-cn'}};
  assert.equal(uiLocale(root),'zh-CN');root.documentElement.lang='en';assert.equal(uiLocale(root),'en');
  for(const invalid of ['', 'not_a_locale']){root.documentElement.lang=invalid;assert.equal(uiLocale(root),'zh-CN');}
});
