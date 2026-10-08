import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const cssIndexScss = await readFile(new URL('../src/scss/core/css-index.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const varExists = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const rules = cssIndexScss.replace(/\/\*[\s\S]*?\*\//g, '');

const barrelUses = [
  'vendor-normalize',
  'global-function',
  'global-index',
  'highlight',
  'highlight-index',
  'highlight-diff',
  'prismjs-diff',
  'prismjs-index',
  'prismjs-line-number',
  'highlight-theme',
  'page-common',
  'homepage',
  'page-404',
  'archives',
  'categories',
  'flink',
  'shuoshuo',
  'tags',
  'common',
  'header',
  'main',
  'footer',
  'rightside',
  'pagination',
  'post',
  'relatedposts',
  'reward',
  'sidebar',
  'chat',
  'comments',
  'loading',
  'third-party',
  'tags-button',
  'tags-gallery',
  'tags-hexo',
  'tags-hide',
  'tags-inline-img',
  'tags-label',
  'tags-note',
  'tags-series',
  'tags-tabs',
  'tags-timeline',
  'readmode',
  'darkmode',
  'search',
  'algolia',
  'local-search',
  'css-index',
];

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

test('css-index.scss 落地，core/index 顶层 @use 且在 vendor-normalize 之后，选择器不使用 data-theme', () => {
  const iNorm = indexScss.indexOf('@use "vendor-normalize"');
  const iIndex = indexScss.indexOf('@use "css-index"');
  assert.match(indexScss, /^@use "css-index";$/m);
  assert.ok(iNorm !== -1 && iIndex > iNorm);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "css-index"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(cssIndexScss, /source\/css\/index\.styl/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /@import\s+['"]nib['"]/);
  assert.doesNotMatch(indexScss, /@import\s+['"]nib['"]/);
  assert.doesNotMatch(rules, /css_prefix/);
  assert.doesNotMatch(rules, /\$color-types|\$tagsP-|\$tab-|\$timeline-default-color/);
});

test('上游 index.styl barrel：不接入 nib，不实现 var.styl，@use 链覆盖已落地 glob', () => {
  assert.doesNotMatch(indexScss, /nib/);
  assert.doesNotMatch(varExists, /@use "var"/);
  assert.doesNotMatch(indexScss, /@use "vendor-var"/);
  for (const name of barrelUses) {
    assert.match(indexScss, new RegExp(`^@use "${name}";$`, 'm'), name);
  }
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 var.styl', () => {
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
  assert.doesNotMatch(cssIndexScss, /\$color-types/);
  assert.doesNotMatch(cssIndexScss, /font-family:\s*Titillium Web/);
});

test('不用 #Butterfly 把 barrel 压到主栏或 .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /line-height:\s*1\.15/);
  assert.doesNotMatch(live, /font-size:\s*2em/);
});

test('编译 page/index.scss 后 barrel 不压 #Butterfly 主栏 / hide-aside 80% / .code-toolbar，且仍消费 normalize 空操作', () => {
  const css = compilePageCss();
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);
  assert.doesNotMatch(css, /@import.*nib/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /line-height:\s*1\.15/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /padding:\s*10px 20px/);
  }

  const containerNorm = compiled.filter((rule) => /\.container/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerNorm.some((rule) => /html\b/.test(rule.selector) && /line-height:\s*1\.15/.test(rule.body)));
});
