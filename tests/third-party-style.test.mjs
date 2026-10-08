import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const thirdPartyScss = await readFile(new URL('../src/scss/core/third-party.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = thirdPartyScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('third-party.scss 挂在上游选择器，不使用 data-theme', () => {
  assert.match(indexScss, /@use "third-party"/);
  assert.match(rules, /#vcomment/);
  assert.match(rules, /#waline-wrap/);
  assert.match(rules, /\.artalk-vote/);
  assert.match(rules, /\.twikoo/);
  assert.match(rules, /\.fireworks/);
  assert.match(rules, /\.medium-zoom-image--opened/);
  assert.match(rules, /\.medium-zoom-overlay/);
  assert.match(rules, /\.mermaid-wrap/);
  assert.match(rules, /\.chartjs-container/);
  assert.match(rules, /#gitalk-container/);
  assert.match(rules, /\.katex-display/);
  assert.match(rules, /mjx-container/);
  assert.match(rules, /\.snackbar-container\.snackbar-css/);
  assert.match(rules, /\.abc-music-sheet/);
  assert.match(rules, /\.fancybox__toolbar__column\.is-middle/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
});

test('上游第三方：Valine 1.1em、Waline token、fireworks 9999、medium-zoom 99999、snackbar 0.85', () => {
  assert.match(thirdPartyScss, /font-size:\s*1\.1em/);
  assert.match(thirdPartyScss, /--waline-font-size:\s*1\.1em/);
  assert.match(thirdPartyScss, /--waline-theme-color:\s*var\(--btn-bg/);
  assert.match(thirdPartyScss, /z-index:\s*9999/);
  assert.match(thirdPartyScss, /z-index:\s*99999\s*!important/);
  assert.match(thirdPartyScss, /opacity:\s*\.85\s*!important/);
  assert.match(thirdPartyScss, /border-radius:\s*5px/);
  assert.match(thirdPartyScss, /@keyframes artalkVoteRipple/);
  assert.match(thirdPartyScss, /cursor:\s*grab/);
  assert.match(thirdPartyScss, /\.mermaid-open-btn/);
  assert.match(thirdPartyScss, /max-width:\s*768px/);
  assert.doesNotMatch(rules, /pre\s*>\s*code\.mermaid/);
  assert.doesNotMatch(rules, /\.katex\s*\{[^}]*display:\s*none/s);
  assert.doesNotMatch(rules, /background:\s*url\(/);
  assert.doesNotMatch(rules, /scrollbar-width:\s*none/);
});

test('本刀不接入第三方提供方、不改 hide_button、不改文章上下篇 150px、无新增 th:utext', () => {
  assert.doesNotMatch(settingsText, /name:\s*snackbar/);
  assert.doesNotMatch(settingsText, /name:\s*mermaid/);
  assert.doesNotMatch(settingsText, /name:\s*artalk/);
  assert.doesNotMatch(settingsText, /name:\s*waline/);
  assert.doesNotMatch(settingsText, /name:\s*fireworks/);
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(componentsHtml, /id="pagination"/);
  assert.match(componentsHtml, /class="pagination-post"/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('编译后选择器挂在第三方组件，无 data-theme，不把文章上下篇压掉', () => {
  const css = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#vcomment/);
  assert.match(css, /#waline-wrap/);
  assert.match(css, /\.fireworks/);
  assert.match(css, /z-index:\s*9999/);
  assert.match(css, /z-index:\s*99999\s*!important/);
  assert.match(css, /\.snackbar-container\.snackbar-css/);
  assert.match(css, /\.fancybox__toolbar__column\.is-middle/);
  assert.match(css, /#pagination\.pagination-post/);
  assert.match(css, /height:\s*150px/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /\.katex\s*\{[^}]*display:\s*none/s);
});
