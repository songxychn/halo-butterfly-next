import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const normalizeScss = await readFile(new URL('../src/scss/core/vendor-normalize.scss', import.meta.url), 'utf8');
const resetScss = await readFile(new URL('../src/scss/core/_reset.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = normalizeScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('vendor-normalize.scss 落地，core/index 顶层 @use 且在 tags-timeline 之后，选择器不使用 data-theme', () => {
  const iTimeline = indexScss.indexOf('@use "tags-timeline"');
  const iNorm = indexScss.indexOf('@use "vendor-normalize"');
  assert.match(indexScss, /^@use "vendor-normalize";$/m);
  assert.ok(iTimeline !== -1 && iNorm > iTimeline);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "vendor-normalize"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(normalizeScss, /normalize\.css v8\.0\.1/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /index\.styl|var\.styl/);
});

test('上游 normalize v8.0.1 数字：html line-height 1.15、h1 2em / .67em、pre monospace,monospace、fieldset .35em .75em .625em', () => {
  assert.match(rules, /line-height:\s*1\.15/);
  assert.match(rules, /-webkit-text-size-adjust:\s*100%/);
  assert.match(rules, /font-size:\s*2em/);
  assert.match(rules, /margin:\s*0\.67em 0/);
  assert.match(rules, /font-family:\s*monospace,\s*monospace/);
  assert.match(rules, /padding:\s*0\.35em 0\.75em 0\.625em/);
  assert.match(rules, /outline:\s*1px dotted ButtonText/);
  assert.match(rules, /display:\s*block/);
  assert.match(resetScss, /box-sizing:\s*border-box/);
  assert.match(resetScss, /font-size:\s*inherit/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 index.styl、不改写 _reset.scss', () => {
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
  assert.doesNotMatch(resetScss, /line-height:\s*1\.15/);
  assert.doesNotMatch(resetScss, /font-size:\s*2em/);
});

test('不用 #Butterfly 或裸 html/body/h1/a/pre 把 1.15 / 2em 压到主栏或 .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /line-height:\s*1\.15/);
  assert.doesNotMatch(live, /font-size:\s*2em/);
  assert.doesNotMatch(live, /monospace,\s*monospace/);
});

test('编译 page/index.scss 后 normalize 数字只在 .container 下，不压 #Butterfly 主栏 / 活 html/h1/a/pre / .code-toolbar / hide-aside 80%', () => {
  const css = compilePageCss();
  assert.match(css, /line-height:\s*1\.15/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /line-height:\s*1\.15/);
    assert.doesNotMatch(rule.body, /font-size:\s*2em/);
  }

  const liveHtml = compiled.filter((rule) => /(^| )html\b/.test(rule.selector) && !/\.container/.test(rule.selector) && !/\.hide-aside/.test(rule.selector));
  for (const rule of liveHtml) {
    assert.doesNotMatch(rule.body, /line-height:\s*1\.15/);
  }

  const liveH1 = compiled.filter((rule) => /(^| |,)h1\b/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveH1) {
    assert.doesNotMatch(rule.body, /font-size:\s*2em/);
    assert.doesNotMatch(rule.body, /0\.67em/);
  }

  const livePre = compiled.filter((rule) => /(^| |,)pre\b/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of livePre) {
    assert.doesNotMatch(rule.body, /monospace,\s*monospace/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /line-height:\s*1\.15/);
    assert.doesNotMatch(rule.body, /font-size:\s*2em/);
  }

  const containerNorm = compiled.filter((rule) => /\.container/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerNorm.some((rule) => /html\b/.test(rule.selector) && /line-height:\s*1\.15/.test(rule.body)));
  assert.ok(containerNorm.some((rule) => /h1\b/.test(rule.selector) && /font-size:\s*2em/.test(rule.body)));
  assert.ok(containerNorm.some((rule) => /pre\b/.test(rule.selector) && /monospace,\s*monospace/.test(rule.body)));
});
