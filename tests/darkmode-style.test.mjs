import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';

const scss = await readFile(new URL('../src/scss/core/darkmode.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const rules = scss.replace(/\/\*[\s\S]*?\*\//g, '');

test('darkmode.scss 挂在 data-color-scheme，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "darkmode"/);
  assert.match(rules, /html\[data-color-scheme='dark'\]/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(scss, /th:utext/);
});

test('上游 CSS 变量与 Halo token 别名', () => {
  assert.match(scss, /--global-bg:\s*#0d0d0d/);
  assert.match(scss, /--card-bg:\s*#121212/);
  assert.match(scss, /--font-color:\s*rgba\(255,\s*255,\s*255,\s*0\.7\)/);
  assert.match(scss, /--btn-color:\s*#cccccc/);
  assert.match(scss, /--note-default-border:\s*#5a5a5a/);
  assert.match(scss, /--body-background:\s*var\(--global-bg\)/);
  assert.match(scss, /--text-color:\s*var\(--font-color\)/);
  assert.match(scss, /--card-background-color:\s*var\(--card-bg\)/);
});

test('覆盖层：web_bg、kbd、图片滤镜、侧栏虚线、Halo toc', () => {
  assert.match(scss, /#web_bg::before/);
  assert.match(scss, /background-color:\s*rgba\(0,\s*0,\s*0,\s*0\.7\)/);
  assert.match(scss, /\bkbd\b/);
  assert.match(scss, /img:not\(\.cover\)/);
  assert.match(scss, /brightness\(0\.88\)\s+contrast\(0\.95\)/);
  assert.match(scss, /\.aside-recent-post \.content > \.item:not\(:last-child\)/);
  assert.match(scss, /border-bottom:\s*1px dashed rgba\(255,\s*255,\s*255,\s*0\.1\)/);
  assert.match(scss, /\.aside-toc/);
  assert.match(scss, /max-width:\s*900px/);
});

test('本刀不改 enable/button 语义，不复用 aside.button', () => {
  assert.match(componentsHtml, /theme\.config\.darkmode\?\.enable != false/);
  assert.match(componentsHtml, /theme\.config\.darkmode\?\.button != false/);
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.doesNotMatch(scss, /aside\.button/);
  assert.match(settingsText, /name: hide_button/);
});
