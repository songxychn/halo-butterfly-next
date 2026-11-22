import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  resolveClickTo,
  resolveEnable,
  resolveText,
  shouldRender,
  visibleQrItems,
} from '../src/js/core/reward.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('reward defaults and item resolvers', () => {
  assert.equal(defaults.post.reward.enable, false);
  assert.equal(defaults.post.reward.text, '');
  assert.deepEqual(defaults.post.reward.QR_code, []);
  assert.equal(resolveEnable(true), true);
  assert.equal(resolveEnable('true'), true);
  assert.equal(resolveEnable(false), false);
  assert.equal(resolveEnable(undefined), false);
  assert.equal(resolveText(''), '打赏');
  assert.equal(resolveText('Buy me a coffee'), 'Buy me a coffee');
  assert.equal(resolveClickTo({ img: '/a.png', link: '/pay' }), '/pay');
  assert.equal(resolveClickTo({ img: '/a.png', link: '  ' }), '/a.png');
  assert.deepEqual(visibleQrItems([{ img: '' }, { img: '/a.png' }]).map(item => item.img), ['/a.png']);
  assert.equal(shouldRender(true, [{ img: '/a.png' }]), true);
  assert.equal(shouldRender(true, []), false);
  assert.equal(shouldRender(false, [{ img: '/a.png' }]), false);
});
