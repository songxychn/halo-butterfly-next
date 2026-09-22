import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {enhanceCodeWhenReady} from '../src/js/core/prism-ready.mjs';

const components = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const layout = await readFile(new URL('../src/html/views/layout.html', import.meta.url), 'utf8');

test('Prism is manual async with persistent load/error outcome; page bundle remains deferred', () => {
  const prism = components.match(/<script\b[^>]*th:src="[^"\n]*plugins\/prism\/prism\.min\.js[^"\n]*"[^>]*>/)?.[0];
  const page = layout.match(/<script\b[^>]*th:src="[^"\n]*'js\/'[^"\n]*"[^>]*>/)?.[0];
  assert.match(prism, /\sasync\sdata-manual\s/);
  assert.match(prism, /onload="window.MainApp.resolvePrism\(true\)"/);
  assert.match(prism, /onerror="window.MainApp.resolvePrism\(false\)"/);
  assert.match(page, /\sdefer(?:\s|>)/);
  assert.doesNotMatch(page, /\sasync(?:\s|=|>)|type="module"/);
  assert(components.indexOf('window.MainApp.prismReady = new Promise') < components.indexOf(prism));
  assert(layout.indexOf('th:replace="~{views/config}"') < layout.indexOf('th:replace="${pin}"'));
});

test('actual vendored Prism data-manual disables both DCL and late rAF automatic highlighting', async () => {
  const source = await readFile(new URL('../src/plugins/prism/prism.min.js', import.meta.url), 'utf8');
  const start = source.indexOf('var _self=');
  const end = source.indexOf('}(_self);', start) + '}(_self);'.length;
  assert(start >= 0 && end > start);
  for (const readyState of ['loading', 'interactive', 'complete']) {
    const unexpected = () => {throw Error('Automatic highlighting must remain disabled');};
    const document = {readyState, currentScript: {src: '/prism.js', hasAttribute: name => name === 'data-manual'}, addEventListener: unexpected};
    const scope = {document, window: {document, requestAnimationFrame: unexpected, setTimeout: unexpected}};
    vm.runInNewContext(source.slice(start, end), scope);
    assert.equal(scope.Prism.manual, true);
    assert.equal(typeof scope.Prism.highlightAllUnder, 'function');
  }
});

const root = () => ({querySelector: () => ({})});
const prism = {highlightAllUnder() {}};
function deferred() {let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve};}

test('highlighter arriving before or after page initializes enhances once, including duplicate load/initializers', async () => {
  for (const alreadyLoaded of [true, false]) {
    const signal = deferred(), node = root(); let count = 0;
    if (alreadyLoaded) signal.resolve(true);
    const options = {root: node, enabled: true, ready: signal.promise, getPrism: () => prism, enhance: () => count++};
    const first = enhanceCodeWhenReady(options), duplicate = enhanceCodeWhenReady(options);
    assert.equal(count, 0, 'Pending or resolved promise must not block synchronous page work');
    signal.resolve(true); signal.resolve(true);
    assert.equal(await first, true); assert.equal(await duplicate, false); assert.equal(count, 1);
  }
});

test('failure, disabled code and no-code pages never invoke highlighter enhancement', async () => {
  for (const overrides of [
    {ready: Promise.resolve(false)}, {ready: Promise.reject(Error('load failed'))},
    {enabled: false}, {root: {querySelector: () => null}}, {root: null},
    {getPrism: () => undefined},
  ]) {
    const result = await enhanceCodeWhenReady({root: root(), enabled: true, ready: Promise.resolve(true), getPrism: () => prism, enhance: () => {throw Error('Unexpected enhancement');}, ...overrides});
    assert.equal(result, false);
  }
});
