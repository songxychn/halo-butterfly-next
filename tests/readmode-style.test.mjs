import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';

const scss = await readFile(new URL('../src/scss/core/readmode.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const rules = scss.replace(/\/\*[\s\S]*?\*\//g, '');

test('readmode.scss 挂在 data-color-scheme，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "readmode"/);
  assert.match(rules, /body\.read-mode/);
  assert.match(rules, /html\[data-color-scheme='dark'\] body\.read-mode/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(scss, /th:utext/);
});

test('上游 CSS 变量与阅读模式覆盖', () => {
  assert.match(scss, /--font-color:\s*#4c4948/);
  assert.match(scss, /--readmode-light-color:\s*#fff/);
  assert.match(scss, /--highlight-bg:\s*#f7f7f7/);
  assert.match(scss, /--exit-btn-hover:\s*#8d8d8d/);
  assert.match(scss, /html\[data-color-scheme='dark'\] body\.read-mode[\s\S]*--highlight-bg:\s*#171717/);
  assert.match(scss, /html\[data-color-scheme='dark'\] body\.read-mode[\s\S]*--readmode-light-color:\s*#0d0d0d/);
  assert.match(scss, /#post-outdate-notice/);
  assert.match(scss, /#web_bg/);
  assert.match(scss, /\.code-toolbar/);
  assert.match(scss, /color:\s*var\(--font-color\)\s*!important/);
  assert.match(scss, /max-width:\s*768px/);
});

test('本刀不改 readmode 按钮语义，不复用 aside.button', () => {
  assert.match(componentsHtml, /id="readmode"/);
  assert.match(componentsHtml, /page == 'post'/);
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(componentsHtml, /theme\.config\.darkmode\?\.enable != false/);
  assert.doesNotMatch(scss, /aside\.button/);
  assert.match(settingsText, /name: hide_button/);
});
