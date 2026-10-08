import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const tbScss = await readFile(new URL('../src/scss/core/tags-button.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = tbScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('tags-button.scss 落地，core/index 顶层 @use 且在 global-index 之后，选择器不使用 data-theme', () => {
  const iGi = indexScss.indexOf('@use "global-index"');
  const iTb = indexScss.indexOf('@use "tags-button"');
  assert.match(indexScss, /^@use "tags-button";$/m);
  assert.ok(iGi !== -1 && iTb > iGi);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "tags-button"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /\.btn-beautify/);
  assert.match(rules, /\.btn-center/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /gallery\.styl|_tags\/gallery/);
});

test('上游 button.styl 数字：padding 0 15px、margin 0 4px 6px、radius 8px、fit-content、scale 1.02 / 1.03', () => {
  assert.match(rules, /padding:\s*0 15px/);
  assert.match(rules, /margin:\s*0 4px 6px/);
  assert.match(rules, /border-radius:\s*8px/);
  assert.match(rules, /width:\s*fit-content/);
  assert.match(rules, /transform:\s*translateY\(-1px\) scale\(1\.02\)/);
  assert.match(rules, /transform:\s*translateY\(-2px\) scale\(1\.03\)/);
  assert.match(rules, /padding:\s*6px 15px/);
  assert.match(rules, /--tags-blue-color/);
  assert.match(rules, /--tags-green-color/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 gallery', () => {
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

test('不用 #Butterfly 把 fit-content / scale 压到主栏或 .button / .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /fit-content/);
  assert.doesNotMatch(live, /\.btn-beautify/);
});

test('编译 page/index.scss 后 btn-beautify 只在 .container 下，不压 #Butterfly 主栏 / 活 .button / .code-toolbar / hide-aside 80%', () => {
  const css = compilePageCss();
  assert.match(css, /\.btn-beautify/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /fit-content/);
    assert.doesNotMatch(rule.body, /scale\(1\.02\)/);
  }

  const liveButton = compiled.filter((rule) => /(^| )\.button\b/.test(rule.selector) && !/\.container/.test(rule.selector) && !/\.btn-beautify/.test(rule.selector));
  for (const rule of liveButton) {
    assert.doesNotMatch(rule.body, /fit-content/);
    assert.doesNotMatch(rule.body, /--btn-beautify-color/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /fit-content/);
    assert.doesNotMatch(rule.body, /scale\(1\.02\)/);
  }

  const containerBtn = compiled.filter((rule) => /\.container/.test(rule.selector) && /\.btn-beautify/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerBtn.some((rule) => /padding:\s*0px 15px|padding:\s*0 15px/.test(rule.body)));
  assert.ok(containerBtn.some((rule) => /border-radius:\s*8px/.test(rule.body)));
  assert.ok(containerBtn.some((rule) => /width:\s*fit-content/.test(rule.body)));
});
