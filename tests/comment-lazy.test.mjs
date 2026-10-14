import assert from 'node:assert/strict';
import { afterEach, test } from 'bun:test';
import { commentModuleUrl, initializeLazyComments, requestLazyComments } from '../src/js/core/comment-lazy.ts';
import { beginPage, disposePage } from '../src/js/core/page-lifecycle.ts';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const realWindow = globalThis.window, realObserver = globalThis.IntersectionObserver;
afterEach(() => {
  if (globalThis.window) disposePage();
  globalThis.window = realWindow;
  globalThis.IntersectionObserver = realObserver;
});
function fixture({ kind = 'Post', observer = true, hash = '', lazy = true } = {}) {
  class Node extends EventTarget {
    dataset = {}; attributes = {}; children = []; isConnected = true; hidden = false; textContent = '';
    setAttribute(key, value) { this.attributes[key] = value; }
    append(value) { this.children.push(value); }
    querySelector() { return this.children[0] ?? null; }
  }
  const region = new Node(), target = new Node(), host = new Node(), status = new Node(), retry = new Node();
  target.dataset = { group: 'content.halo.run', kind, name: 'fixture-identity' };
  region.querySelector = () => lazy ? target : null;
  target.querySelector = selector => ({ '[data-comment-host]': host, '[data-comment-status]': status, '[data-comment-retry]': retry })[selector];
  const observations = [];
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; this.disconnected = false; observations.push(this); }
    observe(node) { this.node = node; }
    disconnect() { this.disconnected = true; }
    intersect() { this.callback([{ isIntersecting: true }]); }
  }
  const win = { location: { hash }, setTimeout, clearTimeout, customElements: { get: () => class Widget {} } };
  if (observer) win.IntersectionObserver = Observer;
  globalThis.window = win;
  globalThis.IntersectionObserver = Observer;
  const root = {
    defaultView: win, location: { origin: 'https://blog.test' }, baseURI: 'https://blog.test/archives/fixture/',
    getElementById: () => region, createElement: () => new Node(),
    querySelectorAll: selector => selector === 'lit-toast-container' ? [] : [{ href: 'https://blog.test/plugins/PluginCommentWidget/assets/static/comment-widget.js?version=3.3.2' }],
  };
  return { root, region, target, host, status, retry, observations };
}
test('lazyload is off in new settings and absent old config takes the eager branch', async () => {
  const schema = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
  assert.equal(defaultsFromSettings(schema).comments.lazyload, false);
  for (const file of ['post', 'page']) {
    const html = await readFile(new URL(`../src/html/${file}.html`, import.meta.url), 'utf8');
    assert.match(html, /<div th:unless="\$\{themePjaxEnabled or theme\.config\.comments\?\.lazyload == true or theme\.config\.comments\?\.lazyload == 'true'\}">\s*<halo:comment/);
  }
});
test('outside the margin nothing mounts; intersection mounts the exact subject once', async () => {
  const f = fixture(); let calls = 0;
  initializeLazyComments(f.root, { importModule: async () => { calls++; return { CommentWidget: true }; } });
  assert.equal(f.target.dataset.commentState, 'idle'); assert.equal(calls, 0);
  assert.equal(f.observations[0].options.rootMargin, '300px 0px');
  f.observations[0].intersect(); requestLazyComments(f.root); await tick();
  assert.equal(calls, 1); assert.equal(f.host.children.length, 1);
  assert.equal(f.host.children[0].kind, 'Post'); assert.equal(f.host.children[0].name, 'fixture-identity');
  assert.equal(f.host.children[0].group, 'content.halo.run'); assert.equal(f.host.children[0].version, 'v1alpha1');
  requestLazyComments(f.root); await tick(); assert.equal(calls, 1);
});
test('jump, direct fragment and unavailable IntersectionObserver load immediately, including SinglePage', async () => {
  for (const settings of [{ kind: 'SinglePage' }, { hash: '#post-comment' }, { observer: false }]) {
    const f = fixture(settings); let calls = 0;
    initializeLazyComments(f.root, { importModule: async () => { calls++; return { CommentWidget: true }; } });
    if (!settings.hash && settings.observer !== false) requestLazyComments(f.root);
    assert.equal(calls, 1); await tick();
    assert.equal(f.host.children[0].kind, settings.kind ?? 'Post');
    disposePage();
  }
});
test('failure exposes retry, fresh URL avoids cached module failures and preserves mounted input', async () => {
  const f = fixture(); const urls = [];
  initializeLazyComments(f.root, { importModule: async url => { urls.push(url); if (urls.length === 1) throw Error('offline'); return { CommentWidget: true }; } });
  requestLazyComments(f.root); await tick();
  assert.equal(f.target.dataset.commentState, 'failed'); assert.equal(f.retry.hidden, false);
  f.retry.dispatchEvent(new Event('click')); await tick();
  assert.equal(new URL(urls[1]).searchParams.get('version'), '3.3.2');
  assert.equal(new URL(urls[1]).searchParams.get('theme-comment-retry'), '1');
  const editor = f.host.children[0]; editor.draft = 'unfinished';
  requestLazyComments(f.root); f.observations[0].intersect(); await tick();
  assert.equal(f.host.children.length, 1); assert.equal(editor.draft, 'unfinished');
});
test('timeout and page disposal never mount a late result or duplicate editors on retry', async () => {
  const f = fixture(); let finish;
  initializeLazyComments(f.root, { timeoutMs: 5, importModule: () => new Promise(resolve => { finish = resolve; }) });
  requestLazyComments(f.root); await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(f.target.dataset.commentState, 'failed');
  finish({ CommentWidget: true }); await tick(); assert.equal(f.host.children.length, 0);
  f.retry.dispatchEvent(new Event('click')); disposePage(); finish({ CommentWidget: true }); await tick();
  assert.equal(f.host.children.length, 0); assert.equal(f.observations[0].disconnected, true);
});
test('missing lazy region leaves eager official rendering alone; module URLs must belong to this plugin and origin', () => {
  const f = fixture({ lazy: false }); let calls = 0;
  initializeLazyComments(f.root, { importModule: async () => { calls++; return {}; } });
  requestLazyComments(f.root); assert.equal(calls, 0);
  f.root.querySelectorAll = () => [{ href: 'https://other.test/plugins/PluginCommentWidget/assets/static/comment-widget.js' }, { href: 'https://blog.test/unrelated.js' }];
  assert.throws(() => commentModuleUrl(f.root));
});
test('reinitializing a retained page scope keeps the existing editor and does not import or mount again', async () => {
  const f = fixture(); let calls = 0;
  const options = { importModule: async () => { calls++; return { CommentWidget: true }; } };
  initializeLazyComments(f.root, options); requestLazyComments(f.root); await tick();
  const editor = f.host.children[0]; editor.draft = 'retained';
  beginPage(); initializeLazyComments(f.root, options); requestLazyComments(f.root); await tick();
  assert.equal(calls, 1); assert.equal(f.host.children.length, 1); assert.equal(editor.draft, 'retained');
});

test('Moment lazy mounting accepts only the native moment.halo.run group', async () => {
  const f=fixture({kind:'Moment',hash:'#post-comment'});
  f.target.dataset.group='moment.halo.run';
  initializeLazyComments(f.root,{importModule:async()=>({CommentWidget:true})}); await tick();
  assert.equal(f.host.children[0].group,'moment.halo.run'); assert.equal(f.host.children[0].kind,'Moment');
  disposePage();
  const wrong=fixture({kind:'Moment',hash:'#post-comment'});
  initializeLazyComments(wrong.root,{importModule:async()=>({CommentWidget:true})}); await tick();
  assert.equal(wrong.host.children.length,0); assert.equal(wrong.target.dataset.commentState,'failed');
});

test('PJAX eager mode mounts without waiting for intersection but retains one editor', async () => {
  const f = fixture(); let calls = 0;
  f.target.dataset.commentEager = 'true';
  initializeLazyComments(f.root, { importModule: async () => { calls++; return { CommentWidget: true }; } });
  await tick();
  assert.equal(calls, 1); assert.equal(f.host.children.length, 1); assert.equal(f.observations.length, 0);
  requestLazyComments(f.root); await tick(); assert.equal(calls, 1);
});
