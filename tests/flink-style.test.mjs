import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';

const flinkScss = await readFile(new URL('../src/scss/core/flink.scss', import.meta.url), 'utf8');
const pageLinksScss = await readFile(new URL('../src/scss/page/links.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');
const pagePostScss = await readFile(new URL('../src/scss/page/post.scss', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const linksHtml = await readFile(new URL('../src/html/links.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const rules = flinkScss.replace(/\/\*[\s\S]*?\*\//g, '');
const pageRules = pageLinksScss.replace(/\/\*[\s\S]*?\*\//g, '');

function compileLinksCss() {
  return sass.compile(new URL('../src/scss/page/links.scss', import.meta.url).pathname, {
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

function isHaloLinkCard(selector) {
  return /(#Butterfly(?:\s+\.links|\.links)|\.links)\b/.test(selector)
    && /\.link\b/.test(selector)
    && !/\.flink/.test(selector);
}

test('flink.scss 挂在 .flink / .links，选择器不使用 data-theme', () => {
  const iCategories = indexScss.indexOf('@use "categories"');
  const iFlink = indexScss.indexOf('@use "flink"');
  assert.match(indexScss, /^@use "flink";$/m);
  assert.ok(iCategories !== -1 && iFlink > iCategories);
  assert.doesNotMatch(indexScss, /\.main[^{]*\{[^}]*@use "flink"/s);
  assert.match(rules, /\.flink/);
  assert.match(rules, /\.flink-list-item/);
  assert.match(rules, /\.flink-item-icon/);
  assert.match(rules, /\.flink-item-name/);
  assert.match(rules, /\.flink-item-desc/);
  assert.match(rules, /\.flink-name/);
  assert.match(rules, /\.links/);
  assert.match(rules, /\.groups/);
  assert.match(pageLinksScss, /\.links/);
  assert.match(pageLinksScss, /\.list/);
  assert.match(linksHtml, /page = 'links'/);
  assert.match(linksHtml, /class="groups"/);
  assert.match(linksHtml, /class="list"/);
  assert.match(linksHtml, /class="link /);
  assert.match(linksHtml, /class="n"/);
  assert.match(linksHtml, /class="d"/);
  assert.match(linksHtml, /'logo'/);
  assert.doesNotMatch(linksHtml, /flink-list-item/);
  assert.doesNotMatch(linksHtml, /flink-item-name/);
  assert.doesNotMatch(rules, /\[data-theme/);
  assert.doesNotMatch(pageRules, /\[data-theme/);
  assert.doesNotMatch(rules, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(pageRules, /#Butterfly/);
  assert.doesNotMatch(flinkScss, /\.flink-list-item[^{]*,[^{]*\.link/);
  assert.doesNotMatch(flinkScss, /\.link[^{]*,[^{]*\.flink-list-item/);
});

test('上游友链数字：三列 calc(100% / 3 - 15px) 高 90px、1024/600、图标 60px、name 1.43em / 40px、desc .93em / 50px、分组 1.5em', () => {
  const upstream = rules.slice(0, rules.lastIndexOf('.links {'));
  assert.match(upstream, /width:\s*calc\(100% \/ 3 - 15px\)/);
  assert.match(upstream, /height:\s*90px/);
  assert.match(upstream, /@media screen and \(max-width:\s*1024px\)/);
  assert.match(upstream, /width:\s*calc\(50% - 15px\)\s*!important/);
  assert.match(upstream, /@media screen and \(max-width:\s*600px\)/);
  assert.match(upstream, /width:\s*calc\(100% - 15px\)\s*!important/);
  assert.match(upstream, /width:\s*60px/);
  assert.match(upstream, /height:\s*60px/);
  assert.match(upstream, /font-size:\s*1\.43em/);
  assert.match(upstream, /height:\s*40px/);
  assert.match(upstream, /font-size:\s*\.93em/);
  assert.match(upstream, /height:\s*50px/);
  assert.match(upstream, /font-size:\s*1\.5em/);
  assert.match(upstream, /float:\s*left/);
  assert.match(pageLinksScss, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(260px,\s*1fr\)\)/);
  assert.match(pageLinksScss, /height:\s*100px/);
  assert.match(pageLinksScss, /height:\s*60px/);
  assert.match(pageLinksScss, /font-size:\s*1\.43em/);
  assert.match(pageLinksScss, /font-size:\s*\.93em/);
  assert.match(pageLinksScss, /font-size:\s*1\.5em/);
});

test('本刀不改 hide_button、不改文章上下篇 150px、不改 html.hide-aside 80%、无新增 th:utext', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button/);
  assert.match(settingsText, /name: hide_button/);
  assert.match(pagePostScss, /#pagination\.pagination-post/);
  assert.match(pagePostScss, /height:\s*150px/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /width:\s*80%/);
  assert.doesNotMatch(linksHtml, /th:utext/);
  assert.doesNotMatch(rules, /aside\.button/);
  assert.doesNotMatch(postHtml.replace(/th:utext="\$\{post\.content\.content\}"/, ''), /th:utext/);
});

test('Halo 友链保留 grid，不用 #Butterfly 把三列 calc 宽度压到 .link', () => {
  const haloBlock = rules.slice(rules.lastIndexOf('.links {'));
  assert.match(haloBlock, /display:\s*grid/);
  assert.match(haloBlock, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(260px,\s*1fr\)\)/);
  assert.match(haloBlock, /height:\s*100px/);
  assert.match(haloBlock, /width:\s*60px/);
  assert.match(haloBlock, /font-size:\s*1\.43em/);
  assert.match(haloBlock, /font-size:\s*\.93em/);
  assert.match(haloBlock, /font-size:\s*1\.5em/);
  assert.match(haloBlock, /-webkit-line-clamp:\s*2/);
  assert.doesNotMatch(haloBlock, /width:\s*calc\(100% \/ 3 - 15px\)/);
  assert.doesNotMatch(haloBlock, /float:\s*left/);
  assert.doesNotMatch(haloBlock, /height:\s*90px/);
  assert.doesNotMatch(haloBlock, /#Butterfly/);
  assert.doesNotMatch(rules, /#Butterfly/);
  assert.doesNotMatch(pageRules, /#Butterfly/);
  assert.match(pageLinksScss, /\.list \{[\s\S]*display:\s*grid/);
  assert.match(pageLinksScss, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(260px,\s*1fr\)\)/);
});

test('编译 links.scss 后 grid 仍在，#Butterfly .links .link 没有三列 calc 宽度', () => {
  const css = compileLinksCss();
  const threeCol = /width:\s*calc\((?:100%\s*\/\s*3|33(?:\.3+)?%)\s*-\s*15px\)/;
  assert.match(css, /\.flink-list-item/);
  assert.match(css, /\.flink-item-name/);
  assert.match(css, /\.flink-name/);
  assert.match(css, threeCol);
  assert.match(css, /height:\s*90px/);
  assert.match(css, /font-size:\s*1\.43em/);
  assert.match(css, /font-size:\s*0?\.93em/);
  assert.match(css, /font-size:\s*1\.5em/);
  assert.match(css, /display:\s*grid/);
  assert.match(css, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(260px,\s*1fr\)\)/);
  assert.match(css, /\.links[\s\S]*\.link[\s\S]*height:\s*100px/);
  assert.match(css, /html\.hide-aside \.main/);
  assert.match(css, /width:\s*80%/);
  assert.doesNotMatch(css, /\[data-theme/);
  assert.doesNotMatch(css, /#Butterfly \.links \.link\s*\{[^}]*width:\s*calc\(100%\s*\/\s*3\s*-\s*15px\)/s);
  assert.doesNotMatch(css, /#Butterfly \.links \.link\s*\{[^}]*width:\s*calc\(33(?:\.3+)?%\s*-\s*15px\)/s);
  assert.doesNotMatch(css, /#Butterfly\.links \.link\s*\{[^}]*width:\s*calc\(100%\s*\/\s*3\s*-\s*15px\)/s);
  assert.doesNotMatch(css, /#Butterfly\.links \.link\s*\{[^}]*width:\s*calc\(33(?:\.3+)?%\s*-\s*15px\)/s);

  const compiled = cssRules(css);
  const upstreamItem = compiled.filter((rule) => /\.flink-list-item\b/.test(rule.selector) && !/\.links/.test(rule.selector));
  assert.ok(upstreamItem.some((rule) => threeCol.test(rule.body)));
  assert.ok(upstreamItem.some((rule) => /height:\s*90px/.test(rule.body)));
  assert.ok(upstreamItem.some((rule) => /float:\s*left/.test(rule.body)));

  const haloCards = compiled.filter((rule) => isHaloLinkCard(rule.selector));
  assert.ok(haloCards.length > 0);
  for (const rule of haloCards) {
    assert.doesNotMatch(rule.body, threeCol);
    assert.doesNotMatch(rule.body, /float:\s*left/);
  }

  const butterflyLink = compiled.filter((rule) => /#Butterfly(?:\s+\.links|\.links).*\.link\b/.test(rule.selector));
  for (const rule of butterflyLink) {
    assert.doesNotMatch(rule.body, threeCol);
  }

  assert.ok(
    compiled.some((rule) => /\.list\b/.test(rule.selector) && /display:\s*grid/.test(rule.body)
      && /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(260px,\s*1fr\)\)/.test(rule.body)),
  );
});
