import {test} from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readThemeArtifact } from '../scripts/navigation/artifact.mjs';

test('导航验收只读取当前版本产物，旧ZIP不能掩盖缺失的新包', async () => {
  const root = await mkdtemp(join(tmpdir(), 'navigation-artifact-'));
  try {
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'halo-butterfly-next', version: '0.1.0-alpha.2' }));
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist/halo-butterfly-next-0.1.0-alpha.1.zip'), 'old artifact');
    assert.throws(() => readThemeArtifact(root), /Build the current theme package.*alpha\.2\.zip/);
    await writeFile(join(root, 'dist/halo-butterfly-next-0.1.0-alpha.2.zip'), 'abc');
    assert.deepEqual(readThemeArtifact(root), {
      artifactFile: 'dist/halo-butterfly-next-0.1.0-alpha.2.zip', artifactVersion: '0.1.0-alpha.2',
      artifactSha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
