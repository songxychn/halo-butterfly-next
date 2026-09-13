import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const hideScss = await readFile(new URL('../src/scss/core/tags-hide.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = hideScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('tags-hide.scss 落地，core/index 顶层 @use 且在 tags-hexo 之后，选择器不使用 data-theme', () => {
  const iHx = indexScss.indexOf('@use "tags-hexo"');
  const iHide = indexScss.indexOf('@use "tags-hide"');
  assert.match(indexScss, /^@use "tags-hide";$/m);
  assert.ok(iHx !== -1 && iHide > iHx);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "tags-hide"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /\.hide-button/);
  assert.match(rules, /\.hide-inline/);
  assert.match(rules, /\.hide-block/);
  assert.match(rules, /\.toggle/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /inlineImg\.styl|_tags\/inlineImg/);
});

test('上游 hide.styl 数字：padding 5px 18px、margin 0 6px / 16px / 20px、toggle 6px 15px、radius 6px / 5px、\\\\f0d7', () => {
  assert.match(rules, /padding:\s*5px 18px/);
  assert.match(rules, /margin:\s*0 6px/);
  assert.match(rules, /margin:\s*0 0 16px/);
  assert.match(rules, /margin-bottom:\s*20px/);
  assert.match(rules, /margin:\s*30px 24px/);
  assert.match(rules, /padding:\s*6px 15px/);
  assert.match(rules, /border-radius:\s*6px/);
  assert.match(rules, /border-radius:\s*5px/);
  assert.match(rules, /content:\s*"\\f0d7"/);
  assert.match(rules, /scale\(1\.02\)/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 inlineImg', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.doesNotMatch(navHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /aside\.hide_button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('不用 #Butterfly 把 hide-button padding 压到主栏或活 .button / #hide-aside-btn / .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /padding:\s*5px 18px/);
  assert.doesNotMatch(live, /\.hide-button/);
  assert.doesNotMatch(live, /#hide-aside-btn/);
});

test('编译 page/index.scss 后 hide-button 只在 .container 下，不压 #Butterfly 主栏 / 活 .button / #hide-aside-btn / hide-aside 80%', () => {
  const css = compilePageCss();
  assert.match(css, /\.hide-button/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /padding:\s*5px 18px/);
    assert.doesNotMatch(rule.body, /scale\(1\.02\)/);
  }

  const liveButton = compiled.filter((rule) => /(^| )\.button\b/.test(rule.selector) && !/\.container/.test(rule.selector) && !/\.hide-button/.test(rule.selector));
  for (const rule of liveButton) {
    assert.doesNotMatch(rule.body, /padding:\s*5px 18px/);
  }

  const hideAsideBtn = compiled.filter((rule) => /#hide-aside-btn/.test(rule.selector));
  for (const rule of hideAsideBtn) {
    assert.doesNotMatch(rule.body, /padding:\s*5px 18px/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /padding:\s*5px 18px/);
    assert.doesNotMatch(rule.body, /scale\(1\.02\)/);
  }

  const containerHide = compiled.filter((rule) => /\.container/.test(rule.selector) && /\.hide-button/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerHide.some((rule) => /padding:\s*5px 18px/.test(rule.body)));
  assert.ok(containerHide.some((rule) => /border-radius:\s*6px/.test(rule.body)));
});
