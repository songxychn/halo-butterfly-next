import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  formatTocNumber,
  getScrollPercent,
  numberTocItems,
  resolveCollapseDepth,
  resolveExpand,
  resolveNumber,
  resolveScrollPercent,
  resolveStyleSimple,
} from '../src/js/core/toc.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('toc defaults and option resolvers', () => {
  assert.equal(defaults.post.toc.post, true);
  assert.equal(defaults.post.toc.page, false);
  assert.equal(defaults.post.toc.number, true);
  assert.equal(defaults.post.toc.expand, false);
  assert.equal(defaults.post.toc.style_simple, false);
  assert.equal(defaults.post.toc.scroll_percent, true);
  assert.equal(resolveNumber(false), false);
  assert.equal(resolveNumber('false'), false);
  assert.equal(resolveNumber(undefined), true);
  assert.equal(resolveScrollPercent(false), false);
  assert.equal(resolveScrollPercent(null), true);
  assert.equal(resolveExpand(true), true);
  assert.equal(resolveExpand(false), false);
  assert.equal(resolveStyleSimple(true), true);
  assert.equal(resolveStyleSimple(false), false);
  assert.equal(resolveCollapseDepth(true), 6);
  assert.equal(resolveCollapseDepth(false), 0);
});

test('toc numbering and scroll percent calculation', () => {
  assert.equal(formatTocNumber([1]), '1.');
  assert.equal(formatTocNumber([1, 1]), '1.1.');
  assert.equal(formatTocNumber([2, 3, 1]), '2.3.1.');
  const numbered = numberTocItems([
    { text: 'A', children: [{ text: 'A1', children: [] }] },
    { text: 'B', children: [] },
  ]);
  assert.equal(numbered[0].number, '1.');
  assert.equal(numbered[0].children[0].number, '1.1.');
  assert.equal(numbered[1].number, '2.');

  const ele = { clientHeight: 2000, offsetTop: 0 };
  const viewport = { innerHeight: 500, document: { documentElement: { scrollHeight: 2000 } } };
  assert.equal(getScrollPercent(0, ele, viewport), 0);
  assert.equal(getScrollPercent(750, ele, viewport), 50);
  assert.equal(getScrollPercent(1500, ele, viewport), 100);
  assert.equal(getScrollPercent(9999, ele, viewport), 100);
  assert.equal(getScrollPercent(-10, ele, viewport), 0);
  assert.equal(getScrollPercent(10, null, viewport), 0);
});
