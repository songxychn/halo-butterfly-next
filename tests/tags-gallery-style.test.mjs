import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const tgScss = await readFile(new URL('../src/scss/core/tags-gallery.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = tgScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('tags-gallery.scss 落地，core/index 顶层 @use 且在 tags-button 之后，选择器不使用 data-theme', () => {
  const iTb = indexScss.indexOf('@use "tags-button"');
  const iTg = indexScss.indexOf('@use "tags-gallery"');
  assert.match(indexScss, /^@use "tags-gallery";$/m);
  assert.ok(iTb !== -1 && iTg > iTb);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "tags-gallery"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /figure\.gallery-group/);
  assert.match(rules, /\.gallery-container/);
  assert.match(rules, /\.loading-container/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /hexo\.styl|_tags\/hexo/);
});

test('上游 gallery.styl 数字：float left、height 250px、calc(50% - 8px)、calc(100% / 3 - 8px)、154px、img calc(100% + 20px)', () => {
  assert.match(rules, /float:\s*left/);
  assert.match(rules, /height:\s*250px/);
  assert.match(rules, /width:\s*calc\(50% - 8px\)/);
  assert.match(rules, /width:\s*calc\(100% \/ 3 - 8px\)/);
  assert.match(rules, /width:\s*calc\(100% \+ 20px\)/);
  assert.match(rules, /width:\s*154px/);
  assert.match(rules, /height:\s*154px/);
  assert.match(rules, /margin:\s*6px 4px/);
  assert.match(rules, /border-radius:\s*10px/);
  assert.match(rules, /max-width:\s*600px/);
  assert.match(rules, /min-width:\s*1024px/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 hexo', () => {
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

test('不用 #Butterfly 把 float / 250px / calc 宽度压到主栏或 .button / .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '').replace(/@keyframes[\s\S]*/g, '');
  assert.doesNotMatch(live, /float:\s*left/);
  assert.doesNotMatch(live, /figure\.gallery-group/);
  assert.doesNotMatch(live, /height:\s*250px/);
});

test('编译 page/index.scss 后 gallery 宽高只在 .container 下，不压 #Butterfly 主栏 / 活 .button / .code-toolbar / hide-aside 80%', () => {
  const css = compilePageCss();
  assert.match(css, /figure\.gallery-group|\.gallery-group/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /float:\s*left/);
    assert.doesNotMatch(rule.body, /height:\s*250px/);
    assert.doesNotMatch(rule.body, /calc\(50%/);
  }

  const liveButton = compiled.filter((rule) => /(^| )\.button\b/.test(rule.selector) && !/\.container/.test(rule.selector) && !/\.gallery-container/.test(rule.selector));
  for (const rule of liveButton) {
    assert.doesNotMatch(rule.body, /padding:\s*8px 14px/);
    assert.doesNotMatch(rule.body, /height:\s*250px/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /float:\s*left/);
    assert.doesNotMatch(rule.body, /height:\s*250px/);
  }

  const containerGal = compiled.filter((rule) => /\.container/.test(rule.selector) && /gallery-group/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerGal.some((rule) => /float:\s*left/.test(rule.body)));
  assert.ok(containerGal.some((rule) => /height:\s*250px/.test(rule.body)));
  assert.ok(containerGal.some((rule) => /calc\(50% - 8px\)/.test(rule.body)));
});
