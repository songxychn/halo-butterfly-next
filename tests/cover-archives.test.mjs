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

function recentFragment(source) {
  const start = source.indexOf('th:fragment="recentPost"');
  assert.notEqual(start, -1);
  const end = source.indexOf('th:fragment="category"', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('封面默认值对齐上游 Butterfly 5.7.0 cover.archives_enable', () => {
  assert.equal(defaults.cover.archives_enable, true);
  assert.equal(defaults.cover.index_enable, true);
  assert.equal(defaults.cover.default_cover, '');
  assert.equal(defaults.cover.aside_enable, true);
});

test('cover 组为 index_enable、default_cover、aside_enable、archives_enable 四项', async () => {
  const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
  const cover = settings.spec.forms.find(form => form.group === 'cover');
  assert.ok(cover);
  const names = cover.formSchema.map(node => node.name);
  assert.deepEqual(names, ['index_enable', 'default_cover', 'aside_enable', 'archives_enable']);
});

test('archives.html：false 不输出封面 img；有 default_cover 回退；无图时 no-cover', async () => {
  const source = await readFile(new URL('../src/html/archives.html', import.meta.url), 'utf8');
  assert.match(source, /theme\.config\.cover\.archives_enable != false/);
  assert.match(source, /coverSrc = \$\{not #strings\.isEmpty\(post\.spec\.cover\) \? post\.spec\.cover : theme\.config\.cover\.default_cover\}/);
  assert.match(source, /showCover = \$\{theme\.config\.cover\.archives_enable != false and \(not #strings\.isEmpty\(coverSrc\) or theme\.config\.loading\.img\.random_enable\)\}/);
  assert.match(source, /th:if="\$\{showCover\}"/);
  assert.match(source, /class="cover"/);
  assert.match(source, /lazyLoadImg\(\$\{coverSrc\}/);
  assert.match(source, /no-cover/);
  assert.doesNotMatch(source, /lazyLoadImg\(\$\{post\.spec\.cover\}/);
  assert.doesNotMatch(source, /<a class="cover" th:href=/);
});

test('不把 archives_enable 写进 list fragment / recentPost', async () => {
  const list = listFragment(await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8'));
  const recent = recentFragment(await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8'));
  assert.match(list, /theme\.config\.cover\.index_enable != false/);
  assert.doesNotMatch(list, /archives_enable/);
  assert.doesNotMatch(list, /aside_enable/);
  assert.match(recent, /theme\.config\.cover\.aside_enable != false/);
  assert.doesNotMatch(recent, /archives_enable/);
  assert.doesNotMatch(recent, /index_enable/);
});

test('归档时间轴无封面时有 no-cover 规则，有封面为 100×70 而非 6rem', async () => {
  const scss = await readFile(new URL('../src/scss/page/archives.scss', import.meta.url), 'utf8');
  const axis = scss.slice(scss.indexOf('&-list'), scss.indexOf('@include components.pagination'));
  assert.match(axis, /&\.no-cover/);
  assert.match(axis, /height:\s*80px/);
  assert.match(axis, /padding:\s*0/);
  assert.match(axis, /\.cover \{[\s\S]*width:\s*100px/);
  assert.match(axis, /height:\s*70px/);
  assert.doesNotMatch(axis, /width:\s*6rem/);
});
