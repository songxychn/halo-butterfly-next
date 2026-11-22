#!/usr/bin/env bun
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve, join, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { compile, renderArticle } from '../render.mjs';

const [packagePath, outputPath] = process.argv.slice(2);
if (!packagePath || !outputPath) throw new Error('Usage: bundle.mjs <release-theme.zip> <new-output-directory>');
const output = resolve(outputPath);
if (!output.startsWith(resolve('.runtime') + '/')) throw new Error('Output must be under .runtime');
await mkdir(dirname(output), { recursive: true, mode: 0o700 });
await mkdir(output, { mode: 0o700 });

const manifest = JSON.parse(await readFile('site/manifest.json', 'utf8'));
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
if (basename(packagePath) !== `halo-butterfly-next-${version}.zip`) throw new Error('Release package filename/version mismatch');

const mapping = Object.fromEntries(manifest.content.map(x => [x.id, (x.kind === 'Post' ? '/archives/' : '/') + x.slug]));
const rendered = await compile(mapping);
manifest.baseline.themeVersion = version;
const published = process.env.DEMO_RELEASE === 'true';
const repo = process.env.GITHUB_REPOSITORY || 'songxychn/halo-butterfly-next';
manifest.publication.publicRelease = published;
manifest.publication.stage = published ? 'published-release' : 'development-rehearsal';
manifest.publication.downloadUrl = published ? `https://github.com/${repo}/releases/tag/v${version}` : null;
if (published) {
  const text = await readFile('site/demo/download.md', 'utf8');
  const body = text.replaceAll('{{version}}', version).replaceAll('{{releaseUrl}}', manifest.publication.downloadUrl);
  rendered.content.find(x => x.id === 'hbn-site-download').html = renderArticle(body, 'content/pages/download.md', rendered.fileUrls, manifest.routes);
}
for (const [name, data] of Object.entries({ 'manifest.json': manifest, 'permalinks.json': mapping, 'rendered-public.json': rendered })) {
  await writeFile(join(output, name), JSON.stringify(data, null, 2) + '\n');
}
const profile = JSON.parse(await readFile('site/config/theme-profile.json', 'utf8'));
if (published && profile.settings?.aside) {
  profile.settings.aside.notice = `Halo Butterfly Next ${version} 在线演示站，安装包与发行说明见下载页面。`;
}
await writeFile(join(output, 'theme-profile.json'), JSON.stringify(profile, null, 2) + '\n');
await copyFile('site/assets/sources.json', join(output, 'sources.json'));
await copyFile(packagePath, join(output, basename(packagePath)));
await mkdir(join(output, 'assets'));
const assets = JSON.parse(await readFile('site/assets/sources.json', 'utf8')).assets;
for (const a of assets) await copyFile(join('site', a.file), join(output, a.file));

const files = {};
for (const dir of ['', 'assets']) {
  for (const entry of await readdir(join(output, dir), { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = dir ? dir + '/' + entry.name : entry.name;
    files[name] = createHash('sha256').update(await readFile(join(output, name))).digest('hex');
  }
}
await writeFile(join(output, 'checksums.json'), JSON.stringify(files, null, 2) + '\n');
const identity = {
  schema: 1,
  version,
  tag: 'v' + version,
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  themeSha256: files[basename(packagePath)],
  published,
};
if (published) {
  const released = JSON.parse(await readFile(join(dirname(packagePath), 'release-identity.json'), 'utf8'));
  if (['tag', 'sourceSha', 'themeSha256'].some(k => released[k] !== identity[k])) throw new Error('Published release identity mismatch');
  identity.releaseId = released.releaseId;
  identity.themeAssetId = released.themeAssetId;
}
await writeFile(join(output, 'release.json'), JSON.stringify(identity, null, 2) + '\n');
