import test from 'node:test';
import assert from 'node:assert/strict';
import {finalCommentErrors,hasFinalCommentErrors} from '../scripts/acceptance/comments/final-errors.mjs';

test('final comment gate rejects late failures and limits the one injected 503 console allowance',()=>{
  const expected='Failed to load resource: the server responded with a status of 503 (Service Unavailable)';
  const row={requests:[{url:'http://127.0.0.1/apis/api.halo.run/v1alpha1/comments/owned/reply',method:'POST',status:503,state:'finished',expectedInjected503:true}],consoleErrors:[expected]};
  const failed=value=>hasFinalCommentErrors(finalCommentErrors(value));
  assert.equal(failed(row),false);
  assert.equal(failed({...row,consoleErrors:[expected,expected]}),true);
  assert.equal(failed({...row,pageErrors:['late exception']}),true);
  assert.equal(failed({...row,consoleErrors:['unrelated error']}),true);
  assert.equal(failed({...row,requests:[{...row.requests[0],state:'failed'}]}),true);
  assert.equal(failed({...row,requests:[{...row.requests[0],status:500}]}),true);
  assert.equal(failed({...row,requests:[{...row.requests[0],expectedInjected503:false}]}),true);
  assert.equal(failed({...row,closeError:'browser context still open'}),true);
});
