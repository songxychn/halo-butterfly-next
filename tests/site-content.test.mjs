import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSite } from '../site/check.mjs';

const source = fileURLToPath(new URL('../site', import.meta.url));

async function fixture(t, edit) {
  const directory = await mkdtemp(path.join(tmpdir(), 'hbn-site-check-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
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

test('site content is complete and remains an unpublished preview', async () => {
  const report = await checkSite();
  assert.equal(report.content, 19);
  assert.equal(report.assets, 14);
  assert.equal(report.publication, 'private-preview');
});

test('site check rejects conflicting identities before any content synchronization', async t => {
  const site = await fixture(t, site => changeJson(site, 'manifest.json', manifest => {
    manifest.content[1].id = manifest.content[0].id;
  }));
  await assert.rejects(checkSite(site), /duplicate id/);
});

test('site check detects broken content links', async t => {
  const site = await fixture(t, site => writeFile(path.join(site, 'content/pages/docs.md'), '# 使用文档\n\n[失效链接](missing.md)\n'));
  await assert.rejects(checkSite(site), /ENOENT/);
});

test('site check rejects paths escaping the site directory', async t => {
  const site = await fixture(t, async site => {
    await writeFile(path.join(site, '../outside.md'), '# Outside\n');
    await changeJson(site, 'manifest.json', manifest => { manifest.content[0].file = '../outside.md'; });
  });
  await assert.rejects(checkSite(site), /File outside scope/);
});

test('site check catches changed media provenance and unknown theme fields', async t => {
  const site = await fixture(t, async site => {
    await writeFile(path.join(site, 'assets/lake.webp'), '<svg viewBox="0 0 10 10"><title>Changed</title><desc>Different image</desc></svg>');
    await changeJson(site, 'config/theme-profile.json', profile => { profile.settings.index.hero_buttons = []; });
  });
  await assert.rejects(checkSite(site), error => {
    assert.match(error.message, /asset digest differs/);
    assert.match(error.message, /Unknown theme setting index.hero_buttons/);
    return true;
  });
});

test('site check rejects downloads and enabled public links before publication', async t => {
  const site = await fixture(t, site => changeJson(site, 'manifest.json', manifest => {
    manifest.publication.downloadUrl = 'https://example.com/unreleased.zip';
    manifest.navigation.find(item => item.label === 'GitHub').enabled = true;
  }));
  await assert.rejects(checkSite(site), error => {
    assert.match(error.message, /must not advertise an installation download/);
    assert.match(error.message, /missing public URL/);
    return true;
  });
});
