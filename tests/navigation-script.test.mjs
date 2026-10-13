import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {executeNavigationScript} from '../src/js/core/navigation-loading.ts';

function fixture() {
  const nodes = [];
  const script = () => ({attributes: [], dataset: {}, textContent: '', src: '', setAttribute() {}, removeAttribute() {}, remove() {this.removed = true;}});
  return {nodes, document: {createElement: script}, parent: {append(node) {nodes.push(node);}}, source: {...script(), src: 'https://cdn.test/entry.js', attributes: [{name: 'src', value: 'https://cdn.test/entry.js'}], dataset: {localResource: '/entry.js'}}};
}

async function withFixture(run) {
  const oldDocument = globalThis.document, oldLocation = globalThis.location;
  const f = fixture();
  f.document.createElement = () => {
    const node = {src: '', textContent: '', setAttribute(name, value) {if (name === 'src') this.src = value;}, removeAttribute() {}, remove() {this.removed = true;}};
    return node;
  };
  globalThis.document = f.document; globalThis.location = {href: 'https://site.test/'};
  try {await run(f);} finally {globalThis.document = oldDocument; globalThis.location = oldLocation;}
}

test('cancelled navigation cannot append a fallback when an old native error arrives', () => withFixture(async f => {
  const controller = new AbortController();
  const pending = executeNavigationScript(f.source, f.parent, controller.signal);
  const lateError = f.nodes[0].onerror;
  controller.abort(); await assert.rejects(pending, /cancelled/);
  assert.equal(f.nodes[0].onerror, null); assert.equal(f.nodes[0].onload, null);
  lateError(); assert.equal(f.nodes.length, 1);
}));

test('timed-out navigation cannot append a fallback after a delayed native error', () => withFixture(async f => {
  const pending = executeNavigationScript(f.source, f.parent, new AbortController().signal);
  const lateError = f.nodes[0].onerror;
  await assert.rejects(pending, /timed out/);
  assert.equal(f.nodes[0].onerror, null); assert.equal(f.nodes[0].removed, true);
  lateError(); assert.equal(f.nodes.length, 1);
}));

test('a current native error retries locally once and completed work ignores old errors', () => withFixture(async f => {
  const pending = executeNavigationScript(f.source, f.parent, new AbortController().signal);
  const lateError = f.nodes[0].onerror;
  lateError(); assert.equal(f.nodes.length, 2); assert.equal(f.nodes[1].src, '/entry.js');
  lateError(); assert.equal(f.nodes.length, 2);
  f.nodes[1].onload(); await pending;
  lateError(); assert.equal(f.nodes.length, 2); assert.equal(f.nodes[1].onerror, null);
}));
