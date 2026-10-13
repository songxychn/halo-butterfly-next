import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {commentLimit, commentCacheMinutes, commentExcerpt, commentAvatar, sameOriginCommentHref, publicComment, rankComments, fetchNewestComments, readCommentCache} from '../src/js/core/newest-comments.ts';

const origin = 'https://blog.test';
const subject = {kind: 'Post', name: 'old-post', href: '/archives/old-post/#post-comment', revision: '3:snapshot:true'};
const raw = (id, date, overrides = {}) => ({metadata: {name:id}, spec: {approved:true, hidden:false, creationTime:date, content:'<p>你好 <img src="/image"> <code>secret code</code><a href="javascript:x">link</a></p>', subjectRef: {group:'content.halo.run',kind:'Post',name:'old-post'}, ...overrides}, owner:{displayName:'读者',avatar:'/avatar.svg',email:'must-not-persist@test'}});
const item = (id,date,sub=subject) => publicComment(raw(id,date,{subjectRef:{group:'content.halo.run',kind:sub.kind,name:sub.name}}),sub,origin);
const storage = () => {
  const data = new Map();
  return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};
};

test('setting bounds, same-origin destinations, avatar URL schemes and safe excerpts', () => {
  assert.equal(commentLimit(undefined),6); assert.equal(commentLimit(99),20); assert.equal(commentLimit(-1),1);
  assert.equal(commentCacheMinutes(undefined),10); assert.equal(commentCacheMinutes(0),0); assert.equal(commentCacheMinutes('oops'),10);
  assert.equal(sameOriginCommentHref('/archives/x?from=card#old',origin),'/archives/x?from=card#post-comment');
  for(const url of ['javascript:alert(1)','//other.test/x','https://u:p@blog.test/x']) assert.equal(sameOriginCommentHref(url,origin),null);
  assert.equal(commentAvatar('data:image/svg+xml,x',origin),'');
  assert.equal(commentAvatar('https://u:p@blog.test/x',origin),'');
  assert.equal(commentExcerpt('<script>bad()</script><style>bad</style><p>你好<img src=x><pre><code>large</code></pre><a href=x>link</a></p>'),'你好[图片][代码][链接]');
  assert.equal(Array.from(commentExcerpt('😀'.repeat(200))).length,151);
});

test('only exact, approved, unhidden subjects enter the public projection; no email/IP/raw content retained', () => {
  const comment = item('one','2026-10-10T10:00:00Z');
  assert.equal(comment.excerpt,'你好 [图片] [代码][链接]');
  assert.deepEqual(Object.keys(comment),['id','subject','nickname','excerpt','date','avatar']);
  for(const patch of [{approved:false},{hidden:true},{parentRef:'top-comment'},{subjectRef:{group:'content.halo.run',kind:'SinglePage',name:subject.name}},{creationTime:'bad'}]) assert.equal(publicComment(raw('x','2026-10-10T10:00:00Z',patch),subject,origin),null);
  const deleted=raw('deleted','2026-10-10T10:00:00Z');deleted.metadata.deletionTimestamp='2026-10-10';
  assert.equal(publicComment(deleted,subject,origin),null);
});

test('global top N spans older posts and single pages, ignores incoming priority order and deduplicates', () => {
  const page={...subject,kind:'SinglePage',name:'about'};
  const a=item('a','2026-10-10T10:00:00Z'),b=item('b','2026-10-11T10:00:00Z',page),c=item('c','2020-01-01T00:00:00Z');
  assert.deepEqual(rankComments([c,a,b,b],2).map(x=>x.id),['b','a']);
});

test('public requests omit credentials, explicitly sort by creation time, use exact subjects and cache sanitized fields', async () => {
  const cache=storage(), calls=[];
  const request=async (url,options)=>{calls.push({url,options});return Response.json({items:[raw('new','2026-10-11T10:00:00Z'),raw('pending','2026-10-11T11:00:00Z',{approved:false})]});};
  const options={origin,storage:cache,fetch:request,now:1000000};
  assert.equal((await fetchNewestComments([subject],6,10,options)).length,1);
  assert.equal(calls[0].options.credentials,'omit');
  const url=new URL(calls[0].url);assert.equal(url.searchParams.get('sort'),'spec.creationTime,desc');assert.equal(url.searchParams.get('name'),subject.name);assert.equal(url.searchParams.get('withReplies'),'false');
  assert.ok(![...cache.data.values()].join('').includes('must-not-persist'));
  await fetchNewestComments([subject],6,10,options);assert.equal(calls.length,1);
  await fetchNewestComments([{...subject,revision:'changed'}],6,10,options);assert.equal(calls.length,2);
  await fetchNewestComments([subject],6,10,{...options,now:2000000});assert.equal(calls.length,3);
  await fetchNewestComments([subject],6,0,options);assert.equal(calls.length,4);assert.equal(cache.data.size,0);
});

test('cache never supplies a removed/private subject and denied storage does not stop the public query', async () => {
  const cache=storage();const request=async()=>Response.json({items:[raw('new','2026-10-11T10:00:00Z')]});
  await fetchNewestComments([subject],6,10,{origin,storage:cache,fetch:request,now:1000});
  assert.equal(readCommentCache(cache,[],6,2000,origin).size,0);
  assert.deepEqual(await fetchNewestComments([],6,10,{origin,storage:cache,fetch:request,now:2000}),[]);
  assert.equal(cache.data.values().next().value,'{}');
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');},removeItem(){throw Error('denied');}};
  assert.equal((await fetchNewestComments([subject],6,10,{origin,storage:denied,fetch:request})).length,1);
});

test('a subject failure rejects the whole result rather than claiming a partial list is latest', async () => {
  const page={...subject,kind:'SinglePage',name:'about'};
  await assert.rejects(fetchNewestComments([subject,page],6,0,{origin,fetch:async url=>new URL(url).searchParams.get('kind')==='Post'?Response.json({items:[raw('new','2026-10-11T10:00:00Z')]}):new Response('',{status:503})}));
});

test('Moment comments require their native group and are fetched anonymously alongside content subjects', async () => {
  const moment={kind:'Moment',name:'m1',href:'/moments/m1#post-comment',revision:'1:1'};
  const value=raw('moment-comment','2026-10-14T10:00:00Z',{subjectRef:{group:'moment.halo.run',kind:'Moment',name:'m1'}});
  assert.ok(publicComment(value,moment,origin));
  assert.equal(publicComment({...value,spec:{...value.spec,subjectRef:{group:'content.halo.run',kind:'Moment',name:'m1'}}},moment,origin),null);
  const calls=[];
  const result=await fetchNewestComments([moment],6,0,{origin,fetch:async(url,options)=>{calls.push({url,options});return Response.json({items:[value]});}});
  assert.equal(new URL(calls[0].url).searchParams.get('group'),'moment.halo.run');
  assert.equal(calls[0].options.credentials,'omit'); assert.equal(result[0].subject,'Moment/m1');
});
