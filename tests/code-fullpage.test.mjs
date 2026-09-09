import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';

const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const settings = parse(settingsText);
const defaults = defaultsFromSettings(settings);
const js = await readFile(new URL('../src/js/modules/CodeBlock.js', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/modules/codeBlock.scss', import.meta.url), 'utf8');
const fragment = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');

test('code_blocks.fullpage 默认 false', () => {
  assert.equal(defaults.render.enable_code_fullpage, false);
});

test('settings.yaml 存在 enable_code_fullpage，且依赖 enable_code', () => {
  const render = settings.spec.forms.find(form => form.group === 'render');
  assert.ok(render);
  const field = render.formSchema.find(node => node.name === 'enable_code_fullpage');
  assert.ok(field);
  assert.equal(field.if, '$get(enable_code).value');
  assert.equal(field.value, false);
  assert.match(String(field.help), /code_blocks\.fullpage/);
});

test('开关 false 不插入全屏按钮；true 输出可键盘激活的 button', () => {
  assert.match(js, /#flag\('enable_code_fullpage'\)/);
  const flag = js.indexOf("#flag('enable_code_fullpage')");
  const button = js.indexOf('<button type="button" class="fullpage-button"', flag);
  assert.ok(flag >= 0 && button > flag);
  assert.equal((js.match(/class="fullpage-button"/g) || []).length, 1);
  const guarded = js.slice(flag, button);
  assert.match(guarded, /#flag\('enable_code_fullpage'\)/);
  assert.match(js, /aria-label="全屏代码"/);
  assert.match(js, /type="button" class="fullpage-button"/);
  assert.doesNotMatch(js, /<span[^>]*class="[^"]*fullpage-button/);
  assert.match(fragment, /theme\.config\.render\.enable_code_fullpage/);
  assert.match(fragment, /enable_code_fullpage: \/\*\[\[\$\{theme\.config\.render\.enable_code_fullpage\}\]\]\*\/ false/);
});

test('进入/退出全屏：class、Esc、overflow 恢复', () => {
  assert.match(js, /addClass\('code-fullpage'\)/);
  assert.match(js, /removeClass\('code-fullpage'\)/);
  assert.match(js, /document\.body\.style\.overflow/);
  assert.match(js, /document\.documentElement\.style\.overflow/);
  assert.match(js, /keydown/);
  assert.match(js, /Escape/);
  assert.match(js, /fa-up-right-and-down-left-from-center/);
  assert.match(js, /fa-down-left-and-up-right-to-center/);
  assert.match(scss, /&\.code-fullpage/);
  assert.match(scss, /position:\s*fixed/);
  assert.match(scss, /z-index:\s*9999/);
  assert.match(scss, /html\[data-color-scheme='dark'\].*fullpage-button|fullpage-button[\s\S]*data-color-scheme='dark'/s);
});

test('本刀不含 shrink=true 默认折叠新语义', () => {
  assert.equal(defaults.render.enable_code_expander, true);
  assert.match(js, /aria-expanded="true"/);
  assert.doesNotMatch(js, /addClass\('closed'\)/);
  assert.doesNotMatch(js, /shrink\s*[:=]\s*true/);
  assert.doesNotMatch(settingsText, /shrink\s*=\s*true/);
  assert.match(js, /class="code-copy"/);
  assert.match(js, /class="code-expander"/);
  assert.match(js, /#flag\('enable_code_mac_style'\)/);
  assert.match(js, /#flag\('enable_code_word_wrap'\)/);
  assert.match(js, /code_height_limit/);
});
