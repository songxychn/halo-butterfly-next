import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const loadingScss = await readFile(new URL('../src/scss/core/loading.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const darkmodeScss = await readFile(new URL('../src/scss/core/darkmode.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const layoutHtml = await readFile(new URL('../src/html/views/layout.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = loadingScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('loading.scss 挂在 #loading-box，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "loading"/);
  assert.match(rules, /#loading-box/);
  assert.match(rules, /\.loading-left-bg/);
  assert.match(rules, /\.loading-right-bg/);
  assert.match(rules, /\.spinner-box/);
  assert.match(rules, /\.configure-border-1/);
  assert.match(rules, /\.configure-border-2/);
  assert.match(rules, /\.loading-word/);
  assert.match(rules, /\.configure-core/);
  assert.match(rules, /&\.loaded/);
  assert.doesNotMatch(layoutHtml, /id="loading-box"/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
});

test('上游全屏加载：半屏 50%、z-index 1000/1001、115px、#ffab91、.loaded 滑出', () => {
  assert.match(loadingScss, /z-index:\s*1000/);
  assert.match(loadingScss, /z-index:\s*1001/);
  assert.match(loadingScss, /width:\s*50%/);
  assert.match(loadingScss, /width:\s*115px/);
  assert.match(loadingScss, /height:\s*115px/);
  assert.match(loadingScss, /#ffab91/);
  assert.match(loadingScss, /rgb\(63,\s*249,\s*220\)/);
  assert.match(loadingScss, /left:\s*-115px/);
  assert.match(loadingScss, /var\(--preloader-bg,\s*#37474f\)/);
  assert.match(loadingScss, /var\(--preloader-color,\s*#fff\)/);
  assert.match(loadingScss, /configure-clockwise/);
  assert.match(loadingScss, /configure-xclockwise/);
  assert.match(loadingScss, /translate\(-100%, 0\)/);
  assert.match(loadingScss, /translate\(100%, 0\)/);
  assert.match(darkmodeScss, /--preloader-bg:\s*#0d0d0d/);
  assert.doesNotMatch(rules, /pace/);
});

test('本刀不接入 pace、不改 hide_button、不改文章上下篇 150px、无新增 th:utext', () => {
  assert.doesNotMatch(settingsText, /name:\s*preloader/);
  assert.doesNotMatch(settingsText, /pace_css_url/);
  assert.match(layoutHtml, /theme\.config\.loading\.type/);
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(componentsHtml, /id="pagination"/);
  assert.match(componentsHtml, /class="pagination-post"/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('编译后选择器挂在 #loading-box，无 data-theme，不把文章上下篇压掉', () => {
  const css = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#loading-box/);
  assert.match(css, /115px/);
  assert.match(css, /#ffab91/);
  assert.match(css, /configure-clockwise/);
  assert.match(css, /#pagination\.pagination-post/);
  assert.match(css, /height:\s*150px/);
  assert.doesNotMatch(css, /\[data-theme/);
});
