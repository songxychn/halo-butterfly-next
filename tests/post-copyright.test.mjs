import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  DEFAULTS,
  formatPermalinkText,
  resolveAuthorHref,
  resolveDecode,
  resolveEnable,
  resolveLicense,
  resolveLicenseUrl,
  shouldRender,
} from '../src/js/core/post-copyright.ts';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const components = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const pageHtml = await readFile(new URL('../src/html/page.html', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/modules/render.scss', import.meta.url), 'utf8');
const renderJs = await readFile(new URL('../src/js/modules/Render.ts', import.meta.url), 'utf8');
const decoratorJs = await readFile(new URL('../src/js/modules/Render.ts', import.meta.url), 'utf8');

function postForm() {
  const form = settings.spec.forms.find(item => item.group === 'post');
  assert.ok(form, 'post');
  return form;
}

function copyrightGroup() {
  const group = postForm().formSchema.find(node => node.name === 'post_copyright');
  assert.ok(group, 'post.post_copyright');
  return group;
}

function child(name) {
  const node = copyrightGroup().children.find(item => item.name === name);
  assert.ok(node, name);
  return node;
}

function fragment(html, name) {
  const start = html.indexOf(`th:fragment="${name}"`);
  assert.notEqual(start, -1, name);
  return html.slice(start);
}

test('默认对齐上游 SHA：enable true、decode false、author_href 空、license 与 url 固定默认', () => {
  assert.equal(defaults.post.post_copyright.enable, true);
  assert.equal(defaults.post.post_copyright.decode, false);
  assert.equal(defaults.post.post_copyright.author_href, '');
  assert.equal(defaults.post.post_copyright.license, 'CC BY-NC-SA 4.0');
  assert.equal(defaults.post.post_copyright.license_url, 'https://creativecommons.org/licenses/by-nc-sa/4.0/');
  assert.equal(child('enable').value, true);
  assert.deepEqual(child('enable').options.map(option => option.value), [true, false]);
  assert.equal(child('decode').value, false);
  assert.equal(child('author_href').value, '');
  assert.equal(child('license').value, 'CC BY-NC-SA 4.0');
  assert.equal(child('license_url').value, 'https://creativecommons.org/licenses/by-nc-sa/4.0/');
  assert.equal(DEFAULTS.enable, true);
  assert.equal(DEFAULTS.decode, false);
  assert.match(String(copyrightGroup().help), /post-copyright\.pug/);
  assert.match(String(copyrightGroup().help), /不做 footer\.nav/);
  assert.match(String(child('enable').help), /post_copyright\.enable/);
  assert.match(String(child('decode').help), /post_copyright\.decode/);
  assert.match(String(child('author_href').help), /th:href/);
  assert.match(String(child('license').help), /th:text/);
});

test('enable 仅显式 false 关闭；decode 仅显式 true；空字段回退默认', () => {
  assert.equal(resolveEnable(true), true);
  assert.equal(resolveEnable('true'), true);
  assert.equal(resolveEnable(false), false);
  assert.equal(resolveEnable('false'), false);
  assert.equal(resolveEnable(undefined), true);
  assert.equal(resolveEnable(null), true);
  assert.equal(shouldRender(false), false);
  assert.equal(shouldRender(undefined), true);
  assert.equal(resolveDecode(true), true);
  assert.equal(resolveDecode('true'), true);
  assert.equal(resolveDecode(false), false);
  assert.equal(resolveDecode('false'), false);
  assert.equal(resolveDecode(undefined), false);
  assert.equal(resolveAuthorHref('', 'https://example.test'), 'https://example.test');
  assert.equal(resolveAuthorHref(null, ''), '/');
  assert.equal(resolveAuthorHref('/about', 'https://example.test'), '/about');
  assert.equal(resolveLicense(''), 'CC BY-NC-SA 4.0');
  assert.equal(resolveLicense('MIT'), 'MIT');
  assert.equal(resolveLicenseUrl(''), 'https://creativecommons.org/licenses/by-nc-sa/4.0/');
  assert.equal(resolveLicenseUrl('https://example.test/lic'), 'https://example.test/lic');
});

test('permalink：默认不解码；显式 true 才 decodeURI；非法百分号回退原文', () => {
  const encoded = 'https://example.test/%E4%B8%AD%E6%96%87';
  assert.equal(formatPermalinkText(encoded, false), encoded);
  assert.equal(formatPermalinkText(encoded, undefined), encoded);
  assert.equal(formatPermalinkText(encoded, true), 'https://example.test/中文');
  assert.equal(formatPermalinkText('%E0%A4%A', true), '%E0%A4%A');
});

test('文章页插入 postCopyright；单页不插入；enable 由 th:if 约束；无新增 utext', () => {
  assert.match(postHtml, /components :: postCopyright/);
  assert.ok(postHtml.indexOf('postCopyright') < postHtml.indexOf('postReward'));
  assert.ok(postHtml.indexOf('postReward') < postHtml.indexOf('postPagination'));
  assert.match(postHtml, /post_copyright_decode/);
  assert.doesNotMatch(pageHtml, /postCopyright/);
  const block = fragment(components, 'postCopyright');
  const end = block.indexOf('th:fragment="postReward"');
  const html = end === -1 ? block : block.slice(0, end);
  assert.match(html, /post_copyright\?\.enable != false/);
  assert.match(html, /th:text="\$\{contributor\?\.displayName \?: site\.title\}"/);
  assert.match(html, /th:href="\$\{pcAuthorHref\}"/);
  assert.match(html, /th:href="\$\{pcLicenseUrl\}"/);
  assert.match(html, /th:text="\$\{pcLicense\}"/);
  assert.match(html, /th:text="\$\{site\.title\}"/);
  assert.doesNotMatch(html, /th:utext/);
  assert.match(html, /本博客所有文章除特别声明外/);
  assert.match(renderJs, /a\.text\(formatPermalinkText/);
  assert.doesNotMatch(renderJs, /a\.html\(decodeURI/);
  assert.match(decoratorJs, /a\.text\(formatPermalinkText/);
  assert.doesNotMatch(decoratorJs, /a\.html\(decodeURI/);
});

test('390 不横向溢出：copy-right anywhere', () => {
  assert.match(scss, /\.copy-right[\s\S]*overflow-wrap:\s*anywhere/);
});
