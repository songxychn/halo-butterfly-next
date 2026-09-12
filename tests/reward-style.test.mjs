import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const rewardScss = await readFile(new URL('../src/scss/core/reward.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = rewardScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('reward.scss 并列 .post-reward / img.post-qr-code-img，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "reward"/);
  assert.match(rules, /\.post-reward \{/);
  assert.match(rules, /\.reward-button/);
  assert.match(rules, /\.reward-main/);
  assert.match(rules, /\.reward-all/);
  assert.match(rules, /\.reward-item/);
  assert.match(rules, /img\.post-qr-code-img/);
  assert.match(componentsHtml, /class="post-reward"/);
  assert.match(componentsHtml, /class="reward-button"/);
  assert.match(componentsHtml, /class="post-qr-code-img"/);
  assert.match(postHtml, /components :: postReward/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
});

test('上游打赏：margin-top 80px、pointer-events、按钮配色、弹层 --reward-pop、二维码 130px', () => {
  assert.match(rewardScss, /margin-top:\s*80px/);
  assert.match(rewardScss, /pointer-events:\s*none/);
  assert.match(rewardScss, /pointer-events:\s*auto/);
  assert.match(rewardScss, /padding:\s*4px 24px/);
  assert.match(rewardScss, /var\(--btn-bg/);
  assert.match(rewardScss, /var\(--btn-color/);
  assert.match(rewardScss, /var\(--btn-hover-color/);
  assert.match(rewardScss, /var\(--reward-pop,\s*#f5f5f5\)/);
  assert.match(rewardScss, /bottom:\s*50px/);
  assert.match(rewardScss, /z-index:\s*100/);
  assert.match(rewardScss, /&:hover > \.reward-main/);
  assert.match(rewardScss, /border-top:\s*13px solid var\(--reward-pop/);
  assert.match(rewardScss, /width:\s*130px/);
  assert.match(rewardScss, /height:\s*130px/);
  assert.match(rewardScss, /color:\s*#858585/);
  assert.match(rewardScss, /:focus-visible/);
  assert.match(rewardScss, /overflow-wrap:\s*anywhere/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(componentsHtml, /id="pagination"/);
  assert.match(componentsHtml, /class="pagination-post"/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.doesNotMatch(pagePostScss, /\.post-reward \{/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('编译后选择器挂在 .post-reward，无 data-theme，不把文章上下篇压成弹层', () => {
  const css = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.post-reward/);
  assert.match(css, /--reward-pop/);
  assert.match(css, /#pagination\.pagination-post/);
  assert.match(css, /height:\s*150px/);
  assert.doesNotMatch(css, /#reward-button/);
  assert.doesNotMatch(css, /#reward-main/);
  assert.doesNotMatch(css, /\[data-theme/);
});
