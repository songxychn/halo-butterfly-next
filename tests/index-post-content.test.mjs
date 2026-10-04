import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  postDesc,
  resolveIndexPostContentLength,
  resolveIndexPostContentMethod,
  truncateContent,
  truncatePlain,
} from '../src/js/core/index-post-content.ts';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const source = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/modules/components.scss', import.meta.url), 'utf8');

function listFragment(html) {
  const start = html.indexOf('th:fragment="list(data,layout)"');
  assert.notEqual(start, -1);
  const end = html.indexOf('th:fragment="emptyData', start);
  assert.notEqual(end, -1);
  return html.slice(start, end);
}

function indexPostContentGroup() {
  const form = settings.spec.forms.find(item => item.group === 'index');
  assert.ok(form, 'index');
  const group = form.formSchema.find(node => node.name === 'index_post_content');
  assert.ok(group, 'index.index_post_content');
  return group;
}

function childField(name) {
  const field = indexPostContentGroup().children.find(node => node.name === name);
  assert.ok(field, name);
  return field;
}

test('默认 method=3、length=500，两组字段互相独立', () => {
  assert.deepEqual(defaults.index.index_post_content, { method: '3', length: 500 });
  assert.equal(resolveIndexPostContentMethod(defaults.index.index_post_content.method), 3);
  assert.equal(resolveIndexPostContentLength(defaults.index.index_post_content.length), 500);
  const group = indexPostContentGroup();
  assert.equal(group.value.method, '3');
  assert.equal(group.value.length, 500);
  const method = childField('method');
  const length = childField('length');
  assert.equal(method.value, '3');
  assert.equal(length.value, 500);
  assert.deepEqual(method.options.map(option => option.value), ['false', '1', '2', '3']);
  assert.match(String(method.help), /index_post_content\.method/);
  assert.match(String(length.help), /index_post_content\.length/);
  assert.match(String(length.help), /500/);
});

test('resolveMethod：false 关闭；1/2 分派；其余默认 3', () => {
  assert.equal(resolveIndexPostContentMethod(false), false);
  assert.equal(resolveIndexPostContentMethod('false'), false);
  assert.equal(resolveIndexPostContentMethod(1), 1);
  assert.equal(resolveIndexPostContentMethod('1'), 1);
  assert.equal(resolveIndexPostContentMethod(2), 2);
  assert.equal(resolveIndexPostContentMethod('2'), 2);
  assert.equal(resolveIndexPostContentMethod(3), 3);
  assert.equal(resolveIndexPostContentMethod('3'), 3);
  assert.equal(resolveIndexPostContentMethod(null), 3);
  assert.equal(resolveIndexPostContentMethod(''), 3);
  assert.equal(resolveIndexPostContentMethod('9'), 3);
});

test('truncate 对齐 hexo-util：不足 length 原样，等长也截断，省略号计入 length', () => {
  assert.equal(truncatePlain('abcd', 10), 'abcd');
  assert.equal(truncatePlain('abcdefghij', 10), 'abcdefg...');
  const exact = 'x'.repeat(500);
  assert.equal(truncatePlain(exact, 500), `${'x'.repeat(497)}...`);
  assert.equal(truncatePlain('x'.repeat(499), 500), 'x'.repeat(499));
  assert.equal(truncatePlain('hello', 0), '...');
  assert.equal(truncateContent('', 500), '');
  assert.equal(truncateContent('<p>hi\nthere</p>', 500), 'hi there');
  assert.equal(truncateContent('<p>' + 'a'.repeat(600) + '</p>', 500), `${'a'.repeat(497)}...`);
  assert.equal(truncateContent('<b>secret</b>', 500, true), '');
});

test('method 语义：false 空；1 仅 description；2 优先 description；3 忽略 description 截断正文', () => {
  const longHtml = `<p>${'正文'.repeat(300)}</p>`;
  const description = '手动摘要';
  assert.equal(postDesc({ description, content: longHtml }, { method: false, length: 500 }), '');
  assert.equal(postDesc({ description, content: longHtml }, { method: 'false', length: 500 }), '');
  assert.equal(postDesc({ description, content: longHtml }, { method: 1, length: 10 }), description);
  assert.equal(postDesc({ description: '', content: longHtml }, { method: 1, length: 10 }), '');
  assert.equal(postDesc({ description, content: longHtml }, { method: 2, length: 10 }), description);
  assert.equal(
    postDesc({ description: '', content: longHtml }, { method: 2, length: 10 }),
    truncateContent(longHtml, 10),
  );
  assert.equal(
    postDesc({ description, content: longHtml }, { method: 3, length: 10 }),
    truncateContent(longHtml, 10),
  );
  assert.equal(
    postDesc({ description, content: longHtml }, { method: 3 }),
    truncateContent(longHtml, 500),
  );
  assert.equal(postDesc({ content: '<p>短</p>' }, { method: 3, length: 500 }), '短');
});

test('length 只影响需要截断的 method 2/3', () => {
  const content = `<p>${'a'.repeat(80)}</p>`;
  assert.equal(postDesc({ description: 'desc', content }, { method: 1, length: 4 }), 'desc');
  const truncated = truncateContent(content, 20);
  assert.notEqual(truncated, truncateContent(content, 40));
  assert.equal(postDesc({ content }, { method: 3, length: 20 }), truncated);
  assert.equal(postDesc({ description: '', content }, { method: 2, length: 20 }), truncated);
  assert.equal(postDesc({ description: 'keep', content }, { method: 2, length: 20 }), 'keep');
});

test('list fragment：method 关闭不渲染；可见文本 th:text；正文走 postFinder.content', () => {
  const list = listFragment(source);
  assert.match(list, /theme\.config\.index\.index_post_content\?\.method/);
  assert.match(list, /theme\.config\.index\.index_post_content\?\.length/);
  assert.match(list, /ipcMethod != false and ipcMethod != 'false'/);
  assert.match(list, /layout == 'list'/);
  assert.match(list, /postFinder\.content\(post\.metadata\.name\)/);
  assert.match(list, /useDescription or methodOne \? null : postFinder\.content/);
  assert.match(list, /post\.spec\.excerpt\.raw/);
  assert.match(list, /th:text="\$\{excerptText\}"/);
  assert.doesNotMatch(list.slice(list.indexOf('index_post_content')), /th:utext/);
  const excerptBlock = list.slice(list.indexOf('ipcMethod != false'), list.indexOf('th:fragment="emptyData'));
  assert.doesNotMatch(excerptBlock, /th:utext/);
  assert.doesNotMatch(list, /moment/);
  assert.doesNotMatch(list, /theme\.config\.post\.post_meta/);
});

test('列表卡片摘要在窄屏限制横向溢出', () => {
  const mixin = scss.slice(scss.indexOf('@mixin essayList'), scss.indexOf('@mixin pagination'));
  const excerpt = mixin.slice(mixin.indexOf('> .excerpt'), mixin.indexOf('@include util.useResponsive($width: util.$w-md) {', mixin.indexOf('> .excerpt') + 1));
  assert.match(mixin, /overflow:\s*hidden/);
  assert.match(mixin, /min-width:\s*0/);
  assert.match(mixin, /overflow-wrap:\s*anywhere/);
  assert.match(excerpt, /overflow-wrap:\s*anywhere/);
  assert.match(excerpt, /min-width:\s*0/);
  assert.match(excerpt, /text-clamp\(2\)/);
});
