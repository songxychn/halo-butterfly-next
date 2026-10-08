import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const labelScss = await readFile(new URL('../src/scss/core/tags-label.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = labelScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('tags-label.scss 落地，core/index 顶层 @use 且在 tags-inline-img 之后，选择器不使用 data-theme', () => {
  const iImg = indexScss.indexOf('@use "tags-inline-img"');
  const iLb = indexScss.indexOf('@use "tags-label"');
  assert.match(indexScss, /^@use "tags-label";$/m);
  assert.ok(iImg !== -1 && iLb > iImg);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "tags-label"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /\.hl-label/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /note\.styl|_tags\/note/);
});

test('上游 label.styl 数字：padding 2px 4px、radius 3px、default / blue / pink / red / purple / orange / green', () => {
  assert.match(rules, /padding:\s*2px 4px/);
  assert.match(rules, /border-radius:\s*3px/);
  assert.match(rules, /var\(--btn-color, #fff\)/);
  assert.match(rules, /var\(--btn-default-color\)/);
  assert.match(rules, /var\(--tags-blue-color\)/);
  assert.match(rules, /var\(--tags-pink-color\)/);
  assert.match(rules, /var\(--tags-red-color\)/);
  assert.match(rules, /var\(--tags-purple-color\)/);
  assert.match(rules, /var\(--tags-orange-color\)/);
  assert.match(rules, /var\(--tags-green-color\)/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 note', () => {
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

test('不用 #Butterfly 把 2px 4px 压到主栏或活 .button / #hide-aside-btn / .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /padding:\s*2px 4px/);
  assert.doesNotMatch(live, /\.hl-label/);
  assert.doesNotMatch(live, /#hide-aside-btn/);
});

test('编译 page/index.scss 后 .hl-label 只在 .container 下，不压 #Butterfly 主栏 / 活 .button / #hide-aside-btn / hide-aside 80%', () => {
  const css = compilePageCss();
  assert.match(css, /\.hl-label/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /padding:\s*2px 4px/);
  }

  const liveButton = compiled.filter((rule) => /(^| )\.button\b/.test(rule.selector) && !/\.container/.test(rule.selector) && !/\.hl-label/.test(rule.selector));
  for (const rule of liveButton) {
    assert.doesNotMatch(rule.body, /padding:\s*2px 4px/);
  }

  const hideAsideBtn = compiled.filter((rule) => /#hide-aside-btn/.test(rule.selector));
  for (const rule of hideAsideBtn) {
    assert.doesNotMatch(rule.body, /padding:\s*2px 4px/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /padding:\s*2px 4px/);
  }

  const containerLabel = compiled.filter((rule) => /\.container/.test(rule.selector) && /\.hl-label/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerLabel.some((rule) => /padding:\s*2px 4px/.test(rule.body)));
  assert.ok(containerLabel.some((rule) => /border-radius:\s*3px/.test(rule.body)));
});
