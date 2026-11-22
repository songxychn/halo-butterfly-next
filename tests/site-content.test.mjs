import { test, afterEach } from 'bun:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSite } from '../site/check.mjs';

const cleanup = [];
afterEach(async () => {
  for (const directory of cleanup.splice(0)) await rm(directory, { recursive: true, force: true });
});

const source = fileURLToPath(new URL('../site', import.meta.url));

async function fixture(edit) {
  const directory = await mkdtemp(path.join(tmpdir(), 'hbn-site-check-'));
  cleanup.push(directory);
  const site = path.join(directory, 'site');
  await cp(source, site, { recursive: true });
  await edit(site);
  return site;
}

async function changeJson(site, relative, change) {
  const file = path.join(site, relative);
  const data = JSON.parse(await readFile(file, 'utf8'));
  change(data);
  await writeFile(file, JSON.stringify(data));
}

test('site content and theme profile are valid', async () => {
  const report = await checkSite();
  assert.ok(report.content >= 1);
  assert.ok(report.assets >= 1);
});

test('site check rejects duplicate ids and broken content links', async () => {
  const dup = await fixture(site => changeJson(site, 'manifest.json', manifest => {
    manifest.content[1].id = manifest.content[0].id;
  }));
  await assert.rejects(checkSite(dup), /duplicate id/);

  const broken = await fixture(site => writeFile(path.join(site, 'content/pages/docs.md'), '# 使用文档\n\n[失效链接](missing.md)\n'));
  await assert.rejects(checkSite(broken), /ENOENT/);
});

test('site check rejects paths escaping the site directory and unknown settings', async () => {
  const escape = await fixture(async site => {
    await writeFile(path.join(site, '../outside.md'), '# Outside\n');
    await changeJson(site, 'manifest.json', manifest => { manifest.content[0].file = '../outside.md'; });
  });
  await assert.rejects(checkSite(escape), /File outside scope/);

  const unknownSetting = await fixture(site => changeJson(site, 'config/theme-profile.json', profile => {
    profile.settings.__invalid_group__ = { foo: 'bar' };
  }));
  await assert.rejects(checkSite(unknownSetting), /Unknown theme settings group/);
});
