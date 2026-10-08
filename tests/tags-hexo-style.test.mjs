import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const hxScss = await readFile(new URL('../src/scss/core/tags-hexo.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = hxScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('tags-hexo.scss 落地，core/index 顶层 @use 且在 tags-gallery 之后，选择器不使用 data-theme', () => {
  const iTg = indexScss.indexOf('@use "tags-gallery"');
  const iHx = indexScss.indexOf('@use "tags-hexo"');
  assert.match(indexScss, /^@use "tags-hexo";$/m);
  assert.ok(iTg !== -1 && iHx > iTg);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "tags-hexo"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /blockquote\.pullquote/);
  assert.match(rules, /\.video-container/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /hide\.styl|_tags\/hide/);
});

test('上游 hexo.styl 数字：max-width 45%、float left/right、padding-top 56.25%、height 0、iframe 100%', () => {
  assert.match(rules, /max-width:\s*45%/);
  assert.match(rules, /float:\s*left/);
  assert.match(rules, /float:\s*right/);
  assert.match(rules, /font-size:\s*110%/);
  assert.match(rules, /padding-top:\s*56\.25%/);
  assert.match(rules, /height:\s*0/);
  assert.match(rules, /margin-bottom:\s*16px/);
  assert.match(rules, /width:\s*100%/);
  assert.match(rules, /height:\s*100%/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 hide', () => {
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

test('不用 #Butterfly 或裸选择器把 float / 45% / 56.25% 压到主栏或活 blockquote / iframe / .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /float:\s*left/);
  assert.doesNotMatch(live, /pullquote/);
  assert.doesNotMatch(live, /56\.25%/);
  assert.doesNotMatch(live, /max-width:\s*45%/);
});

test('编译 page/index.scss 后 pullquote/video 只在 .container 下，不压 #Butterfly 主栏 / 活 blockquote / iframe / hide-aside 80%', () => {
  const css = compilePageCss();
  assert.match(css, /pullquote/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /float:\s*left/);
    assert.doesNotMatch(rule.body, /max-width:\s*45%/);
    assert.doesNotMatch(rule.body, /56\.25%/);
  }

  const liveQuote = compiled.filter((rule) => /blockquote/.test(rule.selector) && !/\.container/.test(rule.selector) && !/\.pullquote/.test(rule.selector));
  for (const rule of liveQuote) {
    assert.doesNotMatch(rule.body, /float:\s*left/);
    assert.doesNotMatch(rule.body, /max-width:\s*45%/);
  }

  const liveIframe = compiled.filter((rule) => /\biframe\b/.test(rule.selector) && !/\.container/.test(rule.selector) && !/\.video-container/.test(rule.selector));
  for (const rule of liveIframe) {
    assert.doesNotMatch(rule.body, /padding-top:\s*56\.25%/);
    assert.doesNotMatch(rule.body, /height:\s*0/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /float:\s*left/);
    assert.doesNotMatch(rule.body, /56\.25%/);
  }

  const containerHx = compiled.filter((rule) => /\.container/.test(rule.selector) && /pullquote/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerHx.some((rule) => /max-width:\s*45%/.test(rule.body)));
  const containerVid = compiled.filter((rule) => /\.container/.test(rule.selector) && /video-container/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerVid.some((rule) => /padding-top:\s*56\.25%/.test(rule.body)));
  assert.ok(containerVid.some((rule) => /height:\s*0/.test(rule.body)));
});
