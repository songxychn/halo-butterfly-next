import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';

const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const settings = parse(settingsText);
const defaults = defaultsFromSettings(settings);
const js = await readFile(new URL('../src/js/modules/CodeBlock.ts', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/modules/codeBlock.scss', import.meta.url), 'utf8');
const fragment = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');

test('code_blocks.word_wrap 默认 false', () => {
  assert.equal(defaults.render.enable_code_word_wrap, false);
});

test('settings.yaml 存在 enable_code_word_wrap，且依赖 enable_code', () => {
  const render = settings.spec.forms.find(form => form.group === 'render');
  assert.ok(render);
  const field = render.formSchema.find(node => node.name === 'enable_code_word_wrap');
  assert.ok(field);
  assert.equal(field.if, '$get(enable_code).value');
  assert.equal(field.value, false);
  assert.match(String(field.help), /code_blocks\.word_wrap/);
});

test('开关为 true 时给代码块包装加上游 word-wrap 类；false 不加权', () => {
  assert.match(js, /#flag\('enable_code_word_wrap'\)/);
  const flag = js.indexOf("#flag('enable_code_word_wrap')");
  const addClass = js.indexOf("addClass('word-wrap')", flag);
  assert.ok(flag >= 0 && addClass > flag);
  assert.equal((js.match(/addClass\('word-wrap'\)/g) || []).length, 1);
  const ifLine = js.slice(js.lastIndexOf('\n', addClass) + 1, addClass);
  assert.match(ifLine, /#flag\('enable_code_word_wrap'\)/);
  assert.match(fragment, /theme\.config\.render\.enable_code_word_wrap/);
  assert.match(fragment, /enable_code_word_wrap: \/\*\[\[\$\{theme\.config\.render\.enable_code_word_wrap\}\]\]\*\/ false/);
});

test('word_wrap 样式仅在 .word-wrap 下换行', () => {
  assert.match(scss, /&\.word-wrap/);
  assert.match(scss, /white-space:\s*pre-wrap/);
  assert.match(scss, /overflow-wrap:\s*break-word/);
  assert.match(scss, /overflow-x:\s*hidden/);
});
