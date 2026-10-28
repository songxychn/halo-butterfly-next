import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { formatMomentDate, nativeMomentPage } from '../src/js/core/moments.ts';
const origin = 'https://blog.example';
test('native jump preserves encoded tags and checks route, integer and page bounds', () => {
  assert.equal(nativeMomentPage(origin + '/moments/page/2?tag=%E5%B1%B1%E5%B7%9D', 1, 3), '/moments?tag=%E5%B1%B1%E5%B7%9D');
  assert.equal(nativeMomentPage(origin + '/moments', 3, 3), '/moments/page/3');
  for (const page of [0, 4, NaN, 1.5, Infinity]) assert.equal(nativeMomentPage(origin + '/moments', page, 3), null);
  assert.equal(nativeMomentPage(origin + '/moments/secret', 2, 3), null);
});
test('explicit timezones make day boundaries independent of the browser; invalid zones fall back UTC', () => {
  assert.match(formatMomentDate('2026-10-14T20:00:00Z', 'Asia/Shanghai'), /2026\/10\/15/);
  assert.match(formatMomentDate('2026-10-14T20:00:00Z', 'UTC'), /2026\/10\/14/);
  assert.equal(formatMomentDate('2026-10-14T20:00:00Z', 'bad-zone'), formatMomentDate('2026-10-14T20:00:00Z', 'UTC'));
});
