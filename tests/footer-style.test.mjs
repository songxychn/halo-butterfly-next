import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const scss = await readFile(new URL('../src/scss/core/footer.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const footerHtml = await readFile(new URL('../src/html/views/footer.html', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const rules = scss.replace(/\/\*[\s\S]*?\*\//g, '');

test('footer.scss 挂在 .footer/#footer，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "footer"/);
  assert.match(rules, /\.footer,\s*#footer|\.footer,\n#footer/);
  assert.match(scss, /#footer/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(scss, /th:utext/);
  assert.doesNotMatch(footerHtml, /th:utext/);
});

test('上游配色：theme 背景、light-grey 文字、mark-bg 遮罩、hover', () => {
  assert.match(scss, /background-color:\s*var\(--theme\)/);
  assert.match(scss, /color:\s*var\(--light-grey, #eeeeee\)/);
  assert.match(scss, /background-color:\s*var\(--mark-bg, rgba\(0, 0, 0, 0\.5\)\)/);
  assert.match(scss, /a[\s\S]*&:hover[\s\S]*color:\s*var\(--theme\)/);
  assert.match(scss, /background-attachment:\s*scroll/);
  assert.match(scss, /background-position:\s*bottom/);
  assert.match(scss, /background-size:\s*cover/);
  assert.match(scss, /footer--mask::before/);
  assert.match(scss, /\.footer-separator/);
  assert.match(scss, /\.icp-icon/);
  assert.match(scss, /justify-content:\s*space-between/);
  assert.match(scss, /padding:\s*40px 60px/);
  assert.match(scss, /max-width:\s*1200px/);
  assert.match(scss, /footer-other--nav/);
  assert.match(scss, /rgba\(0, 0, 0, 0\.1\)/);
  assert.match(scss, /\.footer-flex-items/);
  assert.match(scss, /\.footer-flex-title/);
  assert.match(scss, /max-width:\s*768px/);
});

test('390 不横向溢出；本刀不改模板语义，不复用 aside.button', () => {
  assert.match(scss, /overflow-wrap:\s*anywhere/);
  assert.match(scss, /word-break:\s*break-word/);
  assert.match(scss, /max-width:\s*100%/);
  assert.match(scss, /flex-wrap:\s*wrap/);
  assert.match(scss, /white-space:\s*pre-wrap/);
  assert.match(footerHtml, /class="footer"/);
  assert.match(footerHtml, /th:text="\$\{item\.title\}"/);
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.doesNotMatch(scss, /aside\.button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(scss, /text-decoration:\s*underline/);
  assert.match(scss, /&:focus-visible/);
});
