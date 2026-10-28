import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile, mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { asConfigMap, defaultsFromSettings, migrateConfig, readConfig } from '../scripts/config-migration.mjs';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('2.0.5 converts real legacy groups and reports unimplemented options', () => {
  const input = { base: { metadata_name: 'writer' }, loading: { enable_random_img: false, random_img: 'https://example.invalid/image', preload: 'data:image/gif;base64,x' },
    aside: { enable: false, button: '关注我 &+& /about' }, index: { typewriter: '第一句 &+& 第二句', enable_above: false },
    code: { enable: false, enable_copy: false, theme_light: 'one-light' }, post: { out_date: 0, enable_reward: false },
    socials: { no_data: [{ name: 'GitHub', icon: '<i></i>', url: 'https://github.com/example' }] }, style: { font_family: 'no', content_max_width: '1200px' } };
  const before = structuredClone(input);
  const { config, report } = migrateConfig(input, '2.0.5', defaults);
  assert.equal(config.loading.img.random_enable, false);
  assert.equal(config.aside.enable, false);
  assert.deepEqual(config.aside.button, { name: '关注我', link: '/about' });
  assert.equal(config.index.typewriter_custom_text, '第一句|&|第二句');
  assert.equal(config.render.enable_code, false);
  assert.equal(config.render.enable_code_copy, false);
  assert.equal(config.style.font_family, 'null');
  assert.equal(config.aside.social[0].link, 'https://github.com/example');
  assert.equal(report.needsReview, true);
  for (const field of ['post.out_date', 'post.enable_reward', 'style.content_max_width']) assert(report.changes.some(item => item.field === field && item.action === 'unsupported'));
  assert.deepEqual(input, before);
});

test('2.0.7 preserves nested settings, isolates assets and keeps custom banners', () => {
  const result = migrateConfig({ loading: { source: { type: 'npm' }, img: { random_enable: true, random_link: 'https://example.invalid/random' } },
    nav: { font_color: { light: '#123456' } }, aside: { social: [] }, index: { above_background: 'https://example.invalid/custom.png' } }, '2.0.7', defaults);
  assert.equal(result.config.nav.font_color.light, '#123456');
  assert.equal(result.config.nav.font_color.dark, defaults.nav.font_color.dark);
  assert.equal(result.config.nav.fixed, false);
  assert.equal(result.config.nav.display_title, true);
  assert.equal(result.config.index.top_img_height, '');
  assert.equal(result.config.loading.img.random_enable, true);
  assert.equal(result.config.index.above_background, 'https://example.invalid/custom.png');
  assert.deepEqual(result.config.aside.social, []);
  assert(!Object.hasOwn(result.config.loading, 'source'));
  assert(result.report.changes.some(item => item.action === 'reset-assets-to-package'));
});

test('Halo ConfigMap input and output use independent identity', () => {
  const parsed = readConfig(JSON.stringify({ apiVersion: 'v1alpha1', kind: 'ConfigMap', metadata: { name: 'theme-butterfly-configMap' }, data: { aside: '{"enable":false}' } }));
  const output = asConfigMap(migrateConfig(parsed, '2.0.7', defaults).config);
  assert.equal(output.metadata.name, 'halo-butterfly-next-configMap');
  assert.equal(readConfig(JSON.stringify(output)).aside.enable, false);
  assert.throws(() => readConfig('{"kind":"ConfigMap","data":{"base":"not-json"}}'), /有效 JSON/);
});

test('published defaults use Fastly CDN and nullable social URLs', () => {
  const { config, report } = migrateConfig({ index: { above_background: 'https://fastly.jsdelivr.net/npm/halo-theme-butterfly@latest/above.png' },
    socials: { no_data: [{ name: 'GitHub', icon: '<i class="fa-brands fa-github"></i>', url: null }] } }, '2.0.5', defaults);
  assert.equal(config.index.above_background, '/themes/halo-butterfly-next/assets/images/above.svg');
  assert.equal(config.aside.social.length, 1);
  assert.equal(config.aside.social[0].link, '');
  assert(report.changes.some(item => item.field === 'socials.no_data.0.url' && item.action === 'manual-review'));
});

