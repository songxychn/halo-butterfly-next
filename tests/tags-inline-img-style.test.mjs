import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const imgScss = await readFile(new URL('../src/scss/core/tags-inline-img.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = imgScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('tags-inline-img.scss 落地，core/index 顶层 @use 且在 tags-hide 之后，选择器不使用 data-theme', () => {
  const iHide = indexScss.indexOf('@use "tags-hide"');
  const iImg = indexScss.indexOf('@use "tags-inline-img"');
  assert.match(indexScss, /^@use "tags-inline-img";$/m);
  assert.ok(iHide !== -1 && iImg > iHide);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "tags-inline-img"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /\.inline-img/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /label\.styl|_tags\/label/);
});

test('上游 inlineImg.styl 数字：display inline、margin 0 3px、height 1.1em、vertical-align text-bottom', () => {
  assert.match(rules, /display:\s*inline;/);
  assert.match(rules, /margin:\s*0 3px/);
  assert.match(rules, /height:\s*1\.1em/);
  assert.match(rules, /vertical-align:\s*text-bottom/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 label', () => {
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

test('不用 #Butterfly 把 1.1em 压到主栏或活 img / .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /height:\s*1\.1em/);
  assert.doesNotMatch(live, /\.inline-img/);
});

test('编译 page/index.scss 后 .inline-img 只在 .container 下，不压 #Butterfly 主栏 / 活 img / .code-toolbar / hide-aside 80%', () => {
  const css = compilePageCss();
  assert.match(css, /\.inline-img/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /height:\s*1\.1em/);
  }

  const liveImg = compiled.filter((rule) => /(^| )img\b/.test(rule.selector) && !/\.container/.test(rule.selector) && !/\.inline-img/.test(rule.selector));
  for (const rule of liveImg) {
    assert.doesNotMatch(rule.body, /height:\s*1\.1em/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /height:\s*1\.1em/);
  }

  const containerImg = compiled.filter((rule) => /\.container/.test(rule.selector) && /\.inline-img/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerImg.some((rule) => /display:\s*inline/.test(rule.body)));
  assert.ok(containerImg.some((rule) => /margin:\s*0 3px/.test(rule.body)));
  assert.ok(containerImg.some((rule) => /height:\s*1\.1em/.test(rule.body)));
  assert.ok(containerImg.some((rule) => /vertical-align:\s*text-bottom/.test(rule.body)));
});
