import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  RIGHTSIDE_SCROLL_PERCENT_DEFAULT,
  SHOW_PERCENT_MAX,
  resolveRightsideScrollPercent,
  shouldShowGoUpPercent,
  updateGoUpPercent,
} from '../src/js/core/rightside.ts';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const configHtml = await readFile(new URL('../src/html/views/config.html', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/core/rightside.scss', import.meta.url), 'utf8');
const scrollJs = await readFile(new URL('../src/js/core/scroll.ts', import.meta.url), 'utf8');

function rightsideForm() {
  const form = settings.spec.forms.find(item => item.group === 'rightside');
  assert.ok(form, 'rightside');
  return form;
}

function field(name) {
  const node = rightsideForm().formSchema.find(item => item.name === name);
  assert.ok(node, name);
  return node;
}

test('默认对齐上游 SHA：rightside_scroll_percent false；仅显式 true 开启', () => {
  assert.equal(RIGHTSIDE_SCROLL_PERCENT_DEFAULT, false);
  assert.equal(defaults.rightside.scroll_percent, false);
  assert.equal(field('scroll_percent').value, false);
  assert.deepEqual(field('scroll_percent').options.map(option => option.value), [true, false]);
  assert.match(String(field('scroll_percent').help), /rightside_scroll_percent/);
  assert.match(String(field('scroll_percent').help), /#go-up/);
  assert.match(settingsText, /group: rightside/);
  assert.equal(typeof defaults.aside.button, 'object');
  assert.equal(resolveRightsideScrollPercent(undefined), false);
  assert.equal(resolveRightsideScrollPercent(null), false);
  assert.equal(resolveRightsideScrollPercent(false), false);
  assert.equal(resolveRightsideScrollPercent('false'), false);
  assert.equal(resolveRightsideScrollPercent(true), true);
  assert.equal(resolveRightsideScrollPercent('true'), true);
});

test('模板：仅显式 true 渲染 .scroll-percent；无新增 th:utext', () => {
  assert.match(componentsHtml, /percentOn/);
  assert.match(componentsHtml, /class="scroll-percent"/);
  assert.match(componentsHtml, /th:if="\$\{percentOn\}"/);
  assert.match(configHtml, /rightside_scroll_percent/);
  assert.match(scrollJs, /bindRightsideScrollPercent/);
  assert.doesNotMatch(componentsHtml, /th:utext/);
  assert.doesNotMatch(configHtml, /th:utext/);
});

test('样式含 .scroll-percent 与 .show-percent', () => {
  assert.match(scss, /\.scroll-percent/);
  assert.match(scss, /show-percent/);
});

test('小于 95% 显示数字；>= 95 去掉 show-percent；textContent 非 HTML', () => {
  assert.equal(SHOW_PERCENT_MAX, 95);
  assert.equal(shouldShowGoUpPercent(0), true);
  assert.equal(shouldShowGoUpPercent(94), true);
  assert.equal(shouldShowGoUpPercent(95), false);
  assert.equal(shouldShowGoUpPercent(100), false);

  const names = new Set();
  const goUp = {
    classList: {
      add(name) { names.add(name); },
      remove(name) { names.delete(name); },
    },
  };
  const percentEl = { textContent: '' };
  const ele = { clientHeight: 2000, offsetTop: 0 };
  const viewport = { innerHeight: 500, document: { documentElement: { scrollHeight: 2000 } } };
  updateGoUpPercent(goUp, percentEl, 0, ele, viewport);
  assert.equal(names.has('show-percent'), true);
  assert.equal(percentEl.textContent, '0');
  updateGoUpPercent(goUp, percentEl, 2000, ele, viewport);
  assert.equal(names.has('show-percent'), false);
});
