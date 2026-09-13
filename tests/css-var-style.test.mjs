import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const cssVarScss = await readFile(new URL('../src/scss/core/css-var.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const globalIndexScss = await readFile(new URL('../src/scss/core/global-index.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = cssVarScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('css-var.scss 落地，core/index 顶层 @use 且在 css-index 之后，选择器不使用 data-theme', () => {
  const iIndex = indexScss.indexOf('@use "css-index"');
  const iVar = indexScss.indexOf('@use "css-var"');
  assert.match(indexScss, /^@use "css-var";$/m);
  assert.ok(iIndex !== -1 && iVar > iIndex);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "css-var"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(cssVarScss, /source\/css\/var\.styl/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(cssVarScss, /@import\s+['"]nib['"]/);
});

test('上游 var.styl 默认数字：#49b1f5 / 14px / 330px / 100vh / 43% / 1.6 / #37474f / $tagsP / $tab', () => {
  assert.match(rules, /--bright-blue:\s*#49b1f5/);
  assert.match(rules, /--strong-cyan:\s*#00c4b6/);
  assert.match(rules, /--light-orange:\s*#ff7242/);
  assert.match(rules, /--light-red:\s*#f47466/);
  assert.match(rules, /--font-size:\s*14px/);
  assert.match(rules, /--text-line-height:\s*2/);
  assert.match(rules, /--index-top-img-height:\s*100vh/);
  assert.match(rules, /--index-site-info-top:\s*43%/);
  assert.match(rules, /--sidebar-width:\s*330px/);
  assert.match(rules, /--line-height-code-block:\s*1\.6/);
  assert.match(rules, /--hr-icon-top:\s*-10px/);
  assert.match(rules, /--preloader-bg:\s*#37474f/);
  assert.match(rules, /--rightside-bottom:\s*40px/);
  assert.match(rules, /--tab-border-color:\s*#f0f0f0/);
  assert.match(rules, /--tab-to-top-color:\s*#99a9bf/);
  assert.match(rules, /--tagsP-blue-color:\s*#428bca/);
  assert.match(rules, /--tagsP-pink-color:\s*#ff69b4/);
  assert.match(rules, /--tagsP-red-color:\s*#ff0000/);
  assert.match(globalIndexScss, /--global-font-size:\s*14px/);
  assert.match(globalIndexScss, /--tags-blue-color:\s*#428bca/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不改写 global-index 活 token', () => {
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
  assert.doesNotMatch(globalIndexScss, /--sidebar-width:\s*330px/);
});

test('不用 #Butterfly 把 14px / 330px / 100vh 压到主栏或 .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /330px/);
  assert.doesNotMatch(live, /100vh/);
  assert.doesNotMatch(live, /--font-size:\s*14px/);
});

test('编译 page/index.scss 后 var 默认只在 .container 下，不压 #Butterfly 主栏 / hide-aside 80% / .code-toolbar', () => {
  const css = compilePageCss();
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /--sidebar-width:\s*330px/);
    assert.doesNotMatch(rule.body, /--index-top-img-height:\s*100vh/);
  }

  const liveHtml = compiled.filter((rule) => /(^| )html\b/.test(rule.selector) && !/\.container/.test(rule.selector) && !/\.hide-aside/.test(rule.selector));
  for (const rule of liveHtml) {
    assert.doesNotMatch(rule.body, /--sidebar-width:\s*330px/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /--line-height-code-block:\s*1\.6/);
    assert.doesNotMatch(rule.body, /padding:\s*10px 20px/);
  }

  const containerVar = compiled.filter((rule) => /\.container/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerVar.some((rule) => /--bright-blue:\s*#49b1f5/.test(rule.body)));
  assert.ok(containerVar.some((rule) => /--sidebar-width:\s*330px/.test(rule.body)));
  assert.ok(containerVar.some((rule) => /--font-size:\s*14px/.test(rule.body)));
});
