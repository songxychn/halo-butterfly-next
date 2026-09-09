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
    categories: true,
    tags: true,
    label: true,
  });
  assert.equal(defaults.post.enable_above, true);
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
  assert.doesNotMatch(fragment, /字数总计 --/);
  assert.doesNotMatch(fragment, /阅读时长 --/);

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
