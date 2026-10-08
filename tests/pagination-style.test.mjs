import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const paginationScss = await readFile(new URL('../src/scss/core/pagination.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const componentsScss = await readFile(new URL('../src/scss/modules/components.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const paginationJs = await readFile(new URL('../src/js/modules/Pagination.ts', import.meta.url), 'utf8');
const rules = paginationScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('pagination.scss 并列 #pagination .pagination / .pagination，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "pagination"/);
  assert.match(rules, /#pagination \.pagination/);
  assert.match(rules, /\.layout \.pagination/);
  assert.match(paginationJs, /class="pagination"/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
});

test('上游列表分页：2.5em、6px、current、btn-hover、归档 30px；不套用插件分页', () => {
  assert.match(paginationScss, /width:\s*2\.5em/);
  assert.match(paginationScss, /height:\s*2\.5em/);
  assert.match(paginationScss, /margin:\s*6px/);
  assert.match(paginationScss, /background:\s*var\(--theme\)/);
  assert.match(paginationScss, /--btn-hover-color/);
  assert.match(paginationScss, /\.page-number\.current/);
  assert.match(paginationScss, /#archive \.pagination/);
  assert.match(paginationScss, /margin-top:\s*30px/);
  assert.match(paginationScss, /:not\(\.plugin-pagination\)/);
  assert.match(paginationScss, /:focus-visible/);
  assert.match(paginationScss, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(componentsScss, /width:\s*35px/);
});

test('本刀不改 hide_button、不改文章上下篇 DOM、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(componentsHtml, /id="pagination"/);
  assert.match(componentsHtml, /class="pagination-post"/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(paginationJs, /th:utext/);
});

test('编译后选择器并列列表分页，无错误 BEM ID，不把文章上下篇压成 2.5em', () => {
  const css = sass.compile(new URL('../src/scss/page/index.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  const cssPost = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#pagination \.pagination/);
  assert.match(css, /2\.5em/);
  assert.doesNotMatch(css, /#pagination-title/);
  assert.doesNotMatch(css, /#pagination-related/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.match(cssPost, /#pagination\.pagination-post/);
  assert.match(cssPost, /height:\s*150px/);
});
