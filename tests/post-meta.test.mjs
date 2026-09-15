import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import { CHARS_PER_MINUTE, countPostChars, minutesToRead, stripHtmlToText } from '../src/js/core/post-meta.mjs';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('文章页 post_meta 默认值对齐上游 Butterfly 5.7.0 post_meta.post', () => {
  assert.deepEqual(defaults.post.post_meta, {
    position: 'left',
    date_type: 'both',
    date_format: 'date',
    categories: true,
    tags: true,
    label: true,
  });
  assert.equal(defaults.post.enable_above, true);
});

test('文章页字数/时长/阅读量开关默认关闭，对齐 5.7.0 实验室（wordcount 插件未开、page_pv 关）', () => {
  assert.equal(defaults.wordcount.enable, false);
  assert.equal(defaults.wordcount.post_wordcount, true);
  assert.equal(defaults.wordcount.min2read, true);
  assert.equal(defaults.busuanzi.page_pv, false);
});

test('模板按 post_meta 开关读取分类/标签/日期/前缀/对齐，且不再占位字数', async () => {
  const fragment = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
  assert.match(fragment, /th:fragment="postMeta"/);
  assert.match(fragment, /post_meta\?\.categories/);
  assert.match(fragment, /post_meta\?\.tags/);
  assert.match(fragment, /post_meta\?\.date_type/);
  assert.match(fragment, /post_meta\?\.label/);
  assert.match(fragment, /post_meta\?\.position/);
  assert.match(fragment, /dateType != 'updated'/);
  assert.match(fragment, /dateType != 'created'/);
  assert.match(fragment, /showLabel \? '发布于 '/);
  assert.match(fragment, /showLabel \? '更新于 '/);
  assert.match(fragment, /replaceAll\('\(\?s\)<\[\^>\]\+>'/);
  assert.match(fragment, /\(wordLen \+ 499\) \/ 500/);
  assert.match(fragment, /wordcount\?\.enable == true/);
  assert.match(fragment, /busuanzi\?\.page_pv == true/);
  assert.match(fragment, /showWordcount or showMin2read or showPagePv/);
  assert.match(fragment, /class="wp wordCount" th:if="\$\{showWordcount\}"/);
  assert.match(fragment, /class="wp clock" th:if="\$\{showMin2read\}"/);
  assert.match(fragment, /class="wp visit" th:if="\$\{showPagePv\}"/);
  assert.doesNotMatch(fragment, /字数总计 --/);
  assert.doesNotMatch(fragment, /阅读时长 --/);
  assert.doesNotMatch(fragment, /<li class="row">\s*<span class="wp wordCount">/);

  const post = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
  assert.match(post, /views\/components :: postMeta/);
  assert.match(post, /post_meta\?\.position/);
  assert.match(post, /id="post-info"/);
  assert.match(post, /not theme\.config\.post\.enable_above/);
  assert.doesNotMatch(post, /字数总计 --/);
  assert.doesNotMatch(post, /阅读时长 --/);
  assert.equal((post.match(/views\/components :: postMeta/g) || []).length, 2);

  const header = await readFile(new URL('../src/html/views/header.html', import.meta.url), 'utf8');
  assert.match(header, /views\/components :: postMeta/);
  assert.doesNotMatch(header, /wp tag[\s\S]*post\.categories/);
  assert.doesNotMatch(header, /th:if="\$\{not #lists\.isEmpty\(post\.categories\)\}"[\s\S]*fa-tags/);
});

test('header 标签行不再误用 post.categories 作为显示条件', async () => {
  const header = await readFile(new URL('../src/html/views/header.html', import.meta.url), 'utf8');
  const tagsIf = header.match(/class="wp tag"[^>]*>/);
  assert.equal(tagsIf, null);
  const fragment = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
  assert.match(fragment, /class="wp tag" th:if="\$\{theme.config.post.post_meta\?\.tags != false and not #lists\.isEmpty\(post\.tags\)\}"/);
});

test('列表卡元信息不输出字数/时长/阅读量（index.post_meta 不动）', async () => {
  const source = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
  const start = source.indexOf('th:fragment="list(data,layout)"');
  const end = source.indexOf('th:fragment="emptyData', start);
  const list = source.slice(start, end);
  assert.doesNotMatch(list, /字数总计/);
  assert.doesNotMatch(list, /阅读时长/);
  assert.doesNotMatch(list, /阅读量/);
  assert.doesNotMatch(list, /theme\.config\.wordcount/);
  assert.doesNotMatch(list, /theme\.config\.busuanzi/);
});

test('字数/时长纯函数：空串、短文、去标签，且与 500 字/分钟一致', () => {
  assert.equal(CHARS_PER_MINUTE, 500);
  assert.equal(stripHtmlToText(''), '');
  assert.equal(countPostChars(''), 0);
  assert.equal(minutesToRead(''), 0);
  assert.equal(countPostChars('你好'), 2);
  assert.equal(minutesToRead('你好'), 1);
  assert.equal(countPostChars('<p>你好</p>'), 2);
  assert.equal(countPostChars('<p>ab</p><span>cd</span>'), 4);
  assert.equal(stripHtmlToText('<div class="x">正文<em>加粗</em></div>'), '正文加粗');
  assert.equal(countPostChars('<script>ignore</script><p>字</p>'.replace(/<script[\s\S]*?<\/script>/i, '<script>ignore</script>')), countPostChars('<script>ignore</script><p>字</p>'));
  assert.equal(minutesToRead('a'.repeat(500)), 1);
  assert.equal(minutesToRead('a'.repeat(501)), 2);
});

test('客户端不再用 run_meta 覆盖服务端字数', async () => {
  const postJs = await readFile(new URL('../src/js/page/post.js', import.meta.url), 'utf8');
  assert.doesNotMatch(postJs, /run_meta/);
  assert.doesNotMatch(postJs, /字数总计 \$\{/);
  const scss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
  assert.match(scss, /&-meta[\s\S]*?&\.left/);
  assert.match(scss, /&-meta[\s\S]*?&\.center/);
  assert.match(scss, /\.post-info/);
  assert.doesNotMatch(scss, /useResponsive\(900px\)/);
});
