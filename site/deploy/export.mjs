#!/usr/bin/env node
// Export only source-authored public materials. Never read runtime credentials or databases.
import {mkdir, readFile, writeFile, copyFile, readdir} from 'node:fs/promises';
import {resolve, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {compile} from '../render.mjs';
const repo = fileURLToPath(new URL('../../', import.meta.url));
const mappingFile = process.argv[2];
if (!mappingFile) throw new Error('Usage: node site/deploy/export.mjs <verified-permalinks.json> [new-output-directory]');
const output = resolve(process.argv[3] || join(repo, '.runtime/hk-public-export'));
if (!output.startsWith(join(repo, '.runtime') + '/')) throw new Error('Export must stay in this checkout .runtime');
// mkdir without recursive prevents reusing an existing directory or symlink.
await mkdir(output, {mode: 0o700});
const manifest = JSON.parse(await readFile(join(repo, 'site/manifest.json')));
const assets = JSON.parse(await readFile(join(repo, 'site/assets/sources.json'))).assets;
const mapping = JSON.parse(await readFile(mappingFile));
const rendered = await compile(mapping);
for (const [source, destination] of [
  ['site/manifest.json', 'manifest.json'], ['site/config/theme-profile.json', 'theme-profile.json'],
  ['site/assets/sources.json', 'sources.json'],
  [`dist/halo-butterfly-next-${manifest.baseline.themeVersion}.zip`, `halo-butterfly-next-${manifest.baseline.themeVersion}.zip`],
]) await copyFile(join(repo, source), join(output, destination));
await writeFile(join(output, 'permalinks.json'), JSON.stringify(mapping, null, 2) + '\n');
await writeFile(join(output, 'rendered-public.json'), JSON.stringify(rendered, null, 2) + '\n');
await mkdir(join(output, 'assets'));
for (const asset of assets) await copyFile(join(repo, 'site', asset.file), join(output, asset.file));
const files = {};
for (const dir of [output, join(output, 'assets')]) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    if (entry.isFile()) {
      const file = join(dir, entry.name);
      files[relative(output, file)] = createHash('sha256').update(await readFile(file)).digest('hex');
    }
  }
}
await writeFile(join(output, 'checksums.json'), JSON.stringify(files, null, 2) + '\n');
console.log(JSON.stringify({output, documents: rendered.content.length, images: assets.length, files: Object.keys(files).length}));
