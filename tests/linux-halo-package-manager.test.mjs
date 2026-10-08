import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import YAML from 'yaml';

const workflow = YAML.parse(readFileSync('.github/workflows/linux-halo-browser.yml', 'utf8'));
const selection = workflow.jobs.core.steps.find(step => step.id === 'theme-manager').run;
const execute = promisify(execFile);
const runSelection = (cwd, output) => execute('bash', ['-e', '-c', selection], {
  cwd, env: {...process.env, GITHUB_OUTPUT: output}, timeout: 10_000, killSignal: 'SIGKILL',
});

test('Linux harness accepts both fixed historical pnpm and migrated Bun source checkouts', async () => {
  for (const [manager, lock, engines, needsNode] of [
    ['pnpm@11.19.0', 'pnpm-lock.yaml', {node: '>=24 <25'}, true],
    ['bun@1.4.0', 'bun.lock', {node: '>=24 <25'}, true],
    ['bun@1.4.0', 'bun.lock', {bun: '1.4.0'}, false],
  ]) {
    const cwd = mkdtempSync(path.join(tmpdir(), 'halo-ci-manager-'));
    try {
      writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({packageManager: manager, engines}));
      writeFileSync(path.join(cwd, lock), 'fixture');
      const output = path.join(cwd, 'output');
      await runSelection(cwd, output);
      assert.equal(readFileSync(output, 'utf8'), `manager=${manager}\nneeds-node=${needsNode}\n`);
      rmSync(path.join(cwd, lock));
      await assert.rejects(runSelection(cwd, output), error => error.code === 1, 'missing frozen lock must fail');
    } finally { rmSync(cwd, {recursive: true, force: true}); }
  }
});

test('Linux harness rejects unpinned or unsupported source package managers', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'halo-ci-manager-'));
  try {
    for (const packageManager of ['bun@latest', 'pnpm@10.0.0', 'npm@11.0.0', undefined]) {
      writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({packageManager}));
      await assert.rejects(runSelection(cwd, path.join(cwd, 'output')), error => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /Unsupported source package manager/);
        return true;
      });
    }
  } finally { rmSync(cwd, {recursive: true, force: true}); }
});
