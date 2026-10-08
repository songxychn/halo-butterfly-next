import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';

const scss = await readFile(new URL('../src/scss/core/aside.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const asideHtml = await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8');
const rules = scss.replace(/\/\*[\s\S]*?\*\//g, '');

test('aside.scss 并列 #aside-content / .aside，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "main"/);
  assert.match(mainScss, /@import "aside"/);
  assert.match(rules, /#aside-content/);
  assert.match(rules, /\.aside/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(scss, /th:utext/);
});

test('上游宽度 26%、position padding、maxWidth900、card-widget、sticky、作者卡 token', () => {
  assert.match(scss, /width:\s*26%/);
  assert.match(mainScss, /width:\s*26%/);
  assert.match(mainScss, /padding-left:\s*15px/);
  assert.match(mainScss, /padding-right:\s*15px/);
  assert.match(mainScss, /&\.aside-right/);
  assert.match(mainScss, /&\.aside-left/);
  assert.match(scss, /max-width:\s*900px|900px/);
  assert.match(mainScss, /@media \(max-width: 900px\)/);
  assert.match(scss, /\.card-widget/);
  assert.match(scss, /padding:\s*20px 24px/);
  assert.match(scss, /\.sticky_layout/);
  assert.match(scss, /position:\s*sticky/);
  assert.match(scss, /\.item-headline/);
  assert.match(scss, /font-size:\s*1\.57em/);
  assert.match(scss, /#card-info-btn/);
  assert.match(scss, /background-color:\s*var\(--btn-bg, var\(--theme\)\)/);
  assert.match(scss, /var\(--btn-hover-color, #ff7242\)/);
  assert.match(scss, /overflow-wrap:\s*anywhere/);
});

test('本刀不改 hide_button 语义，不复用作者卡片按钮设置键，无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(asideHtml, /class="aside"/);
  assert.match(asideHtml, /class="aside-user card"/);
  assert.match(scss, /&:focus-visible/);
  assert.doesNotMatch(scss, /aside\.button/);
  assert.doesNotMatch(scss, /item_order/);
  assert.doesNotMatch(scss, /sort_order/);
});
