import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  capRelatedPosts,
  rankRelatedPosts,
  resolveDateType,
  resolveEnable,
  resolveLimit,
} from '../src/js/core/related-post.ts';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const components = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const pageHtml = await readFile(new URL('../src/html/page.html', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/core/relatedposts.scss', import.meta.url), 'utf8');
const renderJs = await readFile(new URL('../src/js/modules/Render.ts', import.meta.url), 'utf8');

function postForm() {
  const form = settings.spec.forms.find(item => item.group === 'post');
  assert.ok(form, 'post');
  return form;
}

function relatedGroup() {
  const group = postForm().formSchema.find(node => node.name === 'related_post');
  assert.ok(group, 'post.related_post');
  return group;
}

function child(name) {
  const node = relatedGroup().children.find(item => item.name === name);
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

function makeList(names) {
  const widget = {
    removed: false,
    remove() { widget.removed = true; },
  };
  const list = { children: [] };
  list.children = names.map(name => {
    const node = {
      removed: false,
      getAttribute(key) { return key === 'data-post-name' ? name : null; },
      remove() {
        node.removed = true;
        list.children = list.children.filter(item => !item.removed);
      },
    };
    return node;
  });
  list.querySelectorAll = () => list.children.filter(item => !item.removed);
  list.closest = () => widget;
  return { list, widget };
}

test('默认对齐上游 SHA：enable true、limit 6、date_type created', () => {
  assert.equal(defaults.post.related_post.enable, true);
  assert.equal(defaults.post.related_post.limit, 6);
  assert.equal(defaults.post.related_post.date_type, 'created');
  assert.equal(child('enable').value, true);
  assert.deepEqual(child('enable').options.map(option => option.value), [true, false]);
  assert.equal(child('limit').value, 6);
  assert.equal(child('date_type').value, 'created');
  assert.deepEqual(child('date_type').options.map(option => option.value), ['created', 'updated']);
  assert.match(String(relatedGroup().help), /related_post\.js/);
  assert.match(String(child('enable').help), /related_post\.enable/);
  assert.match(String(child('limit').help), /limit \|\| 6/);
  assert.match(String(child('date_type').help), /related_post\.date_type/);
  assert.match(String(relatedGroup().help), /不做 footer/);
  assert.equal(resolveEnable(defaults.post.related_post.enable), true);
  assert.equal(resolveLimit(defaults.post.related_post.limit), 6);
  assert.equal(resolveDateType(defaults.post.related_post.date_type), 'created');
});

test('resolveEnable：仅显式 false 关闭；limit 非正数回退 6；date_type 仅 created 否则 updated', () => {
  assert.equal(resolveEnable(false), false);
  assert.equal(resolveEnable('false'), false);
  assert.equal(resolveEnable(true), true);
  assert.equal(resolveEnable('true'), true);
  assert.equal(resolveEnable(null), true);
  assert.equal(resolveEnable(''), true);
  assert.equal(resolveLimit(0), 6);
  assert.equal(resolveLimit('0'), 6);
  assert.equal(resolveLimit(false), 6);
  assert.equal(resolveLimit(null), 6);
  assert.equal(resolveLimit(3), 3);
  assert.equal(resolveLimit('8'), 8);
  assert.equal(resolveLimit(-1), 6);
  assert.equal(resolveDateType('created'), 'created');
  assert.equal(resolveDateType('updated'), 'updated');
  assert.equal(resolveDateType(null), 'created');
  assert.equal(resolveDateType(''), 'created');
  assert.equal(resolveDateType('other'), 'updated');
});

test('rankRelatedPosts 按标签交集加权，同权重随 random，截断 limit', () => {
  const tagA = [
    { path: '/self/', title: 'self' },
    { path: '/a/', title: 'A' },
    { path: '/both/', title: 'Both' },
  ];
  const tagB = [
    { path: '/both/', title: 'Both' },
    { path: '/b/', title: 'B' },
  ];
  let i = 0;
  const ranked = rankRelatedPosts('/self/', [tagA, tagB], {
    limit: 2,
    random: () => [0.1, 0.9, 0.2][i++],
  });
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].path, '/both/');
  assert.equal(ranked[0].weight, 2);
  assert.equal(ranked[1].path, '/b/');
  assert.equal(rankRelatedPosts('/self/', [[]], { limit: 6 }).length, 0);
  assert.equal(rankRelatedPosts('/self/', null).length, 0);
});

test('capRelatedPosts 去重、去掉当前文、截断 limit；空则移除容器', () => {
  const { list, widget } = makeList(['self', 'a', 'a', 'b', 'c']);
  assert.equal(capRelatedPosts(list, 2, 'self'), 2);
  assert.deepEqual(list.children.map(item => item.getAttribute('data-post-name')), ['a', 'b']);
  assert.equal(widget.removed, false);

  const empty = makeList(['self']);
  assert.equal(capRelatedPosts(empty.list, 6, 'self'), 0);
  assert.equal(empty.widget.removed, true);
  assert.equal(capRelatedPosts(null, 6), 0);
});

test('文章页插入 relatedPosts；单页不插入；enable 与无标签由 th:if 约束', () => {
  assert.match(postHtml, /views\/components :: relatedPosts/);
  assert.match(postHtml, /related_post_limit: \/\*\[\[\$\{theme\.config\.post\.related_post\.limit\}\]\]\*\/ 6/);
  assert.doesNotMatch(pageHtml, /relatedPosts/);
  assert.doesNotMatch(pageHtml, /related_post/);
  const related = fragment(components, 'relatedPosts', 'th:fragment="codeBlockPin"');
  assert.match(related, /related_post\?\.enable != false/);
  assert.match(related, /not #lists\.isEmpty\(post\.tags\)/);
  assert.match(related, /postFinder\.listByTag/);
  assert.match(related, /data-post-name/);
  assert.match(related, /rpUpdated \? .*lastModifyTime/);
  assert.match(related, /th:text="\$\{item\.spec\.title\}"/);
  assert.doesNotMatch(related, /th:utext/);
  assert.doesNotMatch(related, /innerHTML/);
  assert.match(renderJs, /from '\.\.\/core\/related-post\.ts'/);
  assert.match(renderJs, /capRelatedPosts/);
});

test('窄屏不横向溢出；三列到单列网格', () => {
  assert.match(scss, /\.relatedPosts/);
  assert.match(scss, /overflow:\s*hidden/);
  assert.match(scss, /width:\s*calc\(33\.333% - 6px\)/);
  assert.match(scss, /width:\s*calc\(50% - 4px\)/);
  assert.match(scss, /width:\s*calc\(100% - 4px\)/);
  assert.match(scss, /min-width:\s*0/);
  assert.match(scss, /overflow-wrap:\s*anywhere/);
});
