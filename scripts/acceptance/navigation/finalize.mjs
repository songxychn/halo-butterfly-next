import assert from 'node:assert/strict';

export function assertCleanNavigation(row) {
  assert.deepEqual(row.pageErrors || [], [], 'Page errors observed');
  assert.deepEqual(row.consoleErrors || [], [], 'Console errors observed');
  assert.deepEqual(row.requests.filter(r => r.state !== 'finished' || (r.httpStatus ?? r.status) >= 400), [], 'Unfinished or failed navigation requests');
}

// Listeners remain live during close. A failure delivered by teardown must not
// leave a previously completed case marked passed. Always try both closes.
export async function closeNavigationCase(row, targets, close) {
  for (const target of targets) if (target) {
    try { await close(target); }
    catch (error) {
      row.status = 'failed';
      (row.closeErrors ??= []).push(String(error));
    }
  }
  try { assertCleanNavigation(row); }
  catch (error) {
    row.status = 'failed';
    row.finalValidationError = String(error);
  }
}
