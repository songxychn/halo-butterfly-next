import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const commentsScss = await readFile(new URL('../src/scss/core/comments.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const darkmodeScss = await readFile(new URL('../src/scss/core/darkmode.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const pageHtml = await readFile(new URL('../src/html/page.html', import.meta.url), 'utf8');
const rules = commentsScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('comments.scss 挂在 #post-comment，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "comments"/);
  assert.match(rules, /#post-comment/);
  assert.match(rules, /\.comment-head/);
  assert.match(rules, /\.comment-headline/);
  assert.match(rules, /\.comment-switch/);
  assert.match(rules, /#switch-btn/);
  assert.match(rules, /\.comment-wrap/);
  assert.match(rules, /&\.move/);
  assert.match(postHtml, /id="post-comment"/);
  assert.match(pageHtml, /id="post-comment"/);
  assert.match(postHtml, /class="comment-headline"/);
  assert.match(postHtml, /<halo:comment/);
  assert.match(pageHtml, /<halo:comment/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
});

test('上游评论区：headline 1.43em、switch 默认 text=true、42x22、tabshow、.move 20px', () => {
  assert.match(commentsScss, /margin-bottom:\s*20px/);
  assert.match(commentsScss, /font-size:\s*1\.43em/);
  assert.match(commentsScss, /float:\s*right/);
  assert.match(commentsScss, /width:\s*max-content/);
  assert.match(commentsScss, /border-radius:\s*8px/);
  assert.match(commentsScss, /var\(--sidebar-bg,\s*#f6f8fa\)/);
  assert.match(commentsScss, /width:\s*42px/);
  assert.match(commentsScss, /height:\s*22px/);
  assert.match(commentsScss, /translateX\(20px\)/);
  assert.match(commentsScss, /animation:\s*tabshow \.5s/);
  assert.match(commentsScss, /@keyframes tabshow/);
  assert.match(darkmodeScss, /#post-comment \.comment-switch/);
  assert.doesNotMatch(postHtml, /id="switch-btn"/);
  assert.doesNotMatch(pageHtml, /id="switch-btn"/);
  assert.doesNotMatch(postHtml, /class="comment-switch"/);
});

test('本刀不接入评论提供方、不改 hide_button、不改文章上下篇 150px、无新增 th:utext', () => {
  assert.doesNotMatch(settingsText, /name:\s*disqus/);
  assert.doesNotMatch(settingsText, /name:\s*waline/);
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(componentsHtml, /id="pagination"/);
  assert.match(componentsHtml, /class="pagination-post"/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
  assert.doesNotMatch(pageHtml.replace(/th:utext="\$\{singlePage\.content\.content\}"/, ''), /th:utext/);
});

test('编译后选择器挂在 #post-comment，无 data-theme，不把文章上下篇压掉', () => {
  const css = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#post-comment/);
  assert.match(css, /\.comment-headline/);
  assert.match(css, /1\.43em/);
  assert.match(css, /#switch-btn/);
  assert.match(css, /tabshow/);
  assert.match(css, /#pagination\.pagination-post/);
  assert.match(css, /height:\s*150px/);
  assert.doesNotMatch(css, /\[data-theme/);
});
