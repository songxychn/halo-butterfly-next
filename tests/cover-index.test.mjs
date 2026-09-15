import assert from 'node:assert/strict';
import test from 'node:test';
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

test('封面默认值对齐上游 Butterfly 5.7.0 cover.index_enable / default_cover', () => {
  assert.equal(defaults.cover.index_enable, true);
  assert.equal(defaults.cover.default_cover, '');
  assert.equal(defaults.loading.img.random_enable, false);
});

test('settings 暴露 cover 组四项（含 archives_enable）；list 仍不读 archives_enable', async () => {
  const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
  const cover = settings.spec.forms.find(form => form.group === 'cover');
  assert.ok(cover);
  const names = cover.formSchema.map(node => node.name);
  assert.deepEqual(names, ['index_enable', 'default_cover', 'aside_enable', 'archives_enable']);
});

test('list fragment：index_enable=false 不渲染封面；无文章封面时用 default_cover', async () => {
  const source = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
  const list = listFragment(source);
  assert.match(list, /theme\.config\.cover\.index_enable != false/);
  assert.match(list, /coverSrc = \$\{not #strings\.isEmpty\(post\.spec\.cover\) \? post\.spec\.cover : theme\.config\.cover\.default_cover\}/);
  assert.match(list, /showCover = \$\{indexCoverEnable and \(not #strings\.isEmpty\(coverSrc\) or theme\.config\.loading\.img\.random_enable\)\}/);
  assert.match(list, /th:if="\$\{showCover\}"/);
  assert.match(list, /lazyLoadImg\(\$\{coverSrc\}/);
  assert.match(list, /no-cover/);
  assert.doesNotMatch(list, /aside_enable/);
  assert.doesNotMatch(list, /archives_enable/);
  assert.doesNotMatch(list, /lazyLoadImg\(\$\{post\.spec\.cover\}/);
});

test('封面优先级：文章封面 > default_cover > loading.img.random_enable', async () => {
  const list = listFragment(await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8'));
  const coverSrcAt = list.indexOf('coverSrc =');
  const showCoverAt = list.indexOf('showCover =');
  const randomAt = list.indexOf('loading.img.random_enable', showCoverAt);
  assert.ok(coverSrcAt >= 0 && showCoverAt > coverSrcAt);
  assert.ok(randomAt > showCoverAt);
  const coverSrcExpr = list.slice(coverSrcAt, showCoverAt);
  assert.match(coverSrcExpr, /post\.spec\.cover/);
  assert.match(coverSrcExpr, /cover\.default_cover/);
  assert.doesNotMatch(coverSrcExpr, /random_enable/);
});

test('首页 list/tile 与分类、标签页共用 list fragment', async () => {
  const index = await readFile(new URL('../src/html/index.html', import.meta.url), 'utf8');
  const category = await readFile(new URL('../src/html/category.html', import.meta.url), 'utf8');
  const tag = await readFile(new URL('../src/html/tag.html', import.meta.url), 'utf8');
  assert.match(index, /views\/components:: list\(\$\{posts\.items\},\$\{theme\.config\.index\.post_layout\}\)/);
  assert.match(category, /views\/components:: list\(\$\{posts\.items\},'list'\)/);
  assert.match(tag, /views\/components:: list\(\$\{posts\.items\},'list'\)/);
});

test('列表卡片在窄屏限制横向溢出：min-width 0、overflow hidden、390 以下换行；无封面时信息区撑满', async () => {
  const scss = await readFile(new URL('../src/scss/modules/components.scss', import.meta.url), 'utf8');
  const mixin = scss.slice(scss.indexOf('@mixin essayList'), scss.indexOf('@mixin pagination'));
  assert.match(mixin, /overflow:\s*hidden/);
  assert.match(mixin, /min-width:\s*0/);
  assert.match(mixin, /max-width:\s*100%/);
  assert.match(mixin, /white-space:\s*normal/);
  assert.match(mixin, /overflow-wrap:\s*anywhere/);
  assert.match(mixin, /util\.\$w-md/);
  assert.match(mixin, /&\.no-cover > \.info/);
  assert.match(mixin, /&\.tile/);
  assert.match(mixin, /width:\s*100%/);
});
