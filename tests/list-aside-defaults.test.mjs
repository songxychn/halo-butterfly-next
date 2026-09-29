import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import { applyRelativeDates } from '../src/js/core/relative-date.mjs';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

function listFragment(source) {
  const start = source.indexOf('th:fragment="list(data,layout)"');
  assert.notEqual(start, -1);
  const end = source.indexOf('th:fragment="emptyData', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

function lazyFragment(source) {
  const start = source.indexOf('th:fragment="lazyLoadImg');
  assert.notEqual(start, -1);
  const end = source.indexOf('th:fragment="postMeta"', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('列表 post_meta.page 默认对齐 5.7.0：tags 关闭；归档卡默认开启', () => {
  assert.equal(defaults.index.post_meta.tags, false);
  assert.equal(defaults.index.post_meta.categories, true);
  assert.equal(defaults.aside.enable_archives, true);
  assert.equal(defaults.cover.default_cover, '');
});

test('列表封面用真实 src、第 2/4/6 篇 right（index%2==1），无评论点赞预览、日期前缀发表于', async () => {
  const source = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
  const list = listFragment(source);
  const lazy = lazyFragment(source);
  assert.match(lazy, /resolvedSrc/);
  assert.match(lazy, /not #strings\.isEmpty\(resolvedSrc\) \? resolvedSrc : theme\.config\.loading\.img\.preload/);
  assert.doesNotMatch(lazy, /data-lazy-src/);
  assert.match(list, /th:each="post, stat : \$\{data\}"/);
  // Butterfly 0-based index%2===0 → left。Thymeleaf even/odd 是 1-based nth-child，禁止用 even/odd 表达左右。
  assert.match(list, /stat\.index % 2 == 1 \? ' right'/);
  assert.doesNotMatch(list, /stat\.even \? ' right'/);
  assert.doesNotMatch(list, /stat\.odd \? ' right'/);
  assert.match(list, /showLabel \? '发表于 '/);
  assert.doesNotMatch(list, /class="wp comment"/);
  assert.doesNotMatch(list, /'点赞 '/);
  assert.doesNotMatch(list, /'预览 '/);
  assert.match(list, /coverSrc = \$\{not #strings\.isEmpty\(post\.spec\.cover\) \? post\.spec\.cover : theme\.config\.cover\.default_cover\}/);
});

test('作者卡与手机抽屉统计为文章/标签/分类，不用点赞', async () => {
  const aside = await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8');
  const components = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
  const user = aside.slice(aside.indexOf('th:fragment="user"'), aside.indexOf('th:fragment="notice"'));
  const drawer = components.slice(components.indexOf('class="site-data"'), components.indexOf('<hr/>'));
  for (const block of [user, drawer]) {
    const articleAt = block.indexOf('>文章<');
    const tagAt = block.indexOf('>标签<');
    const categoryAt = block.indexOf('>分类<');
    assert.ok(articleAt >= 0 && tagAt > articleAt && categoryAt > tagAt, block.slice(0, 400));
    assert.doesNotMatch(block, /点赞/);
    assert.doesNotMatch(block, /javascript:/);
    assert.match(block, /href="\/tags"/);
    assert.match(block, /tagFinder\.list\(1, 1\)\.total/);
  }
});

test('默认侧栏有归档卡与网站信息，分类/标签无多余 ul，文章页先作者公告再目录', async () => {
  const aside = await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8');
  assert.match(aside, /th:fragment="archives"/);
  assert.match(aside, /enable_archives != false/);
  assert.match(aside, /<span class="name">归档<\/span>/);
  assert.match(aside, /<span class="name">网站信息<\/span>/);
  assert.doesNotMatch(aside, /网站资讯/);
  const category = aside.slice(aside.indexOf('th:fragment="category"'), aside.indexOf('th:fragment="tags"'));
  const tags = aside.slice(aside.indexOf('th:fragment="tags"'), aside.indexOf('th:fragment="archives"'));
  assert.doesNotMatch(category, /<\/ul>/);
  assert.doesNotMatch(tags, /<\/ul>/);
  const common = aside.slice(aside.indexOf('th:fragment="common"'), aside.indexOf('th:fragment="post"'));
  assert.ok(common.indexOf('~{::tags}') < common.indexOf('~{::archives}'));
  assert.ok(common.indexOf('~{::archives}') < common.indexOf('~{::webInfo}'));
  const post = aside.slice(aside.indexOf('th:fragment="post"'));
  const userAt = post.indexOf('~{::user}');
  const noticeAt = post.indexOf('~{::notice}');
  const stickyAt = post.indexOf('class="is-sticky"');
  const tocAt = post.indexOf('aside-toc');
  const recentAt = post.lastIndexOf('~{::recentPost}');
  assert.ok(userAt >= 0 && noticeAt > userAt && stickyAt > noticeAt && tocAt > stickyAt && recentAt > tocAt);
});

test('作者头像不再走预加载占位；相对时间保留发表于前缀', async () => {
  const aside = await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8');
  const user = aside.slice(aside.indexOf('th:fragment="user"'), aside.indexOf('th:fragment="notice"'));
  assert.match(user, /contributor\?\.avatar/);
  assert.doesNotMatch(user, /data-lazy-src/);
  assert.doesNotMatch(user, /loading\.img\.preload/);
  const now = Date.parse('2026-09-10T13:00:00Z');
  const nodes = [
    { getAttribute: () => '2026-09-10T12:50:00Z', textContent: '发表于 2026-09-10' },
  ];
  applyRelativeDates({ querySelectorAll: () => nodes }, now);
  assert.equal(nodes[0].textContent, '发表于 10 分钟前');
});

test('实验室设置默认封面；主题默认仍为空对齐上游 null', async () => {
  const lab = await readFile(new URL('../scripts/lab/lab.py', import.meta.url), 'utf8');
  assert.match(lab, /'cover': \{'default_cover': CONTENT\['images'\]\['default'\]\}/);
  assert.equal(defaults.cover.default_cover, '');
});

function archivesFragment(source) {
  const start = source.indexOf('th:fragment="archives"');
  assert.notEqual(start, -1);
  const end = source.indexOf('th:fragment="webInfo"', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

function webInfoFragment(source) {
  const start = source.indexOf('th:fragment="webInfo"');
  assert.notEqual(start, -1);
  const end = source.indexOf('th:fragment="common"', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('归档卡月份计数取该桶全部文章，archives() 的 size 不是行数上限 8', async () => {
  const aside = await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8');
  const scss = await readFile(new URL('../src/scss/core/aside.scss', import.meta.url), 'utf8');
  const archives = archivesFragment(aside);
  assert.doesNotMatch(archives, /postFinder\.archives\(\s*1\s*,\s*8\s*\)/);
  assert.match(archives, /archiveSize = \$\{stats\.post/);
  assert.match(archives, /postFinder\.archives\(\s*1\s*,\s*archiveSize\s*\)/);
  assert.match(archives, /archiveRowLimit = 8/);
  assert.match(archives, /#lists\.size\(monthVo\.posts\)/);
  assert.doesNotMatch(archives, /\b12\b/);
  assert.match(scss, /nth-child\(\s*n\s*\+\s*9\s*\)/);
});

test('网站信息保留文章数目与最后更新时间，无文章点赞和总访问量', async () => {
  const aside = await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8');
  const webInfo = webInfoFragment(aside);
  assert.match(webInfo, /<span class="name">网站信息<\/span>/);
  assert.match(webInfo, /文章数目/);
  assert.match(webInfo, /最后更新时间/);
  assert.match(webInfo, /lastPush/);
  assert.match(webInfo, /status\.lastModifyTime,desc/);
  assert.match(webInfo, /spec\.publishTime,desc/);
  assert.match(webInfo, /data-relative-date="true"/);
  assert.doesNotMatch(webInfo, /文章点赞/);
  assert.doesNotMatch(webInfo, /总访问量/);
  assert.doesNotMatch(webInfo, /stats\.upvote/);
  assert.doesNotMatch(webInfo, /stats\.visit/);
  const now = Date.parse('2026-09-10T13:00:00Z');
  const nodes = [
    { getAttribute: () => '2026-09-10T12:50:00Z', textContent: '2026-09-10 20:50' },
  ];
  applyRelativeDates({ querySelectorAll: () => nodes }, now);
  assert.equal(nodes[0].textContent, '10 分钟前');
});
