import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import { isNavAlwaysPinned, navScrollAppearance } from '../src/js/core/nav-scroll.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('navigation defaults keep nav unpinned with title and post title enabled', () => {
  assert.equal(defaults.nav.fixed, false);
  assert.equal(defaults.nav.logo, '');
  assert.equal(defaults.nav.display_title, true);
  assert.equal(defaults.nav.display_post_title, true);
  assert.equal(defaults.home.top_img_height, '');
  assert.equal(defaults.home.site_info_top, '');
});

test('nav scroll appearance handles both unpinned and pinned modes', () => {
  assert.equal(isNavAlwaysPinned(true), true);
  assert.equal(isNavAlwaysPinned(false), false);
  assert.equal(isNavAlwaysPinned(undefined), false);

  assert.deepEqual(navScrollAppearance({ scrollTop: 57, previousTop: 50 }), { style: true, active: false });
  assert.deepEqual(navScrollAppearance({ scrollTop: 80, previousTop: 90 }), { style: true, active: true });
  assert.deepEqual(navScrollAppearance({ scrollTop: 0, previousTop: 80 }), { style: false, active: false });
  assert.equal(navScrollAppearance({ scrollTop: 20, previousTop: 10 }), null);

  assert.deepEqual(navScrollAppearance({ scrollTop: 57, previousTop: 50, alwaysPinned: true }), { style: true, active: false });
  assert.deepEqual(navScrollAppearance({ scrollTop: 80, previousTop: 90, alwaysPinned: true }), { style: true, active: false });
  assert.deepEqual(navScrollAppearance({ scrollTop: 0, previousTop: 80, alwaysPinned: true }), { style: false, active: false });
});
