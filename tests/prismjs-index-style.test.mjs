import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const prismjsIndexScss = await readFile(new URL('../src/scss/core/prismjs-index.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const codeBlockScss = await readFile(new URL('../src/scss/modules/codeBlock.scss', import.meta.url), 'utf8');
const rules = prismjsIndexScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('prismjs-index.scss 挂在 .container pre[class*="language-"]，core/index 顶层 @use 且在 prismjs-diff 之后，选择器不使用 data-theme', () => {
  const iDiff = indexScss.indexOf('@use "prismjs-diff"');
  const iIndex = indexScss.indexOf('@use "prismjs-index"');
  assert.match(indexScss, /^@use "prismjs-index";$/m);
  assert.ok(iDiff !== -1 && iIndex > iDiff);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "prismjs-index"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /pre\[class\*='language-'\]/);
  assert.match(rules, /:not\(\.line-numbers\)/);
  assert.match(rules, /\.caption/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /@use ['"]line-number|@use ['"]theme/);
});

test('上游 prismjs/index 数字：not(.line-numbers) padding 10px 20px、caption margin-left -3.8em / padding 4px 16px !important、scrollbar --hlscrollbar-bg', () => {
  assert.match(rules, /padding:\s*10px 20px/);
  assert.match(rules, /margin-left:\s*-3\.8em/);
  assert.match(rules, /padding:\s*4px 16px !important/);
  assert.match(rules, /padding:\s*0 !important/);
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
  assert.match(codeBlockScss, /padding:\s*30px 0 0/);
  assert.doesNotMatch(navHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
  assert.match(codeBlockScss, /\.code-toolbar/);
  assert.match(postHtml, /views\/components :: codeBlockPin/);
});

test('不用 #Butterfly 把 padding 压到主栏或 .code-toolbar；不实现 line-number / theme.styl', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(prismjsIndexScss.replace(/\/\*[\s\S]*?\*\//g, ''), /line-number\.styl|theme\.styl/);
  assert.doesNotMatch(postHtml, /figure class="highlight"|figure\.highlight/);
});

test('编译实际会 @use core 的 page/index.scss 后保留上游数字，不把 padding 10px 20px 压到 #Butterfly 主栏或 .code-toolbar', () => {
  const css = compilePageCss();
  assert.match(css, /\.container pre\[class\*=language-\]:not\(\.line-numbers\)/);
  assert.match(css, /padding:\s*10px 20px/);
  assert.match(css, /margin-left:\s*-3\.8em/);
  assert.match(css, /padding:\s*4px 16px !important/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*padding:\s*10px 20px/s);
  assert.doesNotMatch(css, /#Butterfly \.code-toolbar[^{]*\{[^}]*padding:\s*10px 20px/s);

  assert.match(css, /\.container pre\[class\*=language-\]:not\(\.line-numbers\)\s*\{[^}]*padding:\s*10px 20px/s);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /padding:\s*10px 20px/);
    assert.doesNotMatch(rule.body, /margin-left:\s*-3\.8em/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /padding:\s*10px 20px/);
    assert.doesNotMatch(rule.body, /margin-left:\s*-3\.8em/);
  }

  const containerLang = compiled.filter((rule) => /\.container/.test(rule.selector) && /language-/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerLang.some((rule) => /padding:\s*10px 20px/.test(rule.body)));
  assert.ok(containerLang.some((rule) => /margin-left:\s*-3\.8em/.test(rule.body)));

  assert.match(codeBlockScss, /padding:\s*30px 0 0/);
});
