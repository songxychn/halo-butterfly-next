import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  TRANSLATE_ENABLE_DEFAULT,
  TRANSLATE_DEFAULT_TEXT,
  TRANSLATE_DEFAULT_ENCODING,
  MSG_TO_TRADITIONAL,
  MSG_TO_SIMPLIFIED,
  TRANSLATE_STORAGE_KEY,
  resolveTranslateEnable,
  resolveTranslateDefault,
  traditionalized,
  simplified,
  createTranslateState,
  initializeTranslate,
  translatePage,
} from '../src/js/core/translate.mjs';

const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const settings = parse(settingsText);
const defaults = defaultsFromSettings(settings);
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const commonJs = await readFile(new URL('../src/js/core/common.js', import.meta.url), 'utf8');

function translateForm() {
  const form = settings.spec.forms.find(item => item.group === 'translate');
  assert.ok(form, 'translate');
  return form;
}

function field(name) {
  const node = translateForm().formSchema.find(item => item.name === name);
  assert.ok(node, name);
  return node;
}

function textNode(data) {
  return { nodeType: 3, data, tagName: undefined };
}

function element(tagName, childNodes = [], extra = {}) {
  return {
    nodeType: 1,
    tagName,
    childNodes,
    title: extra.title || '',
    alt: extra.alt || '',
    placeholder: extra.placeholder || '',
    value: extra.value,
    type: extra.type,
  };
}

test('默认对齐上游 SHA：enable false；仅显式 true 开启；default 繁', () => {
  assert.equal(TRANSLATE_ENABLE_DEFAULT, false);
  assert.equal(TRANSLATE_DEFAULT_TEXT, '繁');
  assert.equal(TRANSLATE_DEFAULT_ENCODING, 2);
  assert.equal(MSG_TO_TRADITIONAL, '繁');
  assert.equal(MSG_TO_SIMPLIFIED, '簡');
  assert.equal(defaults.translate.enable, false);
  assert.equal(defaults.translate.default, '繁');
  assert.equal(field('enable').value, false);
  assert.equal(field('default').value, '繁');
  assert.deepEqual(field('enable').options.map(option => option.value), [true, false]);
  assert.equal(typeof defaults.aside.button, 'object');
  assert.equal(resolveTranslateEnable(undefined), false);
  assert.equal(resolveTranslateEnable(null), false);
  assert.equal(resolveTranslateEnable(false), false);
  assert.equal(resolveTranslateEnable('false'), false);
  assert.equal(resolveTranslateEnable(true), true);
  assert.equal(resolveTranslateEnable('true'), true);
  assert.equal(resolveTranslateDefault(undefined), '繁');
  assert.equal(resolveTranslateDefault(''), '繁');
  assert.equal(resolveTranslateDefault('简'), '简');
});

test('YAML help 含 #translateLink 已加引号；仅显式 true 渲染；无新增 th:utext', () => {
  assert.match(settingsText, /help: "对应上游 Butterfly translate.enable/);
  assert.match(String(field('enable').help), /#translateLink/);
  assert.match(componentsHtml, /id="translateLink"/);
  assert.match(componentsHtml, /translateOn/);
  assert.match(componentsHtml, /theme.config.translate\?\.enable == true/);
  assert.match(componentsHtml, /th:text="\$\{theme.config.translate/);
  assert.match(componentsHtml, /hideBtnOn or darkBtnOn or readmodeOn or translateOn/);
  assert.match(commonJs, /bindTranslate/);
  assert.doesNotMatch(componentsHtml, /th:utext/);
  const readIdx = componentsHtml.indexOf('id="readmode"');
  const transIdx = componentsHtml.indexOf('id="translateLink"');
  const hideIdx = componentsHtml.indexOf('id="hide-aside-btn"');
  assert.ok(readIdx > 0 && transIdx > readIdx && transIdx < hideIdx);
});

test('字库：简繁往返；点击改 textContent、lang，不走 innerHTML，不改按钮自身文本节点', () => {
  assert.equal(traditionalized('专业'), '專業');
  assert.equal(simplified('專業'), '专业');
  const payload = textNode('专业');
  const buttonText = textNode('KEEP');
  const button = element('BUTTON', [buttonText]);
  button.id = 'translateLink';
  button.textContent = '繁';
  button.innerHTML = 'UNSET';
  const body = element('DIV', [payload, button]);
  const html = { lang: 'zh-CN' };
  const storage = new Map();
  const store = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); },
  };
  const state = createTranslateState({ button, body, html, storage: store });
  assert.equal(state.currentEncoding, 2);
  assert.equal(state.targetEncoding, 2);
  translatePage(state);
  assert.equal(payload.data, '專業');
  assert.equal(button.textContent, '簡');
  assert.equal(button.innerHTML, 'UNSET');
  assert.equal(buttonText.data, 'KEEP');
  assert.equal(html.lang, 'zh-TW');
  assert.equal(JSON.parse(store.getItem(TRANSLATE_STORAGE_KEY)).value, 1);
  translatePage(state);
  assert.equal(payload.data, '专业');
  assert.equal(button.textContent, '繁');
  assert.equal(html.lang, 'zh-CN');
  assert.equal(JSON.parse(store.getItem(TRANSLATE_STORAGE_KEY)).value, 2);
});

test('初始化：已存目标编码 1 时还原繁体并改按钮文案', () => {
  const payload = textNode('专业');
  const button = element('BUTTON', []);
  button.textContent = '繁';
  const body = element('DIV', [payload]);
  const html = { lang: '' };
  const store = {
    getItem() {
      return JSON.stringify({ value: 1, expiry: Date.now() + 86400000 });
    },
    setItem() {},
    removeItem() {},
  };
  const state = createTranslateState({ button, body, html, storage: store });
  initializeTranslate(state);
  assert.equal(payload.data, '專業');
  assert.equal(button.textContent, '簡');
  assert.equal(html.lang, 'zh-TW');
});
