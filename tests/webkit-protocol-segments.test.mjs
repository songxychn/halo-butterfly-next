import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractWebKitProtocol } from '../scripts/acceptance/combinations/extract-webkit-protocol.mjs';

function fixture(change = markers => markers) {
  let clock = 0;
  const markers = [];
  const push = (event, engine, extra = {}) => markers.push({ schema: 1, runId: 'a'.repeat(20), event, engine,
    at: '2026-10-17T00:00:00Z', monotonicNs: String(++clock), ...extra });
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    push('engine-start', engine);
    for (const color of ['light', 'dark']) {
      const details = { color, caseId: engine + '-' + color };
      push('case-start', engine, details);
      push('navigation-intent', engine, { ...details, kind: 'initial-goto' });
      push('context-close-start', engine, details);
      push('context-close-end', engine, { ...details, outcome: 'closed' });
      push('case-end', engine, details);
    }
    push('engine-end', engine, { outcome: 'closed' });
  }
  const lines = ['unrelated launch output 中文\n'];
  for (const marker of change(markers)) {
    lines.push('HBN_COMBINATION_PROTOCOL ' + JSON.stringify(marker) + '\n');
    if (marker.event === 'case-start') lines.push('pw:protocol ◀ RECV ' + marker.engine + ' raw UTF-8 字节\n');
  }
  return Buffer.from(lines.join(''));
}

test('mixed-engine log extraction preserves exact WebKit bytes and both case close windows', () => {
  const source = Buffer.from(fixture().toString().replaceAll('\n', '\r\n')), original = Buffer.from(source);
  const { report, slice } = extractWebKitProtocol(source);
  assert.equal(report.result, 'complete-six-case-capture-webkit-sliced');
  assert.deepEqual(source, original);
  assert.deepEqual(slice, source.subarray(report.slice.startByte, report.slice.endByteExclusive));
  assert.equal(createHash('sha256').update(slice).digest('hex'), report.slice.sha256);
  assert(!slice.toString().includes('chromium'));
  assert(!slice.toString().includes('firefox'));
  assert(slice.toString().includes('webkit raw UTF-8 字节'));
  assert.deepEqual(report.cases.filter(c => c.engine === 'webkit').map(c => c.color), ['light', 'dark']);
  assert(report.cases.every(c => c.closeStart && c.closeEnd.outcome === 'closed'));
});

test('missing case end or failed close cannot yield a complete protocol slice', () => {
  for (const change of [
    markers => markers.filter(m => !(m.event === 'case-end' && m.caseId === 'webkit-dark')),
    markers => markers.map(m => m.event === 'context-close-end' && m.caseId === 'webkit-light' ? { ...m, outcome: 'failed' } : m),
    markers => markers.filter(m => !(m.event === 'context-close-start' && m.caseId === 'firefox-light')),
    markers => markers.slice(0, -1),
  ]) {
    const result = extractWebKitProtocol(fixture(change));
    assert.equal(result.slice, null);
    assert.equal(result.report.result, 'incomplete-capture');
    assert(result.report.errors.length > 0);
  }
});

test('overlap, wrong run/case order and reversed clocks are rejected instead of guessed', () => {
  for (const change of [
    markers => [markers[0], markers[0], ...markers.slice(1)],
    markers => markers.map((m, i) => i === 2 ? { ...m, runId: 'b'.repeat(20) } : m),
    markers => markers.map((m, i) => i === 2 ? { ...m, engine: 'firefox' } : m),
    markers => markers.map(m => m.event === 'case-start' && m.caseId === 'webkit-light' ? { ...m, color: 'dark', caseId: 'webkit-dark' } : m),
    markers => markers.map((m, i) => i === 3 ? { ...m, monotonicNs: '0' } : m),
  ]) assert.equal(extractWebKitProtocol(fixture(change)).slice, null);
});

test('unknown lifecycle marker is retained as an explicit incomplete-capture error', () => {
  const result = extractWebKitProtocol(fixture(markers => markers.map((m, i) => i === 2 ? { ...m, event: 'unknown-event' } : m)));
  assert.equal(result.slice, null);
  assert.match(result.report.errors[0].message, /Unknown lifecycle marker/);
});
