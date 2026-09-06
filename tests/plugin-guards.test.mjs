import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonical, validateTarget, disabledApiUnavailable } from '../scripts/plugins/diagnose.mjs';
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

test('P+ mutation guards preserve unowned content, drift and corrupt backups', () => {
  const result = spawnSync('python3', ['-B', path.join(repo, 'scripts/plugins/test_lab.py')], { encoding: 'utf8', cwd: repo });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
