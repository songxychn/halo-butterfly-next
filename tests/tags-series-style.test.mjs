import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const seriesScss = await readFile(new URL('../src/scss/core/tags-series.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = seriesScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('tags-series.scss 落地，core/index 顶层 @use 且在 tags-note 之后，选择器不使用 data-theme', () => {
  const iNote = indexScss.indexOf('@use "tags-note"');
  const iSeries = indexScss.indexOf('@use "tags-series"');
  assert.match(indexScss, /^@use "tags-series";$/m);
  assert.ok(iNote !== -1 && iSeries > iNote);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "tags-series"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /\.series-items/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /tabs\.styl|_tags\/tabs/);
});

test('上游 series.styl 数字：a:hover color var(--pseudo-hover)', () => {
  assert.match(rules, /a:hover/);
  assert.match(rules, /color:\s*var\(--pseudo-hover\)/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 tabs', () => {
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

test('不用 #Butterfly 把 --pseudo-hover 压到主栏或活 a / .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /--pseudo-hover/);
  assert.doesNotMatch(live, /\.series-items/);
});

test('编译 page/index.scss 后 .series-items a:hover 只在 .container 下，不压 #Butterfly 主栏 / 活 a / .code-toolbar / hide-aside 80%', () => {
  const css = compilePageCss();
  assert.match(css, /\.series-items/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /var\(--pseudo-hover\)/);
  }

  const liveA = compiled.filter((rule) => /(^| )a:hover\b/.test(rule.selector) && !/\.container/.test(rule.selector) && !/\.series-items/.test(rule.selector));
  for (const rule of liveA) {
    assert.doesNotMatch(rule.body, /var\(--pseudo-hover\)/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /var\(--pseudo-hover\)/);
  }

  const containerSeries = compiled.filter((rule) => /\.container/.test(rule.selector) && /\.series-items/.test(rule.selector) && /a:hover/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerSeries.some((rule) => /var\(--pseudo-hover\)/.test(rule.body)));
});
