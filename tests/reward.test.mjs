import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  DEFAULTS,
  resolveClickTo,
  resolveEnable,
  resolveText,
  shouldRender,
  visibleQrItems,
} from '../src/js/core/reward.mjs';

const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
const defaults = defaultsFromSettings(settings);
const components = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const postHtml = await readFile(new URL('../src/html/post.html', import.meta.url), 'utf8');
const pageHtml = await readFile(new URL('../src/html/page.html', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/core/reward.scss', import.meta.url), 'utf8');

function postForm() {
  const form = settings.spec.forms.find(item => item.group === 'post');
  assert.ok(form, 'post');
  return form;
}

function rewardGroup() {
  const group = postForm().formSchema.find(node => node.name === 'reward');
  assert.ok(group, 'post.reward');
  return group;
}

function child(name) {
  const node = rewardGroup().children.find(item => item.name === name);
  assert.ok(node, name);
  return node;
}

function fragment(html, name) {
  const start = html.indexOf(`th:fragment="${name}"`);
  assert.notEqual(start, -1, name);
  return html.slice(start);
}

test('默认对齐上游 SHA：enable false、text 空、QR_code 空', () => {
  assert.equal(defaults.post.reward.enable, false);
  assert.equal(defaults.post.reward.text, '');
  assert.deepEqual(defaults.post.reward.QR_code, []);
  assert.equal(child('enable').value, false);
  assert.deepEqual(child('enable').options.map(option => option.value), [true, false]);
  assert.equal(child('text').value, '');
  assert.deepEqual(child('QR_code').value, []);
  assert.equal(DEFAULTS.enable, false);
  assert.match(String(rewardGroup().help), /reward\.pug/);
  assert.match(String(rewardGroup().help), /不做 footer/);
  assert.match(String(child('enable').help), /reward\.enable/);
  assert.match(String(child('text').help), /th:text/);
});

test('resolveEnable：仅显式 true 开启；空 text 回退打赏', () => {
  assert.equal(resolveEnable(true), true);
  assert.equal(resolveEnable('true'), true);
  assert.equal(resolveEnable(false), false);
  assert.equal(resolveEnable('false'), false);
  assert.equal(resolveEnable(undefined), false);
  assert.equal(resolveText(''), '打赏');
  assert.equal(resolveText(null), '打赏');
  assert.equal(resolveText('Buy me a coffee'), 'Buy me a coffee');
  assert.equal(resolveClickTo({ img: '/a.png', link: '/pay' }), '/pay');
  assert.equal(resolveClickTo({ img: '/a.png', link: '' }), '/a.png');
  assert.deepEqual(visibleQrItems([{ img: '' }, { img: '/a.png' }]).map(item => item.img), ['/a.png']);
  assert.equal(shouldRender(true, [{ img: '/a.png' }]), true);
  assert.equal(shouldRender(true, []), false);
  assert.equal(shouldRender(false, [{ img: '/a.png' }]), false);
});

test('文章页插入 postReward；单页不插入；enable 与空列表由 th:if 约束', () => {
  assert.match(postHtml, /components :: postReward/);
  assert.ok(postHtml.indexOf('copy-right') < postHtml.indexOf('postReward'));
  assert.ok(postHtml.indexOf('postReward') < postHtml.indexOf('postPagination'));
  assert.doesNotMatch(pageHtml, /postReward/);
  const reward = fragment(components, 'postReward');
  assert.match(reward, /reward\?\.enable == true or theme\.config\.post\.reward\?\.enable == 'true'/);
  assert.match(reward, /not #lists\.isEmpty\(theme\.config\.post\.reward\?\.QR_code\)/);
  assert.match(reward, /th:text="\$\{rewardText\}"/);
  assert.match(reward, /th:text="\$\{item\.text\}"/);
  assert.match(reward, /th:alt="\$\{item\.text\}"/);
  assert.doesNotMatch(reward, /th:utext/);
});

test('390 不横向溢出：anywhere 折行、二维码限宽', () => {
  assert.match(scss, /\.post-reward[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(scss, /\.post-reward[\s\S]*max-width:\s*100%/);
  assert.match(scss, /\.post-qr-code-img[\s\S]*max-width:\s*100%/);
  assert.match(scss, /&:hover > \.reward-main/);
});
