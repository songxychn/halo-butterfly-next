import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const shuoshuoScss = await readFile(new URL('../src/scss/core/shuoshuo.scss', import.meta.url), 'utf8');
const pageMomentsScss = await readFile(new URL('../src/scss/page/moments.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const momentsHtml = await readFile(new URL('../src/html/moments.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = shuoshuoScss.replace(/\/\*[\s\S]*?\*\//g, '');
const pageRules = pageMomentsScss.replace(/\/\*[\s\S]*?\*\//g, '');

function compileMomentsCss() {
  return sass.compile(new URL('../src/scss/page/moments.scss', import.meta.url).pathname, {
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

function isHaloMomentCard(selector) {
  return /(#Butterfly(?:\s+\.moments|\.moments)|\.moments)\b/.test(selector)
    && /\.item\b/.test(selector)
    && !/#article-container/.test(selector)
    && !/\.shuoshuo-item/.test(selector);
}

test('shuoshuo.scss 挂在 #article-container / .moments，选择器不使用 data-theme', () => {
  const iFlink = indexScss.indexOf('@use "flink"');
  const iShuoshuo = indexScss.indexOf('@use "shuoshuo"');
  assert.match(indexScss, /^@use "shuoshuo";$/m);
  assert.ok(iFlink !== -1 && iShuoshuo > iFlink);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "shuoshuo"/s);
  assert.match(rules, /#article-container/);
  assert.match(rules, /\.shuoshuo-item/);
  assert.match(rules, /\.shuoshuo-avatar/);
  assert.match(rules, /\.shuoshuo-info/);
  assert.match(rules, /\.shuoshuo-date/);
  assert.match(rules, /\.shuoshuo-content/);
  assert.match(rules, /\.shuoshuo-tag/);
  assert.match(rules, /\.shuoshuo-navigation/);
  assert.match(rules, /\.moments/);
  assert.match(pageMomentsScss, /\.moments/);
  assert.match(pageMomentsScss, /\.list/);
  assert.match(pageMomentsScss, /\.item/);
  assert.match(momentsHtml, /page = 'moments'/);
  assert.match(momentsHtml, /class="list"/);
  assert.match(momentsHtml, /class="item"/);
  assert.match(momentsHtml, /class="medium"/);
  assert.doesNotMatch(momentsHtml, /shuoshuo-item/);
  assert.doesNotMatch(momentsHtml, /#article-container/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(pageRules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(pageRules, /#Butterfly/);
  assert.doesNotMatch(shuoshuoScss, /#article-container[^{]*,[^{]*\.moments \.item/);
  assert.doesNotMatch(shuoshuoScss, /\.moments \.item[^{]*,[^{]*#article-container/);
});

test('上游说说数字：padding 35px 30px 30px / 768 25px 20px 20px、margin-bottom 20px、头像 40px、info 10px、date .8em、content 15px 0 10px、tag 0 8px / 12px / .85em、分页按钮 2.7em', () => {
  const upstream = rules.slice(0, rules.lastIndexOf('.moments {'));
  assert.match(upstream, /padding:\s*35px 30px 30px/);
  assert.match(upstream, /@media screen and \(max-width:\s*768px\)/);
  assert.match(upstream, /padding:\s*25px 20px 20px/);
  assert.match(upstream, /margin-bottom:\s*20px/);
  assert.match(upstream, /width:\s*40px/);
  assert.match(upstream, /height:\s*40px/);
  assert.match(upstream, /border-radius:\s*40px/);
  assert.match(upstream, /margin-left:\s*10px/);
  assert.match(upstream, /font-size:\s*\.8em/);
  assert.match(upstream, /padding:\s*15px 0 10px/);
  assert.match(upstream, /padding:\s*0 8px/);
  assert.match(upstream, /border-radius:\s*12px/);
  assert.match(upstream, /font-size:\s*\.85em/);
  assert.match(upstream, /width:\s*2\.7em/);
  assert.match(upstream, /height:\s*2\.7em/);
  assert.match(upstream, /\.shuoshuo-page-input/);
  assert.match(pageMomentsScss, /padding:\s*35px 30px 30px/);
  assert.match(pageMomentsScss, /padding:\s*25px 20px 20px/);
  assert.match(pageMomentsScss, /margin-bottom:\s*20px/);
  assert.match(pageMomentsScss, /width:\s*170px/);
  assert.match(pageMomentsScss, /height:\s*110px/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.equal([...momentsHtml.matchAll(/th:utext/g)].length, 1);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('Halo 瞬间保留媒体 170×110，不用 #Butterfly 压 width/height；分页输入框不压到瞬间页', () => {
  const haloBlock = rules.slice(rules.lastIndexOf('.moments {'));
  assert.match(haloBlock, /padding:\s*35px 30px 30px/);
  assert.match(haloBlock, /padding:\s*25px 20px 20px/);
  assert.match(haloBlock, /margin-bottom:\s*20px/);
  assert.match(haloBlock, /width:\s*170px/);
  assert.match(haloBlock, /height:\s*110px/);
  assert.doesNotMatch(haloBlock, /#article-container/);
  assert.doesNotMatch(haloBlock, /\.shuoshuo-page-input/);
  assert.doesNotMatch(haloBlock, /width:\s*2\.7em/);
  assert.doesNotMatch(haloBlock, /#Butterfly/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(pageRules, /#Butterfly/);
  assert.match(pageMomentsScss, /width:\s*170px/);
  assert.match(pageMomentsScss, /height:\s*110px/);
  assert.match(pageMomentsScss, /plugin-pagination/);
});

test('编译 moments.scss 后并列选择器保留上游数字，Halo 卡片 padding 对齐，媒体 170×110', () => {
  const css = compileMomentsCss();
  assert.match(css, /#article-container/);
  assert.match(css, /\.shuoshuo-item/);
  assert.match(css, /padding:\s*35px 30px 30px/);
  assert.match(css, /padding:\s*25px 20px 20px/);
  assert.match(css, /margin-bottom:\s*20px/);
  assert.match(css, /width:\s*40px/);
  assert.match(css, /height:\s*40px/);
  assert.match(css, /border-radius:\s*40px/);
  assert.match(css, /margin-left:\s*10px/);
  assert.match(css, /font-size:\s*0?\.8em/);
  assert.match(css, /padding:\s*15px 0 10px/);
  assert.match(css, /padding:\s*0 8px/);
  assert.match(css, /border-radius:\s*12px/);
  assert.match(css, /font-size:\s*0?\.85em/);
  assert.match(css, /width:\s*2\.7em/);
  assert.match(css, /height:\s*2\.7em/);
  assert.match(css, /\.shuoshuo-navigation/);
  assert.match(css, /\.shuoshuo-page-input/);
  assert.match(css, /\.moments/);
  assert.match(css, /width:\s*170px/);
  assert.match(css, /height:\s*110px/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.moments[^{]*\{[^}]*\bwidth:\s*\d+px/s);
  assert.doesNotMatch(css, /#Butterfly\.moments[^{]*\{[^}]*\bwidth:\s*\d+px/s);
  assert.doesNotMatch(css, /#Butterfly \.moments[^{]*\{[^}]*\bheight:\s*\d+px/s);
  assert.doesNotMatch(css, /#article-container \.moments/);
  assert.doesNotMatch(css, /\.plugin-pagination[^{]*\{[^}]*2\.7em/s);

  const compiled = cssRules(css);
  const upstreamItem = compiled.filter((rule) => /#article-container/.test(rule.selector) && /\.shuoshuo-item\b/.test(rule.selector) && !/\.moments/.test(rule.selector));
  assert.ok(upstreamItem.some((rule) => /padding:\s*35px 30px 30px/.test(rule.body)));
  assert.ok(upstreamItem.some((rule) => /margin-bottom:\s*20px/.test(rule.body)));

  const haloCards = compiled.filter((rule) => isHaloMomentCard(rule.selector));
  assert.ok(haloCards.length > 0);
  for (const rule of haloCards) {
    assert.doesNotMatch(rule.body, /width:\s*2\.7em/);
    assert.doesNotMatch(rule.body, /width:\s*40px/);
  }
  assert.ok(haloCards.some((rule) => /padding:\s*35px 30px 30px/.test(rule.body)));

  const butterflyMoments = compiled.filter((rule) => /#Butterfly(?:\s+\.moments|\.moments)/.test(rule.selector));
  for (const rule of butterflyMoments) {
    assert.doesNotMatch(rule.body, /width:\s*2\.7em/);
  }

  assert.ok(
    compiled.some((rule) => /\.medium\b/.test(rule.selector) && /width:\s*170px/.test(rule.body) && /height:\s*110px/.test(rule.body)),
  );

  const pluginPaginate = compiled.filter((rule) => /\.plugin-pagination\b/.test(rule.selector));
  for (const rule of pluginPaginate) {
    assert.doesNotMatch(rule.body, /width:\s*2\.7em/);
    assert.doesNotMatch(rule.body, /height:\s*2\.7em/);
  }
});
