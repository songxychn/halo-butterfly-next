import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('home, aside, cover, and lazyload defaults are sane', () => {
  assert.equal(defaults.home.post_meta.tags, false);
  assert.equal(defaults.home.post_meta.categories, true);
  assert.equal(defaults.aside.enable_archives, true);
  assert.equal(defaults.home.cover.default_cover, '');
  assert.equal(defaults.interaction.lazyload.native, true);
  assert.equal(defaults.interaction.lazyload.blur, false);
});
