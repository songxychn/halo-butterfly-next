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
  const root={defaultView:win,referrer:'https://referrer.test/',querySelector:()=>subject};
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
