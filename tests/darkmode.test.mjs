const bootstrapSource = await readFile(new URL('../src/js/bootstrap.ts', import.meta.url), 'utf8');
import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  DARKMODE_ENABLE_DEFAULT,
  DARKMODE_BUTTON_DEFAULT,
  AUTO_CHANGE_MODE_DEFAULT,
  DARKMODE_START_DEFAULT,
  DARKMODE_END_DEFAULT,
  resolveDarkmodeEnable,
  resolveDarkmodeButton,
  shouldShowDarkmodeButton,
  toggleColorScheme,
  resolveAutoChangeMode,
  resolveHourBound,
  isNightHour,
  resolveInitialColorScheme,
  shouldListenPrefersColorScheme,
} from '../src/js/core/darkmode.ts';

const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const settings = parse(settingsText);
const defaults = defaultsFromSettings(settings);
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const commonJs = await readFile(new URL('../src/js/core/common.ts', import.meta.url), 'utf8');

function darkmodeForm() {
  const form = settings.spec.forms.find(item => item.group === 'darkmode');
  assert.ok(form, 'darkmode');
  return form;
}

function field(name) {
  const node = darkmodeForm().formSchema.find(item => item.name === name);
  assert.ok(node, name);
  return node;
}

test('默认对齐上游 SHA：enable/button true；仅显式 false 关闭', () => {
  assert.equal(DARKMODE_ENABLE_DEFAULT, true);
  assert.equal(DARKMODE_BUTTON_DEFAULT, true);
  assert.equal(defaults.darkmode.enable, true);
  assert.equal(defaults.darkmode.button, true);
  assert.equal(field('enable').value, true);
  assert.equal(field('button').value, true);
  assert.deepEqual(field('enable').options.map(option => option.value), [true, false]);
  assert.deepEqual(field('button').options.map(option => option.value), [true, false]);
  assert.equal(typeof defaults.aside.button, 'object');
  assert.equal(resolveDarkmodeEnable(undefined), true);
  assert.equal(resolveDarkmodeEnable(true), true);
  assert.equal(resolveDarkmodeEnable('true'), true);
  assert.equal(resolveDarkmodeEnable(false), false);
  assert.equal(resolveDarkmodeEnable('false'), false);
  assert.equal(resolveDarkmodeButton(false), false);
  assert.equal(shouldShowDarkmodeButton(true, true), true);
  assert.equal(shouldShowDarkmodeButton(undefined, undefined), true);
  assert.equal(shouldShowDarkmodeButton(false, true), false);
  assert.equal(shouldShowDarkmodeButton(true, false), false);
});

