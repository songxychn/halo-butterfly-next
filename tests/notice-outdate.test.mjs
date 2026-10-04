import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  DEFAULTS,
  daysSince,
  formatNoticeText,
  noticeClassName,
  resolveEnable,
  resolveLimitDay,
  resolveMessageNext,
  resolveMessagePrev,
  resolvePosition,
  resolveStyle,
  resolveUpdatedAt,
  shouldShow,
} from '../src/js/core/notice-outdate.ts';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const components = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const pageHtml = await readFile(new URL('../src/html/page.html', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/core/post.scss', import.meta.url), 'utf8');

function postForm() {
  const form = settings.spec.forms.find(item => item.group === 'post');
  assert.ok(form, 'post');
  return form;
}

function noticeGroup() {
  const group = postForm().formSchema.find(node => node.name === 'noticeOutdate');
  assert.ok(group, 'post.noticeOutdate');
  return group;
}

function child(name) {
  const field = noticeGroup().children.find(node => node.name === name);
  assert.ok(field, name);
  return field;
}

function fragment(html, name, stop) {
  const start = html.indexOf(`th:fragment="${name}"`);
  assert.notEqual(start, -1, name);
  const end = stop ? html.indexOf(stop, start) : html.length;
  assert.notEqual(end, -1, stop || 'eof');
  return html.slice(start, end);
}

test('默认对齐上游 SHA：enable false、style flat、limit_day 365、position top、英文前后缀', () => {
  const group = noticeGroup();
  assert.equal(defaults.post.noticeOutdate.enable, false);
  assert.equal(defaults.post.noticeOutdate.style, 'flat');
  assert.equal(defaults.post.noticeOutdate.limit_day, 365);
  assert.equal(defaults.post.noticeOutdate.position, 'top');
  assert.equal(defaults.post.noticeOutdate.message_prev, DEFAULTS.message_prev);
  assert.equal(defaults.post.noticeOutdate.message_next, DEFAULTS.message_next);
  assert.equal(group.value.enable, false);
  assert.equal(group.value.style, 'flat');
  assert.equal(group.value.limit_day, 365);
  assert.equal(group.value.position, 'top');
  assert.equal(child('enable').value, false);
  assert.deepEqual(child('enable').options.map(option => option.value), [true, false]);
  assert.equal(child('style').value, 'flat');
  assert.deepEqual(child('style').options.map(option => option.value), ['simple', 'flat']);
  assert.equal(child('limit_day').value, 365);
  assert.equal(child('position').value, 'top');
  assert.deepEqual(child('position').options.map(option => option.value), ['top', 'bottom']);
  assert.equal(child('message_prev').value, 'It has been');
  assert.equal(child('message_next').value, DEFAULTS.message_next);
  assert.match(String(group.help), /noticeOutdate/);
  assert.match(String(group.help), /outdate-notice\.pug/);
  assert.match(String(group.help), /不做 related_post/);
  assert.match(String(group.help), /逐页覆盖/);
});

test('resolveEnable：仅 true 开启；其余关闭', () => {
  assert.equal(resolveEnable(true), true);
  assert.equal(resolveEnable('true'), true);
  assert.equal(resolveEnable(false), false);
  assert.equal(resolveEnable('false'), false);
  assert.equal(resolveEnable(null), false);
  assert.equal(resolveEnable(undefined), false);
  assert.equal(resolveEnable(1), false);
  assert.equal(resolveEnable(defaults.post.noticeOutdate.enable), false);
});

test('style 仅 simple，其余（含默认空值）为 flat；position 仅 bottom 否则 top', () => {
  assert.equal(resolveStyle('simple'), 'simple');
  assert.equal(resolveStyle('flat'), 'flat');
  assert.equal(resolveStyle(''), 'flat');
  assert.equal(resolveStyle(null), 'flat');
  assert.equal(resolveStyle('other'), 'flat');
  assert.equal(noticeClassName(defaults.post.noticeOutdate.style), 'flat');
  assert.equal(resolvePosition('bottom'), 'bottom');
  assert.equal(resolvePosition('top'), 'top');
  assert.equal(resolvePosition(''), 'top');
  assert.equal(resolvePosition(null), 'top');
  assert.equal(resolvePosition('middle'), 'top');
});

test('limit_day 默认 365；天数 floor 后 >= limit 才显示', () => {
  assert.equal(resolveLimitDay(defaults.post.noticeOutdate.limit_day), 365);
  assert.equal(resolveLimitDay(null), 365);
  assert.equal(resolveLimitDay(''), 365);
  assert.equal(resolveLimitDay('10'), 10);
  assert.equal(resolveLimitDay(0), 0);
  const now = Date.parse('2026-09-10T00:00:00Z');
  const updated = Date.parse('2025-09-10T00:00:00Z');
  assert.equal(daysSince(updated, now), 365);
  assert.equal(shouldShow({ enable: true, days: 365, limitDay: 365 }), true);
  assert.equal(shouldShow({ enable: true, days: 364, limitDay: 365 }), false);
  assert.equal(shouldShow({ enable: false, days: 400, limitDay: 365 }), false);
  assert.equal(shouldShow({ enable: 'false', days: 400, limitDay: 365 }), false);
  assert.equal(shouldShow({ enable: true, days: 10, limitDay: 10 }), true);
  assert.equal(shouldShow({ enable: true, days: 9, limitDay: 10 }), false);
  assert.equal(shouldShow({ enable: true, days: 0, limitDay: 0 }), true);
  assert.equal(shouldShow({ enable: true, days: null, limitDay: 0 }), false);
});

test('天数取更新时间，无则发布时间；对齐 btf.diffDate 的 Math.floor', () => {
  const updated = '2024-01-01T00:00:00Z';
  const published = '2020-01-01T00:00:00Z';
  assert.equal(resolveUpdatedAt(updated, published), updated);
  assert.equal(resolveUpdatedAt(null, published), published);
  assert.equal(resolveUpdatedAt(undefined, published), published);
  assert.equal(resolveUpdatedAt(null, null), null);
  const now = Date.parse('2024-01-11T12:00:00Z');
  assert.equal(daysSince('2024-01-01T00:00:00Z', now), 10);
  assert.equal(daysSince(new Date('2024-01-11T00:00:00Z'), now), 0);
  assert.equal(daysSince('not-a-date', now), null);
  assert.equal(daysSince(null, now), null);
});

test('文案拼接与上游 JS 一致；空前后缀仍保留空格', () => {
  assert.equal(
    formatNoticeText(DEFAULTS.message_prev, 400, DEFAULTS.message_next),
    'It has been 400 days since the last update, the content of the article may be outdated.',
  );
  assert.equal(formatNoticeText('已过', 3, '天'), '已过 3 天');
  assert.equal(formatNoticeText('', 1, ''), ' 1 ');
});

test('文章页在正文前后插入；单页不插入；enable 与超限由 th:if 约束', () => {
  assert.match(postHtml, /views\/components :: noticeOutdate\('top'\)/);
  assert.match(postHtml, /views\/components :: noticeOutdate\('bottom'\)/);
  assert.ok(postHtml.indexOf("noticeOutdate('top')") < postHtml.indexOf('th:utext="${post.content.content}"'));
  assert.ok(postHtml.indexOf('th:utext="${post.content.content}"') < postHtml.indexOf("noticeOutdate('bottom')"));
  assert.ok(postHtml.indexOf("noticeOutdate('bottom')") < postHtml.indexOf('postCopyright'));
  assert.doesNotMatch(pageHtml, /noticeOutdate/);
  assert.doesNotMatch(pageHtml, /post-outdate-notice/);

  const block = fragment(components, 'noticeOutdate(slot)', 'th:fragment="postPagination"');
  assert.match(block, /id="post-outdate-notice"/);
  assert.match(block, /noticeEnabled = \$\{cfg != null and \(cfg\.enable == true or cfg\.enable == 'true'\)\}/);
  assert.match(block, /noticeDiffDay >= noticeLimit/);
  assert.match(block, /noticePosition == slot/);
  assert.match(block, /lastModifyTime != null \? post\.status\.lastModifyTime : post\.spec\.publishTime/);
  assert.match(block, /toEpochMilli\(\)/);
  assert.match(block, /\/ 86400000/);
  assert.match(block, /style == 'simple' \? 'simple' : 'flat'/);
  assert.match(block, /position == 'bottom' \? 'bottom' : 'top'/);
  assert.match(block, /limit_day == null or cfg\.limit_day == '' \? 365/);
  assert.match(block, /th:text="\$\{noticePrev \+ ' ' \+ noticeDiffDay \+ ' ' \+ noticeNext\}"/);
  assert.match(block, /th:class="\$\{noticeStyle\}"/);
  assert.ok(block.indexOf('th:with=') < block.indexOf('th:if='), 'th:with on fragment before inner th:if');
  assert.doesNotMatch(block, /th:utext/);
  assert.doesNotMatch(block, /related_post/);
  assert.doesNotMatch(block, /page\.noticeOutdate/);
  assert.doesNotMatch(block, /wordcount/);
});

test('可见文本走 th:text；正文仍 utext；提醒本身不 utext', () => {
  const block = fragment(components, 'noticeOutdate(slot)', 'th:fragment="postPagination"');
  assert.match(block, /th:text=/);
  assert.doesNotMatch(block, /th:utext/);
  assert.match(postHtml, /th:utext="\$\{post\.content\.content\}"/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('窄屏不横向溢出：max-width、换行；flat 左侧色条与警告图标，simple 无', () => {
  const block = scss.slice(scss.indexOf('#post-outdate-notice'));
  assert.match(block, /overflow-wrap:\s*anywhere/);
  assert.match(block, /word-break:\s*break-word/);
  assert.match(block, /max-width:\s*100%/);
  assert.match(block, /min-width:\s*0/);
  assert.match(block, /background-color:\s*#ffe6e6/);
  assert.match(block, /color:\s*#ff6666/);
  assert.match(block, /&.flat/);
  assert.match(block, /border-left:\s*5px solid #ff8080/);
  assert.match(block, /content:\s*"\\f071"/);
  assert.match(block, /padding:\s*\.5em 1\.2em/);
});
