import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const tagsScss = await readFile(new URL('../src/scss/core/tags.scss', import.meta.url), 'utf8');
const pageTagsScss = await readFile(new URL('../src/scss/page/tags.scss', import.meta.url), 'utf8');
const tagPageScss = await readFile(new URL('../src/scss/page/tag.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const tagsHtml = await readFile(new URL('../src/html/tags.html', import.meta.url), 'utf8');
const tagHtml = await readFile(new URL('../src/html/tag.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = tagsScss.replace(/\/\*[\s\S]*?\*\//g, '');
const pageRules = pageTagsScss.replace(/\/\*[\s\S]*?\*\//g, '');

function compileTagsCss() {
  return sass.compile(new URL('../src/scss/page/tags.scss', import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function cssRules(css) {
  const rules = [];
  const re = /([^{]+)\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(css))) {
    rules.push({
      selector: match[1].replace(/\s+/g, ' ').trim(),
      body: match[2],
    });
  }
  return rules;
}

function isHaloTagLink(selector) {
  return /(#Butterfly(?:\s+\.tags|\.tags)|\.tags)\b/.test(selector)
    && /\.link\b/.test(selector)
    && !/\.tag-cloud/.test(selector);
}

test('tags.scss 挂在 .tag-cloud / .tags，选择器不使用 data-theme', () => {
  const iShuoshuo = indexScss.indexOf('@use "shuoshuo"');
  const iTags = indexScss.indexOf('@use "tags"');
  assert.match(indexScss, /^@use "tags";$/m);
  assert.ok(iShuoshuo !== -1 && iTags > iShuoshuo);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "tags"/s);
  assert.match(rules, /\.tag-cloud/);
  assert.match(rules, /\.tag-cloud-list|\.tag-cloud\s*\{[\s\S]*&-list/);
  assert.match(tagsScss, /&-list/);
  assert.match(tagsScss, /&-title/);
  assert.match(rules, /\.tags/);
  assert.match(pageTagsScss, /\.tags/);
  assert.match(pageTagsScss, /\.chart/);
  assert.match(pageTagsScss, /\.equinox/);
  assert.match(tagsHtml, /page = 'tags'/);
  assert.match(tagsHtml, /class="chart"/);
  assert.match(tagsHtml, /class="equinox"/);
  assert.match(tagsHtml, /class="link /);
  assert.doesNotMatch(tagsHtml, /tag-cloud/);
  assert.doesNotMatch(tagHtml, /tag-cloud/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(pageRules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(pageRules, /#Butterfly/);
  assert.doesNotMatch(tagsScss, /\.tag-cloud-list[^{]*,[^{]*\.tags \.link/);
  assert.doesNotMatch(tagsScss, /\.tags \.link[^{]*,[^{]*\.tag-cloud/);
});

test('上游标签数字：padding 3px 12px、margin 5px、line-height 1.7、圆角 7、hover scale(1.02)、768 zoom .85、title 2.57em / 768 2em', () => {
  const upstream = rules.slice(0, rules.lastIndexOf('.tags {'));
  assert.match(upstream, /padding:\s*3px 12px/);
  assert.match(upstream, /margin:\s*5px/);
  assert.match(upstream, /line-height:\s*1\.7/);
  assert.match(upstream, /border-radius:\s*7px/);
  assert.match(upstream, /translateY\(-2px\) scale\(1\.02\)/);
  assert.match(upstream, /@media screen and \(max-width:\s*768px\)/);
  assert.match(upstream, /zoom:\s*\.85/);
  assert.match(upstream, /font-size:\s*2\.57em/);
  assert.match(upstream, /font-size:\s*2em/);
  assert.match(pageTagsScss, /padding:\s*3px 12px/);
  assert.match(pageTagsScss, /margin:\s*5px/);
  assert.match(pageTagsScss, /line-height:\s*1\.7/);
  assert.match(pageTagsScss, /border-radius:\s*7px/);
  assert.match(pageTagsScss, /height:\s*360px/);
  assert.match(pageTagsScss, /font-size:\s*1\.5em/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.doesNotMatch(tagsHtml, /th:utext/);
  assert.doesNotMatch(tagHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('Halo 图表页保留 360px，不用 #Butterfly 压 zoom / 2.57em；详情页仍走 essayList', () => {
  const haloBlock = rules.slice(rules.lastIndexOf('.tags {'));
  assert.match(haloBlock, /height:\s*360px/);
  assert.match(haloBlock, /padding:\s*3px 12px/);
  assert.match(haloBlock, /margin:\s*5px/);
  assert.match(haloBlock, /border-radius:\s*7px/);
  assert.doesNotMatch(haloBlock, /zoom:\s*\.85/);
  assert.doesNotMatch(haloBlock, /font-size:\s*2\.57em/);
  assert.doesNotMatch(haloBlock, /#Butterfly/);
  assert.doesNotMatch(pageRules, /#Butterfly/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(tagsHtml, /tag-cloud/);
  assert.match(pageTagsScss, /\.chart \{[\s\S]*height:\s*360px/);
  assert.match(tagPageScss, /components\.essayList/);
  assert.doesNotMatch(tagPageScss, /tag-cloud/);
});

test('编译 tags.scss 后并列选择器保留上游数字，不把图表压成 zoom/.85 或 2.57em', () => {
  const css = compileTagsCss();
  assert.match(css, /\.tag-cloud/);
  assert.match(css, /\.tag-cloud-list/);
  assert.match(css, /\.tag-cloud-title/);
  assert.match(css, /\.tags/);
  assert.match(css, /padding:\s*3px 12px/);
  assert.match(css, /margin:\s*5px/);
  assert.match(css, /line-height:\s*1\.7/);
  assert.match(css, /border-radius:\s*7px/);
  assert.match(css, /scale\(1\.02\)/);
  assert.match(css, /zoom:\s*0?\.85/);
  assert.match(css, /font-size:\s*2\.57em/);
  assert.match(css, /font-size:\s*2em/);
  assert.match(css, /\.tags \.chart\s*\{[^}]*height:\s*360px/s);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.tags[^{]*\{[^}]*\bzoom:\s*\.?85/s);
  assert.doesNotMatch(css, /#Butterfly\.tags[^{]*\{[^}]*\bheight:\s*\d+px/s);
  assert.doesNotMatch(css, /#Butterfly \.chart\s*\{[^}]*\bheight:\s*\d+%/s);
  assert.doesNotMatch(css, /#Butterfly \.equinox/);
  assert.doesNotMatch(css, /\.tag-cloud-list[^{]*,[^{]*\.tags \.link/);

  const compiled = cssRules(css);
  const haloLinks = compiled.filter((rule) => isHaloTagLink(rule.selector));
  assert.ok(haloLinks.length > 0);
  for (const rule of haloLinks) {
    assert.doesNotMatch(rule.body, /zoom:\s*0?\.85/);
    assert.doesNotMatch(rule.body, /font-size:\s*2\.57em/);
  }
  assert.ok(haloLinks.some((rule) => /padding:\s*3px 12px/.test(rule.body)));

  const haloCharts = compiled.filter((rule) => /\.tags/.test(rule.selector) && /\.chart\b/.test(rule.selector) && !/\.tag-cloud/.test(rule.selector));
  assert.ok(haloCharts.some((rule) => /height:\s*360px/.test(rule.body)));
  for (const rule of haloCharts) {
    assert.doesNotMatch(rule.body, /zoom:\s*0?\.85/);
    assert.doesNotMatch(rule.body, /height:\s*2\.57em/);
  }

  const butterflyTags = compiled.filter((rule) => /#Butterfly(?:\s+\.tags|\.tags)/.test(rule.selector));
  for (const rule of butterflyTags) {
    assert.doesNotMatch(rule.body, /zoom:\s*0?\.85/);
    assert.doesNotMatch(rule.body, /font-size:\s*2\.57em/);
  }
});