test('YAML help 含 #darkmode 已加引号；enable&&button 才渲染；无新增 th:utext', () => {
  assert.match(settingsText, /help: "对应上游 Butterfly darkmode.enable/);
  assert.match(String(field('enable').help), /#darkmode/);
  assert.match(String(field('button').help), /#darkmode/);
  assert.match(componentsHtml, /id="darkmode"/);
  assert.match(componentsHtml, /darkBtnOn/);
  assert.match(componentsHtml, /theme.config.darkmode\?\.enable != false/);
  assert.match(componentsHtml, /theme.config.darkmode\?\.button != false/);
  assert.doesNotMatch(componentsHtml, /style.mode == 'user'/);
  assert.match(commonJs, /bindDarkmode/);
  assert.doesNotMatch(componentsHtml, /th:utext/);
  const transIdx = componentsHtml.indexOf('id="translateLink"');
  const darkIdx = componentsHtml.indexOf('id="darkmode"');
  const hideIdx = componentsHtml.indexOf('id="hide-aside-btn"');
  assert.ok(transIdx > 0 && darkIdx > transIdx && darkIdx < hideIdx);
});

test('点击调用 toggleMode，不走 innerHTML', () => {
  let calls = 0;
  let mode = 'light';
  const theme = {
    toggleMode() {
      calls += 1;
      mode = mode === 'light' ? 'dark' : 'light';
    },
    getMode() { return mode; },
  };
  assert.equal(toggleColorScheme(theme), 'dark');
  assert.equal(calls, 1);
  assert.equal(toggleColorScheme(theme), 'light');
  assert.equal(toggleColorScheme(null), null);
});

const configHtml = await readFile(new URL('../src/html/views/config.html', import.meta.url), 'utf8');
const themeJs = await readFile(new URL('../src/js/core/theme.ts', import.meta.url), 'utf8');

test('默认对齐上游 SHA：autoChangeMode false；start/end 空回退 6/18', () => {
  assert.equal(AUTO_CHANGE_MODE_DEFAULT, false);
  assert.equal(DARKMODE_START_DEFAULT, 6);
  assert.equal(DARKMODE_END_DEFAULT, 18);
  assert.equal(defaults.darkmode.autoChangeMode, false);
  assert.equal(defaults.darkmode.start, '');
  assert.equal(defaults.darkmode.end, '');
  assert.equal(field('autoChangeMode').value, false);
  assert.deepEqual(field('autoChangeMode').options.map(option => option.value), [false, 1, 2]);
  assert.equal(field('start').value, '');
  assert.equal(field('end').value, '');
  assert.equal(resolveAutoChangeMode(undefined), false);
  assert.equal(resolveAutoChangeMode(false), false);
  assert.equal(resolveAutoChangeMode('false'), false);
  assert.equal(resolveAutoChangeMode(1), 1);
  assert.equal(resolveAutoChangeMode('1'), 1);
  assert.equal(resolveAutoChangeMode(2), 2);
  assert.equal(resolveAutoChangeMode('2'), 2);
  assert.equal(resolveHourBound('', 6), 6);
  assert.equal(resolveHourBound(null, 6), 6);
  assert.equal(resolveHourBound(0, 6), 0);
  assert.equal(resolveHourBound('0', 18), 0);
  assert.equal(resolveHourBound(6, 6), 6);
  assert.equal(resolveHourBound(24, 6), 24);
  assert.equal(resolveHourBound(25, 6), 6);
  assert.equal(isNightHour(5, 6, 18), true);
  assert.equal(isNightHour(6, 6, 18), false);
  assert.equal(isNightHour(17, 6, 18), false);
  assert.equal(isNightHour(18, 6, 18), true);
  assert.equal(isNightHour(18, 18, 6), true);
  assert.equal(isNightHour(12, 18, 6), false);
});

test('初始主题：强制 / 已存优先；1 跟随系统；2 按小时；false 无已存为 light', () => {
  assert.equal(resolveInitialColorScheme({ styleMode: 'dark', autoChangeMode: 1, saved: 'light', hour: 12 }), 'dark');
  assert.equal(resolveInitialColorScheme({ styleMode: 'light', autoChangeMode: 2, hour: 3 }), 'light');
  assert.equal(resolveInitialColorScheme({ styleMode: 'user', saved: 'dark', autoChangeMode: 1, prefersLight: true }), 'dark');
  assert.equal(resolveInitialColorScheme({
    styleMode: 'user', autoChangeMode: 1, prefersLight: true, prefersDark: false, hour: 3,
  }), 'light');
  assert.equal(resolveInitialColorScheme({
    styleMode: 'user', autoChangeMode: 1, prefersLight: false, prefersDark: true, hour: 12,
  }), 'dark');
  assert.equal(resolveInitialColorScheme({
    styleMode: 'user', autoChangeMode: 1, prefersLight: false, prefersDark: false, hour: 3,
  }), 'dark');
  assert.equal(resolveInitialColorScheme({
    styleMode: 'user', autoChangeMode: 2, start: '', end: '', hour: 12,
  }), 'light');
  assert.equal(resolveInitialColorScheme({
    styleMode: 'user', autoChangeMode: 2, start: 0, end: 24, hour: 0,
  }), 'light');
  assert.equal(resolveInitialColorScheme({ styleMode: 'user', autoChangeMode: false, hour: 3 }), 'light');
  assert.equal(resolveInitialColorScheme({ styleMode: 'auto', autoChangeMode: false, hour: 3 }), 'dark');
  assert.equal(shouldListenPrefersColorScheme({ styleMode: 'user', autoChangeMode: 1, saved: null }), true);
  assert.equal(shouldListenPrefersColorScheme({ styleMode: 'user', autoChangeMode: 1, saved: 'dark' }), false);
  assert.equal(shouldListenPrefersColorScheme({ styleMode: 'dark', autoChangeMode: 1 }), false);
});

test('首屏与 Theme：注入 autoChangeMode；初始 setMode 不 persist；无新增 th:utext', () => {
  assert.match(configHtml, /darkmode_autoChangeMode/);
  assert.match(bootstrapSource, /prefers-color-scheme: dark/);
  assert.match(themeJs, /persist: false/);
  assert.match(themeJs, /prefers-color-scheme: dark/);
  assert.doesNotMatch(configHtml, /th:utext/);
  assert.equal(typeof defaults.aside.button, 'object');
});
