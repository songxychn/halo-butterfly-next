/** Offline WebKit protocol attribution. Never launches a browser or changes a verdict. */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {readFile, realpath, stat, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 300 ? value : null;
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const key = (...values) => JSON.stringify(values);
// Never publish headers, query strings, fragments, URL credentials or script bodies.
const url = value => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin + parsed.pathname : null;
  } catch { return null; }
};
const location = value => ({url: url(value?.url), lineNumber: number(value?.lineNumber), columnNumber: number(value?.columnNumber)});
const initiator = value => ({
  type: ['parser', 'script', 'other'].includes(value?.type) ? value.type : null,
  ...location(value), nodeId: number(value?.nodeId),
  stackLocations: Array.isArray(value?.stackTrace?.callFrames) ? value.stackTrace.callFrames.slice(0, 32).map(location) : [],
  stackTruncated: value?.stackTrace?.truncated === true || (value?.stackTrace?.callFrames?.length || 0) > 32,
});

export function createAnalyzer() {
  const report = {
    schema: 1, result: 'diagnostic-only-no-acceptance-verdict', lines: 0,
    protocolEvents: 0, documents: [], requests: [], failures: [], httpErrors: [],
    navigationEvents: [], targetEvents: [], warnings: [],
    limitations: [
      'Only received protocol events are parsed. No browser, API, interception or product modification.',
      'during-current means the loader was current at the failure event; departure can precede the next commit. It is not proof of an in-page defect.',
      'old-document means a known loader was superseded, detached or its target was committed away; it is not a cancellation exemption or a passed result.',
      'Unknown/missing loader, target or frame is never repaired using URL, stage, referer or current page URL.',
      'Image DOM candidates must be joined separately to browser-report beforeNavigation snapshots; URL equality alone is not exact node/document identity or proof of lazy-loading causality.',
      'Raw headers, cookies, tokens, query strings and script text are excluded. Failure text is represented by a digest and a narrow cancellation label.',
    ],
  };
  const current = new Map(), documents = new Map(), activeRequests = new Map(), retiredTargets = new Set();
  let sequence = 0;
  const scopeKey = (proxy, target) => key(proxy, target);
  const frameKey = (proxy, target, frame) => key(proxy, target, frame);
  const docKey = (proxy, target, frame, loader) => key(proxy, target, frame, loader);
  const requestKey = (proxy, target, request) => key(proxy, target, request);
  function warning(reason) { report.warnings.push({line: report.lines, reason}); }
  function classify(request) {
    if (!request || !request.pageProxyId || !request.targetId || !request.frameId || !request.loaderId) return 'unknown';
    const owner = documents.get(docKey(request.pageProxyId, request.targetId, request.frameId, request.loaderId));
    if (!owner) return 'unknown';
    const active = current.get(frameKey(request.pageProxyId, request.targetId, request.frameId));
    if (owner.retiredAtSequence || retiredTargets.has(scopeKey(request.pageProxyId, request.targetId))) return 'old-document';
    return active === owner ? 'during-current' : 'unknown';
  }
  function receive(message, proxy = null, target = null, depth = 0) {
    if (depth > 4 || !message || typeof message !== 'object') { warning('Invalid protocol envelope'); return; }
    proxy = id(message.pageProxyId) || proxy;
    const method = message.method, p = message.params || {};
    if (method === 'Target.dispatchMessageFromTarget') {
      try { receive(JSON.parse(p.message), proxy, id(p.targetId), depth + 1); }
      catch { warning('Malformed target message'); }
      return;
    }
    if (typeof method !== 'string') return; // Responses may contain complete source or HTML: ignore them.
    if (!['Page.frameNavigated', 'Page.frameDetached', 'Page.willCheckNavigationPolicy', 'Page.didCheckNavigationPolicy',
      'Network.requestWillBeSent', 'Network.responseReceived', 'Network.loadingFinished', 'Network.loadingFailed',
      'Target.didCommitProvisionalTarget', 'Target.targetDestroyed', 'Target.targetCreated'].includes(method)) return;
    const seq = ++sequence;
    report.protocolEvents++;
    if (method.startsWith('Target.')) {
      const entry = {sequence: seq, line: report.lines, method, pageProxyId: proxy,
        targetId: id(p.targetId) || id(p.targetInfo?.targetId), oldTargetId: id(p.oldTargetId), newTargetId: id(p.newTargetId)};
      report.targetEvents.push(entry);
      // Destruction alone is not evidence that a new document replaced this one.
      if (proxy && method === 'Target.didCommitProvisionalTarget' && entry.oldTargetId && entry.newTargetId)
        retiredTargets.add(scopeKey(proxy, entry.oldTargetId));
      return;
    }
    const frame = id(p.frameId) || id(p.frame?.id);
    if (method.startsWith('Page.')) {
      const fk = frameKey(proxy, target, frame), previous = current.get(fk);
      report.navigationEvents.push({sequence: seq, line: report.lines, method, pageProxyId: proxy, targetId: target,
        frameId: frame, loaderId: id(p.frame?.loaderId) || previous?.loaderId || null,
        url: url(p.frame?.url), cancel: typeof p.cancel === 'boolean' ? p.cancel : null});
      if (!proxy || !target || !frame) { warning('Page event missing scope'); return; }
      if (method === 'Page.frameDetached') {
        if (previous) previous.retiredAtSequence = seq;
        current.delete(fk);
      }
      if (method === 'Page.frameNavigated') {
        const loader = id(p.frame?.loaderId);
        if (!loader) { warning('Document commit missing loaderId'); current.delete(fk); return; }
        if (previous && previous.loaderId !== loader) previous.retiredAtSequence = seq;
        const dk = docKey(proxy, target, frame, loader);
        let doc = documents.get(dk);
        if (!doc) {
          doc = {key: dk, pageProxyId: proxy, targetId: target, frameId: frame, loaderId: loader,
            url: url(p.frame.url), parentFrameId: id(p.frame.parentId), committedAtSequence: seq};
          documents.set(dk, doc); report.documents.push(doc);
        }
        current.set(fk, doc);
      }
      return;
    }
    const requestId = id(p.requestId), rk = requestKey(proxy, target, requestId);
    let request = proxy && target && requestId ? activeRequests.get(rk) : null;
    if (method === 'Network.requestWillBeSent') {
      if (request && !p.redirectResponse) warning('Duplicate scoped requestId without redirect');
      if (request && p.redirectResponse) {
        request.state = 'redirected'; request.httpStatus = number(p.redirectResponse.status);
        if (request.httpStatus >= 400) report.httpErrors.push({requestKey: request.key, sequence: seq, status: request.httpStatus, url: request.url});
      }
      request = {key: key(proxy, target, requestId, seq), pageProxyId: proxy, targetId: target, requestId,
        frameId: frame, loaderId: id(p.loaderId), documentURL: url(p.documentURL), url: url(p.request?.url),
        resourceType: ['Document', 'Image', 'StyleSheet', 'Script', 'Font', 'XHR', 'Fetch', 'Other', 'Ping', 'WebSocket', 'Media', 'Manifest'].includes(p.type) ? p.type : null,
        startedAtSequence: seq, timestamp: number(p.timestamp), walltime: number(p.walltime),
        initiator: initiator(p.initiator), state: 'pending', httpStatus: null};
      report.requests.push(request);
      if (proxy && target && requestId) activeRequests.set(rk, request);
      else warning('Request event missing scope; attribution unavailable');
    } else if (method === 'Network.responseReceived') {
      const status = number(p.response?.status);
      if (request) { request.httpStatus = status; request.responseAtSequence = seq; }
      if (status >= 400) report.httpErrors.push({requestKey: request?.key || null, pageProxyId: proxy, targetId: target, requestId,
        sequence: seq, status, url: url(p.response?.url) || request?.url || null});
    } else if (method === 'Network.loadingFinished') {
      if (request) { request.state = 'finished'; request.finishedAtSequence = seq; request.finishedTimestamp = number(p.timestamp); }
    } else if (method === 'Network.loadingFailed') {
      const failure = {sequence: seq, line: report.lines, pageProxyId: proxy, targetId: target, requestId,
        requestKey: request?.key || null, url: request?.url || null, frameId: request?.frameId || null,
        loaderId: request?.loaderId || null, timestamp: number(p.timestamp),
        canceled: typeof p.canceled === 'boolean' ? p.canceled : null,
        errorCategory: /cancel(?:led|ed)/i.test(p.errorText || '') ? 'cancelled' : 'other-failure',
        errorTextSha256: typeof p.errorText === 'string' ? hash(p.errorText) : null,
        documentRelationAtFailure: classify(request)};
      report.failures.push(failure);
      if (request) { request.state = 'failed'; request.failedAtSequence = seq; }
    }
  }
  return {
    line(text) {
      report.lines++;
      if (text.includes('<<<<<( LOG TRUNCATED )>>>>>')) warning('Truncated protocol line; evidence incomplete');
      const marker = text.indexOf('◀ RECV ');
      if (marker < 0) return;
      try { receive(JSON.parse(text.slice(marker + '◀ RECV '.length).replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+\+\d+(?:\.\d+)?(?:ms|s|m|h)\s*$/, ''))); }
      catch { warning('Malformed received protocol JSON'); }
    },
    finish() {
      report.imageRequests = report.requests.filter(r => r.resourceType === 'Image').map(r => ({requestKey: r.key,
        documentKey: r.pageProxyId && r.targetId && r.frameId && r.loaderId ? docKey(r.pageProxyId, r.targetId, r.frameId, r.loaderId) : null,
        documentObserved: documents.has(docKey(r.pageProxyId, r.targetId, r.frameId, r.loaderId)),
        documentURL: r.documentURL, url: r.url, initiatorNodeId: r.initiator.nodeId,
        domMapping: 'not-observed-here; compare-beforeNavigation-images-without-assuming-unique-URL'}));
      report.coverage = {receivedEvents: report.protocolEvents, documents: report.documents.length,
        requests: report.requests.length, failures: report.failures.length, httpErrors: report.httpErrors.length,
        unknownFailureAttributions: report.failures.filter(f => f.documentRelationAtFailure === 'unknown').length,
        warnings: report.warnings.length};
      return report;
    },
  };
}

