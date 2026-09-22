import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { observeReloadRequests } from '../scripts/browser/reload-requests.mjs';
import { finishPage } from '../scripts/browser/support.mjs';

function fixture() {
  const main = {}, child = {}, page = new EventEmitter();
  let currentUrl = 'http://127.0.0.1:18091/';
  page.mainFrame = () => main; page.url = () => currentUrl;
  const result = { requestFailures: [], resources: [], failures: [], jsErrors: [], blockedRequests: [] };
  const ledger = observeReloadRequests(page, result);
  const request = (options = {}) => {
    const r = { url: () => options.url || currentUrl + 'module.js', method: () => options.method || 'GET', resourceType: () => options.type || 'script', isNavigationRequest: () => !!options.navigation, frame: () => options.child ? child : main, failure: () => ({ errorText: options.reason || 'NS_BINDING_ABORTED' }), redirectedFrom: () => options.redirect || null };
    page.emit('request', r); return r;
  };
  const navigate = (options = {}) => {
    if (options.url) currentUrl = options.url;
    const r = request({ ...options, url: currentUrl, navigation: true, type: 'document' });
    page.emit('framenavigated', main); page.emit('requestfinished', r);
    return { status: () => options.status || 200, request: () => r, url: () => currentUrl };
  };
  navigate();
  const response = (r, { status = 200, failure, bodyError, pending = false } = {}) => {
    const item = { url: r.url(), status, type: r.resourceType(), ...(failure ? { failure } : {}) };
    result.resources.push(item); ledger.response(r, item);
    if (bodyError) ledger.captureError(r, item, new Error(bodyError));
    else if (!pending) ledger.bodyComplete(r);
    if (!pending) page.emit('requestfinished', r);
    return item;
  };
  const finish = (close = async () => {}, pending = []) => finishPage(result, pending, close, 10, () => ledger.exemptions());
  return { page, ledger, result, request, navigate, response, finish };
}
async function roundtrip(options = {}) {
  const f = fixture(), old = f.request(options.old);
  if (options.priorBodyError) f.response(old, { bodyError: 'Protocol error reading cancelled response', pending: true, failure: options.oldFailure });
  if (options.beforeReload) f.page.emit('requestfailed', old);
  await f.ledger.reload(async () => {
    if (options.oldBodyError && !options.bodyErrorAfterFailure) f.response(old, { bodyError: 'Protocol error reading cancelled response', pending: true, failure: options.oldFailure });
    if (!options.beforeReload && !options.afterCommit) f.page.emit('requestfailed', old);
    if (options.oldBodyError && options.bodyErrorAfterFailure) f.response(old, { bodyError: 'Protocol error reading cancelled response', pending: true, failure: options.oldFailure });
    const navigation = f.navigate(options.navigation);
    if (options.afterCommit) f.page.emit('requestfailed', old);
    if (!options.noReplacement) {
      const replacement = f.request({ url: old.url() });
      f.response(replacement, options.replacement);
      if (options.newAbort) f.page.emit('requestfailed', replacement);
    }
    if (options.timeout) throw new Error('reload timeout');
    return navigation;
  }).catch(error => f.result.failures.push(error.message));
  await f.finish(); return f;
}

