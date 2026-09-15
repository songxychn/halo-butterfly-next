import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const sidebarScss = await readFile(new URL('../src/scss/core/sidebar.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const commonScss = await readFile(new URL('../src/scss/core/common.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = sidebarScss.replace(/\/\*[\s\S]*?\*\//g, '');

test('sidebar.scss 并列 #sidebar-menus / .side-bar，选择器不使用 data-theme', () => {
  assert.match(indexScss, /@use "sidebar"/);
  assert.match(rules, /#sidebar #menu-mask/);
  assert.match(rules, /#Butterfly > \.mask/);
  assert.match(rules, /#sidebar-menus/);
  assert.match(rules, /#mobile-navigation\.side-bar/);
  assert.match(rules, /\.side-bar \{/);
  assert.match(rules, /\.menus_items/);
  assert.match(rules, /menu\.bar/);
  assert.match(rules, /\.site-page/);
  assert.match(rules, /\.bar-item > \.link/);
  assert.match(componentsHtml, /id="mobile-navigation"/);
  assert.match(componentsHtml, /class="side-bar"/);
  assert.match(navHtml, /aria-controls="mobile-navigation"/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
});

test('上游移动侧栏：330px、z-index 102/103、--sidebar-bg、open 位移、菜单 20px/15px', () => {
  assert.match(sidebarScss, /right:\s*-330px/);
  assert.match(sidebarScss, /width:\s*330px/);
  assert.match(sidebarScss, /z-index:\s*102/);
  assert.match(sidebarScss, /z-index:\s*103/);
  assert.match(sidebarScss, /rgba\(0, 0, 0, \.8\)/);
  assert.match(sidebarScss, /var\(--sidebar-bg,\s*#f6f8fa\)/);
  assert.match(sidebarScss, /var\(--sidebar-menu-bg,\s*#fff\)/);
  assert.match(sidebarScss, /translate3d\(-100%, 0, 0\)/);
  assert.match(sidebarScss, /margin:\s*20px auto/);
  assert.match(sidebarScss, /padding:\s*0 10px/);
  assert.match(sidebarScss, /margin:\s*20px/);
  assert.match(sidebarScss, /padding:\s*15px/);
  assert.match(sidebarScss, /padding:\s*2px 23px 2px 15px/);
  assert.match(sidebarScss, /font-size:\s*1\.15em/);
  assert.match(sidebarScss, /translateX\(3px\)/);
  assert.match(sidebarScss, /max-height:\s*1000px/);
  assert.match(sidebarScss, /:focus-visible/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(componentsHtml, /id="pagination"/);
  assert.match(componentsHtml, /class="pagination-post"/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.doesNotMatch(commonScss, /right:\s*-300px/);
  assert.match(commonScss, /bottom:\s*var\(--rightside-bottom,\s*40px\)/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('编译后选择器挂在 #sidebar-menus / .side-bar，无 data-theme，不把文章上下篇压掉', () => {
  const css = sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#sidebar-menus/);
  assert.match(css, /\.side-bar/);
  assert.match(css, /#mobile-navigation/);
  assert.match(css, /330px/);
  assert.match(css, /#pagination\.pagination-post/);
  assert.match(css, /height:\s*150px/);
  assert.doesNotMatch(css, /\[data-theme/);
});
