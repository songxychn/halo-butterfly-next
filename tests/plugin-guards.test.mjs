import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonical, validateTarget, disabledApiUnavailable, paginationContext, paginationLink, assertMatchingPageItems } from '../scripts/plugins/diagnose.mjs';
const repo = fileURLToPath(new URL('../', import.meta.url));

test('P+ target requires matching owned runtime and distinct explicit loopback ports', () => {
  const marker = { owner: 'halo-butterfly-next-comparison', schema: 1, ports: { halo: 18094, hexo: 14004 } };
  const owner = { owner: 'halo-butterfly-next-plugin-lab', runtime: '/tmp/owned', ports: marker.ports };
  assert.deepEqual(validateTarget(marker, owner, '/tmp/owned'), { halo: 'http://127.0.0.1:18094', hexo: 'http://127.0.0.1:14004' });
  for (const changed of [{ ...owner, owner: 'other' }, { ...owner, runtime: '/tmp/other' }, { ...owner, ports: { halo: 18091, hexo: 14000 } }]) assert.throws(() => validateTarget(marker, changed, '/tmp/owned'));
  assert.throws(() => validateTarget({ ...marker, ports: { halo: 18094, hexo: 18094 } }, { ...owner, ports: { halo: 18094, hexo: 18094 } }, '/tmp/owned'));
});

test('canonical plugin lock hashing recursively sorts objects and preserves Unicode and list order', () => {
  assert.equal(canonical({ z: [{ y: '山川', a: 1 }], a: null }), '{"a":null,"z":[{"a":1,"y":"山川"}]}');
});

test('disabled API accepts only 404 or the observed same-site Halo authentication challenge', () => {
  assert.equal(disabledApiUnavailable(404, null), true);
  assert.equal(disabledApiUnavailable(302, '/login?authentication_required'), true);
  for (const [status, location] of [[200, null], [302, 'https://external.invalid/login'], [302, '/login'], [500, null]]) assert.equal(disabledApiUnavailable(status, location), false);
});

test('photo pagination preserves real size/group semantics and accepts query-relative/provider URLs', () => {
  const base = 'http://127.0.0.1:18094';
  const unfiltered = paginationContext('photos', base + '/photos', 20);
  assert.equal(paginationLink('/photos?page=2&size=20', unfiltered, 'next'), base + '/photos?page=2&size=20');
  const current = paginationContext('photos', base + '/photos?group=合成山川&size=5', 20);
  const provider = '/photos?page=2&size=5&group=' + encodeURIComponent('合成山川');
  assert.ok(paginationLink('?size=5&group=合成山川&page=2', current, 'next', provider));
  for (const wrong of ['/2', '/photos/page/2', '/photos?page=3&size=5&group=合成山川', '/photos?page=2&size=5', '/photos?page=2&group=合成山川', '/photos?page=2&size=20&group=合成山川', '/photos?page=2&page=3&size=5&group=合成山川', '//external.invalid/photos?page=2&size=5&group=合成山川']) assert.equal(paginationLink(wrong, current, 'next'), null, wrong);
  assert.equal(paginationLink(provider, current, 'next', 'https://external.invalid/photos?page=2'), null);
  const second = paginationContext('photos', base + provider, 20);
  assert.ok(paginationLink('/photos?page=1&size=5&group=合成山川', second, 'previous'));
});

test('moment pagination keeps tag and rejects query-page, wrong paths, filters or credentials', () => {
  const base = 'http://127.0.0.1:18094';
  const current = paginationContext('moments', base + '/moments?tag=山川', 10);
  assert.ok(paginationLink('/moments/page/2?tag=%E5%B1%B1%E5%B7%9D', current, 'next'));
  for (const wrong of ['/moments/page/2', '/moments/page/2?tag=星空', '/moments?page=2&tag=山川', '/moments/page/3?tag=山川', 'http://user@127.0.0.1:18094/moments/page/2?tag=山川']) assert.equal(paginationLink(wrong, current, 'next'), null, wrong);
  assert.equal(paginationLink('/moments?tag=山川', current, 'previous'), null);
  const second = paginationContext('moments', base + '/moments/page/2?tag=山川', 10);
  assert.ok(paginationLink('/moments?tag=山川', second, 'previous'));
});

test('P+ mutation guards preserve unowned content, drift and corrupt backups', () => {
  const result = spawnSync('python3', ['-B', path.join(repo, 'scripts/plugins/test_lab.py')], { encoding: 'utf8', cwd: repo });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('each rendered page must match its own API items, including order, duplicates and media', () => {
  const expected = [{ title: 'image 04', url: '/a.svg' }, { title: 'image 03', url: '/b.svg' }];
  assert.doesNotThrow(() => assertMatchingPageItems(structuredClone(expected), expected));
  for (const wrong of [
    [{ title: 'image 24', url: '/a.svg' }, { title: 'image 23', url: '/b.svg' }],
    [expected[0], expected[0]], [...expected].reverse(), [expected[0]],
    [{ ...expected[0], url: '/wrong.svg' }, expected[1]],
  ]) assert.throws(() => assertMatchingPageItems(wrong, expected), /current public API/);
  const moment = { text: 'A complete moment', media: [{ type: 'PHOTO', url: '/a.svg' }] };
  assert.throws(() => assertMatchingPageItems([{ ...moment, text: 'A complete moment plus unrelated text' }], [moment]), /current public API/);
  assert.throws(() => assertMatchingPageItems([{ ...moment, media: [] }], [moment]), /current public API/);
});
