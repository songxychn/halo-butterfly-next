import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const highlightDiffScss = await readFile(new URL('../src/scss/core/highlight-diff.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const codeBlockScss = await readFile(new URL('../src/scss/modules/codeBlock.scss', import.meta.url), 'utf8');
const rules = highlightDiffScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('highlight-diff.scss 挂在 .container figure.highlight，core/index 顶层 @use 且在 highlight-index 之后，选择器不使用 data-theme', () => {
  const iIndex = indexScss.indexOf('@use "highlight-index"');
  const iDiff = indexScss.indexOf('@use "highlight-diff"');
  assert.match(indexScss, /^@use "highlight-diff";$/m);
  assert.ok(iIndex !== -1 && iDiff > iIndex);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "highlight-diff"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /figure\.highlight/);
  assert.match(rules, /\.deletion/);
  assert.match(rules, /\.addition/);
  assert.match(rules, /\.meta/);
  assert.match(rules, /\.comment/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /@use ['"]prismjs|@use ['"]theme/);
});

test('上游 highlight/diff light 默认 token：deletion #bf42bf、addition #105ede、purple #7c4dff、comment rgba(149,165,166,.8)、red #e53935、orange #f76d47、yellow #ffb62c、green #91b859、aqua #39adb5、blue #6182b8', () => {
  assert.match(rules, /color:\s*#bf42bf/);
  assert.match(rules, /color:\s*#105ede/);
  assert.match(rules, /color:\s*#7c4dff/);
  assert.match(rules, /color:\s*rgba\(149,\s*165,\s*166,\s*0\.8\)/);
  assert.match(rules, /color:\s*#e53935/);
  assert.match(rules, /color:\s*#f76d47/);
  assert.match(rules, /color:\s*#ffb62c/);
  assert.match(rules, /color:\s*#91b859/);
  assert.match(rules, /color:\s*#39adb5/);
  assert.match(rules, /color:\s*#6182b8/);
  assert.match(rules, /scrollbar-color:\s*var\(--hlscrollbar-bg\)\s*transparent/);
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

test('不用 #Butterfly 把 token 颜色压到主栏或 .code-toolbar；不实现 prismjs/theme.styl', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(highlightDiffScss.replace(/\/\*[\s\S]*?\*\//g, ''), /prismjs|theme\.styl/);
  assert.doesNotMatch(postHtml, /figure class="highlight"|figure\.highlight/);
});

test('编译实际会 @use core 的 page/index.scss 后保留上游 token 颜色，不把 deletion/red 压到 #Butterfly 主栏或 .code-toolbar', () => {
  const css = compilePageCss();
  assert.match(css, /\.container figure\.highlight/);
  assert.match(css, /#bf42bf/);
  assert.match(css, /#105ede/);
  assert.match(css, /#7c4dff/);
  assert.match(css, /rgba\(149,\s*165,\s*166/);
  assert.match(css, /#e53935/);
  assert.match(css, /#f76d47/);
  assert.match(css, /#ffb62c/);
  assert.match(css, /#91b859/);
  assert.match(css, /#39adb5/);
  assert.match(css, /#6182b8/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*#bf42bf/s);
  assert.doesNotMatch(css, /#Butterfly \.code-toolbar[^{]*\{[^}]*#bf42bf/s);

  assert.match(css, /\.container figure\.highlight pre \.deletion\s*\{[^}]*color:\s*#bf42bf/s);
  assert.match(css, /\.container figure\.highlight pre \.addition\s*\{[^}]*color:\s*#105ede/s);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /#bf42bf/);
    assert.doesNotMatch(rule.body, /#e53935/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /#bf42bf/);
    assert.doesNotMatch(rule.body, /#e53935/);
    assert.doesNotMatch(rule.body, /\.deletion/);
  }

  const containerFigure = compiled.filter((rule) => /\.container/.test(rule.selector) && /figure\.highlight/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerFigure.some((rule) => /#bf42bf/.test(rule.body)));
  assert.ok(containerFigure.some((rule) => /#105ede/.test(rule.body)));
  assert.ok(containerFigure.some((rule) => /#e53935/.test(rule.body)));

  const butterflyHighlight = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /figure\.highlight/.test(rule.selector));
  assert.equal(butterflyHighlight.length, 0);
});
