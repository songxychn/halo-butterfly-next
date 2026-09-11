import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  DEFAULTS,
  formatOwnerCopyright,
  resolveCopyrightEnable,
  resolveCopyrightVersion,
  resolveCustomText,
  resolveOwnerEnable,
  resolveSinceYear,
  shouldRenderNav,
  visibleNavItems,
} from '../src/js/core/footer.mjs';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const footerHtml = await readFile(new URL('../src/html/views/footer.html', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/core/footer.scss', import.meta.url), 'utf8');

function footerForm() {
  const form = settings.spec.forms.find(item => item.group === 'footer');
  assert.ok(form, 'footer');
  return form;
}

function child(name) {
  const node = footerForm().formSchema.find(item => item.name === name);
  assert.ok(node, name);
  return node;
}

function groupChild(groupName, name) {
  const node = child(groupName).children.find(item => item.name === name);
  assert.ok(node, `${groupName}.${name}`);
  return node;
}

test('默认对齐上游 SHA：owner true/2025、copyright true/true、custom_text 空', () => {
  assert.equal(defaults.footer.owner.enable, true);
  assert.equal(defaults.footer.owner.since, 2025);
  assert.equal(defaults.footer.copyright.enable, true);
  assert.equal(defaults.footer.copyright.version, true);
  assert.equal(defaults.footer.custom_text, '');
  assert.deepEqual(defaults.footer.nav, []);
  assert.equal(groupChild('owner', 'enable').value, true);
  assert.deepEqual(groupChild('owner', 'enable').options.map(option => option.value), [true, false]);
  assert.equal(groupChild('owner', 'since').value, 2025);
  assert.equal(groupChild('copyright', 'enable').value, true);
  assert.equal(groupChild('copyright', 'version').value, true);
  assert.equal(child('custom_text').value, '');
  assert.deepEqual(child('nav').value, []);
  assert.equal(DEFAULTS.owner.enable, true);
  assert.equal(DEFAULTS.owner.since, 2025);
  assert.equal(DEFAULTS.copyright.enable, true);
  assert.equal(DEFAULTS.copyright.version, true);
  assert.match(String(child('owner').help), /footer\.pug/);
  assert.match(String(child('owner').help), /不做 footer_img/);
  assert.match(String(groupChild('owner', 'enable').help), /footer\.owner\.enable/);
  assert.match(String(groupChild('copyright', 'enable').help), /footer\.copyright\.enable/);
  assert.match(String(groupChild('copyright', 'version').help), /footer\.copyright\.version/);
  assert.match(String(child('custom_text').help), /th:text/);
  assert.equal(child('nav').name, 'nav');
  assert.match(String(child('nav').help), /footer\.nav/);
  assert.match(String(child('nav').help), /th:text/);
});

test('owner / copyright 仅显式 false 关闭；缺省为 true', () => {
  assert.equal(resolveOwnerEnable(true), true);
  assert.equal(resolveOwnerEnable('true'), true);
  assert.equal(resolveOwnerEnable(false), false);
  assert.equal(resolveOwnerEnable('false'), false);
  assert.equal(resolveOwnerEnable(undefined), true);
  assert.equal(resolveOwnerEnable(null), true);
  assert.equal(resolveCopyrightEnable(false), false);
  assert.equal(resolveCopyrightEnable('false'), false);
  assert.equal(resolveCopyrightEnable(undefined), true);
  assert.equal(resolveCopyrightVersion(false), false);
  assert.equal(resolveCopyrightVersion('false'), false);
  assert.equal(resolveCopyrightVersion(undefined), true);
});

test('since 与当前年不同才显示区间；空或非正数只显示当前年', () => {
  assert.equal(resolveSinceYear(2025), 2025);
  assert.equal(resolveSinceYear('2025'), 2025);
  assert.equal(resolveSinceYear(''), null);
  assert.equal(resolveSinceYear(null), null);
  assert.equal(resolveSinceYear(0), null);
  assert.equal(resolveSinceYear('abc'), null);
  assert.equal(formatOwnerCopyright(2025, 2026, 'Demo'), '© 2025 - 2026 By Demo');
  assert.equal(formatOwnerCopyright(2026, 2026, 'Demo'), '© 2026 By Demo');
  assert.equal(formatOwnerCopyright(null, 2026, 'Demo'), '© 2026 By Demo');
  assert.equal(formatOwnerCopyright(2025, 2025, 'Demo'), '© 2025 By Demo');
});

test('custom_text 空不渲染；保留内部空白', () => {
  assert.equal(resolveCustomText(''), '');
  assert.equal(resolveCustomText(null), '');
  assert.equal(resolveCustomText('hello'), 'hello');
  assert.equal(resolveCustomText('a\nb'), 'a\nb');
});

test('模板：owner/copyright 可关；标题 th:text；无 th:utext；保留备案与插件钩子', () => {
  assert.match(footerHtml, /ownerOn = \$\{theme\.config\.footer\?\.owner\?\.enable != false and theme\.config\.footer\?\.owner\?\.enable != 'false'\}/);
  assert.match(footerHtml, /copyOn = \$\{theme\.config\.footer\?\.copyright\?\.enable != false and theme\.config\.footer\?\.copyright\?\.enable != 'false'\}/);
  assert.match(footerHtml, /versionOn = \$\{theme\.config\.footer\?\.copyright\?\.version != false and theme\.config\.footer\?\.copyright\?\.version != 'false'\}/);
  assert.match(footerHtml, /th:if="\$\{ownerOn\}"/);
  assert.match(footerHtml, /th:if="\$\{copyOn\}"/);
  assert.match(footerHtml, /th:if="\$\{versionOn\}"/);
  assert.match(footerHtml, /th:text="\$\{!#strings\.isEmpty\(sinceText\) and sinceText != currentYear\}/);
  assert.match(footerHtml, /th:if="\$\{not #strings\.isEmpty\(theme\.config\.footer\?\.custom_text\)\}"/);
  assert.match(footerHtml, /th:text="\$\{theme\.config\.footer\.custom_text\}"/);
  assert.match(footerHtml, /class="copyright"/);
  assert.match(footerHtml, /framework-info/);
  assert.match(footerHtml, /footer_custom_text/);
  assert.match(footerHtml, /class="icp"/);
  assert.match(footerHtml, /class="police"/);
  assert.match(footerHtml, /<halo:footer\/>/);
  assert.doesNotMatch(footerHtml, /th:utext/);
  assert.match(footerHtml, /class="footer-flex"/);
  assert.match(footerHtml, /not #lists\.isEmpty\(theme\.config\.footer\?\.nav\)/);
  assert.match(footerHtml, /th:text="\$\{item\.title\}"/);
  assert.match(footerHtml, /th:href="\$\{item\.url\}"/);
  assert.doesNotMatch(footerHtml, /© 2020 -/);
});

test('390 不横向溢出：anywhere 折行', () => {
  assert.match(scss, /overflow-wrap:\s*anywhere/);
  assert.match(scss, /word-break:\s*break-word/);
  assert.match(scss, /max-width:\s*100%/);
  assert.match(scss, /flex-wrap:\s*wrap/);
  assert.match(scss, /white-space:\s*pre-wrap/);
});

test('nav 默认空不渲染；title 与 url 都有才输出', () => {
  assert.deepEqual(DEFAULTS.nav, []);
  assert.equal(shouldRenderNav(undefined), false);
  assert.equal(shouldRenderNav([]), false);
  assert.equal(shouldRenderNav([{ title: '', url: '/' }]), false);
  assert.equal(shouldRenderNav([{ title: 'A', url: '' }]), false);
  assert.deepEqual(visibleNavItems([{ title: '友链', url: '/links' }, { title: 'x', url: '' }]).map(i => i.title), ['友链']);
  assert.equal(shouldRenderNav([{ title: '友链', url: '/links' }]), true);
});
