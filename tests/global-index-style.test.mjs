import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const giScss = await readFile(new URL('../src/scss/core/global-index.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const baseScss = await readFile(new URL('../src/scss/core/_base.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = giScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('global-index.scss 落地，core/index 顶层 @use 且在 global-function 之后，选择器不使用 data-theme', () => {
  const iFn = indexScss.indexOf('@use "global-function"');
  const iGi = indexScss.indexOf('@use "global-index"');
  assert.match(indexScss, /^@use "global-index";$/m);
  assert.ok(iFn !== -1 && iGi > iFn);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "global-index"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /--global-bg:\s*#fff/);
  assert.match(rules, /--font-color:\s*#4c4948/);
  assert.match(rules, /\.text-center/);
  assert.match(rules, /\.fa-fw/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
});

test('上游 index.styl 数字：font 14px、滚动条 5px、selection #00c4b6、a #99a9bf、table radius 5px、blockquote 8px', () => {
  assert.match(rules, /--global-font-size:\s*14px/);
  assert.match(rules, /width:\s*5px/);
  assert.match(rules, /height:\s*5px/);
  assert.match(rules, /background:\s*#00c4b6/);
  assert.match(rules, /color:\s*#99a9bf/);
  assert.match(rules, /border-radius:\s*5px/);
  assert.match(rules, /border-left:\s*4px solid #49b1f5/);
  assert.match(rules, /border-radius:\s*8px/);
  assert.match(rules, /--scrollbar-color:\s*#49b1f5/);
  assert.doesNotMatch(rules, /user-select:\s*none/);
});

test('copy.enable 默认 true：源文件不写活 body user-select；不实现 _tags / var.styl', () => {
  const live = rules.replace(/\.container\s*\{[\s\S]*html\.with-fancybox/s, '');
  assert.doesNotMatch(giScss.replace(/\/\*[\s\S]*?\*\//g, ''), /user-select:\s*none/);
  assert.doesNotMatch(rules, /_tags\/|source\/css\/index\.styl|var\.styl/);
  assert.match(live, /\.text-center/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.match(baseScss, /width:\s*6px/);
  assert.doesNotMatch(navHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('编译 page/index.scss 后 light token 与 5px 滚动条只在 .container 下，不压活 :root / body / 6px 滚动条 / #Butterfly 主栏', () => {
  const css = compilePageCss();
  assert.match(css, /--global-bg:\s*#fff/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const liveRoot = compiled.filter((rule) => /^:root$/.test(rule.selector) || rule.selector === ':root');
  for (const rule of liveRoot) {
    assert.doesNotMatch(rule.body, /--global-bg:\s*#fff/);
    assert.doesNotMatch(rule.body, /--card-bg:\s*#fff/);
    assert.doesNotMatch(rule.body, /--scrollbar-color:\s*#49b1f5/);
  }

  const liveBody = compiled.filter((rule) => /(^| )body$|(^| )body /.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveBody) {
    assert.doesNotMatch(rule.body, /--global-bg/);
    assert.doesNotMatch(rule.body, /user-select:\s*none/);
  }

  const liveScroll = compiled.filter((rule) => /::-webkit-scrollbar/.test(rule.selector) && !/\.container/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(liveScroll.some((rule) => /width:\s*6px/.test(rule.body)));
  for (const rule of liveScroll) {
    assert.doesNotMatch(rule.body, /width:\s*5px/);
  }

  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /--global-bg:\s*#fff/);
    assert.doesNotMatch(rule.body, /width:\s*5px/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /width:\s*5px/);
    assert.doesNotMatch(rule.body, /--global-bg:\s*#fff/);
  }

  const container = compiled.filter((rule) => /\.container/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(container.some((rule) => /--global-bg:\s*#fff/.test(rule.body)));
  assert.ok(container.some((rule) => /width:\s*5px/.test(rule.body)));
  assert.ok(container.some((rule) => /#web_bg/.test(rule.selector) && /width:\s*100%/.test(rule.body)));
});
