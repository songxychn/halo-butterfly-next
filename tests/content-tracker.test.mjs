import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { trackContentView } from '../src/js/core/content-tracker.ts';
import { beginPage } from '../src/js/core/page-lifecycle.ts';

test('committed pages report current content identity once, and list pages never count the old post', async () => {
  const previous = globalThis.window, requests = [];
  let consumed = 0;
  const win = {location:new URL('https://blog.test/first/'), screen:{width:1440,height:1000},navigator:{language:'zh-CN'},localStorage:{getItem:()=>null},fetch:async(url,init)=>{requests.push({url,...JSON.parse(init.body)});return {ok:true,arrayBuffer:async()=>{consumed++;return new ArrayBuffer(0);}};}};
  globalThis.window=win;
  let subject={dataset:{group:'content.halo.run',plural:'posts',name:'post-one',endpoint:'/apis/api.halo.run/v1alpha1/trackers/counter'}};
  const root={scripts:[],defaultView:win,referrer:'https://referrer.test/',querySelector:()=>subject};
  try {
    beginPage();trackContentView(root);trackContentView(root);
    assert.equal(requests.length,1);assert.equal(requests[0].name,'post-one');assert.equal(requests[0].referrer,root.referrer);
    win.location=new URL('https://blog.test/archive/');subject=null;
    beginPage();trackContentView(root);assert.equal(requests.length,1);
    win.location=new URL('https://blog.test/about/?a=1');subject={dataset:{group:'content.halo.run',plural:'singlepages',name:'about',endpoint:'/apis/api.halo.run/v1alpha1/trackers/counter'}};
    beginPage();trackContentView(root);
    assert.equal(requests.length,2);assert.equal(requests[1].plural,'singlepages');assert.equal(requests[1].referrer,'https://blog.test/archive/');assert.equal(requests[1].url,'/about/?a=1');
    win.localStorage.getItem=()=> 'true';beginPage();trackContentView(root);assert.equal(requests.length,2);
    win.localStorage.getItem=()=>null;subject.dataset.endpoint='https://other.test/apis/api.halo.run/v1alpha1/trackers/counter';beginPage();trackContentView(root);assert.equal(requests.length,2);
    subject.dataset.endpoint='/apis/api.halo.run/v1alpha1/trackers/counter';subject.dataset.plural='secrets';beginPage();trackContentView(root);assert.equal(requests.length,2);
    await Promise.resolve();
    assert.equal(consumed,2,'Every committed request drains its response once without retry');
  } finally {globalThis.window=previous;}
});

test('older Halo native tracker owns its content count when server opt-out is unavailable', async () => {
  const previous=globalThis.window;let requests=0;
  const win={location:new URL('https://blog.test/post/'),screen:{width:100,height:100},navigator:{language:'en'},localStorage:{getItem:()=>null},fetch:async()=>{requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}}};
  const subject={dataset:{group:'content.halo.run',plural:'posts',name:'post',endpoint:'/apis/api.halo.run/v1alpha1/trackers/counter'}};
  const native={src:'https://blog.test/halo-tracker.js',dataset:{group:'content.halo.run',plural:'posts',name:'post'}};
  const root={scripts:[native],defaultView:win,referrer:'',querySelector:()=>subject};
  globalThis.window=win;
  try {
    beginPage();trackContentView(root);assert.equal(requests,0,'Native processor remains the only owner');
    root.scripts=[];beginPage();trackContentView(root);assert.equal(requests,1,'Modern opt-out still uses theme tracking');
    root.scripts=[{...native,src:'https://unrelated.test/halo-tracker.js'}];beginPage();trackContentView(root);assert.equal(requests,2,'An unrelated remote script is not the native owner');
    await Promise.resolve();
  }finally{globalThis.window=previous;}
});
