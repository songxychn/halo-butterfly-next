import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  resolveReadmode,
  shouldShowReadmodeButton,
  createExitReadmodeButton,
  enterReadMode,
} from '../src/js/core/rightside.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('readmode defaults and visibility rules', () => {
  assert.equal(defaults.interaction.rightside.readmode, true);
  assert.equal(resolveReadmode(undefined), true);
  assert.equal(resolveReadmode(false), false);
  assert.equal(resolveReadmode('false'), false);
  assert.equal(shouldShowReadmodeButton(true, true), true);
  assert.equal(shouldShowReadmodeButton(false, true), false);
  assert.equal(shouldShowReadmodeButton(true, false), false);
});

test('enterReadMode toggles body.read-mode and creates a safe exit button', () => {
  const names = new Set();
  const kids = [];
  const listeners = [];
  const body = {
    classList: {
      add(name) { names.add(name); },
      remove(name) { names.delete(name); },
    },
    appendChild(el) { kids.push(el); },
  };
  const doc = {
    createElement(tag) {
      const el = {
        tagName: tag,
        type: '',
        className: '',
        title: '',
        innerHTML: 'UNSET',
        remove() { const i = kids.indexOf(el); if (i >= 0) kids.splice(i, 1); },
        addEventListener(type, fn) { listeners.push([type, fn]); },
        removeEventListener() {},
      };
      return el;
    },
  };
  const exitBtn = enterReadMode(body, doc);
  assert.ok(names.has('read-mode'));
  assert.equal(kids.length, 1);
  assert.equal(exitBtn.className, 'fas fa-sign-out-alt exit-readmode');
  assert.equal(exitBtn.innerHTML, 'UNSET');
  assert.equal(createExitReadmodeButton(doc).type, 'button');
  const click = listeners.find(item => item[0] === 'click');
  assert.ok(click);
  click[1]();
  assert.equal(names.has('read-mode'), false);
  assert.equal(kids.length, 0);
});
