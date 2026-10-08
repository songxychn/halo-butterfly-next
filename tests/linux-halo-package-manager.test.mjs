import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import YAML from 'yaml';

const workflow = YAML.parse(readFileSync('.github/workflows/linux-halo-browser.yml', 'utf8'));
const selection = workflow.jobs.core.steps.find(step => step.id === 'theme-manager').run;

test('Linux harness accepts both fixed historical pnpm and migrated Bun source checkouts', () => {
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
      const result = spawnSync('bash', ['-e', '-c', selection], {cwd, env: {...process.env, GITHUB_OUTPUT: output}, encoding: 'utf8'});
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(output, 'utf8'), `manager=${manager}\nneeds-node=${needsNode}\n`);
      rmSync(path.join(cwd, lock));
      assert.notEqual(spawnSync('bash', ['-e', '-c', selection], {cwd, env: {...process.env, GITHUB_OUTPUT: output}}).status, 0, 'missing frozen lock must fail');
    } finally { rmSync(cwd, {recursive: true, force: true}); }
  }
});

test('Linux harness rejects unpinned or unsupported source package managers', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'halo-ci-manager-'));
  try {
    for (const packageManager of ['bun@latest', 'pnpm@10.0.0', 'npm@11.0.0', undefined]) {
      writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({packageManager}));
      const result = spawnSync('bash', ['-e', '-c', selection], {cwd, env: {...process.env, GITHUB_OUTPUT: path.join(cwd, 'output')}, encoding: 'utf8'});
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Unsupported source package manager/);
    }
  } finally { rmSync(cwd, {recursive: true, force: true}); }
});
