import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const localScss = await readFile(new URL('../src/scss/core/local-search.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = localScss.replace(/\/\*[\s\S]*?\*\//g, '');

function compilePageCss() {
  return sass.compile(new URL('../src/scss/page/index.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function cssRules(css) {
  const rules = [];
  const re = /([^{]+)\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(css))) {
    rules.push({
      selector: match[1].replace(/\s+/g, ' ').trim(),
      body: match[2],
    });
  }
  return rules;
}

test('local-search.scss 挂在 #local-search，core/index 顶层 @use 且在 algolia 之后，选择器不使用 data-theme', () => {
  const iAlgolia = indexScss.indexOf('@use "algolia"');
  const iLocal = indexScss.indexOf('@use "local-search"');
  assert.match(indexScss, /^@use "local-search";$/m);
  assert.ok(iAlgolia !== -1 && iLocal > iAlgolia);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "local-search"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /#local-search/);
  assert.match(rules, /\.search-result-list/);
  assert.match(rules, /#local-search-stats/);
  assert.match(rules, /\.search-keyword/);
  assert.match(rules, /#loading-database/);
  assert.match(navHtml, /SearchWidget\.open\(\)/);
  assert.doesNotMatch(navHtml, /local-search/);
  assert.doesNotMatch(navHtml, /search-dialog/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
});

test('上游本地搜索数字：768 min-height calc(var(--search-height) - 255px)、max-height calc(var(--search-height) - 200px)、stats left、keyword 600、loading-database hidden', () => {
  assert.match(rules, /@media screen and \(max-width:\s*768px\)/);
  assert.match(rules, /min-height:\s*calc\(var\(--search-height\) - 255px\)\s*!important/);
  assert.match(rules, /max-height:\s*calc\(var\(--search-height\) - 200px\)\s*!important/);
  assert.match(rules, /text-align:\s*left/);
  assert.match(rules, /font-weight:\s*600/);
  assert.match(rules, /visibility:\s*hidden/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.doesNotMatch(navHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('不用 #Butterfly 把 min-height / max-height 压到主栏；不接入搜索提供方 SDK', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(navHtml, /local-search/i);
  assert.match(navHtml, /SearchWidget\.open\(\)/);
});

test('编译实际会 @use core 的 page/index.scss 后保留上游数字，不把高度压到 #Butterfly 主栏', () => {
  const css = compilePageCss();
  assert.match(css, /#local-search/);
  assert.match(css, /\.search-result-list/);
  assert.match(css, /min-height:\s*calc\(var\(--search-height\) - 255px\)\s*!important/);
  assert.match(css, /max-height:\s*calc\(var\(--search-height\) - 200px\)\s*!important/);
  assert.match(css, /font-weight:\s*600/);
  assert.match(css, /visibility:\s*hidden/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly #local-search/);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*min-height:\s*calc\(var\(--search-height\) - 255px\)/s);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*max-height:\s*calc\(var\(--search-height\) - 200px\)/s);

  assert.match(css, /#local-search \.search-dialog \.search-result-list\s*\{[^}]*min-height:\s*calc\(var\(--search-height\) - 255px\)/s);
  assert.match(css, /#local-search \.search-dialog \.search-result-list\s*\{[^}]*max-height:\s*calc\(var\(--search-height\) - 200px\)/s);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /min-height:\s*calc\(var\(--search-height\) - 255px\)/);
    assert.doesNotMatch(rule.body, /max-height:\s*calc\(var\(--search-height\) - 200px\)/);
  }

  const butterflyLocal = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /#local-search/.test(rule.selector));
  assert.equal(butterflyLocal.length, 0);
});
