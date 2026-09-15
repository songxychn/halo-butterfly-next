import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  MASK_HEADER_DEFAULT,
  resolveMaskHeader,
  shouldRenderHeaderMask,
} from '../src/js/core/mask.mjs';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const layoutHtml = await readFile(new URL('../src/html/views/layout.html', import.meta.url), 'utf8');
const headerScss = await readFile(new URL('../src/scss/core/header.scss', import.meta.url), 'utf8');

function maskForm() {
  const form = settings.spec.forms.find(item => item.group === 'mask');
  assert.ok(form, 'mask');
  return form;
}

function maskChild(name) {
  const node = maskForm().formSchema.find(item => item.name === name);
  assert.ok(node, name);
  return node;
}

test('mask.header 默认 true；仅显式 false 关闭', () => {
  assert.equal(defaults.mask.header, true);
  assert.equal(defaults.mask.footer, true);
  assert.equal(maskChild('header').value, true);
  assert.deepEqual(maskChild('header').options.map(option => option.value), [true, false]);
  assert.match(String(maskChild('header').help), /mask\.header/);
  assert.match(String(maskChild('header').help), /not-top-img/);
  assert.equal(MASK_HEADER_DEFAULT, true);
  assert.equal(resolveMaskHeader(undefined), true);
  assert.equal(resolveMaskHeader(null), true);
  assert.equal(resolveMaskHeader(true), true);
  assert.equal(resolveMaskHeader('true'), true);
  assert.equal(resolveMaskHeader(false), false);
  assert.equal(resolveMaskHeader('false'), false);
  assert.equal(shouldRenderHeaderMask(true, true), true);
  assert.equal(shouldRenderHeaderMask(true, undefined), true);
  assert.equal(shouldRenderHeaderMask(true, false), false);
  assert.equal(shouldRenderHeaderMask(false, true), false);
  assert.equal(shouldRenderHeaderMask('false', true), false);
});

test('布局：默认给 #Butterfly 加 mask-header；无 th:utext', () => {
  assert.match(layoutHtml, /id="Butterfly"/);
  assert.match(layoutHtml, /th:classappend="\$\{theme\.config\.mask\?\.header != false and theme\.config\.mask\?\.header != 'false'\} \? ' mask-header'"/);
  assert.doesNotMatch(layoutHtml, /th:utext/);
});

test('样式：仅 #Butterfly.mask-header 时 .above 才有 :before', () => {
  assert.match(headerScss, /#Butterfly\.mask-header &::before/);
  assert.match(headerScss, /above-mask-color/);
  assert.doesNotMatch(headerScss, /^\s+&::before \{/m);
});
