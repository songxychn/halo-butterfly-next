import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import { applyRelativeDates, formatRelative } from '../src/js/core/relative-date.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('post and home date_format defaults remain independent', () => {
  assert.equal(defaults.post.post_meta.date_format, 'date');
  assert.equal(defaults.home.post_meta.date_format, 'date');
  assert.equal(defaults.post.post_meta.tags, true);
  assert.equal(defaults.home.post_meta.tags, false);
});

test('formatRelative formats Chinese relative dates and preserves publish/update prefixes', () => {
  const now = Date.parse('2026-09-10T13:00:00Z');
  assert.equal(formatRelative('2026-09-10T12:59:30Z', now), '刚刚');
  assert.equal(formatRelative('2026-09-10T12:50:00Z', now), '10 分钟前');
  assert.equal(formatRelative('2026-09-10T10:00:00Z', now), '3 小时前');
  assert.equal(formatRelative('2026-09-08T13:00:00Z', now), '2 天前');
  assert.equal(formatRelative('not-a-date', now), '');

  const nodes = [
    { getAttribute: () => '2026-09-10T12:50:00Z', textContent: '发布于 2026-09-10' },
    { getAttribute: () => '2026-09-08T13:00:00Z', textContent: '2026-09-08' },
    { getAttribute: () => '2026-09-10T10:00:00Z', textContent: '更新于 2026-09-10' },
    { getAttribute: () => '2026-09-10T12:50:00Z', textContent: '发表于 2026-09-10' },
  ];
  applyRelativeDates({ querySelectorAll: () => nodes }, now);
  assert.equal(nodes[0].textContent, '发布于 10 分钟前');
  assert.equal(nodes[1].textContent, '2 天前');
  assert.equal(nodes[2].textContent, '更新于 3 小时前');
  assert.equal(nodes[3].textContent, '发表于 10 分钟前');
});
