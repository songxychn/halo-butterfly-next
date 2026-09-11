import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  ASIDE_HIDE_DEFAULT,
  resolveAsideHide,
  shouldApplyHideAside,
} from '../src/js/core/aside-hide.mjs';

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

test('aside.hide 默认 false；仅显式 true 隐藏；键名不是 aside.button', () => {
  assert.equal(defaults.aside.hide, false);
  assert.equal(defaults.aside.enable, true);
  assert.equal(asideChild('hide').value, false);
  assert.deepEqual(asideChild('hide').options.map(option => option.value), [false, true]);
  assert.match(String(asideChild('hide').help), /aside\.hide/);
  assert.match(String(asideChild('hide').help), /aside\.button/);
  assert.equal(ASIDE_HIDE_DEFAULT, false);
  assert.equal(resolveAsideHide(undefined), false);
  assert.equal(resolveAsideHide(null), false);
  assert.equal(resolveAsideHide(false), false);
  assert.equal(resolveAsideHide('false'), false);
  assert.equal(resolveAsideHide(true), true);
  assert.equal(resolveAsideHide('true'), true);
  assert.equal(shouldApplyHideAside(true, true), true);
  assert.equal(shouldApplyHideAside(true, false), false);
  assert.equal(shouldApplyHideAside(true, undefined), false);
  assert.equal(shouldApplyHideAside(false, true), false);
  assert.equal(shouldApplyHideAside('false', true), false);
});

test('布局：aside.enable 且 hide 为 true 时 html 加 hide-aside；无新增 th:utext', () => {
  assert.match(
    layoutHtml,
    /th:classappend="\$\{theme\.config\.aside\.enable and \(theme\.config\.aside\.hide == true or theme\.config\.aside\.hide == 'true'\)\} \? 'hide-aside'"/,
  );
  assert.doesNotMatch(layoutHtml, /th:utext/);
  assert.match(settingsText, /name: hide/);
  const hideIdx = settingsText.indexOf('name: hide');
  const buttonIdx = settingsText.indexOf('name: button');
  assert.ok(hideIdx > 0 && buttonIdx > hideIdx);
});

test('样式：min-width 900px 时 html.hide-aside 隐藏 .aside、主栏 80%', () => {
  assert.match(mainScss, /@media \(min-width: 900px\)/);
  assert.match(mainScss, /html\.hide-aside \.main/);
  assert.match(mainScss, /> \.aside \{\s*display: none;/s);
  assert.match(mainScss, /> \.content \{\s*width: 80%;/s);
});
