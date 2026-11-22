import { test } from 'bun:test';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const execute = promisify(execFile);

test('demo bundling creates bundle and validates release identity', async () => {
  mkdirSync('.runtime', { recursive: true });
  const root = mkdtempSync('.runtime/demo-test-');
  try {
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
    const data = Buffer.from('fixture package');
    const packagePath = `${root}/halo-butterfly-next-${version}.zip`;
    writeFileSync(packagePath, data);
    const identity = {
      tag: `v${version}`,
      sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      themeSha256: createHash('sha256').update(data).digest('hex'),
      releaseId: 1,
      themeAssetId: 2,
    };
    writeFileSync(`${root}/release-identity.json`, JSON.stringify(identity));
    for (const published of [false, true]) {
      const output = `${root}/bundle-${published}`;
      await execute(process.execPath, ['site/demo/bundle.mjs', packagePath, output], {
        env: { ...process.env, DEMO_RELEASE: String(published) },
      });
      const rendered = JSON.parse(readFileSync(`${output}/rendered-public.json`, 'utf8')).content;
      const download = rendered.find(x => x.id === 'hbn-site-download').html;
      if (published) {
        assert.ok(download.includes(`/releases/tag/v${version}`));
      }
    }
    writeFileSync(`${root}/release-identity.json`, JSON.stringify({ ...identity, themeSha256: '0'.repeat(64) }));
    await assert.rejects(execute(process.execPath, ['site/demo/bundle.mjs', packagePath, `${root}/mismatch`], {
      env: { ...process.env, DEMO_RELEASE: 'true' },
    }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('release tag ordering rejects invalid tags', () => {
  execFileSync('python3', ['-B', '-c', `
import sys
sys.path.insert(0, 'scripts/release')
from common import version_key
versions = ['v0.1.0-alpha.2', 'v0.1.0-alpha.10', 'v0.1.0-beta.1', 'v0.1.0-rc.1', 'v0.1.0', 'v0.2.0-alpha.1', 'v2.0.0-alpha.1', 'v2.0.0']
assert sorted(versions, key=version_key) == versions
for invalid in ['v01.2.3', 'v1.2', 'v1.2.3; echo bad', 'master', 'v1.2.3-alpha.01']:
    try:
        version_key(invalid)
    except ValueError:
        pass
    else:
        raise AssertionError('Accepted invalid tag ' + invalid)
`], { stdio: 'pipe' });
});
