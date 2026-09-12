import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const scss = await readFile(new URL('../src/scss/core/rightside.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const rules = scss.replace(/\/\*[\s\S]*?\*\//g, '');

test('rightside.scss 挂在 #rightside，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "rightside"/);
  assert.match(rules, /#rightside/);
  assert.match(scss, /rightside-show/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(scss, /th:utext/);
  assert.doesNotMatch(componentsHtml, /th:utext/);
});

test('上游定位、按钮 35px、btn token、mobile-toc、cubic-bezier', () => {
  assert.match(scss, /position:\s*fixed/);
  assert.match(scss, /right:\s*-48px/);
  assert.match(scss, /bottom:\s*var\(--rightside-bottom, 40px\)/);
  assert.match(scss, /z-index:\s*100/);
  assert.match(scss, /opacity:\s*0\.8/);
  assert.match(scss, /translate\(-58px, 0\)/);
  assert.match(scss, /width:\s*35px/);
  assert.match(scss, /height:\s*35px/);
  assert.match(scss, /background-color:\s*var\(--btn-bg, var\(--theme\)\)/);
  assert.match(scss, /var\(--btn-hover-color, #ff7242\)/);
  assert.match(scss, /#mobile-toc-button/);
  assert.match(scss, /&\.status/);
  assert.match(scss, /cubic-bezier\(0\.4, 0, 0\.2, 1\)/);
  assert.match(scss, /@keyframes fadeInScale/);
  assert.match(scss, /max-width:\s*900px/);
  assert.match(scss, /#hide-aside-btn/);
});

test('本刀不改 hide_button 语义，不复用 aside.button', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(componentsHtml, /class="side-btn"/);
  assert.match(componentsHtml, /id="rightside-config-hide"/);
  assert.doesNotMatch(scss, /aside\.button/);
  assert.match(settingsText, /name: hide_button/);
});
