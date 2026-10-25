import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {preserveNativeHistoryScroll} from '../src/js/core/native-history-scroll.ts';

function browser(type = 'back_forward', restoration = 'auto') {
  const view = new EventTarget(), calls = [];
  Object.assign(view, {
    performance: {getEntriesByType: () => [{type}]},
    history: {scrollRestoration: restoration}, scrollX: 0, scrollY: 850,
    document: {documentElement: {getBoundingClientRect() {calls.push('layout');}}},
    scrollTo(options) {calls.push(options); this.scrollX = options.left; this.scrollY = options.top;},
  });
  return {view, calls};
}

test('native history retains its restored offset across deferred code layout, once', () => {
  const {view, calls} = browser();
  const enhance = preserveNativeHistoryScroll(view);
  enhance(() => {view.scrollY += 67;});
  assert.equal(view.scrollY, 850);
  assert.deepEqual(calls, ['layout', {left: 0, top: 850, behavior: 'instant'}]);
  enhance(() => {view.scrollY += 20;});
  assert.equal(view.scrollY, 870, 'only the first enhancement is protected');
});

test('normal loads, reloads, PJAX and a not-yet-restored origin keep native behavior', () => {
  for (const [type, restoration, y] of [['navigate','auto',850], ['reload','auto',850], ['back_forward','manual',850], ['back_forward','auto',0]]) {
    const {view, calls} = browser(type, restoration); view.scrollY = y;
    preserveNativeHistoryScroll(view)(() => {view.scrollY += 67;});
    assert.equal(view.scrollY, y + 67); assert.deepEqual(calls, []);
  }
});

test('user intent before enhancement cancels correction without stealing the new reading position', () => {
  for (const event of ['wheel','touchstart','pointerdown','keydown']) {
    const {view, calls} = browser();
    const enhance = preserveNativeHistoryScroll(view);
    view.dispatchEvent(new Event(event)); view.scrollY = 1200;
    enhance(() => {view.scrollY += 67;});
    assert.equal(view.scrollY, 1267); assert.deepEqual(calls, []);
  }
});
