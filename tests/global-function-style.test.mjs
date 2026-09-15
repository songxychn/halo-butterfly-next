import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const fnScss = await readFile(new URL('../src/scss/core/global-function.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const asideScss = await readFile(new URL('../src/scss/core/aside.scss', import.meta.url), 'utf8');
const rules = fnScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('global-function.scss 工具类落地，core/index 顶层 @use 且在 highlight-theme 之后，选择器不使用 data-theme', () => {
  const iTheme = indexScss.indexOf('@use "highlight-theme"');
  const iFn = indexScss.indexOf('@use "global-function"');
  assert.match(indexScss, /^@use "global-function";$/m);
  assert.ok(iTheme !== -1 && iFn > iTheme);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "global-function"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.limit-one-line/);
  assert.match(rules, /\.cardHover/);
  assert.match(rules, /\.btn-effects/);
  assert.match(rules, /\.custom-hr/);
  assert.match(rules, /\.container/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /_global\/index|index\.styl/);
});

test('上游 function.styl 数字：ellipsis、cardHover 8px、list-beauty .43em、hr \\f0c4 / -10px、btn-effects scale 1.02', () => {
  assert.match(rules, /text-overflow:\s*ellipsis/);
  assert.match(rules, /white-space:\s*nowrap/);
  assert.match(rules, /border-radius:\s*8px/);
  assert.match(rules, /width:\s*0\.43em/);
  assert.match(rules, /height:\s*0\.43em/);
  assert.match(rules, /content:\s*"\\f0c4"/);
  assert.match(rules, /top:\s*-10px/);
  assert.match(rules, /transform:\s*translateY\(-1px\) scale\(1\.02\)/);
  assert.match(rules, /transform:\s*translateY\(-2px\) scale\(1\.03\)/);
  assert.match(rules, /transform:\s*translate\(0,\s*-16px\)/);
  assert.match(rules, /animation:\s*bottom-top 1s/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 index.styl', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.match(asideScss, /\.avatar-img/);
  assert.match(asideScss, /width:\s*110px/);
  assert.doesNotMatch(navHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
  assert.match(postHtml, /views\/components :: codeBlockPin/);
  assert.doesNotMatch(rules, /--global-font-size|--global-bg/);
});

test('不用 #Butterfly 把 scale/宽高压到主栏或 .code-toolbar；入场动画不压活 #footer / .avatar-img', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  const liveFn = rules.replace(/\.container\s*\{[\s\S]*\}\s*@keyframes/s, '');
  assert.doesNotMatch(fnScss.replace(/\/\*[\s\S]*?\*\//g, ''), /avatar_turn_around/);
  assert.match(rules, /\.container/);
  assert.match(rules, /#content-inner/);
});

test('编译 page/index.scss 后工具类数字保留；width/height 100% 与 bottom-top 只在 .container 下，不压 #Butterfly 主栏 / .code-toolbar / 活 #footer', () => {
  const css = compilePageCss();
  assert.match(css, /\.limit-one-line/);
  assert.match(css, /\.cardHover/);
  assert.match(css, /border-radius:\s*8px/);
  assert.match(css, /content:\s*"\\f0c4"/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /scale\(1\.1\)/);
    assert.doesNotMatch(rule.body, /animation:\s*bottom-top/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /scale\(1\.1\)/);
    assert.doesNotMatch(rule.body, /width:\s*100%/);
    assert.doesNotMatch(rule.body, /height:\s*100%/);
  }

  const liveFooter = compiled.filter((rule) => /#footer/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveFooter) {
    assert.doesNotMatch(rule.body, /animation:\s*bottom-top/);
  }

  const liveAvatar = compiled.filter((rule) => /\.avatar-img/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveAvatar) {
    assert.doesNotMatch(rule.body, /avatar_turn_around/);
    assert.doesNotMatch(rule.body, /animation:\s*avatar/);
  }

  const containerImg = compiled.filter((rule) => /\.container/.test(rule.selector) && /\.imgHover/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerImg.some((rule) => /width:\s*100%/.test(rule.body) && /height:\s*100%/.test(rule.body)));

  const containerFooter = compiled.filter((rule) => /\.container/.test(rule.selector) && /#footer/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerFooter.some((rule) => /animation:\s*bottom-top 1s/.test(rule.body)));
});
