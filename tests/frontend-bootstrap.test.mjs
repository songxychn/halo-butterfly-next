import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const bootstrap = stripTypeScriptTypes(await readFile(new URL('../src/js/bootstrap.ts', import.meta.url), 'utf8'));
function initialize(conf, saved = {}, blocked = false) {
  const classes = new Set();
  const listeners = new Map();
  const document = {
    documentElement: {dataset: {}, classList: {toggle(name, on) {on ? classes.add(name) : classes.delete(name);}}},
    addEventListener(name, callback) {listeners.set(name, callback);},
  };
  const storage = new Map(Object.entries(saved));
  const window = {MainApp: {conf}, matchMedia: query => ({matches: query.includes('dark')})};
  vm.runInNewContext(bootstrap, {window, document, localStorage: {
    getItem(key) {if (blocked) throw Error('storage blocked'); return storage.get(key);},
    removeItem(key) {storage.delete(key);},
  }});
  return {window, document, classes, listeners, storage};
}

test('startup restores system color and aside state synchronously before DOM readiness', async () => {
  const state = initialize({style_mode: 'auto', darkmode_autoChangeMode: 1, restore_aside: true}, {
    'aside-status': JSON.stringify({value: 'hide', expiry: Date.now() + 60_000}),
  });
  assert.equal(state.document.documentElement.dataset.colorScheme, 'dark');
  assert(state.classes.has('hide-aside'));
  let ready = false;
  state.window.MainApp.codeDomReady.then(() => {ready = true;});
  await Promise.resolve();
  assert.equal(ready, false);
  state.listeners.get('DOMContentLoaded')();
  await state.window.MainApp.codeDomReady;
  assert.equal(ready, true);
});

test('expired aside state is removed and disabled restoration leaves it untouched', () => {
  const saved = {'aside-status': JSON.stringify({value: 'hide', expiry: 1})};
  const expired = initialize({restore_aside: true}, saved);
  assert.equal(expired.storage.has('aside-status'), false);
  assert.equal(expired.classes.has('hide-aside'), false);
  const disabled = initialize({restore_aside: false}, saved);
  assert.equal(disabled.storage.has('aside-status'), true);
});

test('blocked browser storage preserves startup and its DOM readiness signal', () => {
  const state = initialize({style_mode: 'dark', restore_aside: true}, {}, true);
  assert.equal(state.document.documentElement.dataset.colorScheme, 'light');
  assert.equal(typeof state.listeners.get('DOMContentLoaded'), 'function');
});

test('all maintained browser modules are TypeScript', async () => {
  for (const directory of ['src/js', 'src/plugins/loading']) {
    const files = await readdir(new URL('../' + directory + '/', import.meta.url), {recursive: true});
    assert.deepEqual(files.filter(file => /\.(m?js|cjs)$/.test(file)), [], directory);
  }
});
