import test from 'node:test';
import assert from 'node:assert/strict';
import {paceEnabled, paceAPIReady} from '../src/js/core/pace.ts';

test('Pace is default for absent/unknown mode; only animation or explicit disable opts out', () => {
  for (const loading_mode of [undefined, null, '', 'pace', 'invalid']) assert.equal(paceEnabled({loading_mode}), true);
  assert.equal(paceEnabled({loading_mode: 'animation'}), false);
  for (const loading_enable of [false, 'false']) assert.equal(paceEnabled({loading_enable}), false);
  for (const loading_enable of [true, 'true', undefined, null]) assert.equal(paceEnabled({loading_enable}), true);
});
test('partial custom Pace APIs are rejected before starting or configuring progress', () => {
  const api = {options: {}, start() {}, restart() {}, stop() {}, on() {}};
  assert.equal(paceAPIReady(api), true);
  for (const field of Object.keys(api)) {
    const partial = {...api}; delete partial[field]; assert.equal(paceAPIReady(partial), false);
  }
  for (const options of [null, 'options', false]) assert.equal(paceAPIReady({...api, options}), false);
});
