import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const homepageScss = await readFile(new URL('../src/scss/core/homepage.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const listHtml = componentsHtml.slice(
  componentsHtml.indexOf('th:fragment="list(data,layout)"'),
  componentsHtml.indexOf('th:fragment="emptyData'),
);
const rules = homepageScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('homepage.scss 挂在 #recent-posts / .essay，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "homepage"/);
  assert.match(rules, /#recent-posts/);
  assert.match(rules, /\.recent-post-item/);
  assert.match(rules, /#Butterfly \.essay/);
  assert.match(rules, /\.essay\.list/);
  assert.match(rules, /\.essay\.tile/);
  assert.match(rules, /\.layout-4/);
  assert.match(rules, /\.layout-5/);
  assert.match(rules, /\.layout-6/);
  assert.match(rules, /\.layout-7/);
  assert.match(rules, /\.ads-wrap/);
  assert.match(rules, /\.post_cover/);
  assert.match(rules, /\.post-bg/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
});

test('上游首页列表：16.8em、封面 42%/230px、hover scale、两列 8px、17em 遮罩', () => {
  assert.match(homepageScss, /height:\s*16\.8em/);
  assert.match(homepageScss, /height:\s*18\.8em/);
  assert.match(homepageScss, /width:\s*42%/);
  assert.match(homepageScss, /width:\s*58%/);
  assert.match(homepageScss, /height:\s*230px/);
  assert.match(homepageScss, /margin-bottom:\s*20px/);
  assert.match(homepageScss, /transform:\s*scale\(1\.1\)/);
  assert.match(homepageScss, /calc\(100% \/ 2 - 8px\)/);
  assert.match(homepageScss, /calc\(100% \/ 3 - 8px\)/);
  assert.match(homepageScss, /height:\s*17em/);
  assert.match(homepageScss, /backdrop-filter:\s*blur\(3px\)/);
  assert.match(homepageScss, /font-size:\s*1\.55em/);
  assert.match(homepageScss, /font-size:\s*1\.43em/);
  assert.match(homepageScss, /#ff7242/);
  assert.doesNotMatch(rules, /time\s*\{[^}]*display:\s*none/s);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(componentsHtml, /id="pagination"/);
  assert.match(componentsHtml, /class="pagination-post"/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.doesNotMatch(listHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
  assert.match(settingsText, /name: post_layout/);
  assert.match(settingsText, /value: list/);
});

test('编译后选择器挂在 #recent-posts / .essay，无 data-theme，不把文章上下篇压掉', () => {
  const css = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#recent-posts/);
  assert.match(css, /\.recent-post-item/);
  assert.match(css, /#Butterfly \.essay/);
  assert.match(css, /width:\s*42%/);
  assert.match(css, /height:\s*16\.8em/);
  assert.match(css, /height:\s*230px/);
  assert.match(css, /transform:\s*scale\(1\.1\)/);
  assert.match(css, /\.ads-wrap/);
  assert.match(css, /calc\(50% - 8px\)/);
  assert.match(css, /calc\(33\.3333333333% - 8px\)/);
  assert.match(css, /height:\s*17em/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /#pagination\.pagination-post/);
  assert.match(css, /height:\s*150px/);
  assert.doesNotMatch(css, /\[data-theme/);
});
