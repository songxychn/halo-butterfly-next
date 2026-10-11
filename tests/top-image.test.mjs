import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse, parseAllDocuments } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';

const source = await readFile(new URL('../src/js/above-background.ts', import.meta.url), 'utf8');
const code = new Bun.Transpiler({ loader: 'ts' }).transformSync(source);
function run(conf) {
  const requests = [];
  const properties = new Map();
  class Image {
    set src(value) { requests.push({ value, fail: () => this.onerror() }); }
  }
  const rootStyle = { setProperty: (name, value) => properties.set(name, value), removeProperty: name => properties.delete(name) };
  runInNewContext(code, { window: { MainApp: { conf } }, Image, document: {
    documentElement: { style: rootStyle }, createElement: () => ({ style: {} }),
  } });
  return { requests, properties };
}

test('disabled top image makes no decorative image requests', () => {
  for (const enable_above of [false, undefined, 'false']) {
    const { requests, properties } = run({ enable_above, above_background: '/cover.webp', above_background_fallback: '/default.webp' });
    assert.equal(requests.length, 0);
    assert.equal(properties.size, 0);
  }
});

test('broken primary falls back once, then removes the background without a retry loop', () => {
  const { requests, properties } = run({ enable_above: true, above_background: '/broken.webp', above_background_fallback: '/default.webp' });
  assert.equal(requests[0].value, '/broken.webp');
  requests[0].fail();
  assert.equal(requests[1].value, '/default.webp');
  assert.equal(properties.get('--above-background'), 'url("/default.webp")');
  requests[1].fail();
  assert.equal(properties.size, 0);
  assert.equal(requests.length, 2);
});

test('duplicate fallback and empty URLs do not repeat failed requests', () => {
  const { requests, properties } = run({ enable_above: true, above_background: ' /same.webp ', above_background_fallback: '/same.webp' });
  requests[0].fail();
  assert.equal(requests.length, 1);
  assert.equal(properties.size, 0);
  assert.equal(run({ enable_above: true, above_background: ' ', above_background_fallback: '' }).requests.length, 0);
});

test('image URLs remain a CSSOM value rather than injected HTML or CSS source', () => {
  const url = '/image?q="</style><script>alert(1)</script>\\';
  const { requests, properties } = run({ enable_above: true, above_background: url });
  assert.equal(requests[0].value, url);
  assert.equal(properties.get('--above-background'), `url(${JSON.stringify(url)})`);
});

test('new image defaults preserve saved configurations and expose only visibility metadata', async () => {
  const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
  const defaults = defaultsFromSettings(settings);
  assert.deepEqual(defaults.image, { disable_top_img: false, default_top_img: '' });
  assert.equal(defaults.index.enable_above, true);
  assert.equal(defaults.post.enable_above, true);
  const annotations = parseAllDocuments(await readFile(new URL('../annotation-setting.yaml', import.meta.url), 'utf8')).map(doc => doc.toJSON());
  for (const kind of ['Post', 'SinglePage']) {
    const form = annotations.find(doc => doc.spec.targetRef.kind === kind).spec.formSchema;
    const visibility = form.find(field => field.name === 'top_img_enable');
    assert.equal(visibility.value, 'inherit');
    assert.deepEqual(visibility.options.map(option => option.value), ['inherit', 'true', 'false']);
    assert.ok(!form.some(field => ['top_img', 'above_background'].includes(field.name)));
  }
});
