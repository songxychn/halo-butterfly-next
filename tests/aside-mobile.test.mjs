import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as sass from 'sass';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  ASIDE_MOBILE_DEFAULT,
  resolveAsideMobile,
  shouldApplyAsideMobileOff,
} from '../src/js/core/aside-mobile.mjs';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const layoutHtml = await readFile(new URL('../src/html/views/layout.html', import.meta.url), 'utf8');
const mainScss = await readFile(new URL('../src/scss/core/main.scss', import.meta.url), 'utf8');
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');

function asideForm() {
  const form = settings.spec.forms.find(item => item.group === 'aside');
  assert.ok(form, 'aside');
  return form;
}

function asideChild(name) {
  const node = asideForm().formSchema.find(item => item.name === name);
  assert.ok(node, name);
  return node;
}

function compilePageCss(page) {
  return sass.compile(new URL(`../src/scss/page/${page}.scss`, import.meta.url).pathname, {
    loadPaths: ['node_modules'],
  }).css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function mediaInner(css, query) {
  const needle = `@media (${query})`;
  const inners = [];
  let searchFrom = 0;
  while (true) {
    const start = css.indexOf(needle, searchFrom);
    if (start < 0) break;
    const brace = css.indexOf('{', start);
    if (brace < 0) break;
    let depth = 0;
    let end = brace;
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++;
      else if (css[end] === '}') {
        depth--;
        if (depth === 0) {
          end++;
          break;
        }
      }
    }
    inners.push(css.slice(brace + 1, end - 1));
    searchFrom = end;
  }
  return inners.join('\n');
}

function cssRules(css) {
  const parsed = [];
  const re = /([^{]+)\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(css))) {
    const selector = match[1].replace(/\s+/g, ' ').trim();
    if (selector.startsWith('@')) continue;
    parsed.push({ selector, body: match[2] });
  }
  return parsed;
}

function ruleMatches(rules, selectorRe, bodyRe) {
  return rules.some(rule => selectorRe.test(rule.selector) && bodyRe.test(rule.body));
}

test('aside.mobile 默认 true；仅显式 false 关闭；键名不是 aside.button', () => {
  assert.equal(defaults.aside.mobile, true);
  assert.equal(defaults.aside.hide, false);
  assert.equal(asideChild('mobile').value, true);
  assert.deepEqual(asideChild('mobile').options.map(option => option.value), [true, false]);
  assert.match(String(asideChild('mobile').help), /aside\.mobile/);
  assert.match(String(asideChild('mobile').help), /aside\.button/);
  assert.equal(ASIDE_MOBILE_DEFAULT, true);
  assert.equal(resolveAsideMobile(undefined), true);
  assert.equal(resolveAsideMobile(null), true);
  assert.equal(resolveAsideMobile(true), true);
  assert.equal(resolveAsideMobile('true'), true);
  assert.equal(resolveAsideMobile(false), false);
  assert.equal(resolveAsideMobile('false'), false);
  assert.equal(shouldApplyAsideMobileOff(true, false), true);
  assert.equal(shouldApplyAsideMobileOff(true, true), false);
  assert.equal(shouldApplyAsideMobileOff(true, undefined), false);
  assert.equal(shouldApplyAsideMobileOff(false, false), false);
  assert.equal(shouldApplyAsideMobileOff('false', false), false);
});

test('布局：aside.enable 且 mobile 为 false 时 html 加 aside-mobile-off；无新增 th:utext', () => {
  assert.match(layoutHtml, /aside-mobile-off/);
  assert.match(layoutHtml, /theme\.config\.aside\.mobile == false/);
  assert.match(layoutHtml, /hide-aside/);
  assert.doesNotMatch(layoutHtml, /th:utext/);
  assert.match(settingsText, /name: mobile/);
  const mobileIdx = settingsText.indexOf('name: mobile');
  const buttonIdx = settingsText.indexOf('name: button');
  const hideIdx = settingsText.indexOf('name: hide');
  assert.ok(hideIdx > 0 && mobileIdx > hideIdx && buttonIdx > mobileIdx);
});

test('样式：max-width 768px 时 html.aside-mobile-off 隐藏非目录卡片', () => {
  assert.match(mainScss, /@media \(max-width: 768px\)/);
  assert.match(mainScss, /html\.aside-mobile-off \.aside \.card:not\(\.aside-toc\)/);
  assert.match(mainScss, /display: none/);
});

test('编译 CSS：max-width 900px / 390 时 .main.aside-right 叠成一列，主栏 100%，不是 74%+row', () => {
  for (const page of ['index', 'post']) {
    const css = compilePageCss(page);
    const stack = mediaInner(css, 'max-width: 900px');
    const desktop = mediaInner(css, 'min-width: 900px');
    assert.ok(stack.length > 0, `${page} max-width 900px`);
    const stackRules = cssRules(stack);
    const desktopRules = cssRules(desktop);

    assert.ok(
      ruleMatches(stackRules, /\.main\.aside-right(?![\w-])/, /flex-direction:\s*column/),
      `${page} 390/900 stack column`,
    );
    assert.ok(
      ruleMatches(stackRules, /\.main\.aside-right\s*>\s*\.content/, /width:\s*100%/),
      `${page} 390/900 content 100%`,
    );
    assert.equal(
      ruleMatches(stackRules, /\.main\.aside-right(?![\w-])/, /flex-direction:\s*row(?!\s*-)/),
      false,
      `${page} stack must not keep row`,
    );
    assert.equal(
      ruleMatches(stackRules, /\.main\.aside-right\s*>\s*\.content/, /width:\s*74%/),
      false,
      `${page} stack must not keep 74%`,
    );

    assert.ok(
      ruleMatches(desktopRules, /\.main\.aside-right(?![\w-])/, /flex-direction:\s*row(?!\s*-)/),
      `${page} desktop row`,
    );
    assert.ok(
      ruleMatches(desktopRules, /\.main\.aside-right\s*>\s*\.content/, /width:\s*74%/),
      `${page} desktop 74%`,
    );
  }
});

test('源码：桌面 74%/row 包在 min-width 900px；max-width 900px 覆盖 aside-right；不靠隐藏卡片修双栏', () => {
  const minIdx = mainScss.indexOf('@media (min-width: 900px)');
  const maxIdx = mainScss.indexOf('@media (max-width: 900px)');
  assert.ok(minIdx > 0 && maxIdx > minIdx);
  const desktopBlock = mainScss.slice(minIdx, maxIdx);
  const stackBlock = mainScss.slice(maxIdx, mainScss.indexOf('@include util.useResponsive(util.$w-md)'));
  assert.match(desktopBlock, /&\.aside-right/);
  assert.match(desktopBlock, /flex-direction:\s*row;/);
  assert.match(desktopBlock, /width:\s*74%/);
  assert.match(stackBlock, /&\.aside-right/);
  assert.match(stackBlock, /flex-direction:\s*column/);
  assert.match(stackBlock, /width:\s*100%/);
  assert.doesNotMatch(stackBlock, /aside-mobile-off/);
  assert.doesNotMatch(stackBlock, /display:\s*none/);
});
