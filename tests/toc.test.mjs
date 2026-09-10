import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  formatTocNumber,
  getScrollPercent,
  numberTocItems,
  resolveCollapseDepth,
  resolveExpand,
  resolveNumber,
  resolveScrollPercent,
  resolveStyleSimple,
} from '../src/js/core/toc.mjs';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const aside = await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const pageHtml = await readFile(new URL('../src/html/page.html', import.meta.url), 'utf8');
const renderJs = await readFile(new URL('../src/js/modules/Render.js', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/modules/render.scss', import.meta.url), 'utf8');

function tocForm() {
  const form = settings.spec.forms.find(item => item.group === 'toc');
  assert.ok(form, 'toc');
  return form;
}

function field(name) {
  const node = tocForm().formSchema.find(item => item.name === name);
  assert.ok(node, name);
  return node;
}

function fragment(html, name, stop) {
  const start = html.indexOf(`th:fragment="${name}"`);
  assert.notEqual(start, -1, name);
  const end = stop ? html.indexOf(stop, start) : html.length;
  assert.notEqual(end, -1, stop || 'eof');
  return html.slice(start, end);
}

test('默认对齐上游 SHA：number true、expand false、style_simple false、scroll_percent true', () => {
  assert.equal(defaults.toc.number, true);
  assert.equal(defaults.toc.expand, false);
  assert.equal(defaults.toc.style_simple, false);
  assert.equal(defaults.toc.scroll_percent, true);
  assert.equal(field('number').value, true);
  assert.deepEqual(field('number').options.map(option => option.value), [true, false]);
  assert.equal(field('expand').value, false);
  assert.deepEqual(field('expand').options.map(option => option.value), [true, false]);
  assert.equal(field('style_simple').value, false);
  assert.deepEqual(field('style_simple').options.map(option => option.value), [true, false]);
  assert.equal(field('scroll_percent').value, true);
  assert.deepEqual(field('scroll_percent').options.map(option => option.value), [true, false]);
  assert.match(String(field('number').help), /toc\.number/);
  assert.match(String(field('expand').help), /toc\.expand/);
  assert.match(String(field('style_simple').help), /toc\.style_simple/);
  assert.match(String(field('scroll_percent').help), /toc\.scroll_percent/);
  assert.match(String(field('number').help), /不做 toc\.post/);
  assert.match(String(field('style_simple').help), /不做 related_post/);
  assert.match(String(field('scroll_percent').help), /不做 rightside_scroll_percent/);
  assert.equal(resolveNumber(defaults.toc.number), true);
  assert.equal(resolveExpand(defaults.toc.expand), false);
  assert.equal(resolveStyleSimple(defaults.toc.style_simple), false);
  assert.equal(resolveScrollPercent(defaults.toc.scroll_percent), true);
});

test('resolveNumber / scroll_percent：仅显式 false 关闭；expand / style_simple：仅显式 true 开启', () => {
  assert.equal(resolveNumber(false), false);
  assert.equal(resolveNumber('false'), false);
  assert.equal(resolveNumber(true), true);
  assert.equal(resolveNumber('true'), true);
  assert.equal(resolveNumber(null), true);
  assert.equal(resolveNumber(''), true);
  assert.equal(resolveScrollPercent(false), false);
  assert.equal(resolveScrollPercent('false'), false);
  assert.equal(resolveScrollPercent(null), true);
  assert.equal(resolveExpand(true), true);
  assert.equal(resolveExpand('true'), true);
  assert.equal(resolveExpand(false), false);
  assert.equal(resolveExpand(null), false);
  assert.equal(resolveStyleSimple(true), true);
  assert.equal(resolveStyleSimple('true'), true);
  assert.equal(resolveStyleSimple(false), false);
  assert.equal(resolveStyleSimple(null), false);
  assert.equal(resolveCollapseDepth(true), 6);
  assert.equal(resolveCollapseDepth(false), 0);
  assert.equal(resolveCollapseDepth(null), 0);
});

test('序号形如 1. / 1.1.；getScrollPercent 对齐 btf 并夹在 0–100', () => {
  assert.equal(formatTocNumber([1]), '1.');
  assert.equal(formatTocNumber([1, 1]), '1.1.');
  assert.equal(formatTocNumber([2, 3, 1]), '2.3.1.');
  const numbered = numberTocItems([
    { text: 'A', children: [{ text: 'A1', children: [] }] },
    { text: 'B', children: [] },
  ]);
  assert.equal(numbered[0].number, '1.');
  assert.equal(numbered[0].children[0].number, '1.1.');
  assert.equal(numbered[1].number, '2.');

  const ele = { clientHeight: 2000, offsetTop: 0 };
  const viewport = { innerHeight: 500, document: { documentElement: { scrollHeight: 2000 } } };
  assert.equal(getScrollPercent(0, ele, viewport), 0);
  assert.equal(getScrollPercent(750, ele, viewport), 50);
  assert.equal(getScrollPercent(1500, ele, viewport), 100);
  assert.equal(getScrollPercent(9999, ele, viewport), 100);
  assert.equal(getScrollPercent(-10, ele, viewport), 0);
  assert.equal(getScrollPercent(10, null, viewport), 0);
});

test('文章页注入 conf；单页不注入；style_simple 仅文章侧栏', () => {
  assert.match(postHtml, /toc_number: \/\*\[\[\$\{theme\.config\.toc\.number\}\]\]\*\/ true/);
  assert.match(postHtml, /toc_expand: \/\*\[\[\$\{theme\.config\.toc\.expand\}\]\]\*\/ false/);
  assert.match(postHtml, /toc_scroll_percent: \/\*\[\[\$\{theme\.config\.toc\.scroll_percent\}\]\]\*\/ true/);
  assert.doesNotMatch(pageHtml, /toc_number/);
  assert.doesNotMatch(pageHtml, /theme\.config\.toc/);
  assert.doesNotMatch(pageHtml, /aside-toc/);
  assert.doesNotMatch(postHtml, /anchor\.auto_update/);
  assert.doesNotMatch(postHtml, /anchor\.click_to_scroll/);

  const postAside = fragment(aside, 'post');
  assert.match(postAside, /toc-percentage/);
  assert.match(postAside, /th:if="\$\{tocPercent\}"/);
  assert.match(postAside, /is-numbered/);
  assert.match(postAside, /is-expand/);
  assert.match(postAside, /th:unless="\$\{tocSimple\}"/);
  assert.match(postAside, /::recentPost/);
  assert.doesNotMatch(postAside, /th:utext/);
  assert.doesNotMatch(postAside, /related_post/);
  assert.doesNotMatch(postAside, /anchor/);

  const common = fragment(aside, 'common', 'th:fragment="post"');
  assert.match(common, /::recentPost/);
  assert.doesNotMatch(common, /tocSimple/);
  assert.doesNotMatch(common, /aside-toc/);
});

test('Render 接线 number / expand / scroll_percent；百分比 textContent 非 HTML', () => {
  assert.match(renderJs, /from '\.\.\/core\/toc\.mjs'/);
  assert.match(renderJs, /collapseDepth: resolveCollapseDepth\(this\.#conf\.toc_expand\)/);
  assert.match(renderJs, /applyTocNumbers\(tocEl, resolveNumber\(this\.#conf\.toc_number\)\)/);
  assert.match(renderJs, /percentEl\.textContent = String\(getScrollPercent\(scrollTop, article\)\)/);
  assert.match(renderJs, /resolveScrollPercent\(this\.#conf\.toc_scroll_percent\)/);
  assert.doesNotMatch(renderJs, /innerHTML.*toc-percentage/);
  assert.doesNotMatch(renderJs, /anchor\.auto_update/);
});

test('窄屏不横向溢出；折叠与百分比样式', () => {
  assert.match(scss, /\.toc-percentage/);
  assert.match(scss, /overflow-wrap:\s*anywhere/);
  assert.match(scss, /word-break:\s*break-word/);
  assert.match(scss, /min-width:\s*0/);
  assert.match(scss, /&\.is-expand/);
  assert.match(scss, /&:not\(\.is-expand\)/);
  assert.match(scss, /\.toc-number/);
});
