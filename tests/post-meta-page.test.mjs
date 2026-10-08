import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

function listFragment(source) {
  const start = source.indexOf('th:fragment="list(data,layout)"');
  assert.notEqual(start, -1);
  const end = source.indexOf('th:fragment="emptyData', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('首页列表 post_meta 默认值对齐上游 Butterfly 5.7.0 post_meta.page（date_type=created）', () => {
  assert.deepEqual(defaults.index.post_meta, {
    date_type: 'created',
    date_format: 'date',
    categories: true,
    tags: false,
    label: true,
  });
  assert.equal(defaults.index.post_layout, 'list');
});

test('文章页 post.post_meta 默认值不被首页列表组覆盖', () => {
  assert.deepEqual(defaults.post.post_meta, {
    position: 'left',
    date_type: 'both',
    date_format: 'date',
    categories: true,
    tags: true,
    label: true,
  });
});

test('list fragment 按 index.post_meta 控制分类/标签/日期/前缀，并补上可关闭的标签', async () => {
  const source = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
  const list = listFragment(source);
  assert.match(list, /theme\.config\.index\.post_meta\?\.date_type/);
  assert.match(list, /theme\.config\.index\.post_meta\?\.label != false/);
  assert.match(list, /theme\.config\.index\.post_meta\?\.categories != false/);
  assert.match(list, /theme\.config\.index\.post_meta\?\.tags != false/);
  assert.match(list, /class="wp tag"/);
  assert.match(list, /post\.tags/);
  assert.match(list, /dateType != 'updated'/);
  assert.match(list, /dateType == 'updated' or dateType == 'both'/);
  assert.match(list, /showLabel \? '发表于 '/);
  assert.match(list, /showLabel \? '更新于 '/);
  assert.doesNotMatch(list, /dateType != 'created'/);
  assert.doesNotMatch(list, /theme\.config\.post\.post_meta/);
  assert.doesNotMatch(list, /yyyy-MM-dd HH:mm/);
});

test('列表评论由默认关闭的 card_post_count 控制，不输出点赞/预览', async () => {
  const list = listFragment(await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8'));
  assert.doesNotMatch(list, /class="wp comment"/);
  assert.match(list, /theme\.config\.comments\?\.card_post_count == true/);
  assert.match(list, /post\.stats\.comment/);
  assert.doesNotMatch(list, /class="wp upvote"/);
  assert.doesNotMatch(list, /'点赞 '/);
  assert.doesNotMatch(list, /'预览 '/);
  assert.match(list, /class="wp publishTime"/);
  assert.match(list, /class="wp category"/);
});

test('首页/分类/标签页共用 list fragment', async () => {
  const index = await readFile(new URL('../src/html/index.html', import.meta.url), 'utf8');
  const category = await readFile(new URL('../src/html/category.html', import.meta.url), 'utf8');
  const tag = await readFile(new URL('../src/html/tag.html', import.meta.url), 'utf8');
  assert.match(index, /views\/components:: list\(\$\{posts\.items\},\$\{theme\.config\.index\.post_layout\}\)/);
  assert.match(category, /views\/components:: list\(\$\{posts\.items\},'list'\)/);
  assert.match(tag, /views\/components:: list\(\$\{posts\.items\},'list'\)/);
});

test('列表卡片在窄屏限制横向溢出：min-width 0、overflow hidden、390 以下换行', async () => {
  const scss = await readFile(new URL('../src/scss/modules/components.scss', import.meta.url), 'utf8');
  const mixin = scss.slice(scss.indexOf('@mixin essayList'), scss.indexOf('@mixin pagination'));
  assert.match(mixin, /overflow:\s*hidden/);
  assert.match(mixin, /min-width:\s*0/);
  assert.match(mixin, /max-width:\s*100%/);
  assert.match(mixin, /white-space:\s*normal/);
  assert.match(mixin, /overflow-wrap:\s*anywhere/);
  assert.match(mixin, /util\.\$w-md/);
});
