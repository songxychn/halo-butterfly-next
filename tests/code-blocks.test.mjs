import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('代码块工具栏默认值对齐上游 Butterfly 5.7.0 code_blocks', () => {
  assert.equal(defaults.render.enable_code_copy, true);
  assert.equal(defaults.render.enable_code_title, true);
  assert.equal(defaults.render.enable_code_expander, true);
  assert.equal(defaults.render.enable_code_mac_style, false);
  assert.equal(defaults.render.code_height_limit, false);
  assert.equal(defaults.render.enable_code_word_wrap, false);
  assert.equal(defaults.render.enable_code_fullpage, false);
  assert.equal(defaults.render.code_theme_light, 'one-light');
  assert.equal(defaults.render.code_theme_dark, 'one-dark');
});

test('halo.settings 真实存在 copy/shrink/language/macStyle/height_limit', async () => {
  const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
  const render = settings.spec.forms.find(form => form.group === 'render');
  assert.ok(render);
  const names = new Set();
  const visit = nodes => {
    for (const node of nodes || []) {
      if (node.name) names.add(node.name);
      if (node.children) visit(node.children);
    }
  };
  visit(render.formSchema);
  for (const name of ['enable_code_copy', 'enable_code_expander', 'enable_code_title', 'enable_code_mac_style', 'code_height_limit']) {
    assert.ok(names.has(name), name);
  }
});

test('模板注入工具栏开关，页面与文章共用 codeBlockPin', async () => {
  const fragment = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
  assert.match(fragment, /th:fragment="codeBlockPin"/);
  assert.match(fragment, /theme\.config\.render\.enable_code_copy/);
  assert.match(fragment, /theme\.config\.render\.enable_code_expander/);
  assert.match(fragment, /theme\.config\.render\.enable_code_title/);
  assert.match(fragment, /theme\.config\.render\.enable_code_mac_style/);
  assert.match(fragment, /theme\.config\.render\.code_height_limit/);
  assert.match(fragment, /enable_code_mac_style: \/\*\[\[\$\{theme\.config\.render\.enable_code_mac_style\}\]\]\*\/ false/);

  const post = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/html/page.html', import.meta.url), 'utf8');
  assert.match(post, /views\/components :: codeBlockPin/);
  assert.match(page, /views\/components :: codeBlockPin/);
  assert.match(post, /annotations\.getOrDefault\(post, 'enable_code_copy'/);
});

test('JS 按开关输出控件：copy 可键盘激活，关闭 copy 不输出按钮', async () => {
  const js = await readFile(new URL('../src/js/modules/CodeBlock.js', import.meta.url), 'utf8');
  assert.match(js, /#copyEnabled\(/);
  assert.match(js, /#flag\('enable_code_copy'\)/);
  assert.match(js, /#flag\('enable_code_expander'\)/);
  assert.match(js, /#flag\('enable_code_title'\)/);
  assert.match(js, /#flag\('enable_code_mac_style'\)/);
  assert.match(js, /addClass\('mac-style'\)/);
  assert.match(js, /toolbar-item.*remove|find\('\.toolbar-item'\)\.first\(\)\.remove/);
  assert.match(js, /<button type="button" class="code-copy"/);
  assert.match(js, /aria-label="复制代码"/);
  assert.match(js, /复制成功~/);
  assert.match(js, /copy-notice/);
  assert.match(js, /useMessage\.info/);
  assert.match(js, /code_height_limit/);

  const copyStart = js.indexOf('#copyEnabled()');
  const copyAppend = js.indexOf('class="code-copy"', copyStart);
  const copyIf = js.lastIndexOf('this.#copyEnabled()', copyAppend);
  assert.ok(copyStart >= 0 && copyIf > copyStart && copyAppend > copyIf);
  assert.equal((js.match(/class="code-copy"/g) || []).length, 1);

  const expanderIf = js.indexOf("#flag('enable_code_expander')");
  const expanderAppend = js.indexOf('class="code-expander"', expanderIf);
  assert.ok(expanderIf >= 0 && expanderAppend > expanderIf);
});

test('mac 圆点与高度限制由 class 控制，默认样式不强制圆点', async () => {
  const scss = await readFile(new URL('../src/scss/modules/codeBlock.scss', import.meta.url), 'utf8');
  assert.match(scss, /&\.mac-style::before/);
  assert.doesNotMatch(scss, /^\s*&::before/m);
  assert.match(scss, /\.copy-notice/);
  assert.match(scss, /\.code-copy/);
  assert.match(scss, /has-height-limit/);
  assert.match(scss, /--code-height-limit/);
});
