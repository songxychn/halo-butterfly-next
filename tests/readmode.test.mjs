import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  READMODE_DEFAULT,
  resolveReadmode,
  shouldShowReadmodeButton,
  createExitReadmodeButton,
  enterReadMode,
} from '../src/js/core/rightside.ts';

const settingsText = await readFile(new URL('../settings.yaml', import.meta.url), 'utf8');
const settings = parse(settingsText);
const defaults = defaultsFromSettings(settings);
const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const commonJs = await readFile(new URL('../src/js/core/common.ts', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/core/readmode.scss', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');

function rightsideForm() {
  const form = settings.spec.forms.find(item => item.group === 'rightside');
  assert.ok(form, 'rightside');
  return form;
}

function field(name) {
  const node = rightsideForm().formSchema.find(item => item.name === name);
  assert.ok(node, name);
  return node;
}

test('默认对齐上游 SHA：readmode true；仅显式 false 关闭；仅文章页', () => {
  assert.equal(READMODE_DEFAULT, true);
  assert.equal(defaults.rightside.readmode, true);
  assert.equal(field('readmode').value, true);
  assert.deepEqual(field('readmode').options.map(option => option.value), [true, false]);
  assert.match(String(field('readmode').help), /readmode/);
  assert.match(String(field('readmode').help), /#readmode/);
  assert.equal(typeof defaults.aside.button, 'object');
  assert.equal(resolveReadmode(undefined), true);
  assert.equal(resolveReadmode(null), true);
  assert.equal(resolveReadmode(true), true);
  assert.equal(resolveReadmode('true'), true);
  assert.equal(resolveReadmode(false), false);
  assert.equal(resolveReadmode('false'), false);
  assert.equal(shouldShowReadmodeButton(true, true), true);
  assert.equal(shouldShowReadmodeButton(undefined, true), true);
  assert.equal(shouldShowReadmodeButton(false, true), false);
  assert.equal(shouldShowReadmodeButton(true, false), false);
});

test('YAML help 含 #readmode 已加引号；模板仅 page==post；无新增 th:utext', () => {
  assert.match(settingsText, /help: "对应上游 Butterfly readmode/);
  assert.match(String(field('readmode').help), /#readmode/);
  assert.match(componentsHtml, /id="readmode"/);
  assert.match(componentsHtml, /readmodeOn/);
  assert.match(componentsHtml, /page == 'post'/);
  assert.match(componentsHtml, /hideBtnOn or darkBtnOn or readmodeOn or translateOn/);
  assert.match(commonJs, /bindReadmode/);
  assert.doesNotMatch(componentsHtml, /th:utext/);
});

test('进入阅读模式给 body 加 .read-mode；退出按钮不走 innerHTML', () => {
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

test('样式：body.read-mode 隐藏 chrome；退出按钮固定；窄屏到底部', () => {
  assert.match(indexScss, /readmode/);
  assert.match(scss, /body\.read-mode/);
  assert.match(scss, /#rightside/);
  assert.match(scss, /\.exit-readmode/);
  assert.match(scss, /max-width:\s*768px/);
});
