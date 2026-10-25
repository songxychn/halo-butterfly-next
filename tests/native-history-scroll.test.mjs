import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {preserveNativeHistoryScroll} from '../src/js/core/native-history-scroll.ts';

function browser(type = 'back_forward', restoration = 'auto') {
  const view = new EventTarget(), calls = [];
  Object.assign(view, {
    performance: {getEntriesByType: () => [{type}]},
    navigator: {userAgent: 'Mozilla/5.0 AppleWebKit/605.1.15 Version/26.6 Safari/605.1.15'},
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


test('Blink and Gecko retain their own anchor restoration while iOS WebKit brands are protected', () => {
  for (const [agent, expected] of [
    ['Mozilla/5.0 AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36', 917],
    ['Mozilla/5.0 Gecko/20100101 Firefox/155.0', 917],
    ['Mozilla/5.0 AppleWebKit/605.1.15 CriOS/153.0.0.0 Mobile Safari/604.1', 850],
    ['Mozilla/5.0 AppleWebKit/605.1.15 FxiOS/155.0 Mobile Safari/605.1.15', 850],
  ]) {
    const {view} = browser(); view.navigator.userAgent = agent;
    preserveNativeHistoryScroll(view)(() => {view.scrollY += 67;});
    assert.equal(view.scrollY, expected);
  }
});
