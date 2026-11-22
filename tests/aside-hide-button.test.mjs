import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  ASIDE_STATUS_KEY,
  ASIDE_STATUS_TTL_DAYS,
  resolveAsideHideButton,
  shouldShowHideAsideButton,
  shouldRestoreAsideStatus,
  nextAsideStatus,
  readAsideStatus,
  writeAsideStatus,
  applyAsideStatus,
  restoreAsideStatus,
  onHideAsideButtonClick,
} from '../src/js/core/aside-hide-button.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) { return Object.hasOwn(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
  };
}

test('aside hide_button defaults and explicit false semantics', () => {
  assert.equal(defaults.aside.hide_button, true);
  assert.equal(defaults.aside.hide, false);
  assert.equal(defaults.aside.mobile, true);
  assert.equal(resolveAsideHideButton(undefined), true);
  assert.equal(resolveAsideHideButton(true), true);
  assert.equal(resolveAsideHideButton(false), false);
  assert.equal(resolveAsideHideButton('false'), false);
  assert.equal(shouldShowHideAsideButton(true, false), false);
  assert.equal(shouldShowHideAsideButton(true, true), true);
  assert.equal(shouldShowHideAsideButton(false, true), false);
  assert.equal(shouldRestoreAsideStatus(true, true), true);
  assert.equal(shouldRestoreAsideStatus(true, false), false);
});

test('aside hide button toggles classList even when localStorage throws', () => {
  const classes = new Set();
  const classList = {
    contains(name) { return classes.has(name); },
    toggle(name, force) {
      if (force === undefined) {
        if (classes.has(name)) classes.delete(name); else classes.add(name);
        return;
      }
      if (force) classes.add(name); else classes.delete(name);
    },
  };
  const brokenStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('blocked'); },
  };
  onHideAsideButtonClick(classList, brokenStorage);
  assert.equal(classes.has('hide-aside'), true);
  onHideAsideButtonClick(classList, brokenStorage);
  assert.equal(classes.has('hide-aside'), false);
});

test('aside status persistence respects TTL and expiration', () => {
  assert.equal(ASIDE_STATUS_KEY, 'aside-status');
  assert.equal(ASIDE_STATUS_TTL_DAYS, 2);
  assert.equal(nextAsideStatus(true), 'show');
  assert.equal(nextAsideStatus(false), 'hide');

  const storage = memoryStorage();
  const now = Date.now();
  writeAsideStatus('hide', 2, storage, now);
  const stored = JSON.parse(storage.getItem(ASIDE_STATUS_KEY));
  assert.equal(stored.value, 'hide');
  assert.equal(stored.expiry, now + 2 * 86400000);
  assert.equal(readAsideStatus(storage), 'hide');

  const expired = memoryStorage({ [ASIDE_STATUS_KEY]: JSON.stringify({ value: 'hide', expiry: 1 }) });
  assert.equal(readAsideStatus(expired), undefined);
  assert.equal(expired.getItem(ASIDE_STATUS_KEY), null);

  const classes = new Set();
  const classList = {
    contains(name) { return classes.has(name); },
    toggle(name, force) {
      if (force === undefined) { if (classes.has(name)) classes.delete(name); else classes.add(name); return; }
      if (force) classes.add(name); else classes.delete(name);
    },
  };
  applyAsideStatus(classList, 'hide');
  assert.equal(classes.has('hide-aside'), true);
  applyAsideStatus(classList, 'show');
  assert.equal(classes.has('hide-aside'), false);

  restoreAsideStatus(classList, memoryStorage({ [ASIDE_STATUS_KEY]: JSON.stringify({ value: 'hide' }) }), true, true);
  assert.equal(classes.has('hide-aside'), true);
});
