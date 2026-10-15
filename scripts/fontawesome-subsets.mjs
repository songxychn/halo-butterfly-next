import { readFile, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
/** No font compiler at build time; pinned upstream files and generated subsets must match. */
export async function appendIconSubsets(upstream, subsets, destination) {
  const manifest = JSON.parse(await readFile(path.join(subsets, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 1 || manifest.upstreamVersion !== '6.7.2' || manifest.fonts?.length !== 3 || Object.keys(manifest.inputs ?? {}).length !== 9 || new Set(manifest.fonts.map(font => font.file)).size !== 3) throw new Error('Invalid FontAwesome subset manifest');
  for (const [file, expected] of Object.entries(manifest.inputs)) {
    if (!['css/all.min.css', 'LICENSE.txt', 'metadata/icon-families.json', 'webfonts/fa-solid-900.woff2', 'webfonts/fa-regular-400.woff2', 'webfonts/fa-brands-400.woff2', 'webfonts/fa-solid-900.ttf', 'webfonts/fa-regular-400.ttf', 'webfonts/fa-brands-400.ttf'].includes(file)) throw new Error('Unexpected FontAwesome input');
    if (digest(await readFile(path.join(upstream, file))) !== expected) throw new Error('FontAwesome input changed; regenerate subsets: ' + file);
  }
  const css = await readFile(path.join(subsets, 'subsets.css'));
  if (digest(css) !== manifest.cssSha256) throw new Error('FontAwesome subset CSS changed; regenerate subsets');
  for (const font of manifest.fonts) {
    if (!['butterfly-solid.woff2', 'butterfly-regular.woff2', 'butterfly-brands.woff2'].includes(font.file)) throw new Error('Unexpected subset filename');
    const file = path.join(subsets, font.file), data = await readFile(file);
    if (digest(data) !== font.sha256 || data.length !== font.bytes) throw new Error('FontAwesome subset changed; regenerate: ' + font.file);
    await cp(file, path.join(destination, 'webfonts', font.file));
  }
  const original = await readFile(path.join(upstream, 'css/all.min.css'));
  await writeFile(path.join(destination, 'css/all.min.css'), Buffer.concat([original, Buffer.from('\n'), css]));
  await cp(path.join(subsets, 'NOTICE.md'), path.join(destination, 'SUBSETS-NOTICE.md'));
}
