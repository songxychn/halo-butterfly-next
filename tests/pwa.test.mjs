import assert from 'node:assert/strict';
import test from 'node:test';
import { installWorker, publicNavigation, CACHE_NAME, CACHE_PREFIX } from '../plugins/pwa/src/worker.ts';
import { ownsRegistration, clearOwnedPwa } from '../src/js/core/pwa.ts';

const origin = 'https://blog.example';
const offline = origin + '/butterfly-pwa/offline.html';
function harness() {
  const stores = new Map();
  const handlers = new Map();
  let removed = false;
  const caches = {
    keys: async () => [...stores.keys()], delete: async key => stores.delete(key),
    open: async key => {
      if (!stores.has(key)) stores.set(key, new Map());
      const store = stores.get(key);
      return { put: async (url, response) => store.set(url, response), match: async url => store.get(url)?.clone() };
    },
  };
  const worker = {
    location: { origin }, caches, clients: { claim: async () => {} }, skipWaiting: async () => {},
    registration: { unregister: async () => { removed = true; } },
    addEventListener: (name, callback) => handlers.set(name, callback),
    fetch: async url => typeof url === 'string' && url.endsWith('/status')
      ? Response.json({ owner: 'butterfly-pwa', enabled: true })
      : new Response('<h1>offline</h1>', { headers: { 'Content-Type': 'text/html' } }),
  };
  installWorker(worker);
  async function dispatch(name, request, extra = {}) {
    const waits = []; let response;
    handlers.get(name)({ request, ...extra, waitUntil: promise => waits.push(promise), respondWith: promise => { response = promise; } });
    const value = response ? await response : undefined;
    await Promise.all(waits);
    return value;
  }
  return { worker, caches, stores, dispatch, removed: () => removed };
}
const navigation = path => ({ url: origin + path, method: 'GET', mode: 'navigate' });

test('offline fallback is restricted to same-origin public document navigations', () => {
  for (const path of ['/', '/archives/article/', '/categories/example']) assert(publicNavigation(navigation(path), origin));
  for (const path of ['/console', '/console/', '/uc/profile', '/login', '/apis/content', '/upload/file', '/x?token=secret', '/%63onsole', '/a.pdf', '/butterfly-pwa/status']) {
    assert.equal(publicNavigation(navigation(path), origin), false, path);
  }
  assert.equal(publicNavigation({ ...navigation('/'), url: 'https://external.example/' }, origin), false);
  assert.equal(publicNavigation({ ...navigation('/'), method: 'POST' }, origin), false);
  assert.equal(publicNavigation({ ...navigation('/'), mode: 'cors' }, origin), false);
});

test('install caches exactly one offline page; upgrade preserves unrelated caches', async () => {
  const h = harness();
  await h.caches.open(CACHE_PREFIX + 'old'); await h.caches.open('unrelated');
  await h.dispatch('install'); await h.dispatch('activate');
  assert.deepEqual([...h.stores.keys()].sort(), [CACHE_NAME, 'unrelated'].sort());
  assert.deepEqual([...h.stores.get(CACHE_NAME).keys()], [offline]);
});

test('documents and HTTP failures stay network-only; loss of network returns identifiable 503', async () => {
  const h = harness(); await h.dispatch('install');
  h.worker.fetch = async input => typeof input === 'string'
    ? Response.json({ owner: 'butterfly-pwa', enabled: true }) : new Response('private', { status: 401 });
  assert.equal((await h.dispatch('fetch', navigation('/article/'))).status, 401);
  h.worker.fetch = async () => { throw new Error('offline'); };
  const response = await h.dispatch('fetch', navigation('/article/'));
  assert.equal(response.status, 503); assert.equal(response.headers.get('X-Butterfly-PWA'), 'offline');
  assert.match(await response.text(), /offline/);
  assert.equal(await h.dispatch('fetch', navigation('/login')), undefined);
  assert.equal(h.stores.get(CACHE_NAME).size, 1);
});

test('disabled plugin or absent endpoint retires only owned caches and stops fallback', async () => {
  for (const unavailable of [false, 404, 410]) {
    const h = harness(); await h.dispatch('install'); await h.caches.open('foreign');
    h.worker.fetch = async url => typeof url === 'string'
      ? (unavailable === false ? Response.json({ owner: 'butterfly-pwa', enabled: false }) : new Response('', { status: unavailable }))
      : new Response('fresh');
    assert.equal(await (await h.dispatch('fetch', navigation('/'))).text(), 'fresh');
    assert.equal(h.removed(), true); assert.deepEqual([...h.stores.keys()], ['foreign']);
    assert.equal(await h.dispatch('fetch', navigation('/')), undefined);
  }
});

test('failed install cannot activate an offline cache; transient errors do not revoke installed worker', async () => {
  const h = harness(); h.worker.fetch = async () => new Response('', { status: 500 });
  await assert.rejects(h.dispatch('install'), /enabled/);
  assert.equal(h.stores.size, 0); assert.equal(h.removed(), false);
});

test('reenabling a still-live retired worker restores the offline document and claims clients', async () => {
  const h = harness(); await h.dispatch('install');
  const normalFetch = h.worker.fetch;
  h.worker.fetch = async input => typeof input === 'string'
    ? Response.json({ owner: 'butterfly-pwa', enabled: false }) : new Response('network');
  await h.dispatch('fetch', navigation('/'));
  assert.equal(h.stores.size, 0);
  h.worker.fetch = normalFetch;
  let claimed = false; h.worker.clients.claim = async () => { claimed = true; };
  await h.dispatch('message', undefined, { data: { type: 'butterfly-pwa:resume' }, source: { url: origin + '/' } });
  assert(claimed); assert(h.stores.get(CACHE_NAME).has(offline));
  h.worker.fetch = async () => { throw new Error('offline'); };
  assert.equal((await h.dispatch('fetch', navigation('/'))).status, 503);
});

test('theme cleanup identifies every worker version and never unregisters foreign workers', async () => {
  const own = { scope: origin + '/', active: { scriptURL: origin + '/butterfly-pwa/sw.js' }, unregister: async () => { own.removed = true; } };
  const foreign = { scope: origin + '/', active: { scriptURL: origin + '/other.js' }, unregister: async () => { throw new Error('must not unregister'); } };
  assert(ownsRegistration(own, origin));
  assert.equal(ownsRegistration({ ...own, waiting: foreign.active }, origin), false);
  assert.equal(ownsRegistration({ ...own, scope: origin + '/another/' }, origin), false);
  const h = harness(); await h.caches.open(CACHE_NAME); await h.caches.open('foreign');
  await clearOwnedPwa({ getRegistrations: async () => [own, foreign] }, h.caches, origin);
  assert.equal(own.removed, true); assert.deepEqual([...h.stores.keys()], ['foreign']);
});
