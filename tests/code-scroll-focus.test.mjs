import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCodeScrollFocus} from '../src/js/core/code-scroll-focus.mjs';

test('keyboard stop follows the actual raw or enhanced scrolling element and preserves author tab order', () => {
  const previous = {ResizeObserver: globalThis.ResizeObserver, getComputedStyle: globalThis.getComputedStyle, document: globalThis.document};
  const observed = [];
  let resize;
  const element = (tabindex) => ({
    clientWidth: 100, clientHeight: 50, scrollWidth: 400, scrollHeight: 50,
    overflowX: 'auto', overflowY: 'visible', tabindex,
    hasAttribute() {return this.tabindex !== undefined;},
    setAttribute(name, value) {this.tabindex = value;},
    removeAttribute() {delete this.tabindex;},
  });
  try {
    globalThis.ResizeObserver = class {constructor(callback) {resize = callback;} observe(node) {observed.push(node);}};
    globalThis.getComputedStyle = node => node;
    globalThis.document = {};
    const pre = element(), code = element(), authored = element('-1');
    code.overflowX = 'visible';
    const refresh = bindCodeScrollFocus({querySelectorAll(selector) {assert.equal(selector, 'pre, pre > code'); return [pre, code, authored];}});
    assert.deepEqual(observed, [pre, code]);
    assert.equal(pre.tabindex, '0', 'raw pre is immediately reachable without Prism');
    assert.equal(code.tabindex, undefined);
    assert.equal(authored.tabindex, '-1');
    pre.overflowX = 'hidden'; code.overflowX = 'auto';
    refresh();
    assert.equal(pre.tabindex, undefined);
    assert.equal(code.tabindex, '0', 'enhancement moves scroll to code without a second observer');
    code.clientWidth = 500; resize();
    assert.equal(code.tabindex, undefined, 'wide/non-overflowing code does not add a tab stop');
    assert.equal(typeof bindCodeScrollFocus(null), 'function');
  } finally {Object.assign(globalThis, previous);}
});
