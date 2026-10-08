import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const tabsScss = await readFile(new URL('../src/scss/core/tags-tabs.scss', import.meta.url), 'utf8');
const commentsScss = await readFile(new URL('../src/scss/core/comments.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const readmodeScss = await readFile(new URL('../src/scss/core/readmode.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = tabsScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('tags-tabs.scss 落地，core/index 顶层 @use 且在 tags-series 之后，选择器不使用 data-theme', () => {
  const iSeries = indexScss.indexOf('@use "tags-series"');
  const iTabs = indexScss.indexOf('@use "tags-tabs"');
  assert.match(indexScss, /^@use "tags-tabs";$/m);
  assert.ok(iSeries !== -1 && iTabs > iSeries);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "tags-tabs"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /\.nav-tabs/);
  assert.match(rules, /\.tab-item-content/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /timeline\.styl|_tags\/timeline/);
  assert.doesNotMatch(rules, /@keyframes\s+tabshow/);
  assert.match(commentsScss, /@keyframes tabshow/);
});

test('上游 tabs.styl 数字：margin 0 0 20px、radius 6px、tab padding 8px 18px、content 36px 24px 10px、768px 下 24px 14px', () => {
  assert.match(rules, /margin:\s*0 0 20px/);
  assert.match(rules, /border-radius:\s*6px/);
  assert.match(rules, /padding:\s*8px 18px/);
  assert.match(rules, /border-top:\s*2px solid var\(--tab-border-color\)/);
  assert.match(rules, /padding:\s*36px 24px 10px/);
  assert.match(rules, /@media \(max-width:\s*768px\)/);
  assert.match(rules, /padding:\s*24px 14px/);
  assert.match(rules, /width:\s*1\.5em/);
  assert.match(rules, /line-height:\s*2/);
  assert.match(rules, /transition:\s*all 0\.4s/);
  assert.match(rules, /animation:\s*tabshow 0\.5s/);
  assert.match(rules, /color:\s*#99a9bf/);
  assert.match(rules, /border-top:\s*2px solid var\(--theme\)/);
  assert.match(readmodeScss, /\.tabs/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 timeline', () => {
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

test('不用 #Butterfly 把 padding/border 压到主栏或活 .tabs / .code-toolbar，不改写 tabshow keyframes', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /36px 24px 10px/);
  assert.doesNotMatch(live, /\.nav-tabs/);
  assert.match(commentsScss, /translateY\(15px\)/);
});

test('编译 page/index.scss 后 tabs 数字只在 .container 下，不压 #Butterfly 主栏 / 阅读模式活 .tabs / .code-toolbar / hide-aside 80%', () => {
  const css = compilePageCss();
  assert.match(css, /\.nav-tabs/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);
  assert.match(css, /@keyframes tabshow/);
  assert.match(css, /translateY\(15px\)/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /36px 24px 10px/);
    assert.doesNotMatch(rule.body, /padding:\s*8px 18px/);
  }

  const liveTabs = compiled.filter((rule) => /\.tabs\b/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveTabs) {
    assert.doesNotMatch(rule.body, /margin:\s*0 0 20px/);
    assert.doesNotMatch(rule.body, /padding:\s*36px 24px 10px/);
    assert.doesNotMatch(rule.body, /padding:\s*8px 18px/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /36px 24px 10px/);
    assert.doesNotMatch(rule.body, /padding:\s*8px 18px/);
  }

  const containerTabs = compiled.filter((rule) => /\.container/.test(rule.selector) && /\.tabs\b/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerTabs.some((rule) => /margin:\s*0 0 20px/.test(rule.body)));
  assert.ok(containerTabs.some((rule) => /border-radius:\s*6px/.test(rule.body)));
  assert.ok(containerTabs.some((rule) => /padding:\s*8px 18px/.test(rule.body)));
  assert.ok(containerTabs.some((rule) => /padding:\s*36px 24px 10px/.test(rule.body)));
  assert.match(css, /@media \(max-width:\s*768px\)/);
  assert.match(css, /padding:\s*24px 14px/);
});
