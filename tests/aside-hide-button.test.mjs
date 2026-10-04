const bootstrapSource = await readFile(new URL('../src/js/bootstrap.ts', import.meta.url), 'utf8');
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  ASIDE_HIDE_BUTTON_DEFAULT,
  ASIDE_STATUS_KEY,
  ASIDE_STATUS_TTL_DAYS,
  resolveAsideHideButton,
  shouldShowHideAsideButton,
  shouldRestoreAsideStatus,
  nextAsideStatus,
  readAsideStatus,
  writeAsideStatus,
  applyAsideStatus,
  restoreAsideStatus,
  onHideAsideButtonClick,
} from '../src/js/core/aside-hide-button.ts';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const configHtml = await readFile(new URL('../src/html/views/config.html', import.meta.url), 'utf8');
const layoutHtml = await readFile(new URL('../src/html/views/layout.html', import.meta.url), 'utf8');
const commonJs = await readFile(new URL('../src/js/core/common.ts', import.meta.url), 'utf8');
const asideHtml = await readFile(new URL('../src/html/views/aside.html', import.meta.url), 'utf8');

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

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) { return Object.hasOwn(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
  };
}

test('aside.hide_button 默认 true；仅显式 false 关闭；不复用作者卡片 aside.button', () => {
  assert.equal(defaults.aside.hide_button, true);
  assert.equal(defaults.aside.hide, false);
  assert.equal(defaults.aside.mobile, true);
  assert.equal(asideChild('hide_button').value, true);
  assert.deepEqual(asideChild('hide_button').options.map(option => option.value), [true, false]);
  assert.match(String(asideChild('hide_button').help), /aside\.hide_button/);
  assert.match(String(asideChild('hide_button').help), /aside\.button/);
  assert.match(String(asideChild('hide_button').help), /#hide-aside-btn/);
  assert.equal(asideChild('button').$formkit, 'group');
  assert.equal(typeof defaults.aside.button, 'object');
  assert.ok('name' in defaults.aside.button && 'link' in defaults.aside.button);
  assert.equal(ASIDE_HIDE_BUTTON_DEFAULT, true);
  assert.equal(resolveAsideHideButton(undefined), true);
  assert.equal(resolveAsideHideButton(null), true);
  assert.equal(resolveAsideHideButton(true), true);
  assert.equal(resolveAsideHideButton('true'), true);
  assert.equal(resolveAsideHideButton(false), false);
  assert.equal(resolveAsideHideButton('false'), false);
  assert.equal(shouldShowHideAsideButton(true, false), false);
  assert.equal(shouldShowHideAsideButton(true, true), true);
  assert.equal(shouldShowHideAsideButton(true, undefined), true);
  assert.equal(shouldShowHideAsideButton(false, true), false);
  assert.equal(shouldShowHideAsideButton('false', true), false);
  assert.equal(shouldRestoreAsideStatus(true, true), true);
  assert.equal(shouldRestoreAsideStatus(true, false), false);
});

test('布局：#hide-aside-btn 在 #rightside-config-hide；无新增 th:utext；作者卡片 aside.button 仍独立', () => {
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /id="rightside-config-hide"/);
  assert.match(componentsHtml, /theme\.config\.aside\.hide_button != false/);
  assert.match(componentsHtml, /theme\.config\.aside\.enable != false/);
  assert.doesNotMatch(componentsHtml, /th:utext/);
  assert.doesNotMatch(layoutHtml, /th:utext/);
  assert.match(bootstrapSource, /aside-status/);
  assert.match(configHtml, /hide_button != false/);
  assert.match(commonJs, /bindHideAsideButton/);
  assert.match(asideHtml, /theme\.config\.aside\.button\.name/);
  const hideBtnIdx = settingsText.indexOf('name: hide_button');
  const authorBtnIdx = settingsText.indexOf('name: button');
  const mobileIdx = settingsText.indexOf('name: mobile');
  assert.ok(mobileIdx > 0 && hideBtnIdx > mobileIdx && authorBtnIdx > hideBtnIdx);
});

test('交互：toggle html.hide-aside 并按上游 TTL 写入 aside-status', () => {
  assert.equal(ASIDE_STATUS_KEY, 'aside-status');
  assert.equal(ASIDE_STATUS_TTL_DAYS, 2);
  assert.equal(nextAsideStatus(true), 'show');
  assert.equal(nextAsideStatus(false), 'hide');

  const storage = memoryStorage();
  const now = Date.now();
  writeAsideStatus('hide', 2, storage, now);
  const stored = JSON.parse(storage.getItem(ASIDE_STATUS_KEY));
  assert.equal(stored.value, 'hide');
  assert.equal(stored.expiry, now + 2 * 86400000);
  assert.equal(readAsideStatus(storage), 'hide');

  const expired = memoryStorage({
    [ASIDE_STATUS_KEY]: JSON.stringify({ value: 'hide', expiry: 1 }),
  });
  assert.equal(readAsideStatus(expired), undefined);
  assert.equal(expired.getItem(ASIDE_STATUS_KEY), null);

  const classes = new Set();
  const classList = {
    contains(name) { return classes.has(name); },
    toggle(name, force) {
      if (force === undefined) {
        if (classes.has(name)) classes.delete(name); else classes.add(name);
        return;
      }
      if (force) classes.add(name); else classes.delete(name);
    },
  };
  applyAsideStatus(classList, 'hide');
  assert.equal(classes.has('hide-aside'), true);
  applyAsideStatus(classList, 'show');
  assert.equal(classes.has('hide-aside'), false);

  restoreAsideStatus(classList, memoryStorage({
    [ASIDE_STATUS_KEY]: JSON.stringify({ value: 'hide' }),
  }), true, true);
  assert.equal(classes.has('hide-aside'), true);
  const before = classes.has('hide-aside');
  restoreAsideStatus(classList, memoryStorage({
    [ASIDE_STATUS_KEY]: JSON.stringify({ value: 'show' }),
  }), true, false);
  assert.equal(classes.has('hide-aside'), before);

  const clickStore = memoryStorage();
  onHideAsideButtonClick(classList, clickStore);
  assert.equal(classes.has('hide-aside'), false);
  assert.equal(JSON.parse(clickStore.getItem(ASIDE_STATUS_KEY)).value, 'show');
});
