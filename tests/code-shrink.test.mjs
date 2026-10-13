import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings, migrateConfig } from '../scripts/config-migration.mjs';
import { resolveCodeShrink } from '../src/js/core/code-shrink.ts';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const js = await readFile(new URL('../src/js/modules/CodeBlock.ts', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/modules/codeBlock.scss', import.meta.url), 'utf8');
const fragment = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');

function expanderField() {
  const render = settings.spec.forms.find(form => form.group === 'render');
  assert.ok(render);
  const field = render.formSchema.find(node => node.name === 'code_shrink');
  assert.ok(field);
  return field;
}

test('code_blocks.shrink 默认对齐上游 false', () => {
  assert.equal(defaults.render.code_shrink, 'expanded');
  assert.equal(typeof defaults.render.code_shrink, 'string');
});

test('settings.yaml 以字符串三态表达 shrink，且仍映射 code_shrink', () => {
  const field = expanderField();
  assert.equal(field.if, '$get(enable_code).value');
  assert.equal(field.value, 'expanded');
  const values = field.options.map(option => option.value);
  assert.deepEqual(values, ['expanded', 'collapsed', 'disabled']);
  assert.ok(values.every(value => typeof value === 'string'));
  assert.match(String(field.help), /code_blocks\.shrink/);
  assert.match(String(field.help), /完整代码/);
  assert.doesNotMatch(String(field.help), /旧版布尔/);
  assert.match(fragment, /theme\.config\.render\.code_shrink/);
  assert.match(fragment, /code_shrink: \/\*\[\[\$\{theme\.config\.render\.code_shrink\}\]\]\*\/ 'expanded'/);
});

test('三态源码：none 无按钮不 closed；false 有按钮展开；true 有按钮初始 closed', () => {
  assert.match(js, /#shrinkMode\(/);
  assert.match(js, /resolveCodeShrink/);
  assert.match(js, /shrink !== 'none'/);
  assert.match(js, /shrink === 'true'/);
  assert.match(js, /addClass\('closed'\)/);
  assert.match(js, /toggleClass\('closed', !expanded\)/);
  assert.match(js, /#setCodeExpanded\(wrap, expander, wrap\.hasClass\('closed'\)\)/);
  assert.match(js, /<button type="button" class="code-expander"/);
  assert.equal((js.match(/class="code-expander"/g) || []).length, 1);
  assert.doesNotMatch(js, /#flag\('code_shrink'\)/);
  const noneGuard = js.indexOf("shrink !== 'none'");
  const button = js.indexOf('class="code-expander"', noneGuard);
  const closed = js.indexOf("addClass('closed')", noneGuard);
  assert.ok(noneGuard >= 0 && button > noneGuard);
  assert.ok(closed > noneGuard && closed < button);
  assert.match(js, /aria-expanded="\$\{initiallyClosed \? 'false' : 'true'\}"/);
  assert.match(js, /class="code-copy"/);
  assert.match(js, /#flag\('enable_code_mac_style'\)/);
  assert.match(js, /#flag\('enable_code_word_wrap'\)/);
  assert.match(js, /#flag\('enable_code_fullpage'\)/);
  assert.match(js, /code_height_limit/);
});

test('初始折叠视觉使用上游 closed，macStyle 旋转方向与上游一致', () => {
  assert.match(scss, /&\.closed/);
  assert.match(scss, /transform:\s*rotate\(-90deg\)/);
  assert.match(scss, /&\.mac-style .*code-expander[\s\S]*rotate\(90deg\)/s);
  assert.doesNotMatch(scss, /&\.enable-expander/);
});

test('runtime accepts semantic states only; legacy booleans/strings use the default', () => {
  assert.equal(resolveCodeShrink('collapsed'), 'true');
  assert.equal(resolveCodeShrink('disabled'), 'none');
  for (const value of ['expanded', true, false, 'true', 'false', 'none', undefined, null, '']) assert.equal(resolveCodeShrink(value), 'false');
});
test('offline importer converts old boolean and string states', () => {
  for (const [value, expected] of [[true, 'expanded'], [false, 'disabled'], ['true', 'collapsed'], ['false', 'expanded'], ['none', 'disabled']]) {
    const migrated = migrateConfig({render:{enable_code_expander:value}}, '2.0.7', defaults);
    assert.equal(migrated.config.render.code_shrink, expected);
    assert.equal('enable_code_expander' in migrated.config.render, false);
  }
  assert.equal(migrateConfig({code:{enable_expander:true}}, '2.0.5', defaults).config.render.code_shrink, 'expanded');
});
