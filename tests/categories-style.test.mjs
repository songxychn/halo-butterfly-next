import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const categoriesScss = await readFile(new URL('../src/scss/core/categories.scss', import.meta.url), 'utf8');
const pageCategoriesScss = await readFile(new URL('../src/scss/page/categories.scss', import.meta.url), 'utf8');
const categoryPageScss = await readFile(new URL('../src/scss/page/category.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const categoriesHtml = await readFile(new URL('../src/html/categories.html', import.meta.url), 'utf8');
const categoryHtml = await readFile(new URL('../src/html/category.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = categoriesScss.replace(/\/\*[\s\S]*?\*\//g, '');
const pageRules = pageCategoriesScss.replace(/\/\*[\s\S]*?\*\//g, '');

function compileCategoriesCss() {
  return sass.compile(new URL('../src/scss/page/categories.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
}

test('categories.scss 挂在 .category-lists / .categories，选择器不使用 data-theme', () => {
  const iArchives = indexScss.indexOf('@use "archives"');
  const iCategories = indexScss.indexOf('@use "categories"');
  assert.match(indexScss, /^@use "categories";$/m);
  assert.ok(iArchives !== -1 && iCategories > iArchives);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "categories"/s);
  assert.match(rules, /\.category-lists/);
  assert.match(rules, /\.category-title/);
  assert.match(rules, /\.category-list/);
  assert.match(rules, /\.category-list-count/);
  assert.match(rules, /@mixin list-beauty/);
  assert.match(rules, /@include list-beauty/);
  assert.match(rules, /\.categories/);
  assert.match(pageCategoriesScss, /\.categories/);
  assert.match(pageCategoriesScss, /\.chart/);
  assert.match(categoriesHtml, /page = 'categories'/);
  assert.match(categoriesHtml, /class="chart"/);
  assert.doesNotMatch(categoriesHtml, /category-lists/);
  assert.doesNotMatch(categoryHtml, /category-lists/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(pageRules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
});

test('上游分类数字：2.57em / 768 2em、count 8px 与括号、ul 20px / 内层 4px、li 6px 与 .12em .4em .12em 1.4em', () => {
  assert.match(categoriesScss, /font-size:\s*2\.57em/);
  assert.match(categoriesScss, /@media screen and \(max-width:\s*768px\)/);
  assert.match(categoriesScss, /font-size:\s*2em/);
  assert.match(categoriesScss, /margin-left:\s*8px/);
  assert.match(categoriesScss, /content:\s*'\('/);
  assert.match(categoriesScss, /content:\s*'\)'/);
  assert.match(categoriesScss, /padding:\s*0 0 0 20px/);
  assert.match(categoriesScss, /padding-left:\s*4px/);
  assert.match(categoriesScss, /margin:\s*6px 0/);
  assert.match(categoriesScss, /padding:\s*\.12em \.4em \.12em 1\.4em/);
  assert.match(categoriesScss, /list-style:\s*none/);
  assert.match(categoriesScss, /width:\s*\.43em/);
  assert.match(categoriesScss, /height:\s*\.43em/);
  assert.match(categoriesScss, /top:\s*\.67em/);
  assert.match(pageCategoriesScss, /height:\s*450px/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.doesNotMatch(categoriesHtml, /th:utext/);
  assert.doesNotMatch(categoryHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('Halo 图表页保留 450px，不用 #Butterfly 压 width/height；单分类仍走 essayList', () => {
  assert.match(pageCategoriesScss, /\.chart \{[\s\S]*height:\s*450px/);
  assert.doesNotMatch(pageRules, /#Butterfly/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(categoriesHtml, /category-lists/);
  assert.match(categoryHtml, /views\/components:: list/);
  assert.match(categoryPageScss, /components\.essayList/);
  assert.doesNotMatch(rules, /\.essay/);
  const haloBlock = rules.slice(rules.lastIndexOf('.categories {'));
  assert.match(haloBlock, /\.category-title/);
  assert.match(haloBlock, /\.category-list/);
});

test('编译 categories.scss 后并列选择器保留上游数字，不把图表压成百分比列', () => {
  const css = compileCategoriesCss();
  assert.match(css, /\.category-lists/);
  assert.match(css, /\.category-title/);
  assert.match(css, /\.category-list-count/);
  assert.match(css, /\.categories/);
  assert.match(css, /font-size:\s*2\.57em/);
  assert.match(css, /font-size:\s*2em/);
  assert.match(css, /margin-left:\s*8px/);
  assert.match(css, /content:\s*["']\(["']|content:\s*["']\\28["']/);
  assert.match(css, /content:\s*["']\)["']|content:\s*["']\\29["']/);
  assert.match(css, /padding:\s*0 0 0 20px/);
  assert.match(css, /padding-left:\s*4px/);
  assert.match(css, /margin:\s*6px 0/);
  assert.match(css, /padding:\s*0?\.12em 0?\.4em 0?\.12em 1\.4em/);
  assert.match(css, /list-style:\s*none/);
  assert.match(css, /width:\s*0?\.43em/);
  assert.match(css, /height:\s*0?\.43em/);
  assert.match(css, /top:\s*0?\.67em/);
  assert.match(css, /\.categories \.chart\s*\{[^}]*height:\s*450px/s);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly\.categories[^{]*\{[^}]*\bwidth:\s*\d+%/s);
  assert.doesNotMatch(css, /#Butterfly\.categories[^{]*\{[^}]*\bheight:\s*\d+px/s);
  assert.doesNotMatch(css, /#Butterfly \.chart\s*\{[^}]*\bheight:\s*\d+%/s);
  assert.doesNotMatch(css, /\.categories ul\s*\{/);
  assert.match(css, /\.categories \.category-list ul\s*\{/);
});
