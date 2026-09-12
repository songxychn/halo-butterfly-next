import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';

const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const settings = parse(settingsText);
const defaults = defaultsFromSettings(settings);
const configHtml = await readFile(new URL('../src/html/views/config.html', import.meta.url), 'utf8');
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const commonScss = await readFile(new URL('../src/scss/core/common.scss', import.meta.url), 'utf8');

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

test('默认对齐上游 SHA：rightside_bottom 空，CSS 回退 40px', () => {
  assert.equal(defaults.rightside.bottom, '');
  assert.equal(field('bottom').value, '');
  assert.equal(field('bottom').$formkit, 'text');
  assert.match(String(field('bottom').help), /rightside_bottom/);
  assert.match(String(field('bottom').help), /#rightside/);
  assert.match(String(field('bottom').help), /40px/);
  assert.equal(typeof defaults.aside.button, 'object');
});

test('YAML help 含 #rightside 已加引号，解析后不是断注释', () => {
  assert.match(settingsText, /help: "对应上游 Butterfly rightside_bottom/);
  assert.match(String(field('bottom').help), /#rightside/);
  assert.match(String(field('bottom').help), /\$rightside-bottom|#rightside/);
});

test('注入 --rightside-bottom；空值 40px；无新增 th:utext', () => {
  assert.match(configHtml, /--rightside-bottom/);
  assert.match(configHtml, /#strings\.isEmpty\(theme\.config\.rightside\?\.bottom\) \? '40px'/);
  assert.match(commonScss, /bottom:\s*var\(--rightside-bottom,\s*40px\)/);
  assert.doesNotMatch(configHtml, /th:utext/);
  assert.doesNotMatch(componentsHtml.split('id="rightside"')[1]?.slice(0, 2000) ?? '', /th:utext/);
});
