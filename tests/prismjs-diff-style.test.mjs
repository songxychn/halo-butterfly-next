import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const prismjsDiffScss = await readFile(new URL('../src/scss/core/prismjs-diff.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const codeBlockScss = await readFile(new URL('../src/scss/modules/codeBlock.scss', import.meta.url), 'utf8');
const rules = prismjsDiffScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('prismjs-diff.scss 挂在 .container pre[class*="language-"]，core/index 顶层 @use 且在 highlight-diff 之后，选择器不使用 data-theme', () => {
  const iDiff = indexScss.indexOf('@use "highlight-diff"');
  const iPrism = indexScss.indexOf('@use "prismjs-diff"');
  assert.match(indexScss, /^@use "prismjs-diff";$/m);
  assert.ok(iDiff !== -1 && iPrism > iDiff);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "prismjs-diff"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /pre\[class\*='language-'\]/);
  assert.match(rules, /\.token\.function/);
  assert.match(rules, /\.token\.comment/);
  assert.match(rules, /\.token\.deleted/);
  assert.match(rules, /\.token\.inserted/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /@use ['"]prismjs\/index|@use ['"]line-number|@use ['"]theme/);
});

test('上游 prismjs/diff light 默认 token：function #ffb62c、comment rgba(149,165,166,.8)、punctuation #5e6687、operator #c76b29、string #22a2c9、important #c94922、deleted line-through', () => {
  assert.match(rules, /color:\s*#ffb62c/);
  assert.match(rules, /color:\s*rgba\(149,\s*165,\s*166,\s*0\.8\)/);
  assert.match(rules, /color:\s*#5e6687/);
  assert.match(rules, /opacity:\s*0\.7/);
  assert.match(rules, /color:\s*#c76b29/);
  assert.match(rules, /color:\s*#c08b30/);
  assert.match(rules, /color:\s*#3d8fd1/);
  assert.match(rules, /color:\s*#22a2c9/);
  assert.match(rules, /color:\s*#6679cc/);
  assert.match(rules, /color:\s*#ac9739/);
  assert.match(rules, /color:\s*#c94922/);
  assert.match(rules, /text-decoration:\s*line-through/);
  assert.match(rules, /border-bottom:\s*1px dotted #202746/);
  assert.match(rules, /outline:\s*0\.4em solid #c94922/);
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
  assert.match(componentsHtml, /plugins\/prism\/themes\/prism-/);
  assert.doesNotMatch(navHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
  assert.match(codeBlockScss, /\.code-toolbar/);
  assert.match(postHtml, /views\/components :: codeBlockPin/);
});

test('不用 #Butterfly 把 token 颜色压到主栏或 .code-toolbar；不实现 prismjs/index、line-number、theme.styl', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(prismjsDiffScss.replace(/\/\*[\s\S]*?\*\//g, ''), /prismjs\/index|line-number\.styl|theme\.styl/);
  assert.doesNotMatch(postHtml, /figure class="highlight"|figure\.highlight/);
});

test('编译实际会 @use core 的 page/index.scss 后保留上游 token，不把 #ffb62c / line-through 压到 #Butterfly 主栏或 .code-toolbar', () => {
  const css = compilePageCss();
  assert.match(css, /\.container pre\[class\*=language-\]/);
  assert.match(css, /#ffb62c/);
  assert.match(css, /#5e6687/);
  assert.match(css, /#c76b29/);
  assert.match(css, /#22a2c9/);
  assert.match(css, /#c94922/);
  assert.match(css, /line-through/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*#ffb62c/s);
  assert.doesNotMatch(css, /#Butterfly \.code-toolbar[^{]*\{[^}]*#ffb62c/s);

  assert.match(css, /\.container pre\[class\*=language-\] \.token\.function\s*\{[^}]*color:\s*#ffb62c/s);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /#ffb62c/);
    assert.doesNotMatch(rule.body, /#c94922/);
    assert.doesNotMatch(rule.body, /line-through/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /#ffb62c/);
    assert.doesNotMatch(rule.body, /#c94922/);
    assert.doesNotMatch(rule.body, /line-through/);
    assert.doesNotMatch(rule.body, /#5e6687/);
  }

  const containerLang = compiled.filter((rule) => /\.container/.test(rule.selector) && /language-/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerLang.some((rule) => /#ffb62c/.test(rule.body)));
  assert.ok(containerLang.some((rule) => /#22a2c9/.test(rule.body)));
  assert.ok(containerLang.some((rule) => /line-through/.test(rule.body)));

  const butterflyLang = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /language-/.test(rule.selector) && /\.token/.test(rule.selector));
  assert.equal(butterflyLang.length, 0);
});
