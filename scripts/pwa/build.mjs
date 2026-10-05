import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const haloJar = process.argv[2] || process.env.HALO_JAR_SOURCE;
if (!haloJar) throw new Error('Pass the pinned Halo 2.26.1 JAR: bun run pwa:build /path/to/halo-2.26.1.jar');
const directory = path.join(root, '.runtime/pwa-build/generated');
await mkdir(directory, { recursive: true });
const result = await build({ configFile: false, logLevel: 'error', build: {
  write: false, target: 'es2022', lib: {
    entry: path.join(root, 'plugins/pwa/src/entry.ts'), formats: ['iife'], name: 'ButterflyPwaWorker',
  },
} });
const code = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code;
const offline = await readFile(path.join(root, 'plugins/pwa/resources/offline.html'));
const revision = createHash('sha256').update(code).update(offline).digest('hex').slice(0, 20);
await writeFile(path.join(directory, 'sw.js'), code.replaceAll('__PWA_REVISION__', revision));
const run = spawnSync('python3', [path.join(root, 'scripts/pwa/build.py'), path.resolve(haloJar)], { cwd: root, stdio: 'inherit' });
if (run.status !== 0) process.exitCode = run.status || 1;
