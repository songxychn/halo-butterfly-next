import test from 'node:test';
import assert from 'node:assert/strict';
import {paceEnabled, paceAPIReady, NavigationProgress} from '../src/js/core/pace.ts';

test('Pace is default for absent/unknown mode; only animation or explicit disable opts out', () => {
  for (const loading_mode of [undefined, null, '', 'pace', 'invalid']) assert.equal(paceEnabled({loading_mode}), true);
  assert.equal(paceEnabled({loading_mode: 'animation'}), false);
  for (const loading_enable of [false, 'false']) assert.equal(paceEnabled({loading_enable}), false);
  for (const loading_enable of [true, 'true', undefined, null]) assert.equal(paceEnabled({loading_enable}), true);
});
test('current navigation progresses monotonically below completion; stale request cannot clear it', () => {
  const state = new NavigationProgress(), first = new AbortController(), second = new AbortController();
  assert.equal(state.progress, 100);
  const old = state.begin(first.signal); old.advance(55); old.advance(20); assert.equal(state.progress, 55);
  const current = state.begin(second.signal); old.advance(85); assert.equal(old.finish(), false); assert.equal(state.progress, 0);
  current.advance(100); assert.equal(state.progress, 95); assert.equal(current.finish(), true); assert.equal(state.progress, 100);
});
test('aborted requests cannot advance progress; cancellation can settle its own estimate', () => {
  const state = new NavigationProgress(), controller = new AbortController(), job = state.begin(controller.signal);
  job.advance(20); controller.abort(); job.advance(75); assert.equal(state.progress, 20);
  assert.equal(job.finish(), true); assert.equal(state.progress, 100);
});
test('partial custom Pace APIs are rejected before starting or configuring progress', () => {
  const api = {options: {}, start() {}, restart() {}, stop() {}, on() {}};
  assert.equal(paceAPIReady(api), true);
  for (const field of Object.keys(api)) {
    const partial = {...api}; delete partial[field]; assert.equal(paceAPIReady(partial), false);
  }
  for (const options of [null, 'options', false]) assert.equal(paceAPIReady({...api, options}), false);
});
