import {test} from 'bun:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { observeReloadRequests } from '../scripts/browser/reload-requests.mjs';
import { finishPage } from '../scripts/browser/support.mjs';

function fixture() {
  const page = new EventEmitter(), frame = {}, child = {};
  page.url = () => 'about:blank'; page.mainFrame = () => frame;
  const result = { requestFailures: [], resources: [], failures: [], jsErrors: [], blockedRequests: [] }, pending = [];
  const ledger = observeReloadRequests(page, result);
  const request = ({ type = 'script', method = 'GET', childFrame = false, url = 'http://127.0.0.1:18091/resource' } = {}) => {
    const req = { url: () => url, method: () => method, resourceType: () => type, frame: () => childFrame ? child : frame, isNavigationRequest: () => type === 'document', failure: () => ({ errorText: 'net::ERR_ABORTED' }) };
    page.emit('request', req); return req;
  };
  const response = req => {
    const item = { url: req.url(), status: 200, type: req.resourceType() };
    result.resources.push(item); ledger.response(req, item); return item;
  };
  const finish = (close = async () => {}, timeout = 30) => finishPage(result, pending, close, timeout, ledger);
  return { page, result, pending, ledger, request, response, finish };
}

for (const type of ['document', 'stylesheet', 'script', 'image', 'font', 'media']) test(`unanswered ${type} fails even when close emits no failure`, async () => {
  const f = fixture(), req = f.request({ type }); let closed = false;
  await f.finish(async () => { closed = true; });
  assert(closed); assert.equal(f.result.status, 'failed'); assert.equal(f.result.requestFailures.length, 0);
  assert.deepEqual(f.result.pendingRequestsBeforeClose, [{ requestId: 1, url: req.url(), method: 'GET', type, documentId: type === 'document' ? 1 : 0, mainFrame: true, responseReceived: false }]);
  assert(f.result.failures.some(message => message.includes('before context close')));
});

test('HEAD resources and child-frame requests need completion too', async () => {
  const f = fixture(); f.request({ method: 'HEAD' }); f.request({ childFrame: true });
  await f.finish(); assert.equal(f.result.status, 'failed'); assert.equal(f.result.pendingRequestsBeforeClose.length, 2);
  assert.equal(f.result.pendingRequestsBeforeClose[1].mainFrame, false);
});

test('close-time finished event cannot erase the pre-close pending snapshot', async () => {
  const f = fixture(), req = f.request();
  await f.finish(async () => { f.page.emit('requestfinished', req); });
  assert.equal(f.ledger.pendingRequests().length, 0); assert.equal(f.result.status, 'failed');
  assert.equal(f.result.pendingRequestsBeforeClose.length, 1); assert.equal(f.result.requestFailures.length, 0);
});

test('partial response remains unfinished even if closing releases its body', async () => {
  const f = fixture(), req = f.request(); f.response(req);
  let release; f.pending.push(new Promise(resolve => { release = resolve; }));
  await f.finish(async () => { release(); f.page.emit('requestfinished', req); });
  assert.equal(f.result.status, 'failed'); assert.equal(f.result.pendingRequestsBeforeClose[0].responseReceived, true);
});

test('resource and response body completing inside the settle budget pass', async () => {
  const f = fixture(), req = f.request(); f.response(req);
  f.pending.push(new Promise(resolve => setTimeout(() => { f.ledger.bodyComplete(req); f.page.emit('requestfinished', req); resolve(); }, 5)));
  await f.finish(async () => {}, 1000); assert.equal(f.result.status, 'passed'); assert.deepEqual(f.result.pendingRequestsBeforeClose, []);
});

test('critical request first observed during body drain is included in the closing gate', async () => {
  const f = fixture(), first = f.request(); f.response(first);
  f.pending.push(new Promise(resolve => setTimeout(() => { f.page.emit('requestfinished', first); f.request({ type: 'image' }); resolve(); }, 5)));
  await f.finish(); assert.equal(f.result.status, 'failed');
  assert.equal(f.result.pendingRequestsBeforeClose.length, 1); assert.equal(f.result.pendingRequestsBeforeClose[0].type, 'image');
});

test('later response body tasks are drained instead of using the original Promise.all snapshot', async () => {
  const f = fixture(), first = f.request(); f.response(first); let laterBodyComplete = false;
  f.pending.push(new Promise(resolve => setTimeout(() => {
    f.page.emit('requestfinished', first);
    const second = f.request({ type: 'image' }); f.response(second); f.page.emit('requestfinished', second);
    f.pending.push(new Promise(done => setTimeout(() => { laterBodyComplete = true; done(); }, 5)));
    resolve();
  }, 5)));
  await f.finish(async () => { assert(laterBodyComplete); }, 1000);
  assert.equal(f.result.status, 'passed');
});

test('a completed same-URL request cannot hide another pending Request identity', async () => {
  const f = fixture(), old = f.request(), replacement = f.request();
  f.response(replacement); f.page.emit('requestfinished', replacement);
  await f.finish(); assert.equal(f.result.status, 'failed');
  assert.equal(f.result.pendingRequestsBeforeClose[0].requestId, 1); assert.equal(f.result.pendingRequestsBeforeClose[0].url, old.url());
});

test('redirect target document cannot disappear after an earlier document finishes', async () => {
  const f = fixture(), first = f.request({ type: 'document' }); f.page.emit('requestfinished', first);
  f.request({ type: 'document', url: 'http://127.0.0.1:18091/final' });
  await f.finish(); assert.equal(f.result.status, 'failed');
  assert.equal(f.result.pendingRequestsBeforeClose[0].url, 'http://127.0.0.1:18091/final');
});

test('background fetch/XHR, event streams and allowed visit counter have no new completion requirement', async () => {
  const f = fixture();
  for (const type of ['fetch', 'xhr', 'eventsource', 'websocket']) f.request({ type });
  f.request({ method: 'POST', type: 'fetch', url: 'http://127.0.0.1:18091/apis/api.halo.run/v1alpha1/trackers/counter' });
  await f.finish(); assert.equal(f.result.status, 'passed'); assert.deepEqual(f.result.pendingRequestsBeforeClose, []);
});

test('background request failure and blocked writes still fail', async () => {
  const f = fixture(), req = f.request({ type: 'fetch' }); f.page.emit('requestfailed', req);
  f.result.blockedRequests.push({ method: 'POST', url: '/forbidden' });
  await f.finish(); assert.equal(f.result.status, 'failed'); assert.equal(f.result.requestFailures.length, 1);
});

test('snapshot errors fail closed and still close the context', async () => {
  const f = fixture(); let closed = false;
  f.ledger.pendingRequests = () => { throw new Error('broken ledger'); };
  await f.finish(async () => { closed = true; });
  assert(closed); assert.equal(f.result.status, 'failed'); assert(f.result.failures.some(message => message.includes('broken ledger')));
});
