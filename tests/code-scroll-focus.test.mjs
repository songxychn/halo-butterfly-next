import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCodeScrollFocus} from '../src/js/core/code-scroll-focus.ts';

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

test('Prism focus transition preserves reading offsets only for the currently focused code block', async () => {
  const {preserveCodeReadingFocus} = await import('../src/js/core/code-scroll-focus.ts');
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = element => element;
  try {
    for (const initialFocus of ['pre', 'code', 'elsewhere']) {
      const document = {body: {}}, outside = {};
      const make = tag => ({tag, scrollLeft: 0, scrollTop: 0, clientWidth: 100, clientHeight: 50,
        scrollWidth: 500, scrollHeight: 100, overflowX: 'auto', overflowY: 'auto', attrs: {},
        matches(selector) {return selector === 'pre' ? tag === 'pre' : true;},
        hasAttribute(name) {return Object.hasOwn(this.attrs, name);},
        setAttribute(name, value) {this.attrs[name] = value;},
        getAttribute(name) {return this.attrs[name];},
        removeAttribute(name) {delete this.attrs[name];},
        addEventListener(name, handler) {this[name] = handler;},
        focus(options) {assert.deepEqual(options, {preventScroll: true}); document.activeElement = this;},
      });
      const pre = make('pre'), code = make('code');
      pre.querySelector = () => code; code.parentElement = pre;
      const root = {ownerDocument: document, contains: element => [pre, code].includes(element)};
      code.attrs.tabindex = '-1'; // Preserve explicit author semantics, even when restoring programmatic focus.
      pre.scrollLeft = 40; pre.scrollTop = 10;
      document.activeElement = initialFocus === 'elsewhere' ? outside : initialFocus === 'pre' ? pre : code;
      let prepared = 0;
      const restore = preserveCodeReadingFocus(root, readingPre => {
        assert.equal(readingPre, pre);
        prepared++;
        code.clientHeight = 50; // A collapsed block must become visible before focus selection.
      });
      code.clientHeight = 0;
      pre.overflowX = pre.overflowY = 'hidden';
      if (initialFocus !== 'elsewhere') document.activeElement = document.body;
      restore();
      assert.equal(prepared, initialFocus === 'elsewhere' ? 0 : 1);
      if (initialFocus === 'elsewhere') assert.equal(document.activeElement, outside);
      else {
        assert.equal(document.activeElement, code);
        assert.equal(code.scrollLeft, 40); assert.equal(code.scrollTop, 10);
        assert.equal(pre.scrollLeft, 0); assert.equal(pre.scrollTop, 0);
        assert.equal(code.attrs.tabindex, '-1');
      }
      document.activeElement = pre;
      const noSteal = preserveCodeReadingFocus(root);
      document.activeElement = outside; noSteal();
      assert.equal(document.activeElement, outside, 'do not replace a focus change during enhancement');
      document.activeElement = pre;
      delete pre.attrs.tabindex; code.overflowX = code.overflowY = 'visible';
      const noOverflow = preserveCodeReadingFocus(root);
      document.activeElement = document.body; noOverflow();
      assert.equal(document.activeElement, pre); assert.equal(pre.attrs.tabindex, '-1');
      pre.blur(); assert.equal(pre.attrs.tabindex, undefined, 'temporary focus fallback adds no permanent tab stop');
    }
  } finally {globalThis.getComputedStyle = previous;}
});
