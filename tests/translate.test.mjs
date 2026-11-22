import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  TRANSLATE_STORAGE_KEY,
  resolveTranslateEnable,
  resolveTranslateDefault,
  traditionalized,
  simplified,
  createTranslateState,
  initializeTranslate,
  translatePage,
} from '../src/js/core/translate.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

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

test('translate defaults and resolvers', () => {
  assert.equal(defaults.interaction.translate.enable, false);
  assert.equal(defaults.interaction.translate.default, '繁');
  assert.equal(defaults.interaction.translate.defaultEncoding, 2);
  assert.equal(defaults.interaction.translate.translateDelay, 0);
  assert.equal(defaults.interaction.translate.msgToTraditionalChinese, '繁');
  assert.equal(defaults.interaction.translate.msgToSimplifiedChinese, '簡');
  assert.equal(resolveTranslateEnable(false), false);
  assert.equal(resolveTranslateEnable(true), true);
  assert.equal(resolveTranslateDefault(''), '繁');
  assert.equal(resolveTranslateDefault('简'), '简');
});

test('traditional/simplified conversion toggles textContent and html.lang without touching button children', () => {
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

test('initializeTranslate restores persisted traditional state', () => {
  const payload = textNode('专业');
  const button = element('BUTTON', []);
  button.textContent = '繁';
  const body = element('DIV', [payload]);
  const html = { lang: '' };
  const store = {
    getItem() { return JSON.stringify({ value: 1, expiry: Date.now() + 86400000 }); },
    setItem() {},
    removeItem() {},
  };
  const state = createTranslateState({ button, body, html, storage: store });
  initializeTranslate(state);
  assert.equal(payload.data, '專業');
  assert.equal(button.textContent, '簡');
  assert.equal(html.lang, 'zh-TW');
});
