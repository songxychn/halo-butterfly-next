import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const headerScss = await readFile(new URL('../src/scss/core/header.scss', import.meta.url), 'utf8');
const navScss = await readFile(new URL('../src/scss/core/nav.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../src/html/index.html', import.meta.url), 'utf8');
const headerRules = headerScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('header.scss 并列 #page-header / .header，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "header"/);
  assert.match(headerRules, /#page-header/);
  assert.match(headerRules, /\.header/);
  assert.doesNotMatch(headerRules, /\[data-theme/);
  assert.doesNotMatch(headerScss, /th:utext/);
  assert.doesNotMatch(headerScss, /aside\.button/);
});

test('上游配色与高度：theme 背景、not-top-img、非首页 400/280、文章 400/360、full_page 100vh', () => {
  assert.match(headerScss, /background-color:\s*var\(--theme\)/);
  assert.match(headerScss, /&\.dp,\s*\n\s*&\.not-top-img|&\.not-top-img/);
  assert.match(headerScss, /height:\s*60px/);
  assert.match(headerScss, /background:\s*none/);
  assert.match(headerScss, /height:\s*400px/);
  assert.match(headerScss, /height:\s*280px/);
  assert.match(headerScss, /height:\s*360px/);
  assert.match(headerScss, /background-attachment:\s*fixed/);
  assert.match(pageIndexScss, /height:\s*100vh/);
  assert.match(headerScss, /overflow-wrap:\s*anywhere/);
  assert.match(headerScss, /#Butterfly\.mask-header &::before/);
});

test('#nav 定位仍走 .nav.style / .fixed / .active；本刀不改 hide_button', () => {
  assert.match(navScss, /z-index:\s*90/);
  assert.match(navScss, /z-index:\s*91/);
  assert.match(navScss, /top:\s*-60px/);
  assert.match(navScss, /&\.fixed/);
  assert.match(navScss, /&\.active/);
  assert.match(navScss, /translate3d\(0, 100%, 0\)/);
  assert.match(navScss, /backdrop-filter:\s*blur\(7px\)/);
  assert.match(navScss, /padding:\s*0 36px/);
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(indexHtml, /'header dp' : 'header'|class="header"/);
  assert.match(indexHtml, /class="above"/);
  assert.doesNotMatch(navScss, /aside\.button/);
  assert.doesNotMatch(navScss, /\[data-theme/);
});

test('编译后选择器并列 #page-header / .header，无错误 BEM ID', () => {
  const css = sass.compile(new URL('../src/scss/page/index.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  const cssPost = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#page-header/);
  assert.match(css, /\.header\.dp|\.header\.not-top-img/);
  assert.match(css, /background-attachment:\s*fixed/);
  assert.match(cssPost, /height:\s*360px/);
  assert.doesNotMatch(css, /#page-header-title/);
  assert.doesNotMatch(css, /#nav-title/);
  assert.doesNotMatch(css, /\[data-theme/);
});

test('编译 CSS：首页 above-title 默认 1.85em（390 约 25.9px），min-width 768px 才 2.85em（桌面约 39.9px）', () => {
  const css = sass.compile(new URL('../src/scss/page/index.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');

  function mediaInner(source, query) {
    const needle = `@media (${query})`;
    const inners = [];
    let searchFrom = 0;
    while (true) {
      const start = source.indexOf(needle, searchFrom);
      if (start < 0) break;
      const brace = source.indexOf('{', start);
      if (brace < 0) break;
      let depth = 0;
      let end = brace;
      for (; end < source.length; end++) {
        if (source[end] === '{') depth++;
        else if (source[end] === '}') {
          depth--;
          if (depth === 0) {
            end++;
            break;
          }
        }
      }
      inners.push(source.slice(brace + 1, end - 1));
      searchFrom = end;
    }
    return inners.join('\n');
  }

  function stripMedia(source) {
    let out = source;
    let searchFrom = 0;
    while (true) {
      const start = out.indexOf('@media', searchFrom);
      if (start < 0) break;
      const brace = out.indexOf('{', start);
      if (brace < 0) break;
      let depth = 0;
      let end = brace;
      for (; end < out.length; end++) {
        if (out[end] === '{') depth++;
        else if (out[end] === '}') {
          depth--;
          if (depth === 0) {
            end++;
            break;
          }
        }
      }
      out = out.slice(0, start) + out.slice(end);
      searchFrom = start;
    }
    return out;
  }

  const desktop = mediaInner(css, 'min-width: 768px');
  assert.match(desktop, /\.header \.above-title[^{]*\{[^}]*font-size:\s*2\.85em/);
  assert.match(headerScss, /font-size:\s*1\.85em/);
  assert.match(headerScss, /@media \(min-width: 768px\)/);
  const unscopedTitle = [...stripMedia(css).matchAll(/\.header \.above-title\s*\{([^}]*)\}/g)]
    .map(match => match[1])
    .join('\n');
  assert.match(unscopedTitle, /font-size:\s*1\.85em/);
  assert.doesNotMatch(unscopedTitle, /font-size:\s*2\.85em/);
});
