import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  hexoNeighborsFromHalo,
  linkClassName,
  paginationOrder,
  paginationOrderFromHalo,
  resolvePostPagination,
} from '../src/js/core/post-pagination.ts';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const components = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const pageHtml = await readFile(new URL('../src/html/page.html', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');

function postForm() {
  const form = settings.spec.forms.find(item => item.group === 'post');
  assert.ok(form, 'post');
  return form;
}

function paginationField() {
  const field = postForm().formSchema.find(node => node.name === 'post_pagination');
  assert.ok(field, 'post.post_pagination');
  return field;
}

function fragment(html, name, stop) {
  const start = html.indexOf(`th:fragment="${name}"`);
  assert.notEqual(start, -1, name);
  const end = stop ? html.indexOf(stop, start) : html.length;
  assert.notEqual(end, -1, stop || 'eof');
  return html.slice(start, end);
}

test('默认 post_pagination=1，取值 false / 1 / 2', () => {
  assert.equal(defaults.post.post_pagination, '1');
  const field = paginationField();
  assert.equal(field.value, '1');
  assert.deepEqual(field.options.map(option => option.value), ['false', '1', '2']);
  assert.match(String(field.help), /post_pagination/);
  assert.match(String(field.help), /pagination\.pug/);
  assert.match(String(field.help), /不做 related_post/);
  assert.equal(resolvePostPagination(defaults.post.post_pagination), 1);
});

test('resolvePostPagination：false 关闭；2 为模式 2；其余真值（含 1）为模式 1', () => {
  assert.equal(resolvePostPagination(false), false);
  assert.equal(resolvePostPagination('false'), false);
  assert.equal(resolvePostPagination(0), false);
  assert.equal(resolvePostPagination('0'), false);
  assert.equal(resolvePostPagination(2), 2);
  assert.equal(resolvePostPagination('2'), 2);
  assert.equal(resolvePostPagination(1), 1);
  assert.equal(resolvePostPagination('1'), 1);
  assert.equal(resolvePostPagination(null), 1);
  assert.equal(resolvePostPagination(''), 1);
  assert.equal(resolvePostPagination('3'), 1);
});

test('Halo cursor 与 Hexo page.prev/next 对映射，1 对调、2 保持', () => {
  const older = { title: '较早' };
  const newer = { title: '较晚' };
  assert.deepEqual(hexoNeighborsFromHalo(older, newer), { prev: newer, next: older });

  assert.deepEqual(paginationOrder(1, newer, older), { prev: older, next: newer });
  assert.deepEqual(paginationOrder(2, newer, older), { prev: newer, next: older });
  assert.deepEqual(paginationOrderFromHalo(1, older, newer), { prev: older, next: newer });
  assert.deepEqual(paginationOrderFromHalo(2, older, newer), { prev: newer, next: older });
  assert.deepEqual(paginationOrderFromHalo(1, older, null), { prev: older, next: null });
  assert.deepEqual(paginationOrderFromHalo(1, null, newer), { prev: null, next: newer });
  assert.deepEqual(paginationOrderFromHalo(2, older, null), { prev: null, next: older });
});

test('仅一侧时 full-width；无摘要时 no-desc', () => {
  assert.equal(linkClassName({ hasOther: true, hasDesc: true }), '');
  assert.equal(linkClassName({ hasOther: false, hasDesc: true }), 'full-width');
  assert.equal(linkClassName({ hasOther: true, hasDesc: false }), 'no-desc');
  assert.equal(linkClassName({ hasOther: false, hasDesc: false }), 'full-width no-desc');
});

test('文章页插入上下篇；单页不插入；false 不渲染', () => {
  assert.match(postHtml, /views\/components :: postPagination/);
  assert.ok(postHtml.indexOf('views/components :: postPagination') < postHtml.indexOf('halo:comment'));
  assert.ok(postHtml.indexOf('copy-right') < postHtml.indexOf('views/components :: postPagination'));
  assert.doesNotMatch(pageHtml, /postPagination/);
  assert.doesNotMatch(pageHtml, /pagination-post/);

  const nav = fragment(components, 'postPagination', 'th:fragment="postPaginationLink(');
  assert.match(nav, /theme\.config\.post\.post_pagination != false and theme\.config\.post\.post_pagination != 'false'/);
  assert.match(nav, /postFinder\.cursor\(post\.metadata\.name\)/);
  assert.match(nav, /modeTwo = \$\{paginationMode == 2 or paginationMode == '2'\}/);
  assert.match(nav, /prevPost = \$\{modeTwo \? haloNext : haloPrev\}/);
  assert.match(nav, /nextPost = \$\{modeTwo \? haloPrev : haloNext\}/);
  assert.doesNotMatch(nav, /related_post/);
  assert.doesNotMatch(nav, /noticeOutdate/);
  assert.doesNotMatch(nav, /th:utext/);
});

test('链接标题 permalink 用 text 转义；摘要走 postDesc 且 th:text', () => {
  const block = fragment(components, 'postPagination', 'th:fragment="codeBlockPin"');
  assert.match(block, /th:href="\$\{target\.status\.permalink\}"/);
  assert.match(block, /th:title="\$\{target\.spec\.title\}"/);
  assert.match(block, /th:text="\$\{target\.spec\.title\}"/);
  assert.match(block, /th:text="\$\{excerptText\}"/);
  assert.match(block, /th:text="\$\{direction == 'prev' \? '上一篇' : '下一篇'\}"/);
  assert.match(block, /full-width/);
  assert.match(block, /no-desc/);
  assert.match(block, /text-right/);
  assert.match(block, /target\.spec\.excerpt\.raw/);
  assert.match(block, /postFinder\.content\(target\.metadata\.name\)/);
  assert.match(block, /index_post_content\?\.method/);
  assert.doesNotMatch(block, /th:utext/);
  assert.doesNotMatch(block, /th:attr="href/);
});

test('窄屏不横向溢出：隐藏溢出、min-width 0、标题换行与单行截断', () => {
  const block = scss.slice(scss.indexOf('#pagination.pagination-post'));
  assert.match(block, /overflow:\s*hidden/);
  assert.match(block, /min-width:\s*0/);
  assert.match(block, /max-width:\s*100%/);
  assert.match(block, /flex-direction:\s*column/);
  assert.match(block, /overflow-wrap:\s*anywhere/);
  assert.match(block, /text-clamp\(1\)/);
  assert.match(block, /height:\s*150px/);
  assert.match(block, /full-width/);
});
