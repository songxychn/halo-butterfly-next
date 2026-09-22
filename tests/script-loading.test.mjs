import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {enhanceCodeWhenReady, loadPrismAfterPaint} from '../src/js/core/prism-ready.mjs';

const components = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const layout = await readFile(new URL('../src/html/views/layout.html', import.meta.url), 'utf8');

test('Prism URL is configuration only, with early DOM-ready gate; page bundle remains deferred', () => {
  assert.doesNotMatch(components, /<script[^>]*src="[^"\n]*plugins\/prism\/prism\.min\.js/);
  assert.match(components, /window\.MainApp\.prismSource =/);
  assert.match(components, /window\.MainApp\.codeDomReady = new Promise/);
  assert.match(components, /document\.addEventListener\('DOMContentLoaded', resolve, \{once: true\}\)/);
  const page = layout.match(/<script\b[^>]*th:src="[^"\n]*'js\/'[^"\n]*"[^>]*>/)?.[0];
  assert.match(page, /\sdefer(?:\s|>)/);
  assert.doesNotMatch(page, /\sasync(?:\s|=|>)|type="module"/);
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

test('one manual async request starts only after DOM readiness and two frame opportunities', async () => {
  for (const succeeds of [true, false]) {
    const dom = deferred(), frames = [], scripts = [];
    const document = {
      createElement(tag) {
        assert.equal(tag, 'script');
        return {events: {}, attrs: {}, setAttribute(k, v) {this.attrs[k] = v;}, addEventListener(k, fn) {this.events[k] = fn;}};
      },
      head: {append(script) {scripts.push(script);}},
    };
    const options = {source: '/prism.js', domReady: dom.promise, document, requestFrame: callback => frames.push(callback)};
    const ready = loadPrismAfterPaint(options);
    assert.equal(loadPrismAfterPaint(options), ready, 'same shared promise and no duplicate request');
    await Promise.resolve(); assert.equal(frames.length, 0); assert.equal(scripts.length, 0);
    dom.resolve(); await Promise.resolve();
    assert.equal(frames.length, 1); frames.shift()();
    assert.equal(scripts.length, 0); assert.equal(frames.length, 1);
    frames.shift()(); assert.equal(scripts.length, 1);
    const script = scripts[0];
    assert.equal(script.src, '/prism.js'); assert.equal(script.async, true);
    assert(Object.hasOwn(script.attrs, 'data-manual'));
    script.events[succeeds ? 'load' : 'error']();
    script.events.load(); script.events.error();
    assert.equal(await ready, succeeds, 'native outcome settles only once');
    assert.equal(await loadPrismAfterPaint(options), succeeds); assert.equal(scripts.length, 1);
  }
});

test('empty source and rejected DOM-ready gate keep raw code without requesting a script', async () => {
  for (const options of [{source: '', domReady: Promise.resolve()}, {source: '/prism.js', domReady: Promise.reject(Error('unavailable'))}]) {
    assert.equal(await loadPrismAfterPaint({...options, document: {}, requestFrame: () => {throw Error('Unexpected frame');}}), false);
  }
});
