import test from 'node:test';
import assert from 'node:assert/strict';
import {finalUploadErrors} from '../scripts/acceptance/comments/upload-final-errors.mjs';
const failed=row=>Object.values(finalUploadErrors(row)).some(x=>Array.isArray(x)?x.length>0:!!x);
const request={url:'http://127.0.0.1:18845/apis/api.commentwidget.halo.run/v1alpha1/upload',method:'POST',status:503,state:'finished',expectedInjected503:true};
const message='Failed to load resource: the server responded with a status of 503 (Service Unavailable)';
test('upload failure allowance is restricted to one injected upload response',()=>{
 assert.equal(failed({requests:[request],consoleErrors:[message]}),false);
 for(const change of [{expectedInjected503:false},{status:500},{method:'GET'},{url:'http://127.0.0.1:18845/other'},{state:'failed'}])assert.equal(failed({requests:[{...request,...change}]}),true);
 assert.equal(failed({requests:[request,request]}),true);
 assert.equal(failed({requests:[request],consoleErrors:[message,message]}),true);
});
test('upload report rejects late page, network and browser cleanup failures',()=>{
 for(const extra of [{pageErrors:['late exception']},{consoleErrors:['unrelated error']},{closeError:'context close failed'}])assert.equal(failed({requests:[request],...extra}),true);
 assert.equal(failed({requests:[request,{url:'http://127.0.0.1:18845/image.png',method:'GET',status:200,state:'pending'}]}),true);
});
