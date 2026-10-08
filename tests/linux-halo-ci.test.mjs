import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {spawnSync} from 'node:child_process';

test('Linux CI only exports anonymous allowlisted artifacts and respects runtime ownership', () => {
  const result = spawnSync('python3', ['-B', 'scripts/ci/linux-halo/test_run.py'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
