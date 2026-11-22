import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  SHOW_PERCENT_MAX,
  resolveRightsideScrollPercent,
  shouldShowGoUpPercent,
  updateGoUpPercent,
} from '../src/js/core/rightside.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('rightside scroll_percent defaults and threshold behavior', () => {
  assert.equal(defaults.interaction.rightside.scroll_percent, false);
  assert.equal(resolveRightsideScrollPercent(undefined), false);
  assert.equal(resolveRightsideScrollPercent(true), true);
  assert.equal(resolveRightsideScrollPercent('true'), true);
  assert.equal(SHOW_PERCENT_MAX, 95);
  assert.equal(shouldShowGoUpPercent(0), true);
  assert.equal(shouldShowGoUpPercent(94), true);
  assert.equal(shouldShowGoUpPercent(95), false);

  const names = new Set();
  const goUp = {
    classList: {
      add(name) { names.add(name); },
      remove(name) { names.delete(name); },
    },
  };
  const percentEl = { textContent: '' };
  const ele = { clientHeight: 2000, offsetTop: 0 };
  const viewport = { innerHeight: 500, document: { documentElement: { scrollHeight: 2000 } } };
  updateGoUpPercent(goUp, percentEl, 0, ele, viewport);
  assert.equal(names.has('show-percent'), true);
  assert.equal(percentEl.textContent, '0');
  updateGoUpPercent(goUp, percentEl, 2000, ele, viewport);
  assert.equal(names.has('show-percent'), false);
});
