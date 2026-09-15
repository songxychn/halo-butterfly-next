import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const pageCommonScss = await readFile(new URL('../src/scss/core/page-common.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const layoutHtml = await readFile(new URL('../src/html/views/layout.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = pageCommonScss.replace(/\/\*[\s\S]*?\*\//g, '');
const mainRules = mainScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('page-common.scss 挂在 #body-wrap / .layout，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "page-common"/);
  assert.match(rules, /#body-wrap/);
  assert.match(rules, /\.layout\.hide-aside/);
  assert.match(rules, /\.main\.hide-aside/);
  assert.match(rules, /\.apple/);
  assert.match(mainRules, /\.layout/);
  assert.match(mainRules, /\.main/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(layoutHtml, /id="body-wrap"/);
});

test('上游页面通用：1200px、40px 15px、768 的 20px 5px、主栏 50px 40px、hide-aside 1000/1300', () => {
  assert.match(mainScss, /max-width:\s*1200px/);
  assert.match(mainScss, /padding:\s*40px 15px/);
  assert.match(mainScss, /padding:\s*20px 5px/);
  assert.match(mainScss, /padding:\s*50px 40px/);
  assert.match(mainScss, /padding:\s*36px 14px/);
  assert.match(mainScss, /flex:\s*1 auto/);
  assert.match(mainScss, /width:\s*74%/);
  assert.match(pageCommonScss, /max-width:\s*1000px/);
  assert.match(pageCommonScss, /max-width:\s*1300px/);
  assert.match(pageCommonScss, /background-attachment:\s*scroll\s*!important/);
  assert.match(pageCommonScss, /transform:\s*translateZ\(0\)/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.doesNotMatch(mainScss, /1250px/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(layoutHtml, /class="main"/);
  assert.match(componentsHtml, /id="pagination"/);
  assert.match(componentsHtml, /class="pagination-post"/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('编译后选择器挂在 #body-wrap / .layout，无 data-theme，不把文章上下篇压掉', () => {
  const css = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#body-wrap/);
  assert.match(css, /\.layout/);
  assert.match(css, /max-width:\s*1200px/);
  assert.match(css, /padding:\s*40px 15px/);
  assert.match(css, /\.apple/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /#pagination\.pagination-post/);
  assert.match(css, /height:\s*150px/);
  assert.doesNotMatch(css, /\[data-theme/);
});
