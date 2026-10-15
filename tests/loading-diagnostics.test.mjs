import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { loadingDiagnosticPlan, loadingRequestLedger, loadingDiagnosticPassed, boundedDiagnostic, completeLoadingDiagnostic } from '../scripts/browser/loading-diagnostics.mjs';

test('fixed diagnostic plan covers all five route classes in both transport modes without retries', () => {
  const plan = loadingDiagnosticPlan();
  assert.equal(plan.length, 40);
  assert.equal(new Set(plan.map(({ route, width, colorScheme, routed }) => JSON.stringify({ route, width, colorScheme, routed }))).size, 40);
  for (const route of ['/', '/archives/preview-2/', '/about-preview/', '/archives/', '/tags/butterfly/']) assert.equal(plan.filter(row => row.route === route).length, 8);
});

test('same-URL request identities and pre-close pending evidence survive late cleanup events', () => {
  const request = () => ({ url: () => 'http://127.0.0.1:18091/a.js', method: () => 'GET', resourceType: () => 'script' });
  const first = request(), second = request(), ledger = loadingRequestLedger();
  ledger.start(first); ledger.start(second);
  ledger.get(first).status = 200; ledger.finish(first);
  const beforeClose = ledger.snapshot();
  ledger.finish(second, 'NS_BINDING_ABORTED');
  assert.equal(beforeClose[1].state, 'pending');
  assert.equal(ledger.snapshot()[1].state, 'failed');
  assert.equal(loadingDiagnosticPassed(beforeClose, [], undefined), false);
  assert.equal(beforeClose[0].state, 'finished');
  assert.notEqual(beforeClose[0].id, beforeClose[1].id);
});

test('HTTP errors, body capture failures, navigation errors and cleanup errors cannot become passed diagnostics', () => {
  const okay = { state: 'finished', status: 200, type: 'document' };
  assert.equal(loadingDiagnosticPassed([okay], [], undefined), true);
  for (const bad of [{ ...okay, status: 404 }, { ...okay, state: 'pending' }, { ...okay, bodyError: 'closed' }, { ...okay, responseError: 'Asset returned HTML' }]) assert.equal(loadingDiagnosticPassed([bad], [], undefined), false);
  assert.equal(loadingDiagnosticPassed([okay], [], 'navigation timed out'), false);
  assert.equal(loadingDiagnosticPassed([okay], ['cleanup failed'], undefined), false);
});

test('diagnostic refuses remote, mismatched, symlinked and unowned lab processes before browser launch', async () => {
  const { mkdtemp, mkdir, writeFile, symlink, rm } = await import('node:fs/promises');
  const path = await import('node:path');
  const { REPO } = await import('../scripts/browser/support.mjs');
  const { ownedDiagnosticLab } = await import('../scripts/browser/loading-diagnostics.mjs');
  await mkdir(path.join(REPO, '.runtime'), { recursive: true });
  const root = await mkdtemp(path.join(REPO, '.runtime/loading-guard-'));
  try {
    const lab = path.join(root, 'lab');
    await mkdir(lab);
    await writeFile(path.join(lab, 'lab.json'), JSON.stringify({ schema: 1, owner: 'halo-butterfly-next-comparison', ports: { halo: 18815, hexo: 14815 } }));
    await assert.rejects(ownedDiagnosticLab(lab, 'https://example.com'), /explicit http/);
    await assert.rejects(ownedDiagnosticLab(lab, 'http://127.0.0.1:18816'), /ownership marker/);
    const link = path.join(root, 'linked');
    await symlink(lab, link);
    await assert.rejects(ownedDiagnosticLab(link, 'http://127.0.0.1:18815'), /nonsymlink/);
    await writeFile(path.join(lab, 'halo-process.json'), JSON.stringify({ pid: 0, identity: path.join(lab, 'halo/halo.jar') }));
    await assert.rejects(ownedDiagnosticLab(lab, 'http://127.0.0.1:18815'), /Invalid owned Halo process record/);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test('empty resource snapshots and incomplete batches never pass', () => {
  assert.equal(loadingDiagnosticPassed([], [], undefined), false);
  assert.equal(loadingDiagnosticPassed([{ state: 'finished', status: 200, type: 'script' }], [], undefined), false);
  assert.equal(completeLoadingDiagnostic([], true), false);
  assert.equal(completeLoadingDiagnostic(Array.from({ length: 39 }, () => ({ pass: true })), true), false);
  assert.equal(completeLoadingDiagnostic(Array.from({ length: 40 }, () => ({ pass: true })), false), false);
  assert.equal(completeLoadingDiagnostic(Array.from({ length: 40 }, () => ({ pass: true })), true), true);
});

test('hanging cleanup and body capture have an independent deadline and retain pre-close failure', async () => {
  const pending = [{ type: 'document', status: 200, state: 'finished' }, { type: 'script', state: 'pending' }];
  for (const phase of ['context close', 'browser close', 'response body collection']) {
    await assert.rejects(boundedDiagnostic(() => new Promise(() => {}), 5, phase), new RegExp(phase + ' exceeded 5ms'));
  }
  assert.equal(loadingDiagnosticPassed(pending, [], undefined), false);
  assert.equal(await boundedDiagnostic(() => Promise.resolve('closed'), 100, 'browser close'), 'closed');
});
