import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const searchScss = await readFile(new URL('../src/scss/core/search.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = searchScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('search.scss 挂在 .search-dialog，core/index 顶层 @use 且在 tags 之后，选择器不使用 data-theme', () => {
  const iTags = indexScss.indexOf('@use "tags"');
  const iSearch = indexScss.indexOf('@use "search"');
  assert.match(indexScss, /^@use "search";$/m);
  assert.ok(iTags !== -1 && iSearch > iTags);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "search"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.search-dialog/);
  assert.match(rules, /\.search-nav/);
  assert.match(rules, /#search-mask/);
  assert.match(navHtml, /SearchWidget\.open\(\)/);
  assert.doesNotMatch(navHtml, /search-dialog/);
  assert.doesNotMatch(navHtml, /search-mask/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
});

test('上游搜索面板数字：宽 600px、top 10%、padding 20px、圆角 8、768 全屏、nav 1.4em、输入 5px 14px / border 2px / 圆角 40px、结果 calc(80vh - 220px)', () => {
  assert.match(rules, /width:\s*600px/);
  assert.match(rules, /top:\s*10%/);
  assert.match(rules, /padding:\s*20px/);
  assert.match(rules, /border-radius:\s*8px/);
  assert.match(rules, /@media screen and \(max-width:\s*768px\)/);
  assert.match(rules, /font-size:\s*1\.4em/);
  assert.match(rules, /padding:\s*5px 14px/);
  assert.match(rules, /border:\s*2px solid/);
  assert.match(rules, /border-radius:\s*40px/);
  assert.match(rules, /max-height:\s*calc\(80vh - 220px\)/);
  assert.match(rules, /z-index:\s*1001/);
  assert.match(rules, /margin-left:\s*-300px/);
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

test('不用 #Butterfly 把 600px 弹层或 768 全屏压到主栏', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /@use "algolia"/);
  assert.doesNotMatch(rules, /@use "local-search"/);
  assert.doesNotMatch(rules, /@require/);
  assert.match(navHtml, /SearchWidget\.open\(\)/);
});

test('编译实际会 @use core 的 page/index.scss 后保留上游数字，不把 600px/100% 压到 #Butterfly 主栏', () => {
  const css = compilePageCss();
  assert.match(css, /\.search-dialog/);
  assert.match(css, /#search-mask/);
  assert.match(css, /\.search-nav/);
  assert.match(css, /width:\s*600px/);
  assert.match(css, /top:\s*10%/);
  assert.match(css, /padding:\s*20px/);
  assert.match(css, /border-radius:\s*8px/);
  assert.match(css, /font-size:\s*1\.4em/);
  assert.match(css, /padding:\s*5px 14px/);
  assert.match(css, /border:\s*2px solid/);
  assert.match(css, /border-radius:\s*40px/);
  assert.match(css, /max-height:\s*calc\(80vh - 220px\)/);
  assert.match(css, /@media screen and \(max-width:\s*768px\)/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.search-dialog/);
  assert.doesNotMatch(css, /#Butterfly\.search-dialog/);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*width:\s*600px/s);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*width:\s*100%/s);
  assert.doesNotMatch(css, /#Butterfly \.content[^{]*\{[^}]*width:\s*600px/s);

  const compiled = cssRules(css);
  const dialog = compiled.filter((rule) => /\.search-dialog\b/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(dialog.some((rule) => /width:\s*600px/.test(rule.body)));
  assert.ok(dialog.some((rule) => /padding:\s*20px/.test(rule.body)));
  assert.ok(dialog.some((rule) => /border-radius:\s*8px/.test(rule.body)));
  assert.ok(dialog.some((rule) => /top:\s*10%/.test(rule.body)));

  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /width:\s*600px/);
    assert.doesNotMatch(rule.body, /top:\s*10%/);
    assert.doesNotMatch(rule.body, /max-height:\s*calc\(80vh - 220px\)/);
  }

  const butterflyDialog = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.search-dialog\b/.test(rule.selector));
  assert.equal(butterflyDialog.length, 0);
});
