import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const chatScss = await readFile(new URL('../src/scss/core/chat.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = chatScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('chat.scss 挂在 #chatra:not(.chatra--expanded)，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "chat"/);
  assert.match(rules, /#chatra:not\(\.chatra--expanded\)/);
  assert.match(rules, /visibility:\s*hidden\s*!important/);
  assert.match(rules, /width:\s*1px\s*!important/);
  assert.match(rules, /height:\s*1px\s*!important/);
  assert.match(rules, /opacity:\s*0\s*!important/);
  assert.match(rules, /pointer-events:\s*none/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
});

test('本刀不接入聊天提供方、不改 hide_button、不改文章上下篇 150px、无新增 th:utext', () => {
  assert.doesNotMatch(settingsText, /name:\s*chatra/);
  assert.doesNotMatch(settingsText, /rightside_button/);
  assert.doesNotMatch(chatScss, /chatra\.io/);
  assert.doesNotMatch(componentsHtml, /id="chatra"/);
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

test('编译后选择器挂在 #chatra，无 data-theme，不把文章上下篇压掉', () => {
  const css = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#chatra:not\(\.chatra--expanded\)/);
  assert.match(css, /visibility:\s*hidden\s*!important/);
  assert.match(css, /width:\s*1px\s*!important/);
  assert.match(css, /#pagination\.pagination-post/);
  assert.match(css, /height:\s*150px/);
  assert.doesNotMatch(css, /\[data-theme/);
});
