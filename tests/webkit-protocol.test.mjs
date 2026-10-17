import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { createAnalyzer } from '../scripts/acceptance/combinations/analyze-webkit-protocol.mjs';

function fixture() {
  const analyzer = createAnalyzer();
  function event(method, params, target = 'target-a', proxy = 'proxy-a') {
    const payload = { method, params };
    const envelope = target ? { pageProxyId: proxy, method: 'Target.dispatchMessageFromTarget',
      params: { targetId: target, message: JSON.stringify(payload) } } : { pageProxyId: proxy, ...payload };
    analyzer.line('2026-10-17T00:00:00Z pw:protocol ◀ RECV ' + JSON.stringify(envelope) + '\u001b[0m +1ms');
  }
  const commit = (loader, target, proxy) => event('Page.frameNavigated', {
    frame: { id: 'frame-a', loaderId: loader, url: 'http://127.0.0.1/same' },
  }, target, proxy);
  const request = (requestId, loaderId, target, proxy, extra = {}) => event('Network.requestWillBeSent', {
    requestId, loaderId, frameId: 'frame-a', documentURL: 'http://127.0.0.1/same',
    request: { url: 'http://127.0.0.1/image.webp' }, type: 'Image', initiator: { type: 'parser' }, ...extra,
  }, target, proxy);
  const fail = (requestId, target, proxy) => event('Network.loadingFailed', { requestId, errorText: 'cancelled', canceled: true }, target, proxy);
  return { analyzer, event, commit, request, fail };
}

test('WebKit same URL with a new loader does not merge document identities', () => {
  const f = fixture();
  f.commit('old'); f.request('old-request', 'old'); f.commit('new'); f.fail('old-request');
  f.request('new-request', 'new'); f.fail('new-request');
  const result = f.analyzer.finish();
  assert.equal(result.documents.length, 2);
  assert.deepEqual(result.failures.map(x => x.documentRelationAtFailure), ['old-document', 'during-current']);
});

test('WebKit request IDs are scoped by page proxy and target, including target swaps', () => {
  const f = fixture();
  f.commit('loader'); f.request('same-id', 'loader');
  f.event('Target.didCommitProvisionalTarget', { oldTargetId: 'target-a', newTargetId: 'target-b' }, null);
  f.commit('loader', 'target-b'); f.request('same-id', 'loader', 'target-b');
  f.commit('loader', 'target-b', 'proxy-b'); f.request('same-id', 'loader', 'target-b', 'proxy-b');
  f.fail('same-id'); f.fail('same-id', 'target-b'); f.fail('same-id', 'target-b', 'proxy-b');
  const result = f.analyzer.finish();
  assert.equal(new Set(result.requests.map(x => x.key)).size, 3);
  assert.deepEqual(result.failures.map(x => x.documentRelationAtFailure), ['old-document', 'during-current', 'during-current']);
});

test('WebKit missing loader or request cannot be inferred from URL or current frame', () => {
  const f = fixture(); f.commit('loader'); f.request('missing-loader', undefined);
  f.fail('missing-loader'); f.fail('missing-request');
  assert.deepEqual(f.analyzer.finish().failures.map(x => x.documentRelationAtFailure), ['unknown', 'unknown']);
});

test('WebKit StyleSheet type and HTTP errors survive whitelist extraction', () => {
  const f = fixture(); f.commit('loader');
  f.request('css', 'loader', undefined, undefined, { type: 'StyleSheet', request: { url: 'http://127.0.0.1/theme.css' } });
  f.event('Network.responseReceived', { requestId: 'css', response: { status: 503, url: 'http://127.0.0.1/theme.css' } });
  const result = f.analyzer.finish();
  assert.equal(result.requests[0].resourceType, 'StyleSheet');
  assert.equal(result.httpErrors[0].status, 503);
  assert.equal(result.imageRequests.length, 0);
});

test('WebKit extraction omits secrets and script text but preserves initiator locations', () => {
  const f = fixture(); f.commit('loader');
  f.request('private', 'loader', undefined, undefined, {
    request: { url: 'http://user:password@127.0.0.1/image.webp?token=QUERY_SECRET#FRAGMENT_SECRET', headers: { Cookie: 'COOKIE_SECRET' } },
    initiator: { type: 'script', nodeId: 42, stackTrace: { callFrames: [{ url: 'http://127.0.0.1/app.js?token=STACK_SECRET', lineNumber: 8, columnNumber: 4, functionName: 'PRIVATE_FUNCTION' }] } },
  });
  f.event('Runtime.evaluate', { expression: 'PRIVATE_SCRIPT_TEXT' });
  const result = f.analyzer.finish(), serialized = JSON.stringify(result);
  for (const value of ['user:password', 'QUERY_SECRET', 'FRAGMENT_SECRET', 'COOKIE_SECRET', 'STACK_SECRET', 'PRIVATE_FUNCTION', 'PRIVATE_SCRIPT_TEXT'])
    assert(!serialized.includes(value));
  assert.equal(result.requests[0].initiator.stackLocations[0].lineNumber, 8);
  assert.equal(result.requests[0].initiator.nodeId, 42);
});

test('WebKit malformed and truncated messages record incomplete evidence', () => {
  const f = fixture();
  f.analyzer.line('pw:protocol ◀ RECV {broken');
  f.analyzer.line('pw:protocol ◀ RECV {<<<<<( LOG TRUNCATED )>>>>>}');
  const result = f.analyzer.finish();
  assert(result.warnings.some(x => x.reason.startsWith('Truncated')));
  assert(result.warnings.some(x => x.reason.startsWith('Malformed')));
  assert.equal(result.result, 'diagnostic-only-no-acceptance-verdict');
});
