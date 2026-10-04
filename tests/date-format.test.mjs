import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import { applyRelativeDates, formatRelative } from '../src/js/core/relative-date.ts';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const source = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const commonJs = await readFile(new URL('../src/js/core/common.ts', import.meta.url), 'utf8');

function postMetaFragment(html) {
  const start = html.indexOf('th:fragment="postMeta"');
  assert.notEqual(start, -1);
  const end = html.indexOf('th:fragment="list(data,layout)"', start);
  assert.notEqual(end, -1);
  return html.slice(start, end);
}

function listFragment(html) {
  const start = html.indexOf('th:fragment="list(data,layout)"');
  assert.notEqual(start, -1);
  const end = html.indexOf('th:fragment="emptyData', start);
  assert.notEqual(end, -1);
  return html.slice(start, end);
}

function groupField(groupName, fieldName) {
  const form = settings.spec.forms.find(item => item.group === groupName);
  assert.ok(form, groupName);
  const group = form.formSchema.find(node => node.name === 'post_meta');
  assert.ok(group, `${groupName}.post_meta`);
  const field = group.children.find(node => node.name === fieldName);
  assert.ok(field, `${groupName}.post_meta.${fieldName}`);
  return field;
}

test('默认 date_format 均为 date，两组字段互相独立', () => {
  assert.equal(defaults.post.post_meta.date_format, 'date');
  assert.equal(defaults.index.post_meta.date_format, 'date');
  assert.deepEqual(defaults.post.post_meta, {
    position: 'left',
    date_type: 'both',
    date_format: 'date',
    categories: true,
    tags: true,
    label: true,
  });
  assert.deepEqual(defaults.index.post_meta, {
    date_type: 'created',
    date_format: 'date',
    categories: true,
    tags: false,
    label: true,
  });
  const postField = groupField('post', 'date_format');
  const pageField = groupField('index', 'date_format');
  assert.equal(postField.value, 'date');
  assert.equal(pageField.value, 'date');
  assert.deepEqual(postField.options.map(option => option.value), ['date', 'relative']);
  assert.deepEqual(pageField.options.map(option => option.value), ['date', 'relative']);
  assert.match(String(postField.help), /post_meta\.post\.date_format/);
  assert.match(String(pageField.help), /post_meta\.page\.date_format/);
  assert.match(String(postField.help), /index\.post_meta\.date_format/);
  assert.match(String(pageField.help), /post\.post_meta\.date_format/);
});

test('文章页只读 post.post_meta.date_format，列表只读 index.post_meta.date_format', () => {
  const postMeta = postMetaFragment(source);
  const list = listFragment(source);
  assert.match(postMeta, /theme\.config\.post\.post_meta\?\.date_format/);
  assert.doesNotMatch(postMeta, /theme\.config\.index\.post_meta\?\.date_format/);
  assert.match(list, /theme\.config\.index\.post_meta\?\.date_format/);
  assert.doesNotMatch(list, /theme\.config\.post\.post_meta/);
  assert.match(postMeta, /yyyy-MM-dd/);
  assert.match(list, /yyyy-MM-dd/);
  assert.doesNotMatch(postMeta, /th:utext/);
  assert.doesNotMatch(list, /th:utext/);
  assert.match(postMeta, /showLabel \? '发布于 '/);
  assert.match(postMeta, /showLabel \? '更新于 '/);
  assert.match(list, /showLabel \? '发表于 '/);
  assert.match(list, /showLabel \? '更新于 '/);
});

test('relative 时 time 仍输出绝对 datetime，可见文本由客户端替换', () => {
  const postMeta = postMetaFragment(source);
  const list = listFragment(source);
  assert.match(postMeta, /th:datetime="\$\{post\.spec\.publishTime\}"/);
  assert.match(postMeta, /th:datetime="\$\{post\.status\.lastModifyTime\}"/);
  assert.match(list, /th:datetime="\$\{post\.spec\.publishTime\}"/);
  assert.match(list, /th:datetime="\$\{post\.status\.lastModifyTime\}"/);
  assert.match(postMeta, /th:data-relative-date="\$\{dateFormat == 'relative'\}"/);
  assert.match(list, /th:data-relative-date="\$\{dateFormat == 'relative'\}"/);
  assert.match(commonJs, /applyRelativeDates/);
  assert.doesNotMatch(commonJs, /moment/);
  assert.doesNotMatch(source, /moment/);
});

test('formatRelative 输出中文相对时间，并保留发布/更新前缀', () => {
  const now = Date.parse('2026-09-10T13:00:00Z');
  assert.equal(formatRelative('2026-09-10T12:59:30Z', now), '刚刚');
  assert.equal(formatRelative('2026-09-10T12:50:00Z', now), '10 分钟前');
  assert.equal(formatRelative('2026-09-10T10:00:00Z', now), '3 小时前');
  assert.equal(formatRelative('2026-09-08T13:00:00Z', now), '2 天前');
  assert.equal(formatRelative('not-a-date', now), '');

  const nodes = [
    { getAttribute: () => '2026-09-10T12:50:00Z', textContent: '发布于 2026-09-10' },
    { getAttribute: () => '2026-09-08T13:00:00Z', textContent: '2026-09-08' },
    { getAttribute: () => '2026-09-10T10:00:00Z', textContent: '更新于 2026-09-10' },
  ];
  applyRelativeDates({ querySelectorAll: () => nodes }, now);
  assert.equal(nodes[0].textContent, '发布于 10 分钟前');
  assert.equal(nodes[1].textContent, '2 天前');
  assert.equal(nodes[2].textContent, '更新于 3 小时前');
});
