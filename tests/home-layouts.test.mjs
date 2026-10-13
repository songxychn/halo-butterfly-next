import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
import {defaultsFromSettings, migrateConfig} from '../scripts/config-migration.mjs';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);

test('seven layouts have one default; tile is converted only by the offline importer', () => {
  const index = settings.spec.forms.find(form => form.group === 'index');
  const layout = index.formSchema.find(field => field.name === 'index_layout');
  assert.deepEqual(layout.options.map(option => option.value), ['1', '2', '3', '4', '5', '6', '7']);
  assert.equal(defaults.index.index_layout, '3');
  assert.equal('post_layout' in defaults.index, false);
  for (const from of ['2.0.5', '2.0.7']) {
    const migrated = migrateConfig({index: {post_layout: 'tile'}}, from, defaults);
    assert.equal('post_layout' in migrated.config.index, false);
    assert.equal(migrated.config.index.index_layout, '6');
  }
});

test('masonry is pinned to the actual upstream engine and shipped with complete fallback licenses', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.devDependencies['@egjs/infinitegrid'], '4.13.0');
  for (const name of ['egjs-infinitegrid-4.13.0', 'egjs-component-3.0.5', 'egjs-imready-1.4.2', 'cfcs-core']) {
    const license = await readFile(new URL(`../third-party-licenses/${name}-LICENSE.txt`, import.meta.url), 'utf8');
    assert.match(license, /Copyright/);
    assert.match(license, /Permission is hereby granted/);
    assert.match(license, /THE SOFTWARE IS PROVIDED/);
  }
});
