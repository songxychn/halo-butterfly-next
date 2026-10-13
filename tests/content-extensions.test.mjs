import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import * as sass from 'sass';
import {contentTabIndex} from '../src/js/core/content-extensions.ts';

test('one-based preferred tab rejects invalid values without hiding all panels', () => {
  for (const value of [null, '', '0', '-1', 'NaN', '2.5', '999', 'Infinity']) assert.equal(contentTabIndex(value, 2), 0);
  assert.equal(contentTabIndex('1', 2), 0);
  assert.equal(contentTabIndex('2', 2), 1);
});

test('portable fixture stores all content and native fallback links, never runtime-only hiding or JSON placeholders', async () => {
  const fixture = await readFile(new URL('../fixtures/content-extensions/article.html', import.meta.url), 'utf8');
  assert.doesNotMatch(fixture, /\{%|\bhidden(?:\s|=|>)|data-content-tabs-ready|role="tab(?:panel|list)?"|<script/i);
  for (const text of ['Docker 部署', '本地运行', 'macOS 的内容', '答案：', '海岸旅行', '森林记忆', '第一篇：部署']) assert.ok(fixture.includes(text));
  assert.match(fixture, /<details[^>]*><summary>/);
  assert.match(fixture, /<a href="\/lab\/cover-turquoise-coast.webp"><img/);
});

test('uninitialized groups remain visible; only ready groups hide, while print restores every panel', () => {
  const css = sass.compile(new URL('../src/scss/modules/content-extensions.scss', import.meta.url).pathname, {silenceDeprecations:['global-builtin']}).css;
  const hiddenRules = [...css.matchAll(/([^{}]+)\{([^{}]*display:\s*none;[^{}]*)\}/g)];
  assert.ok(hiddenRules.length >= 2);
  for (const [,selector] of hiddenRules) assert.ok(selector.includes('[data-content-tabs-ready]'), selector);
  assert.match(css, /@media print/);
  assert.match(css, /section\[hidden\][^{]*\{\s*display: block !important/);
  assert.doesNotMatch(css, /\.container|\.nav-tabs|\.tab-item-content|#Butterfly/);
});

test('content lab rejects missing ownership and mismatched ports before any theme activation', async () => {
  const runtime = await mkdtemp(join(tmpdir(), 'content-lab-guard-'));
  try {
    for (const marker of [null, {schema:1, owner:'another-task', ports:{halo:18531,hexo:14531}},
      {schema:1, owner:'halo-butterfly-next-comparison', ports:{halo:18541,hexo:14541}}]) {
      if (marker) await writeFile(join(runtime, 'lab.json'), JSON.stringify(marker));
      const result = spawnSync('python3', ['-B', 'scripts/content/lab.py', 'theme-earth'], {
        encoding:'utf8', env:{...process.env,LAB_RUNTIME:runtime,HALO_PORT:'18531',HEXO_PORT:'14531'},
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Content lab ownership\/ports differ/);
    }
  } finally { await rm(runtime, {recursive:true,force:true}); }
});
