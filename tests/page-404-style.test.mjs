import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const page404Scss = await readFile(new URL('../src/scss/core/page-404.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const error404Scss = await readFile(new URL('../src/scss/page/error404.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const errorHtml = await readFile(new URL('../src/html/error/404.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = page404Scss.replace(/\/\*[\s\S]*?\*\//g, '');

test('page-404.scss 挂在 .type-404 / #Butterfly.error404，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "page-404"/);
  assert.match(rules, /\.type-404/);
  assert.match(rules, /\.error-content/);
  assert.match(rules, /\.error-img/);
  assert.match(rules, /\.error_title/);
  assert.match(rules, /\.error_subtitle/);
  assert.match(rules, /#Butterfly\.error404/);
  assert.match(rules, /#error-content/);
  assert.match(rules, /\.error-card/);
  assert.match(rules, /\.nc/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(errorHtml, /class="type-404"/);
});

test('上游 404：360px / 500px、图文 50%、9em / 8em、subtitle clamp 2', () => {
  assert.match(page404Scss, /height:\s*360px/);
  assert.match(page404Scss, /height:\s*500px/);
  assert.match(page404Scss, /width:\s*50%/);
  assert.match(page404Scss, /height:\s*45%/);
  assert.match(page404Scss, /height:\s*55%/);
  assert.match(page404Scss, /font-size:\s*9em/);
  assert.match(page404Scss, /font-size:\s*8em/);
  assert.match(page404Scss, /font-size:\s*1\.6em/);
  assert.match(page404Scss, /-webkit-line-clamp:\s*2/);
  assert.match(page404Scss, /margin-top:\s*-\.6em/);
  assert.match(page404Scss, /margin-top:\s*-3em/);
  assert.match(page404Scss, /margin:\s*0 20px/);
  assert.match(error404Scss, /-webkit-line-clamp:\s*2/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.doesNotMatch(errorHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
  const error404Group = settingsText.slice(settingsText.indexOf('group: error404'));
  assert.doesNotMatch(error404Group.slice(0, 800), /name:\s*enable/);
});

test('Halo 404 不把 #rightside display:none；.type-404 + #rightside 仅空操作', () => {
  assert.match(page404Scss, /\.type-404/);
  assert.match(page404Scss, /& \+ #rightside/);
  assert.match(error404Scss, /&#Butterfly > #rightside/);
  assert.match(error404Scss, /position:\s*static/);
  assert.match(error404Scss, /opacity:\s*1/);
  const haloBlock = page404Scss.slice(page404Scss.lastIndexOf('#Butterfly.error404 {'));
  assert.doesNotMatch(haloBlock, /#rightside[^{]*\{[^}]*display:\s*none/s);
  assert.doesNotMatch(haloBlock, /width:\s*50%/);
  assert.doesNotMatch(haloBlock, /height:\s*45%/);
  assert.doesNotMatch(haloBlock, /height:\s*55%/);
  const type404 = page404Scss.slice(0, page404Scss.lastIndexOf('#Butterfly.error404 {'));
  assert.match(type404, /width:\s*50%/);
  assert.match(type404, /height:\s*45%/);
});

test('编译后选择器挂在 .type-404 / error404，无 data-theme，不把文章上下篇压掉', () => {
  const css = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.type-404/);
  assert.match(css, /\.error-content/);
  assert.match(css, /height:\s*360px/);
  assert.match(css, /height:\s*500px/);
  assert.match(css, /font-size:\s*9em/);
  assert.match(css, /-webkit-line-clamp:\s*2/);
  assert.match(css, /#Butterfly\.error404/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /#pagination\.pagination-post/);
  assert.match(css, /height:\s*150px/);
  assert.doesNotMatch(css, /\[data-theme/);
});

test('编译 error404.scss 后 grid 列不被 #Butterfly.error404 的 width/height 拆掉', () => {
  const css = sass.compile(new URL('../src/scss/page/error404.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /grid-template-columns:\s*1fr 1fr/);
  assert.match(css, /height:\s*225px/);
  assert.match(css, /\.type-404[^{]*\.error-img[^{]*\{[^}]*width:\s*50%/s);
  assert.doesNotMatch(css, /#Butterfly\.error404 \.error-art\s*\{[^}]*width:\s*50%/s);
  assert.doesNotMatch(css, /#Butterfly\.error404 \.error-info\s*\{[^}]*width:\s*50%/s);
  assert.doesNotMatch(css, /#Butterfly\.error404 \.error-art\s*\{[^}]*height:\s*45%/s);
});
