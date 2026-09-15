import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const timelineScss = await readFile(new URL('../src/scss/core/tags-timeline.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pageIndexScss = await readFile(new URL('../src/scss/page/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const navHtml = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = timelineScss.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('tags-timeline.scss 落地，core/index 顶层 @use 且在 tags-tabs 之后，选择器不使用 data-theme', () => {
  const iTabs = indexScss.indexOf('@use "tags-tabs"');
  const iTimeline = indexScss.indexOf('@use "tags-timeline"');
  assert.match(indexScss, /^@use "tags-timeline";$/m);
  assert.ok(iTabs !== -1 && iTimeline > iTabs);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "tags-timeline"/s);
  assert.match(pageIndexScss, /@use '\.\.\/core'/);
  assert.match(rules, /\.container/);
  assert.match(rules, /\.timeline-item/);
  assert.match(rules, /\.item-circle/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(rules, /index\.styl|normalize\.min\.css|var\.styl/);
});

test('上游 timeline.styl 数字：margin 0 10px 20px、padding 14px 0 5px 20px、圆点 6px、content 12px 15px / 8px、相邻 -20px', () => {
  assert.match(rules, /margin:\s*0 10px 20px/);
  assert.match(rules, /padding:\s*14px 0 5px 20px/);
  assert.match(rules, /border-left:\s*2px solid var\(--timeline-color, var\(--theme\)\)/);
  assert.match(rules, /margin:\s*0 0 15px/);
  assert.match(rules, /left:\s*-27px/);
  assert.match(rules, /width:\s*6px/);
  assert.match(rules, /height:\s*6px/);
  assert.match(rules, /border:\s*3px solid var\(--pseudo-hover\)/);
  assert.match(rules, /left:\s*-28px/);
  assert.match(rules, /border:\s*4px solid var\(--timeline-color, var\(--theme\)\)/);
  assert.match(rules, /padding:\s*12px 15px/);
  assert.match(rules, /border-radius:\s*8px/);
  assert.match(rules, /font-size:\s*0\.93em/);
  assert.match(rules, /margin-top:\s*-20px/);
  assert.match(rules, /font-weight:\s*600/);
  assert.match(rules, /font-size:\s*1\.2em/);
  for (const color of ['blue', 'pink', 'red', 'purple', 'orange', 'green']) {
    assert.match(rules, new RegExp(`&.${color}`));
  }
  assert.match(rules, /rgba\(66,\s*139,\s*202,\s*0\.2\)/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext、不实现 index.styl', () => {
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

test('不用 #Butterfly 把 padding/border/-20px 压到主栏或活时间线 / .code-toolbar', () => {
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.match(rules, /\.container/);
  const live = rules.replace(/\.container\s*\{[\s\S]*$/s, '');
  assert.doesNotMatch(live, /14px 0 5px 20px/);
  assert.doesNotMatch(live, /margin-top:\s*-20px/);
  assert.doesNotMatch(live, /\.timeline-item/);
});

test('编译 page/index.scss 后 timeline 数字只在 .container 下，不压 #Butterfly 主栏 / 活 .timeline / .code-toolbar / hide-aside 80%', () => {
  const css = compilePageCss();
  assert.match(css, /\.timeline-item/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.container/);

  const compiled = cssRules(css);
  const butterflyMain = compiled.filter((rule) => /#Butterfly/.test(rule.selector) && /\.main\b/.test(rule.selector));
  for (const rule of butterflyMain) {
    assert.doesNotMatch(rule.body, /14px 0 5px 20px/);
    assert.doesNotMatch(rule.body, /margin-top:\s*-20px/);
  }

  const liveTimeline = compiled.filter((rule) => /\.timeline\b/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveTimeline) {
    assert.doesNotMatch(rule.body, /margin:\s*0 10px 20px/);
    assert.doesNotMatch(rule.body, /padding:\s*14px 0 5px 20px/);
    assert.doesNotMatch(rule.body, /margin-top:\s*-20px/);
  }

  const liveToolbar = compiled.filter((rule) => /\.code-toolbar/.test(rule.selector) && !/\.container/.test(rule.selector));
  for (const rule of liveToolbar) {
    assert.doesNotMatch(rule.body, /12px 15px/);
    assert.doesNotMatch(rule.body, /margin-top:\s*-20px/);
  }

  const containerTimeline = compiled.filter((rule) => /\.container/.test(rule.selector) && /\.timeline\b/.test(rule.selector) && !/#Butterfly/.test(rule.selector));
  assert.ok(containerTimeline.some((rule) => /margin:\s*0 10px 20px/.test(rule.body)));
  assert.ok(containerTimeline.some((rule) => /padding:\s*14px 0 5px 20px/.test(rule.body)));
  assert.ok(containerTimeline.some((rule) => /padding:\s*12px 15px/.test(rule.body)));
  assert.ok(containerTimeline.some((rule) => /margin-top:\s*-20px/.test(rule.body)));
  assert.ok(containerTimeline.some((rule) => /left:\s*-27px/.test(rule.body)));
  assert.ok(containerTimeline.some((rule) => /left:\s*-28px/.test(rule.body)));
});
