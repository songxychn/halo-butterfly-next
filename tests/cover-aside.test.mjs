import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

function recentFragment(source) {
  const start = source.indexOf('th:fragment="recentPost"');
  assert.notEqual(start, -1);
  const end = source.indexOf('th:fragment="category"', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('封面与最近文章默认值对齐上游 Butterfly 5.7.0 cover.aside_enable / aside.card_recent_post', () => {
  assert.equal(defaults.cover.aside_enable, true);
  assert.equal(defaults.cover.index_enable, true);
  assert.equal(defaults.cover.default_cover, '');
  assert.deepEqual(defaults.aside.card_recent_post, {
    enable: true,
    limit: 5,
    sort: 'date',
  });
  assert.equal(defaults.aside.enable_category, true);
});

test('cover 组为 index_enable、default_cover、aside_enable、archives_enable 四项', async () => {
  const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
  const cover = settings.spec.forms.find(form => form.group === 'cover');
  assert.ok(cover);
  const names = cover.formSchema.map(node => node.name);
  assert.deepEqual(names, ['index_enable', 'default_cover', 'aside_enable', 'archives_enable']);
});

test('aside.card_recent_post 使用上游嵌套名，不含 sort_order', async () => {
  const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
  const aside = settings.spec.forms.find(form => form.group === 'aside');
  assert.ok(aside);
  const group = aside.formSchema.find(node => node.name === 'card_recent_post');
  assert.ok(group);
  assert.equal(group.$formkit, 'group');
  const names = group.children.map(node => node.name);
  assert.deepEqual(names, ['enable', 'limit', 'sort']);
  assert.ok(!names.includes('sort_order'));
  const fieldNames = [];
  const visit = nodes => {
    for (const node of nodes || []) {
      if (node.name) fieldNames.push(node.name);
      if (node.children) visit(node.children);
    }
  };
  visit(aside.formSchema);
  assert.ok(!fieldNames.includes('sort_order'));
  assert.ok(!fieldNames.includes('card_archives'));
  assert.ok(!fieldNames.includes('card_newest_comments'));
  const noticeIdx = aside.formSchema.findIndex(node => node.name === 'notice');
  const recentIdx = aside.formSchema.findIndex(node => node.name === 'card_recent_post');
  const categoryIdx = aside.formSchema.findIndex(node => node.name === 'enable_category');
  assert.ok(noticeIdx >= 0 && recentIdx === noticeIdx + 1 && categoryIdx === recentIdx + 1);
});

test('模板：enable=false 不渲染卡片；aside_enable=false 无 thumbnail / 有 no-cover；limit/sort 表达式存在', async () => {
  const source = await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8');
  const recent = recentFragment(source);
  assert.match(recent, /th:if="\$\{theme\.config\.aside\.card_recent_post\.enable != false\}"/);
  assert.match(recent, /rawLimit = \$\{theme\.config\.aside\.card_recent_post\.limit\}/);
  assert.match(recent, /recentLimit = \$\{rawLimit == null \? 5 : \(\(rawLimit <= 0 or rawLimit > 20\) \? 20 : rawLimit\)\}/);
  assert.match(recent, /sortUpdated = \$\{theme\.config\.aside\.card_recent_post\.sort == 'updated'\}/);
  assert.match(recent, /status\.lastModifyTime,desc/);
  assert.match(recent, /spec\.publishTime,desc/);
  assert.match(recent, /postFinder\.list\(\{page: 1, size: recentLimit, sort: \{'status\.lastModifyTime,desc'\}\}\)/);
  assert.match(recent, /postFinder\.list\(\{page: 1, size: recentLimit, sort: \{'spec\.publishTime,desc'\}\}\)/);
  assert.match(recent, /coverSrc = \$\{not #strings\.isEmpty\(post\.spec\.cover\) \? post\.spec\.cover : theme\.config\.cover\.default_cover\}/);
  assert.match(recent, /showCover = \$\{theme\.config\.cover\.aside_enable != false and \(not #strings\.isEmpty\(coverSrc\) or theme\.config\.loading\.img\.random_enable\)\}/);
  assert.match(recent, /th:if="\$\{showCover\}"/);
  assert.match(recent, /class="thumbnail"/);
  assert.match(recent, /no-cover/);
  assert.match(recent, /lazyLoadImg\(\$\{coverSrc\}/);
  assert.doesNotMatch(recent, /lazyLoadImg\(\$\{post\.spec\.cover\}/);
  assert.doesNotMatch(recent, /archives_enable/);
  assert.doesNotMatch(recent, /sort_order/);

  const common = source.slice(source.indexOf('th:fragment="common"'), source.indexOf('th:fragment="post"'));
  const noticeAt = common.indexOf('~{::notice}');
  const recentAt = common.indexOf('~{::recentPost}');
  const categoryAt = common.indexOf('~{::category}');
  assert.ok(noticeAt >= 0 && recentAt > noticeAt && categoryAt > recentAt);

  const post = source.slice(source.indexOf('th:fragment="post"'));
  const stickyAt = post.indexOf('class="is-sticky"');
  const tocAt = post.indexOf('aside-toc');
  const postRecentAt = post.indexOf('~{::recentPost}');
  const stickyClose = post.indexOf('</div>', tocAt);
  assert.ok(stickyAt >= 0 && tocAt > stickyAt && postRecentAt > stickyClose);
});

test('侧栏最近文章缩略图优先级与首页 list 一致，且不改 list 的 index_enable 路径', async () => {
  const list = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
  assert.match(list, /theme\.config\.cover\.index_enable != false/);
  assert.doesNotMatch(list, /aside_enable/);
  const scss = await readFile(new URL('../src/scss/core/aside.scss', import.meta.url), 'utf8');
  assert.match(scss, /&-recent-post/);
  assert.match(scss, /&\.no-cover > \.info/);
  assert.match(scss, /flex:\s*1/);
  assert.match(scss, /width:\s*4em/);
});
