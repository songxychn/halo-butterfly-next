import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {readFile} from 'node:fs/promises';
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
