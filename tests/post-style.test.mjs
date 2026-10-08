import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const postScss = await readFile(new URL('../src/scss/core/post.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = postScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('post.scss 并列 #post / .post、.container / .render，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "post"/);
  assert.match(rules, /#post \.post-copyright/);
  assert.match(rules, /\.post \.copy-right/);
  assert.match(rules, /\.container,/);
  assert.match(rules, /\.render \{/);
  assert.match(postHtml, /class="render"/);
  assert.match(componentsHtml, /class="copy-right"/);
  assert.match(componentsHtml, /id="post-outdate-notice"/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
});

test('上游文章页：版权 40px / light-grey / hover 阴影，过期提醒 flat，kbd，tag_share', () => {
  assert.match(postScss, /margin:\s*40px 0 10px/);
  assert.match(postScss, /var\(--light-grey/);
  assert.match(postScss, /box-shadow:\s*0 0 8px 0 rgba\(232, 237, 250/);
  assert.match(postScss, /content:\s*"\\f1f9"/);
  assert.match(postScss, /#post-outdate-notice/);
  assert.match(postScss, /background-color:\s*#ffe6e6/);
  assert.match(postScss, /border-left:\s*5px solid #ff8080/);
  assert.match(postScss, /content:\s*"\\f071"/);
  assert.match(postScss, /\.num \{/);
  assert.match(postScss, /padding:\s*0 4px/);
  assert.match(postScss, /\.tag_share/);
  assert.match(postScss, /\.post-meta__tags/);
  assert.match(postScss, /border-radius:\s*12px/);
  assert.match(postScss, /kbd \{/);
  assert.match(postScss, /Monaco/);
  assert.match(postScss, /\.ads-wrap/);
  assert.match(postScss, /margin:\s*40px 0/);
  assert.match(postScss, /:focus-visible/);
  assert.match(postScss, /overflow-wrap:\s*anywhere/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、无新增 th:utext', () => {
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

test('编译后选择器并列文章页布局，无错误 BEM ID，不把文章上下篇压掉', () => {
  const css = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  const cssIndex = sass.compile(new URL('../src/scss/page/index.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#post \.post-copyright/);
  assert.match(css, /\.copy-right/);
  assert.match(css, /#post-outdate-notice/);
  assert.match(css, /kbd/);
  assert.match(css, /height:\s*150px/);
  assert.doesNotMatch(css, /#post-title/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.match(cssIndex, /\.container,/);
  assert.doesNotMatch(cssIndex, /\[data-theme/);
});
