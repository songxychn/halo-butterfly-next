import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const noteScss = await readFile(new URL('../src/scss/core/tags-note.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = noteScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('tags-note.scss 落地，core/index 顶层 @use 且在 tags-label 之后，选择器不使用 data-theme', () => {
  const iLb = indexScss.indexOf('@use "tags-label"');
  const iNote = indexScss.indexOf('@use "tags-note"');
  assert.match(indexScss, /^@use "tags-note";$/m);
  assert.ok(iLb !== -1 && iNote > iLb);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "tags-note"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /\.note/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /series\.styl|_tags\/series/);
});

test('上游 note.styl 数字：padding 15px、margin 0 0 20px、radius 3px、左边框 5px、icons 3em、六色与六类 icon', () => {
  assert.match(rules, /padding:\s*15px/);
  assert.match(rules, /margin:\s*0 0 20px/);
  assert.match(rules, /border-radius:\s*3px/);
  assert.match(rules, /border-left-width:\s*5px/);
  assert.match(rules, /border-left:\s*5px solid/);
  assert.match(rules, /padding-left:\s*3em/);
  assert.match(rules, /content:\s*"\\f0a9"/);
  assert.match(rules, /content:\s*"\\f055"/);
  assert.match(rules, /content:\s*"\\f05a"/);
  assert.match(rules, /content:\s*"\\f058"/);
  assert.match(rules, /content:\s*"\\f06a"/);
  assert.match(rules, /content:\s*"\\f056"/);
  assert.match(rules, /--tags-blue-color/);
  assert.match(rules, /--note-danger-border/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 series、不改 settings.yaml 结构键 note', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.doesNotMatch(settingsText, /^note:/m);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.doesNotMatch(navHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('不用 #Butterfly 把 padding 15px / !important margin 压到主栏或活 blockquote / p / img / .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /padding:\s*15px/);
  assert.doesNotMatch(live, /\.note/);
  assert.doesNotMatch(live, /margin-top:\s*0\s*!important/);
});

test('编译 page/index.scss 后 .note 只在 .container 下，不压 #Butterfly 主栏 / 活 blockquote / .code-toolbar / hide-aside 80%', () => {
  const css = compilePageCss();
  assert.match(css, /\.note/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /padding:\s*15px/);
  }

  const liveQuote = compiled.filter((rule) => /(^| )blockquote\b/.test(rule.selector) && !/\.container/.test(rule.selector) && !/\.note/.test(rule.selector));
  for (const rule of liveQuote) {
    assert.doesNotMatch(rule.body, /padding:\s*15px/);
    assert.doesNotMatch(rule.body, /margin-top:\s*0\s*!important/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /padding:\s*15px/);
  }

  const notePad = compiled.filter((rule) => /\.note/.test(rule.selector) && /padding:\s*15px/.test(rule.body));
  assert.ok(notePad.length > 0);
  for (const rule of notePad) {
    assert.match(rule.selector, /\.container/);
    assert.doesNotMatch(rule.selector, /#Butterfly/);
  }

  const containerNote = compiled.filter((rule) => /\.container/.test(rule.selector) && /\.note/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerNote.some((rule) => /padding:\s*15px/.test(rule.body)));
  assert.ok(containerNote.some((rule) => /margin:\s*0 0 20px/.test(rule.body)));
  assert.ok(containerNote.some((rule) => /border-radius:\s*3px/.test(rule.body)));
});
