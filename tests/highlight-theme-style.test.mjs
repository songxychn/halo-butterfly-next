import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const themeScss = await readFile(new URL('../src/scss/core/highlight-theme.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const codeBlockScss = await readFile(new URL('../src/scss/modules/codeBlock.scss', import.meta.url), 'utf8');
const rules = themeScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('highlight-theme.scss 挂在 .container figure.highlight，core/index 顶层 @use 且在 prismjs-line-number 之后，选择器不使用 data-theme', () => {
  const iLine = indexScss.indexOf('@use "prismjs-line-number"');
  const iTheme = indexScss.indexOf('@use "highlight-theme"');
  assert.match(indexScss, /^@use "highlight-theme";$/m);
  assert.ok(iLine !== -1 && iTheme > iLine);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "highlight-theme"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /figure\.highlight/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /:root/);
  assert.doesNotMatch(rules, /\.code-toolbar/);
});

test('上游 theme.styl light 默认数字：#F6F8FA / #90A4AE / #80CBC440、tools #e6ebf1、scrollbar #dce4eb、token red #E53935', () => {
  assert.match(rules, /--highlight-background:\s*#f6f8fa/i);
  assert.match(rules, /--highlight-foreground:\s*#90a4ae/i);
  assert.match(rules, /--highlight-selection:\s*#80cbc440/i);
  assert.match(rules, /--highlight-mac-border:\s*rgba\(144,\s*164,\s*174,\s*0\.4\)/);
  assert.match(rules, /--highlight-gutter-color:\s*rgba\(144,\s*164,\s*174,\s*0\.5\)/);
  assert.match(rules, /--highlight-tools-bg:\s*#e6ebf1/i);
  assert.match(rules, /--highlight-scrollbar:\s*#dce4eb/i);
  assert.match(rules, /--highlight-comment:\s*rgba\(149,\s*165,\s*166,\s*0\.8\)/);
  assert.match(rules, /--highlight-red:\s*#e53935/i);
  assert.match(rules, /--highlight-orange:\s*#f76d47/i);
  assert.match(rules, /--highlight-yellow:\s*#ffb62c/i);
  assert.match(rules, /--highlight-green:\s*#91b859/i);
  assert.match(rules, /--highlight-aqua:\s*#39adb5/i);
  assert.match(rules, /--highlight-blue:\s*#6182b8/i);
  assert.match(rules, /--highlight-purple:\s*#7c4dff/i);
  assert.match(rules, /--highlight-deletion:\s*#bf42bf/i);
  assert.match(rules, /--highlight-addition:\s*#105ede/i);
  assert.doesNotMatch(rules, /#212121/);
  assert.doesNotMatch(rules, /#292[Dd]3[Ee]/);
  assert.doesNotMatch(rules, /#0[Ff]111[Aa]/);
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
  assert.doesNotMatch(navHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
  assert.match(codeBlockScss, /\.code-toolbar/);
  assert.match(postHtml, /views\/components :: codeBlockPin/);
});

test('不用 #Butterfly 把主题色压到主栏或 .code-toolbar；不实现 _global；不把 darker/pale night/ocean 写入本文件规则', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(themeScss.replace(/\/\*[\s\S]*?\*\//g, ''), /_global\/|function\.styl|pale night|#212121|#0[Ff]111[Aa]/);
  assert.doesNotMatch(postHtml, /figure class="highlight"|figure\.highlight/);
});

test('编译实际会 @use core 的 page/index.scss 后 light 默认留在 .container figure.highlight，不压到 #Butterfly 主栏或 .code-toolbar', () => {
  const css = compilePageCss();
  assert.match(css, /\.container figure\.highlight/);
  assert.match(css, /--highlight-background:\s*#f6f8fa/i);
  assert.match(css, /--highlight-foreground:\s*#90a4ae/i);
  assert.match(css, /--highlight-selection:\s*#80cbc440/i);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*--highlight-background/s);
  assert.doesNotMatch(css, /#Butterfly \.code-toolbar[^{]*\{[^}]*--highlight-background/s);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /--highlight-background/);
    assert.doesNotMatch(rule.body, /#212121/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /--highlight-background/);
    assert.doesNotMatch(rule.body, /#212121/);
  }

  const containerFig = compiled.filter((rule) => /\.container/.test(rule.selector) && /figure\.highlight/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerFig.some((rule) => /--highlight-background:\s*#f6f8fa/i.test(rule.body)));
  assert.ok(containerFig.some((rule) => /--highlight-red:\s*#e53935/i.test(rule.body)));

  const liveRoot = compiled.filter((rule) => /^:root$/.test(rule.selector) || /html\[data-color-scheme/.test(rule.selector));
  for (const rule of liveRoot) {
    assert.doesNotMatch(rule.body, /--highlight-background/);
    assert.doesNotMatch(rule.body, /#212121/);
  }

  assert.match(codeBlockScss, /padding:\s*30px 0 0/);
});
