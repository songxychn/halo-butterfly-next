import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const archivesScss = await readFile(new URL('../src/scss/core/archives.scss', import.meta.url), 'utf8');
const pageArchivesScss = await readFile(new URL('../src/scss/page/archives.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const archivesHtml = await readFile(new URL('../src/html/archives.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = archivesScss.replace(/\/\*[\s\S]*?\*\//g, '');
const pageRules = pageArchivesScss.replace(/\/\*[\s\S]*?\*\//g, '');

function compileArchivesCss() {
  return sass.compile(new URL('../src/scss/page/archives.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
}

test('archives.scss 挂在 .article-sort / .archives / .axis-*，选择器不使用 data-theme', () => {
  const i404 = indexScss.indexOf('@use "page-404"');
  const iArchives = indexScss.indexOf('@use "archives"');
  assert.match(indexScss, /^@use "archives";$/m);
  assert.ok(i404 !== -1 && iArchives > i404);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "archives"/s);
  assert.match(rules, /\.article-sort/);
  assert.match(rules, /\.article-sort-title|\.article-sort[\s\S]*&-title/);
  assert.match(rules, /\.article-sort-item|\.article-sort[\s\S]*&-item/);
  assert.match(rules, /\.no-article-cover/);
  assert.match(rules, /\.archives/);
  assert.match(rules, /\.axis-title/);
  assert.match(rules, /\.axis-list/);
  assert.match(rules, /\.axis-list--item|&--item/);
  assert.match(pageArchivesScss, /\.archives/);
  assert.match(pageArchivesScss, /&-title/);
  assert.match(pageArchivesScss, /&-list/);
  assert.match(archivesHtml, /class="archives"|page = 'archives'/);
  assert.match(archivesHtml, /class="axis-title"/);
  assert.match(archivesHtml, /class="axis-list"/);
  assert.match(archivesHtml, /axis-list--item/);
  assert.doesNotMatch(archivesHtml, /article-sort/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(pageRules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
});

test('上游归档数字：1.72em / 1.43em / .85em / 1.05em、封面 100×70、无封面 80px、clamp 2 与 translateX(10px)', () => {
  assert.match(archivesScss, /margin-left:\s*10px/);
  assert.match(archivesScss, /padding-left:\s*20px/);
  assert.match(archivesScss, /border-left:\s*2px/);
  assert.match(archivesScss, /font-size:\s*1\.72em/);
  assert.match(archivesScss, /padding-bottom:\s*20px/);
  assert.match(archivesScss, /width:\s*10px/);
  assert.match(archivesScss, /height:\s*1\.5em/);
  assert.match(archivesScss, /margin:\s*0 0 20px 10px/);
  assert.match(archivesScss, /width:\s*6px/);
  assert.match(archivesScss, /left:\s*calc\(-20px - 17px\)/);
  assert.match(archivesScss, /height:\s*80px/);
  assert.match(archivesScss, /font-size:\s*1\.43em/);
  assert.match(archivesScss, /margin-bottom:\s*10px/);
  assert.match(archivesScss, /font-size:\s*\.85em/);
  assert.match(archivesScss, /padding-left:\s*6px/);
  assert.match(archivesScss, /font-size:\s*1\.05em/);
  assert.match(archivesScss, /-webkit-line-clamp:\s*2/);
  assert.match(archivesScss, /transform:\s*translateX\(10px\)/);
  assert.match(archivesScss, /width:\s*100px/);
  assert.match(archivesScss, /height:\s*70px/);
  assert.match(archivesScss, /flex:\s*1/);
  assert.match(archivesScss, /padding:\s*0 16px/);
  assert.match(pageArchivesScss, /font-size:\s*1\.72em/);
  assert.match(pageArchivesScss, /width:\s*100px/);
  assert.match(pageArchivesScss, /height:\s*70px/);
  assert.match(pageArchivesScss, /height:\s*80px/);
  assert.match(pageArchivesScss, /font-size:\s*1\.05em/);
  assert.match(pageArchivesScss, /transform:\s*translateX\(10px\)/);
  assert.doesNotMatch(pageArchivesScss, /width:\s*6rem/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.doesNotMatch(archivesHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('Halo 封面改自身规则为 100×70，不用 #Butterfly 压 width 百分比', () => {
  const haloBlock = rules.slice(rules.lastIndexOf('.archives {'));
  assert.match(haloBlock, /\.cover/);
  assert.match(haloBlock, /width:\s*100px/);
  assert.match(haloBlock, /height:\s*70px/);
  assert.doesNotMatch(haloBlock, /\.cover\s*\{[^}]*\bwidth:\s*\d+%/s);
  assert.doesNotMatch(haloBlock, /#Butterfly/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(pageArchivesScss, /\.cover \{[\s\S]*width:\s*100px/);
  assert.match(pageArchivesScss, /@media screen and \(max-width:\s*768px\)[\s\S]*width:\s*70px/);
});

test('编译 archives.scss 后并列选择器保留 flex 时间轴，不把封面压成百分比列', () => {
  const css = compileArchivesCss();
  assert.match(css, /\.article-sort/);
  assert.match(css, /\.article-sort-title/);
  assert.match(css, /\.article-sort-item/);
  assert.match(css, /\.article-sort-item-img/);
  assert.match(css, /\.archives/);
  assert.match(css, /\.axis-title/);
  assert.match(css, /\.axis-list--item/);
  assert.match(css, /font-size:\s*1\.72em/);
  assert.match(css, /font-size:\s*1\.43em/);
  assert.match(css, /font-size:\s*0?\.85em/);
  assert.match(css, /font-size:\s*1\.05em/);
  assert.match(css, /height:\s*1\.5em/);
  assert.match(css, /height:\s*80px/);
  assert.match(css, /-webkit-line-clamp:\s*2/);
  assert.match(css, /transform:\s*translateX\(10px\)/);
  assert.match(archivesScss, /left:\s*calc\(-20px - 17px\)/);
  assert.match(css, /left:\s*-37px/);
  assert.match(css, /\.archives \.axis-list--item[^{]*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.archives \.axis-list--item[^{]*\{[^}]*align-items:\s*center/s);
  assert.match(css, /\.archives \.axis-list--item \.cover\s*\{[^}]*width:\s*100px/s);
  assert.match(css, /\.archives \.axis-list--item \.cover\s*\{[^}]*height:\s*70px/s);
  assert.match(css, /\.archives \.axis-list--item \.info\s*\{[^}]*flex:\s*1/s);
  assert.match(css, /\.article-sort-item-img\s*\{[^}]*width:\s*100px/s);
  assert.match(css, /\.article-sort-item-info\s*\{[^}]*flex:\s*1/s);
  assert.match(css, /\.article-sort-item\.no-article-cover\s*\{[^}]*height:\s*80px/s);
  assert.match(css, /\.archives \.axis-list--item\.no-cover\s*\{[^}]*height:\s*80px/s);
  assert.doesNotMatch(css, /#Butterfly\.archives[^{]*\.cover\s*\{[^}]*\bwidth:\s*\d+%/s);
  assert.doesNotMatch(css, /#Butterfly \.axis-list--item \.cover\s*\{[^}]*\bwidth:\s*\d+%/s);
  assert.doesNotMatch(css, /\.archives \.axis-list--item \.cover\s*\{[^}]*\bwidth:\s*\d+%/s);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
});
