import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
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