async function main() {
  assert.equal(process.argv.length, 4, 'Usage: bun analyze-webkit-protocol.mjs <private-protocol.log> <new-report.json>');
  const runtime = await realpath(path.join(REPO, '.runtime'));
  const input = await realpath(process.argv[2]), output = path.resolve(process.argv[3]);
  const inside = p => p.startsWith(runtime + path.sep);
  assert(inside(input), 'Input must be in this worktree runtime');
  assert.equal(input, path.resolve(process.argv[2]), 'Symlink input path forbidden');
  const parent = await realpath(path.dirname(output));
  assert(inside(parent) || parent === runtime, 'Output must be in this worktree runtime');
  assert.equal(parent, path.dirname(output), 'Symlink output parent forbidden');
  const info = await stat(input);
  assert(info.isFile() && (info.mode & 0o777) === 0o600, 'Raw protocol log must be a regular mode-0600 file');
  assert(info.size <= 256 * 1024 * 1024, 'Fixed 256 MiB offline input limit exceeded');
  const analyzer = createAnalyzer(), digest = createHash('sha256');
  const stream = createReadStream(input);
  stream.on('data', chunk => digest.update(chunk));
  for await (const line of createInterface({input: stream, crlfDelay: Infinity})) analyzer.line(line);
  const report = analyzer.finish();
  report.input = {path: path.relative(REPO, input), sha256: digest.digest('hex'), bytes: info.size};
  report.parserSha256 = hash(await readFile(fileURLToPath(import.meta.url)));
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  console.log(JSON.stringify({output: path.relative(REPO, output), coverage: report.coverage, result: report.result}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
