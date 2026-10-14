import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {siteLink,siteColor,footerGrow,shuffled,parseFriendGroups,readPublicJson} from '../src/js/core/site-content.ts';
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
test('remote group contract preserves plain text metadata and validates every destination',()=>{
 const raw=[{name:'作者推荐',description:'<b>literal</b>',links:[{name:'站点',url:'https://example.com',logo:'javascript:alert(1)',description:'<script>literal</script>'}]}];
 const result=parseFriendGroups(raw,origin);assert.equal(result[0].description,'<b>literal</b>');assert.equal(result[0].links[0].logo,'');assert.equal(result[0].links[0].description,'<script>literal</script>');
 assert.deepEqual(parseFriendGroups({groups:[]},origin),[]);
 for(const patch of [{name:'x',url:'javascript:alert(1)'},{name:'',url:'/valid'},{name:'x',url:'https://u:p@foo.test'}])assert.throws(()=>parseFriendGroups([{name:'g',links:[patch]}],origin));
 assert.throws(()=>parseFriendGroups(Array.from({length:51},()=>({name:'g',links:[]})),origin));
 assert.throws(()=>parseFriendGroups([{name:'g',links:Array.from({length:501},()=>({name:'x',url:'/x'}))}],origin));
});
test('remote JSON byte limit applies to streamed bodies regardless of headers',async()=>{
 assert.deepEqual(await readPublicJson(Response.json({groups:[]})),{groups:[]});
 await assert.rejects(readPublicJson(new Response('x'.repeat(1024*1024+1))));await assert.rejects(readPublicJson(new Response('bad')));await assert.rejects(readPublicJson(new Response('{}',{status:503})));
});
