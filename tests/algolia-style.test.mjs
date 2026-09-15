import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const algoliaScss = await readFile(new URL('../src/scss/core/algolia.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = algoliaScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('algolia.scss 挂在 #algolia-search，core/index 顶层 @use 且在 search 之后，选择器不使用 data-theme', () => {
  const iSearch = indexScss.indexOf('@use "search"');
  const iAlgolia = indexScss.indexOf('@use "algolia"');
  assert.match(indexScss, /^@use "algolia";$/m);
  assert.ok(iSearch !== -1 && iAlgolia > iSearch);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "algolia"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /#algolia-search/);
  assert.match(rules, /\.ais-Hits-list/);
  assert.match(rules, /#algolia-info/);
  assert.match(rules, /\.algolia-poweredBy/);
  assert.match(navHtml, /SearchWidget\.open\(\)/);
  assert.doesNotMatch(navHtml, /algolia-search/);
  assert.doesNotMatch(navHtml, /search-dialog/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
});

test('上游 Algolia 数字：768 min-height calc(var(--search-height) - 245px)、poweredBy float right / padding-top 2px / svg 1.1em', () => {
  assert.match(rules, /@media screen and \(max-width:\s*768px\)/);
  assert.match(rules, /min-height:\s*calc\(var\(--search-height\) - 245px\)/);
  assert.match(rules, /float:\s*right/);
  assert.match(rules, /padding-top:\s*2px/);
  assert.match(rules, /height:\s*1\.1em/);
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

test('不用 #Butterfly 把 min-height 压到主栏；不接入 Algolia SDK', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(navHtml, /algolia/i);
  assert.match(navHtml, /SearchWidget\.open\(\)/);
});

test('编译实际会 @use core 的 page/index.scss 后保留上游数字，不把 min-height 压到 #Butterfly 主栏', () => {
  const css = compilePageCss();
  assert.match(css, /#algolia-search/);
  assert.match(css, /\.ais-Hits-list/);
  assert.match(css, /\.algolia-poweredBy/);
  assert.match(css, /min-height:\s*calc\(var\(--search-height\) - 245px\)/);
  assert.match(css, /float:\s*right/);
  assert.match(css, /padding-top:\s*2px/);
  assert.match(css, /height:\s*1\.1em/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly #algolia-search/);
  assert.doesNotMatch(css, /#Butterfly\.algolia/);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*min-height:\s*calc\(var\(--search-height\) - 245px\)/s);

  assert.match(css, /#algolia-search \.search-dialog \.ais-Hits-list\s*\{[^}]*min-height:\s*calc\(var\(--search-height\) - 245px\)/s);
  assert.match(css, /#algolia-search \.search-dialog #algolia-info \.algolia-poweredBy\s*\{[^}]*float:\s*right/s);
  assert.match(css, /#algolia-search \.search-dialog #algolia-info \.algolia-poweredBy\s*\{[^}]*padding-top:\s*2px/s);

  const compiled = cssRules(css);

  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /min-height:\s*calc\(var\(--search-height\) - 245px\)/);
    assert.doesNotMatch(rule.body, /height:\s*1\.1em/);
  }

  const butterflyAlgolia = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /#algolia-search/.test(rule.selector));
  assert.equal(butterflyAlgolia.length, 0);
});
