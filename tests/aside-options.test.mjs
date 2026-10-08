import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import { sortTags, limitItems, formatArchiveDate } from '../src/js/core/aside-options.ts';
const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'))).aside;
const tag = (name, count) => ({ dataset: { name, count: String(count) } });

test('标签全量排序后限量，名称、文章数、随机与 0 全部均受支持', () => {
  const tags = [tag('C', 2), tag('A', 9), tag('B', 4)];
  assert.deepEqual(limitItems(sortTags(tags, 'length', -1), 2).map(x => x.dataset.name), ['A', 'B']);
  assert.deepEqual(sortTags(tags, 'name', -1).map(x => x.dataset.name), ['C', 'B', 'A']);
  assert.equal(limitItems(tags, 0).length, 3);
  const shuffled = sortTags(tags, 'random', 1, () => 0);
  assert.deepEqual(shuffled.map(x => x.dataset.name), ['A', 'B', 'C']);
  assert.deepEqual(tags.map(x => x.dataset.name), ['C', 'A', 'B']);
});

test('归档格式支持常用年月 token、本地月份名称和原样文本，保持跨年排序所用数据不变', () => {
  assert.equal(formatArchiveDate('2025', '01', 'YYYY年MM月'), '2025年01月');
  assert.equal(formatArchiveDate('2025', '12', 'MMMM YYYY', 'en'), 'December 2025');
  assert.equal(formatArchiveDate('2025', '02', '[MM] YY/M'), 'MM 25/2');
  assert.equal(formatArchiveDate('2025', '02', 'YYYY'), '2025');
});

test('侧栏默认项保留旧数量与显示，保留旧版卡片开关键', () => {
  assert.deepEqual(defaults.display, { archive: true, tag: true, category: true });
  assert.equal(defaults.card_categories.limit, 5);
  assert.equal(defaults.card_categories.expand, 'none');
  assert.equal(defaults.card_tags.limit, 25);
  assert.equal(defaults.card_tags.orderby, 'random');
  assert.equal(defaults.card_archives.limit, 8);
  assert.equal(defaults.card_archives.type, 'monthly');
  for (const key of ['enable_category', 'enable_tags', 'enable_archives', 'enable_webInfo']) assert.equal(defaults[key], true);
  assert.equal(defaults.card_webinfo.post_count, true);
  assert.equal(defaults.card_webinfo.last_push_date, true);
  assert.equal(defaults.card_webinfo.runtime, true);
});

test('页面显示在服务端决定主栏宽度；分类标签使用真实 Finder 并有无脚本限量回退', async () => {
  const aside = await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/html/views/layout.html', import.meta.url), 'utf8');
  assert.match(layout, /asideEnabled \? theme.config.aside.position : 'off-aside'/);
  for (const key of ['archive', 'tag', 'category']) assert.ok(layout.includes(`asideDisplay?.${key} != false`));
  assert.match(aside, /categoryFinder\.listAsTree\(\)/);
  assert.match(aside, /tagFinder\.listAll\(\)/);
  assert.match(aside, /status.index < categoryLimit/);
  assert.match(aside, /status.index < tagLimit/);
  assert.match(aside, /<template data-category-tree>/);
  assert.match(aside, /<template data-tag-list>/);
  assert.match(aside, /#aggregates.sum\(year.months\.\!\[posts.size\(\)\]\)/);
  assert.doesNotMatch(aside, /stats.post > 1000/);
});

test('全为空分类时保留服务端空状态，不替换为无内容的侧栏', async () => {
  const { initializeAsideOptions } = await import('../src/js/core/aside-options.ts');
  const tree = {
    children: [],
    append(node) { this.children = [node]; },
    querySelector() { return this.children[0] || null; },
    querySelectorAll() { return [...this.children]; },
  };
  const emptyCategory = {
    dataset: { name: '空分类', count: '0' },
    classList: { contains: value => value === 'category-entry' },
    querySelector: () => null,
    remove() { tree.children = []; },
  };
  tree.children.push(emptyCategory);
  let replaced = false;
  const container = {
    dataset: { limit: '5', expand: 'none' },
    querySelector: () => ({ content: { cloneNode: () => tree } }),
    replaceChildren() { replaced = true; },
  };
  initializeAsideOptions({ querySelectorAll: selector => selector === '[data-aside-categories]' ? [container] : [] });
  assert.equal(replaced, false);
});


test('分类树使用 Halo 已计算的级联 postCount，而非节点直接文章数', async () => {
  const source = await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8');
  const tree = source.slice(source.indexOf('th:fragment="categoryTree(nodes)"'), source.indexOf('<!--/* 标签'));
  assert.match(tree, /data-count=\$\{node.postCount\}/);
  assert.match(tree, /class="num" th:text="\$\{node.postCount\}"/);
  assert.doesNotMatch(tree, /node.status.visiblePostCount/);
});
