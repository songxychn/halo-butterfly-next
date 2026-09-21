import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const components = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const layout = await readFile(new URL('../src/html/views/layout.html', import.meta.url), 'utf8');

test('Prism and page classic scripts defer together in dependency order', () => {
  const prism = components.match(/<script\b[^>]*th:src="[^"\n]*plugins\/prism\/prism\.min\.js[^"\n]*"[^>]*>/)?.[0];
  const page = layout.match(/<script\b[^>]*th:src="[^"\n]*'js\/'[^"\n]*"[^>]*>/)?.[0];
  for (const tag of [prism, page]) {
    assert(tag, 'Both external scripts must exist');
    assert.match(tag, /\sdefer(?:\s|>)/);
    assert.doesNotMatch(tag, /\sasync(?:\s|=|>)|type="module"/);
  }
  assert(layout.indexOf('th:replace="${pin}"') < layout.indexOf(page));
  assert(layout.indexOf('th:replace="~{views/config}"') < layout.indexOf('th:replace="${pin}"'));
  // Inline configuration stays parser-executed; defer is only for the two external scripts.
  assert.match(components, /<script id="codeBlockScript" th:inline="javascript">/);
});

test('vendored Prism defers automatic highlighting until DCL when its script is deferred', async () => {
  const source = await readFile(new URL('../src/plugins/prism/prism.min.js', import.meta.url), 'utf8');
  // Execute the actual Prism core initialization, excluding optional language/plugin definitions.
  const start = source.indexOf('var _self=');
  const end = source.indexOf('}(_self);', start) + '}(_self);'.length;
  assert(start >= 0 && end > start);
  const callbacks = [], events = [];
  const document = {
    readyState: 'interactive',
    currentScript: {defer: true, src: '/prism.js', hasAttribute: () => false},
    addEventListener: (name, callback) => callbacks.push({name, callback}),
  };
  const scope = {document, window: {document, requestAnimationFrame: () => {throw Error('Must wait for DCL');}}};
  vm.runInNewContext(source.slice(start, end), scope);
  assert.equal(typeof scope.Prism.highlightAllUnder, 'function');
  scope.Prism.highlightAll = () => events.push('automatic-highlight');
  assert.deepEqual(callbacks.map(x => x.name), ['DOMContentLoaded']);
  events.push('page-bundle-can-use-Prism');
  assert.deepEqual(events, ['page-bundle-can-use-Prism']);
  callbacks[0].callback();
  assert.deepEqual(events, ['page-bundle-can-use-Prism', 'automatic-highlight']);
});