test('malformed input cannot pollute objects or silently coerce strings to booleans', () => {
  assert.throws(() => readConfig('{"base":{"__proto__":{"polluted":true}}}'), /不允许/);
  assert.throws(() => readConfig('[]'), /分组对象/);
  assert.throws(() => migrateConfig({}, 'latest', defaults), /明确指定/);
  const { config, report } = migrateConfig({ aside: { enable: 'false' } }, '2.0.7', defaults);
  assert.equal(config.aside.enable, defaults.aside.enable);
  assert.equal(report.needsReview, true);
  assert.equal(report.changes[0].action, 'type-mismatch');
});

test('CLI refuses existing files and leaves source contents unchanged', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'butterfly-migration-'));
  try {
    const input = path.join(dir, 'old.json'), output = path.join(dir, 'next.json');
    const original = '{"aside":{"enable":false}}';
    await writeFile(input, original);
    const run = () => spawnSync(process.execPath, [new URL('../scripts/migrate-config.mjs', import.meta.url).pathname, '--input', input, '--output', output, '--from', '2.0.7'], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    const generated = await readFile(output, 'utf8');
    assert.equal(JSON.parse(generated).aside.enable, false);
    const report = JSON.parse(await readFile(output + '.report.json', 'utf8'));
    const theme = parse(await readFile(new URL('../theme.yaml', import.meta.url), 'utf8'));
    assert.equal(report.targetVersion, theme.spec.version);
    assert.notEqual(run().status, 0);
    assert.equal(await readFile(output, 'utf8'), generated);
    assert.equal(await readFile(input, 'utf8'), original);
    assert.deepEqual((await readdir(dir)).sort(), ['next.json', 'next.json.report.json', 'old.json']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('scope reduction reports removed services without retaining credentials and changes sharing explicitly', () => {
  const input = {moments:{source:'/feed.json',limit:20,timezone:'UTC'},links:{source:'/links.json'},pjax:{enable:true},analytics:{umami_analytics:{token:'private-fixture'}},chat:{crisp:{website_id:'fixture'}},ad:{post:'<script>fixture</script>'},loading:{instantpage:true},wordcount:{total_wordcount:true},share:{use:'addtoany',addtoany:{item:'x'}},busuanzi:{provider:'busuanzi',site_uv:true,site_pv:true,page_pv:true},index:{subtitle_source:'custom',typewriter_random_api:'/old-api',typewriter_custom_text:'Keep'}};
  const before=structuredClone(input),{config,report}=migrateConfig(input,'0.1.0-alpha.4',defaults);
  assert.deepEqual(input,before);
  assert.equal(config.share.use,'native');
  assert.equal(config.busuanzi.site_pv,false);assert.equal(config.busuanzi.page_pv,false);
  assert.equal(config.index.typewriter_custom_text,'Keep');
  assert.equal(report.needsReview,true);
  for(const field of ['moments.source','moments.limit','links.source','pjax','analytics','chat','ad','loading.instantpage','wordcount.total_wordcount','share.addtoany','busuanzi.provider','busuanzi.site_uv','index.subtitle_source','index.typewriter_random_api']) assert.ok(report.changes.some(x=>x.field===field&&x.action==='removed-feature'),field);
  assert.doesNotMatch(JSON.stringify({config,report}),/private-fixture|old-api|<script>fixture/);
  for(const provider of ['halo',undefined]) {
    const kept=migrateConfig({busuanzi:{...(provider?{provider}:{}),site_pv:true,page_pv:true}},'0.1.0-alpha.4',defaults);
    assert.equal(kept.config.busuanzi.site_pv,true);assert.equal(kept.config.busuanzi.page_pv,true);
  }
});

test('removed comment controls and individual resources cannot survive migration', () => {
  const input = {comments:{lazyload:true,jump:true},aside:{card_newest_comments:{enable:true,storage:10}},CDN:{asset_base:'/theme-assets',option:{main:'https://obsolete.invalid/main.js',mermaid:'/custom-renderer.js'}}};
  const {config,report}=migrateConfig(input,'0.1.0-alpha.4',defaults);
  assert.equal(config.comments.jump,true);
  assert.equal(config.CDN.asset_base,'/theme-assets');
  for(const field of ['comments.lazyload','aside.card_newest_comments','CDN.option'])assert(report.changes.some(x=>x.field===field&&x.action==='removed-feature'),field);
  assert.equal(report.needsReview,true);
  assert.equal(config.comments.lazyload,undefined);
  assert.equal(config.aside.card_newest_comments,undefined);
  assert.equal(config.CDN.option,undefined);
  assert.doesNotMatch(JSON.stringify({config,report}),/obsolete.invalid|custom-renderer/);
});
