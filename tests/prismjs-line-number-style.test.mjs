import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const prismjsLineNumberScss = await readFile(new URL('../src/scss/core/prismjs-line-number.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const codeBlockScss = await readFile(new URL('../src/scss/modules/codeBlock.scss', import.meta.url), 'utf8');
const rules = prismjsLineNumberScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('prismjs-line-number.scss 挂在 .container pre.line-numbers，core/index 顶层 @use 且在 prismjs-index 之后，选择器不使用 data-theme', () => {
  const iIndex = indexScss.indexOf('@use "prismjs-index"');
  const iLine = indexScss.indexOf('@use "prismjs-line-number"');
  assert.match(indexScss, /^@use "prismjs-line-number";$/m);
  assert.ok(iIndex !== -1 && iLine > iIndex);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "prismjs-line-number"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /pre\[class\*='language-'\]/);
  assert.match(rules, /\.line-numbers/);
  assert.match(rules, /\.line-numbers-rows/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /@use ['"]theme|theme\.styl/);
});

test('上游 prismjs/line-number 数字：padding-left 3.8em、line-height 1.6、rows left -3.8em / width 3em、span:before .8em / --hlnumber-color', () => {
  assert.match(rules, /padding-left:\s*3\.8em/);
  assert.match(rules, /counter-reset:\s*linenumber/);
  assert.match(rules, /line-height:\s*1\.6/);
  assert.match(rules, /left:\s*-3\.8em/);
  assert.match(rules, /width:\s*3em/);
  assert.match(rules, /letter-spacing:\s*-1px/);
  assert.match(rules, /padding-right:\s*\.?8em/);
  assert.match(rules, /color:\s*var\(--hlnumber-color\)/);
  assert.match(rules, /content:\s*counter\(linenumber\)/);
  assert.match(rules, /white-space:\s*inherit/);
  assert.doesNotMatch(rules, /white-space:\s*pre-wrap/);
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
  assert.match(codeBlockScss, /padding:\s*30px 0 0/);
  assert.match(codeBlockScss, /\.line-numbers-rows/);
  assert.match(codeBlockScss, /left:\s*0/);
  assert.match(codeBlockScss, /padding:\s*10px 20px 10px 50px/);
  assert.doesNotMatch(navHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
  assert.match(codeBlockScss, /\.code-toolbar/);
  assert.match(postHtml, /views\/components :: codeBlockPin/);
});

test('不用 #Butterfly 把 padding-left 3.8em 压到主栏或 .code-toolbar；不实现 theme.styl', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(prismjsLineNumberScss.replace(/\/\*[\s\S]*?\*\//g, ''), /theme\.styl/);
  assert.doesNotMatch(postHtml, /figure class="highlight"|figure\.highlight/);
});

test('编译实际会 @use core 的 page/index.scss 后保留上游数字，不把 padding-left 3.8em 压到 #Butterfly 主栏或 .code-toolbar', () => {
  const css = compilePageCss();
  assert.match(css, /\.container pre\[class\*=language-\]\.line-numbers/);
  assert.match(css, /padding-left:\s*3\.8em/);
  assert.match(css, /left:\s*-3\.8em/);
  assert.match(css, /counter-reset:\s*linenumber/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*padding-left:\s*3\.8em/s);
  assert.doesNotMatch(css, /#Butterfly \.code-toolbar[^{]*\{[^}]*padding-left:\s*3\.8em/s);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /padding-left:\s*3\.8em/);
    assert.doesNotMatch(rule.body, /left:\s*-3\.8em/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /padding-left:\s*3\.8em/);
    assert.doesNotMatch(rule.body, /left:\s*-3\.8em/);
  }

  const containerLang = compiled.filter((rule) => /\.container/.test(rule.selector) && /language-/.test(rule.selector) && /line-numbers/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerLang.some((rule) => /padding-left:\s*3\.8em/.test(rule.body)));
  assert.ok(containerLang.some((rule) => /left:\s*-3\.8em/.test(rule.body)));

  assert.match(codeBlockScss, /padding:\s*30px 0 0/);
  assert.match(codeBlockScss, /padding:\s*10px 20px 10px 50px/);
});
