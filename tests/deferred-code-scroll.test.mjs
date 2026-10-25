import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {preserveDeferredCodeScroll} from '../src/js/core/deferred-code-scroll.ts';

function browser(type = 'back_forward', restoration = 'auto') {
  const view = new EventTarget(), calls = [], frames = [];
  let value = '', priority = '';
  const style = {
    getPropertyValue: () => value, getPropertyPriority: () => priority,
    setProperty(_name, next, importance = '') {value = next; priority = importance;},
    removeProperty() {value = priority = '';},
  };
  Object.assign(view, {
    performance: {getEntriesByType: () => [{type}]},
    navigator: {userAgent: 'Mozilla/5.0 AppleWebKit/605.1.15 Version/26.6 Safari/605.1.15'},
    history: {scrollRestoration: restoration}, scrollX: 0, scrollY: 850,
    document: {documentElement: {style, getBoundingClientRect() {calls.push('layout');}}},
    scrollTo(options) {calls.push(options); this.scrollX = options.left; this.scrollY = options.top;},
    requestAnimationFrame(fn) {frames.push(fn);},
  });
  return {view, calls, style, frames, paint: () => {frames.splice(0).forEach(fn => fn());}};
}

test('WebKit native history keeps its restored offset across one enhancement and releases anchoring after paint', () => {
  const {view, calls, style, paint} = browser();
  const enhance = preserveDeferredCodeScroll(view);
  enhance(() => {assert.equal(style.getPropertyValue('overflow-anchor'), 'none');view.scrollY += 67;});
  assert.equal(view.scrollY, 850);
  assert.deepEqual(calls, ['layout', {left: 0, top: 850, behavior: 'instant'}]);
  paint(); assert.equal(style.getPropertyValue('overflow-anchor'), 'none');
  view.scrollY = 1200;paint();assert.equal(style.getPropertyValue('overflow-anchor'), '');
  assert.equal(view.scrollY, 1200, 'no delayed callback steals subsequent reading position');
  enhance(() => {view.scrollY += 20;}); assert.equal(view.scrollY, 1220);
});

test('normal native loads, reloads and a not-yet-restored origin retain native behavior', () => {
  for (const [type,y] of [['navigate',850], ['reload',850], ['back_forward',0]]) {
    const {view, calls, frames} = browser(type); view.scrollY = y;
    preserveDeferredCodeScroll(view)(() => {view.scrollY += 67;});
    assert.equal(view.scrollY, y + 67); assert.deepEqual(calls, []); assert.deepEqual(frames, []);
  }
});

test('user input before enhancement cancels correction without stealing the new reading position', () => {
  for (const mode of ['auto','manual']) for (const event of ['wheel','touchstart','pointerdown','keydown']) {
    const {view, calls} = browser('back_forward',mode);
    const enhance = preserveDeferredCodeScroll(view);
    view.dispatchEvent(new Event(event)); view.scrollY = 1200;
    enhance(() => {view.scrollY += 67;});
    assert.equal(view.scrollY, 1267); assert.deepEqual(calls, []);
  }
});

test('native engine boundaries retain Blink/Gecko anchors and include iOS WebKit brands', () => {
  for (const [agent, expected] of [
    ['Mozilla/5.0 AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36', 917],
    ['Mozilla/5.0 Gecko/20100101 Firefox/155.0', 917],
    ['Mozilla/5.0 AppleWebKit/605.1.15 CriOS/153.0.0.0 Mobile Safari/604.1', 850],
    ['Mozilla/5.0 AppleWebKit/605.1.15 FxiOS/155.0 Mobile Safari/605.1.15', 850],
  ]) {
    const {view} = browser(); view.navigator.userAgent = agent;
    preserveDeferredCodeScroll(view)(() => {view.scrollY += 67;});
    assert.equal(view.scrollY, expected);
  }
});

test('PJAX manual restoration protects all engines and restores authored inline anchoring priority', () => {
  for (const agent of ['Chrome/153.0.0.0','Firefox/155.0','AppleWebKit/605.1.15']) {
    const {view, style, paint} = browser('navigate','manual');view.navigator.userAgent = agent;
    style.setProperty('overflow-anchor','auto','important');
    preserveDeferredCodeScroll(view)(() => {view.scrollY += 67;});
    assert.equal(view.scrollY,850);paint();paint();
    assert.equal(style.getPropertyValue('overflow-anchor'),'auto');
    assert.equal(style.getPropertyPriority('overflow-anchor'),'important');
  }
});

test('enhancement exceptions release temporary anchoring without masking the error', () => {
  const {view, style, paint} = browser();
  assert.throws(() => preserveDeferredCodeScroll(view)(() => {throw new Error('failed highlighter');}), /failed highlighter/);
  paint();paint(); assert.equal(style.getPropertyValue('overflow-anchor'),'');
});
