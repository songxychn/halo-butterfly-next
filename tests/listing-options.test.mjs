import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {tagCloudSettings, orderTagItems, archiveMenuTitle} from '../src/js/core/listing-options.ts';

test('tag cloud bounds malformed settings and preserves native order by default', () => {
  assert.deepEqual(tagCloudSettings({}),{unit:'px',min:12,max:21,amount:0,orderby:'native',order:1});
  assert.deepEqual(tagCloudSettings({unit:'url(evil)',minFont:500,maxFont:-2,amount:-1,order:9}),{unit:'px',min:21,max:96,amount:0,orderby:'native',order:1});
  const rem=tagCloudSettings({unit:'rem',minFont:2,maxFont:1,amount:2.1});
  assert.equal(rem.min,1);assert.equal(rem.max,2);assert.equal(rem.amount,0);
});
test('cloud sorts complete candidates before limiting; ties use locale names', () => {
  const items=[{name:'z',count:1},{name:'b',count:9},{name:'a',count:9}];
  assert.deepEqual(orderTagItems(items,{amount:2}),items.slice(0,2));
  assert.deepEqual(orderTagItems(items,{orderby:'length',order:-1,amount:2}).map(x=>x.name),['b','a']);
  assert.deepEqual(orderTagItems(items,{orderby:'name',order:1,amount:1}).map(x=>x.name),['a']);
  assert.deepEqual(items.map(x=>x.name),['z','b','a']);
  assert.equal(orderTagItems(items,{orderby:'random'},'en',()=>0).length,3);
});
test('archive menu title ignores external and dated routes, accepts nested flat candidates', () => {
  const links=[{href:'https://other.test/archives',title:'external'},{href:'/archives/2026',title:'year'},{href:'/archives/',title:'All writing'}];
  assert.equal(archiveMenuTitle(links,'https://blog.test/archives'),'All writing');
  assert.equal(archiveMenuTitle([{href:'javascript:alert(1)',title:'x'}],'https://blog.test/archives'),'');
});