test('runner reload records raw failure and old/new identities; replacement completion alone grants exemption', async () => {
  const { result } = await roundtrip();
  assert.equal(result.status, 'passed'); assert.equal(result.requestFailures.length, 1);
  assert.equal(result.requestFailures[0].reason, 'NS_BINDING_ABORTED');
  assert.equal(result.runnerCancellations.length, 1);
  assert.notEqual(result.runnerCancellations[0].requestId, result.runnerCancellations[0].replacementRequestId);
});
test('cancelled response body remains recorded and can use only the same request exemption', async () => {
  const { result } = await roundtrip({ oldBodyError: true });
  assert.equal(result.status, 'passed'); assert.match(result.resources[0].captureError, /cancelled/);
  assert.equal(result.runnerCancellations[0].responseBodyCancelled, true);
});
for (const [name, options] of Object.entries({
  'body error predating reload': { priorBodyError: true },
  'abort outside reload': { beforeReload: true },
  'abort after new document commit': { afterCommit: true },
  'non-abort transport failure': { old: { reason: 'NS_ERROR_NET_RESET' } },
  'child frame': { old: { child: true } },
  'fetch outside proved resource scope': { old: { type: 'fetch' } },
  'write request': { old: { method: 'POST' } },
  'replacement absent': { noReplacement: true },
  'replacement still pending': { replacement: { pending: true } },
  'new same-URL request aborted': { newAbort: true },
  'replacement body failed': { replacement: { bodyError: 'body unavailable' } },
  'replacement HTTP error': { replacement: { status: 500, failure: 'HTTP 500' } },
  'replacement wrong content': { replacement: { failure: 'Unexpected content type' } },
  'replacement package mismatch': { replacement: { failure: 'Package mismatch' } },
  'old HTTP/content failure with cancelled body': { oldBodyError: true, oldFailure: 'Unexpected content type' },
  'reload HTTP500 resolves': { navigation: { status: 500 } },
  'reload redirect': { navigation: { redirect: {} } },
  'reload changes final URL': { navigation: { url: 'http://127.0.0.1:18091/other/' } },
  'reload throws or times out': { timeout: true }
})) test(name + ' remains a failure', async () => {
  const { result } = await roundtrip(options);
  assert.equal(result.status, 'failed'); assert.equal(result.runnerCancellations.length, 0);
  assert.equal(result.requestFailures.length >= 1, true);
});
test('request created during reload was not in the old-document snapshot', async () => {
  const f = fixture();
  await f.ledger.reload(async () => {
    const later = f.request(); f.page.emit('requestfailed', later);
    const navigation = f.navigate(); f.response(f.request()); return navigation;
  });
  await f.finish(); assert.equal(f.result.status, 'failed'); assert.equal(f.result.runnerCancellations.length, 0);
});
test('completed old request is not exempted by a later abort event', async () => {
  const f = fixture(), old = f.request(); f.response(old);
  await f.ledger.reload(async () => { f.page.emit('requestfailed', old); const nav = f.navigate(); f.response(f.request()); return nav; });
  await f.finish(); assert.equal(f.result.status, 'failed');
});
test('context-close abort and forged JSON classification cannot bypass the live ledger', async () => {
  const f = fixture(), old = f.request();
  f.result.runnerCancellations.push({ requestId: 2 });
  await f.finish(async () => { f.page.emit('requestfailed', old); f.result.requestFailures[0].runnerOwnedReloadCancellation = true; });
  assert.equal(f.result.status, 'failed'); assert.equal(f.result.runnerCancellations.length, 0);
});
test('blocked writes and drain timeouts stay failures even with a valid reload cancellation', async () => {
  const f = await roundtrip();
  f.result.blockedRequests.push({ method: 'POST', url: '/forbidden' });
  await f.finish(async () => {}, [new Promise(() => {})]);
  assert.equal(f.result.status, 'failed');
  assert(f.result.failures.some(s => s.includes('Blocked')));
  assert(f.result.failures.some(s => s.includes('exceeded')));
});
test('a same-URL resource begun before replacement document commit cannot prove recovery', async () => {
  const f = fixture(), old = f.request();
  await f.ledger.reload(async () => {
    f.page.emit('requestfailed', old);
    f.request({ navigation: true, type: 'document', url: f.page.url() });
    const preCommit = f.request(); f.response(preCommit);
    return f.navigate();
  });
  await f.finish(); assert.equal(f.result.status, 'failed'); assert.equal(f.result.runnerCancellations.length, 0);
});

test('body rejection after requestfailed remains tied to the same owned reload', async () => {
  const { result } = await roundtrip({ oldBodyError: true, bodyErrorAfterFailure: true });
  assert.equal(result.status, 'passed'); assert.equal(result.runnerCancellations[0].responseBodyCancelled, true);
});

test('a later cancelled-body rejection cannot overwrite an earlier capture error', async () => {
  const f = fixture(), old = f.request();
  const item = f.response(old, { bodyError: 'independent failure before reload', pending: true });
  await f.ledger.reload(async () => {
    f.page.emit('requestfailed', old);
    f.ledger.captureError(old, item, new Error('later cancellation rejection'));
    const nav = f.navigate(); f.response(f.request()); return nav;
  });
  await f.finish(); assert.equal(f.result.status, 'failed');
  assert.deepEqual(item.captureErrors, ['independent failure before reload', 'later cancellation rejection']);
  assert.equal(f.result.runnerCancellations.length, 0);
});
