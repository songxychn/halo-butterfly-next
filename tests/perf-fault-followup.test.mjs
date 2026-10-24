import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('故障验收共享互斥、真实子进程组退出及预检失败恢复', () => {
  const result = spawnSync('python3', ['-B', 'scripts/perf/test_fault_followup.py'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 20000,
  });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
});
