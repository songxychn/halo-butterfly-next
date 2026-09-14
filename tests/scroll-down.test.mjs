import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

function indexFragment(headerHtml) {
  const start = headerHtml.indexOf('th:fragment="index"');
  assert.notEqual(start, -1);
  const end = headerHtml.indexOf('th:fragment="post"', start);
  assert.notEqual(end, -1);
  return headerHtml.slice(start, end);
}

test('header index 与首页第一屏含 #scroll-down / .scroll-down-effects', async () => {
  const header = await readFile(new URL('../src/html/views/header.html', import.meta.url), 'utf8');
  const indexFrag = indexFragment(header);
  assert.match(indexFrag, /id="scroll-down"/);
  assert.match(indexFrag, /class="fas fa-angle-down scroll-down-effects"/);
  assert.doesNotMatch(indexFrag, /display:\s*none/);

  const home = await readFile(new URL('../src/html/index.html', import.meta.url), 'utf8');
  assert.match(home, /id="scroll-down"/);
  assert.match(home, /class="fas fa-angle-down scroll-down-effects"/);
});

test('#scroll-down 有可见样式与点击滚到内容，不用 CSS 隐藏', async () => {
  const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
  assert.match(pageIndexScss, /#scroll-down/);
  assert.match(pageIndexScss, /scroll-down-effects/);
  assert.match(pageIndexScss, /@keyframes scroll-down-effect/);
  const scrollRule = pageIndexScss.slice(pageIndexScss.indexOf('#scroll-down {'), pageIndexScss.indexOf('.scroll-down-effects'));
  assert.match(scrollRule, /display:\s*flex/);
  assert.doesNotMatch(scrollRule, /display:\s*none/);
  assert.doesNotMatch(scrollRule, /useResponsive|@media/);

  const css = sass.compile(new URL('../src/scss/page/index.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#scroll-down/);
  assert.match(css, /scroll-down-effect/);
  assert.match(css, /#scroll-down[^{]*\{[^}]*display:\s*flex/);
  assert.doesNotMatch(css, /#scroll-down[^{]*\{[^}]*display:\s*none/);

  const commonJs = await readFile(new URL('../src/js/core/common.js', import.meta.url), 'utf8');
  assert.match(commonJs, /getElementById\('scroll-down'\)/);
  assert.match(commonJs, /#Butterfly > \.main/);
  assert.match(commonJs, /offsetTop/);
});
