import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {preserveNativeHistoryScroll, saveNativeHistoryScroll} from '../src/js/core/native-history-scroll.ts';

function browser(type = 'back_forward', restoration = 'auto') {
  const view = new EventTarget(), calls = [];
  Object.assign(view, {
    performance: {getEntriesByType: () => [{type}]},
    history: {scrollRestoration: restoration, state: {butterflyNativeScroll: {x: 0, y: 850}}, replaceState(state) {this.state = state;}},
    location: {href: 'https://example.test/article'}, scrollX: 0, scrollY: 850,
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

test('normal loads, reloads and PJAX keep native behavior', () => {
  for (const [type, restoration, y] of [['navigate','auto',850], ['reload','auto',850], ['back_forward','manual',850]]) {
    const {view, calls} = browser(type, restoration); view.scrollY = y;
    preserveNativeHistoryScroll(view)(() => {view.scrollY += 67;});
    assert.equal(view.scrollY, y + 67); assert.deepEqual(calls, []);
  }
});

test('saved departure wins over each engine temporary layout offset; missing/invalid records are ignored', () => {
  for (const initial of [0, 783, 850, 917]) {
    const {view} = browser(); view.scrollY = initial;
    preserveNativeHistoryScroll(view)(() => {view.scrollY += 67;});
    assert.equal(view.scrollY, 850);
  }
  for (const saved of [undefined, {x:0,y:NaN}, {x:0,y:-1}, {x:0,y:'850'}]) {
    const {view,calls} = browser(); view.history.state.butterflyNativeScroll = saved;
    preserveNativeHistoryScroll(view)(() => {view.scrollY += 67;});
    assert.equal(view.scrollY, 917); assert.deepEqual(calls, []);
  }
});

test('departure record retains other history owners and the actual final scroll position', () => {
  const {view} = browser();view.history.state = {otherPlugin: {route: 'a'}};
  view.scrollY = 1250; saveNativeHistoryScroll(view);
  assert.deepEqual(view.history.state, {otherPlugin:{route:'a'},butterflyNativeScroll:{x:0,y:1250}});
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
