import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {closeNavigationCase} from '../scripts/acceptance/navigation/finalize.mjs';

const successful = () => ({status:'passed', requests:[{state:'finished',status:200}],pageErrors:[],consoleErrors:[]});
test('navigation rejects late request/page/console failures delivered during close', async () => {
  for (const inject of [
    row => row.requests.push({state:'failed',failure:'cancelled'}),
    row => row.requests.push({state:'pending'}),
    row => row.requests.push({state:'finished',httpStatus:503}),
    row => row.pageErrors.push('late exception'),
    row => row.consoleErrors.push('late console error'),
  ]) {
    const row=successful(),closed=[];
    await closeNavigationCase(row,['context','browser'],async target=>{closed.push(target);await Promise.resolve();if(target==='browser')inject(row);});
    assert.equal(row.status,'failed');assert(row.finalValidationError);assert.deepEqual(closed,['context','browser']);
  }
});
test('navigation always closes both targets and preserves existing failures', async () => {
  const row={...successful(),status:'failed',error:'original failure'},closed=[];
  await closeNavigationCase(row,['context','browser'],async target=>{closed.push(target);if(target==='context')throw Error('close failed');});
  assert.equal(row.status,'failed');assert.equal(row.error,'original failure');assert.equal(row.closeErrors.length,1);assert.deepEqual(closed,['context','browser']);
  const clean=successful();await closeNavigationCase(clean,[undefined,'browser'],async()=>{});assert.equal(clean.status,'passed');
});
