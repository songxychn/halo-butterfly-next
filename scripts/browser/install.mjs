import { copyFile, readFile, writeFile, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { FIXTURE, RUNTIME, ownRuntime, browserEnvironment, readJson, sha256 } from './support.mjs';

try {
  await ownRuntime();
  const env = browserEnvironment();
  const fixture = await readJson(path.join(FIXTURE, 'package.json'));
  const version = spawnSync('pnpm', ['--version'], { encoding: 'utf8', env });
  if (version.status !== 0 || version.stdout.trim() !== fixture.packageManager.split('@')[1]) throw new Error(`Use ${fixture.packageManager}; automatic package-manager installation is not permitted`);
  for (const name of ['package.json', 'pnpm-lock.yaml']) await copyFile(path.join(FIXTURE, name), path.join(RUNTIME, 'deps', name));
  const run = (command, args) => {
    const result = spawnSync(command, args, { cwd: path.join(RUNTIME, 'deps'), env, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.error?.message})`);
  };
  run('pnpm', ['install', '--ignore-workspace', '--frozen-lockfile', '--ignore-scripts', '--store-dir', path.join(RUNTIME, 'pnpm-store'), '--registry=https://registry.npmjs.org']);
  const actual = await readJson(path.join(RUNTIME, 'deps/node_modules/playwright/package.json'));
  if (actual.version !== fixture.dependencies.playwright) throw new Error('Installed Playwright version differs from pinned fixture');
  // This CLI installs only the three patched automation engines. Never use
  // channel chrome/msedge, install-deps, or an existing user profile.
  run(process.execPath, [path.join(RUNTIME, 'deps/node_modules/playwright/cli.js'), 'install', '--no-shell', 'chromium', 'firefox', 'webkit']);
  const require = createRequire(await realpath(path.join(RUNTIME, 'deps/node_modules/playwright/package.json')));
  const manifest = await readJson(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'browsers.json'));
  await writeFile(path.join(RUNTIME, 'installation.json'), JSON.stringify({ version: actual.version, packageManager: fixture.packageManager, lockSha256: sha256(await readFile(path.join(FIXTURE, 'pnpm-lock.yaml'))), engines: manifest.browsers, installedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log('Independent automation engines installed in', path.join(RUNTIME, 'browsers'));
} catch (error) {
  console.error('Browser installation failed:', error.message);
  process.exitCode = 1;
}
