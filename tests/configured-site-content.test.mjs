import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {siteLink,siteColor,footerGrow,shuffled} from '../src/js/core/site-content.ts';
const origin='https://blog.test';
test('configured URLs retain native public/contact links but reject unsafe schemes and credentials',()=>{
 for(const s of ['javascript:alert(1)','data:text/html,hi','https://u:p@blog.test/a','file:///etc/passwd'])assert.equal(siteLink(s,origin),null);
 assert.equal(siteLink('/about',origin),origin+'/about');assert.equal(siteLink('#footer',origin),origin+'/#footer');assert.equal(siteLink('mailto:a@example.com',origin),'mailto:a@example.com');assert.equal(siteLink('mailto:a@example.com',origin,false),null);
 const page='https://blog.test/archives/post/';assert.equal(siteLink('#chapter',page),page+'#chapter');assert.equal(siteLink('image.png',page),page+'image.png');assert.equal(siteLink('../other',page),'https://blog.test/archives/other');
});
test('color inputs cannot escape their CSS property and width weight is bounded',()=>{
 const accepts=()=>true;
 for(const value of ['red;position:fixed','url(https://tracker.test)','var(--secret)','red\n','<style>'])assert.equal(siteColor(value,accepts),'');
 assert.equal(siteColor(' #abc ',accepts),'#abc');assert.equal(siteColor('not-color',()=>false),'');
 assert.equal(footerGrow(2.5),2.5);for(const value of [0,-1,13,Infinity,'1;display:none'])assert.equal(footerGrow(value),1);
});
test('shuffle preserves membership and original source order, including malformed entropy fallback',()=>{
 const items=['a','b','c','d'],copy=[...items];assert.deepEqual([...shuffled(items,()=>0)].sort(),copy);assert.deepEqual(items,copy);assert.notDeepEqual(shuffled(items,()=>0),copy);assert.deepEqual(shuffled([],()=>1),[]);assert.equal(shuffled(items,()=>NaN).length,4);
});
