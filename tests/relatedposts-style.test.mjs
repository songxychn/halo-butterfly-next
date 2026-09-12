import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const relatedScss = await readFile(new URL('../src/scss/core/relatedposts.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = relatedScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('relatedposts.scss 并列 .relatedPosts / > a，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "relatedposts"/);
  assert.match(rules, /\.relatedPosts \{/);
  assert.match(rules, /\.relatedPosts-list/);
  assert.match(rules, /> a,/);
  assert.match(rules, /> a\.pagination-related/);
  assert.match(componentsHtml, /class="relatedPosts"/);
  assert.match(componentsHtml, /class="relatedPosts-list"/);
  assert.match(componentsHtml, /class="pagination-related"/);
  assert.match(postHtml, /components :: relatedPosts/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
});

test('上游相关文章网格：40px、1.43em、三列 200px、768 两列 150px、clamp 2/3', () => {
  assert.match(relatedScss, /margin-top:\s*40px/);
  assert.match(relatedScss, /font-size:\s*1\.43em/);
  assert.match(relatedScss, /font-weight:\s*700/);
  assert.match(relatedScss, /width:\s*calc\(33\.333% - 6px\)/);
  assert.match(relatedScss, /height:\s*200px/);
  assert.match(relatedScss, /width:\s*calc\(50% - 4px\)/);
  assert.match(relatedScss, /height:\s*150px/);
  assert.match(relatedScss, /width:\s*calc\(100% - 4px\)/);
  assert.match(relatedScss, /text-clamp\(2\)/);
  assert.match(relatedScss, /text-clamp\(3\)/);
  assert.match(relatedScss, /:focus-visible/);
  assert.match(relatedScss, /overflow-wrap:\s*anywhere/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(componentsHtml, /id="pagination"/);
  assert.match(componentsHtml, /class="pagination-post"/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.doesNotMatch(pagePostScss, /\.relatedPosts \{/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('编译后选择器挂在 .relatedPosts，无错误 BEM ID，不把文章上下篇压成 200px', () => {
  const css = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.relatedPosts/);
  assert.match(css, /33\.333%/);
  assert.match(css, /height:\s*200px/);
  assert.match(css, /#pagination\.pagination-post/);
  assert.match(css, /height:\s*150px/);
  assert.doesNotMatch(css, /#relatedPosts-list/);
  assert.doesNotMatch(css, /#relatedPosts-title/);
  assert.doesNotMatch(css, /\[data-theme/);
});
