import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const highlightIndexScss = await readFile(new URL('../src/scss/core/highlight-index.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const codeBlockScss = await readFile(new URL('../src/scss/modules/codeBlock.scss', import.meta.url), 'utf8');
const rules = highlightIndexScss.replace(/\/\*[\s\S]*?\*\//g, '');

function compilePageCss() {
  return sass.compile(new URL('../src/scss/page/index.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function cssRules(css) {
  const parsed = [];
  const re = /([^{]+)\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(css))) {
    parsed.push({
      selector: match[1].replace(/\s+/g, ' ').trim(),
      body: match[2],
    });
  }
  return parsed;
}

test('highlight-index.scss 挂在 .container figure.highlight，core/index 顶层 @use 且在 highlight 之后，选择器不使用 data-theme', () => {
  const iHighlight = indexScss.indexOf('@use "highlight";');
  const iIndex = indexScss.indexOf('@use "highlight-index"');
  assert.match(indexScss, /^@use "highlight-index";$/m);
  assert.ok(iHighlight !== -1 && iIndex > iHighlight);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "highlight-index"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /figure\.highlight/);
  assert.match(rules, /\.line/);
  assert.match(rules, /\.gutter pre/);
  assert.match(rules, /\.code pre/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /@use ['"]prismjs|@use ['"]theme|diff\.styl/);
});

test('上游 highlight/index 数字：line:before min-width 30px / padding 0 6px 0 0、marked #80cbc440、table overflow auto、gutter padding 10px right、code pre width 100%', () => {
  assert.match(rules, /padding:\s*0 6px 0 0/);
  assert.match(rules, /min-width:\s*30px/);
  assert.match(rules, /background-color:\s*#80cbc440/);
  assert.match(rules, /display:\s*block/);
  assert.match(rules, /overflow:\s*auto/);
  assert.match(rules, /border:\s*none/);
  assert.match(rules, /padding:\s*0/);
  assert.match(rules, /padding-right:\s*10px/);
  assert.match(rules, /padding-left:\s*10px/);
  assert.match(rules, /text-align:\s*right/);
  assert.match(rules, /width:\s*100%/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不改主题枚举', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.match(settingsText, /code_theme_light/);
  assert.match(settingsText, /one-light/);
  assert.match(settingsText, /code_theme_dark/);
  assert.match(settingsText, /one-dark/);
  assert.doesNotMatch(navHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
  assert.match(codeBlockScss, /\.code-toolbar/);
  assert.match(postHtml, /views\/components :: codeBlockPin/);
});

test('不用 #Butterfly 把 overflow/width/min-width 压到主栏或 .code-toolbar；不实现 prismjs/theme/diff', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(highlightIndexScss.replace(/\/\*[\s\S]*?\*\//g, ''), /prismjs|theme\.styl|diff\.styl/);
  assert.doesNotMatch(postHtml, /figure class="highlight"|figure\.highlight/);
});

test('编译实际会 @use core 的 page/index.scss 后保留上游数字，不把 width 100% / min-width 30px 压到 #Butterfly 主栏或 .code-toolbar', () => {
  const css = compilePageCss();
  assert.match(css, /\.container figure\.highlight/);
  assert.match(css, /min-width:\s*30px/);
  assert.match(css, /padding:\s*0 6px 0 0/);
  assert.match(css, /rgba\(128,\s*203,\s*196/);
  assert.match(css, /width:\s*100%/);
  assert.match(css, /padding-right:\s*10px/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*min-width:\s*30px/s);
  assert.doesNotMatch(css, /#Butterfly \.code-toolbar[^{]*\{[^}]*min-width:\s*30px/s);
  assert.match(css, /\.container figure\.highlight \.code pre\s*\{[^}]*width:\s*100%/s);
  assert.match(css, /\.container figure\.highlight \.line:before\s*\{[^}]*min-width:\s*30px/s);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /min-width:\s*30px/);
    assert.doesNotMatch(rule.body, /padding:\s*0 6px 0 0/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /min-width:\s*30px/);
    assert.doesNotMatch(rule.body, /padding:\s*0 6px 0 0/);
  }

  const containerFigure = compiled.filter((rule) => /\.container/.test(rule.selector) && /figure\.highlight/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerFigure.some((rule) => /min-width:\s*30px/.test(rule.body)));
  assert.ok(containerFigure.some((rule) => /width:\s*100%/.test(rule.body)));

  const butterflyHighlight = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /figure\.highlight/.test(rule.selector));
  assert.equal(butterflyHighlight.length, 0);
});
