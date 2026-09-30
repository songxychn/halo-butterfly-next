import test from 'node:test';
import assert from 'node:assert/strict';
import { whenContentReady } from '../src/js/core/loading-ready.ts';

test('Loading ends at DOM readiness without waiting for image/plugin window load', () => {
  const doc = new EventTarget();
  doc.readyState = 'loading';
  let calls = 0;
  whenContentReady(() => calls++, doc);
  assert.equal(calls, 0);
  doc.readyState = 'interactive';
  doc.dispatchEvent(new Event('DOMContentLoaded'));
  assert.equal(calls, 1);
  doc.dispatchEvent(new Event('DOMContentLoaded'));
  assert.equal(calls, 1);
});

for (const readyState of ['interactive', 'complete']) {
  test(`Late loading script clears immediately when document is ${readyState}`, () => {
    let calls = 0;
    whenContentReady(() => calls++, { readyState, addEventListener() { assert.fail('missed event listener'); } });
    assert.equal(calls, 1);
  });
}
