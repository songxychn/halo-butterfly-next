import {test} from 'bun:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('双站夹具的目录归属、凭据权限、漂移保护与重复初始化', () => {
  const result = spawnSync('python3', ['-B', 'scripts/lab/test_lab.py'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
});
