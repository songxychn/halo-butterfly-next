import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const highlightScss = await readFile(new URL('../src/scss/core/highlight.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const codeBlockScss = await readFile(new URL('../src/scss/modules/codeBlock.scss', import.meta.url), 'utf8');
const rules = highlightScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('highlight.scss 挂在 .container，core/index 顶层 @use 且在 local-search 之后，深色用 data-color-scheme', () => {
  const iLocal = indexScss.indexOf('@use "local-search"');
  const iHighlight = indexScss.indexOf('@use "highlight"');
  assert.match(indexScss, /^@use "highlight";$/m);
  assert.ok(iLocal !== -1 && iHighlight > iLocal);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "highlight"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /:root/);
  assert.match(rules, /html\[data-color-scheme='dark'\]/);
  assert.match(rules, /\.container/);
  assert.match(rules, /figure\.highlight/);
  assert.match(rules, /\.highlight-tools/);
  assert.match(rules, /--hl-color/);
  assert.match(rules, /--hl-bg/);
  assert.match(rules, /--hltools-bg/);
  assert.match(rules, /--hlnumber-bg/);
  assert.match(rules, /--hlscrollbar-bg/);
  assert.match(rules, /--hlexpand-bg/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /@use ['"]prismjs|@use ['"]theme|@use ['"]highlight\/index/);
});

test('上游 highlight 数字：light #f6f8fa/#90a4ae、dark #171717、code-block overflow auto / margin 0 0 20px / line-height 1.6、pre padding 10px 20px、tools 2.15em', () => {
  assert.match(rules, /--hl-color:\s*#90a4ae/);
  assert.match(rules, /--hl-bg:\s*#f6f8fa/);
  assert.match(rules, /--hltools-bg:\s*#e6ebf1/);
  assert.match(rules, /--hlscrollbar-bg:\s*#dce4eb/);
  assert.match(rules, /--hl-bg:\s*#171717/);
  assert.match(rules, /--hltools-bg:\s*#1a1a1a/);
  assert.match(rules, /--hlscrollbar-bg:\s*#1f1f1f/);
  assert.match(rules, /overflow:\s*auto/);
  assert.match(rules, /margin:\s*0 0 20px/);
  assert.match(rules, /line-height:\s*1\.6/);
  assert.match(rules, /padding:\s*10px 20px/);
  assert.match(rules, /padding:\s*2px 5px/);
  assert.match(rules, /height:\s*2\.15em/);
  assert.match(rules, /min-height:\s*24px/);
  assert.match(rules, /border-radius:\s*6px/);
  assert.match(rules, /height:\s*calc\(100vh - 2\.15em\)/);
  assert.match(rules, /z-index:\s*99999/);
  assert.match(rules, /width:\s*12px/);
  assert.match(rules, /height:\s*12px/);
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

test('不用 #Butterfly 把 overflow/width 压到主栏或 .code-toolbar；不实现 prismjs/theme.styl', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /@use ['"]prismjs|@use ['"]theme|@use ['"]highlight\/index/);
  assert.doesNotMatch(postHtml, /figure class="highlight"|figure\.highlight/);
});

test('编译实际会 @use core 的 page/index.scss 后保留上游数字，不把 overflow 压到 #Butterfly 主栏或 .code-toolbar', () => {
  const css = compilePageCss();
  assert.match(css, /--hl-color:\s*#90a4ae/);
  assert.match(css, /--hl-bg:\s*#f6f8fa/);
  assert.match(css, /html\[data-color-scheme=dark\]/);
  assert.match(css, /--hl-bg:\s*#171717/);
  assert.match(css, /\.container pre/);
  assert.match(css, /overflow:\s*auto/);
  assert.match(css, /margin:\s*0 0 20px/);
  assert.match(css, /line-height:\s*1\.6/);
  assert.match(css, /padding:\s*10px 20px/);
  assert.match(css, /height:\s*2\.15em/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);
  assert.doesNotMatch(css, /#Butterfly \.main[^{]*\{[^}]*overflow:\s*auto/s);
  assert.doesNotMatch(css, /#Butterfly \.code-toolbar[^{]*\{[^}]*margin:\s*0 0 20px/s);

  assert.match(css, /\.container pre\s*,\s*\.container code|\.container pre\s*\{[^}]*overflow:\s*auto|\.container pre[^{]*\{[^}]*overflow:\s*auto/s);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /margin:\s*0 0 20px/);
    assert.doesNotMatch(rule.body, /height:\s*calc\(100vh - 2\.15em\)/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /margin:\s*0 0 20px/);
    assert.doesNotMatch(rule.body, /height:\s*calc\(100vh - 2\.15em\)/);
  }

  const containerPre = compiled.filter((rule) => /\.container/.test(rule.selector) && /\bpre\b/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerPre.some((rule) => /overflow:\s*auto/.test(rule.body) || /margin:\s*0 0 20px/.test(rule.body)));

  const butterflyHighlight = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /figure\.highlight/.test(rule.selector));
  assert.equal(butterflyHighlight.length, 0);
});
