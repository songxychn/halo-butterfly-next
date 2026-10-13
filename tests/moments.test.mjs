import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { feedUrl, momentDate, formatMomentDate, nativeMomentPage, parseMomentFeed, readMomentFeed } from '../src/js/core/moments.ts';
const origin = 'https://blog.example';
const item = (key, date = '2026-10-14T12:00:00Z') => ({ key, date, author: '作者', content: '内容', tags: ['标签'] });
test('native jump preserves encoded tags and checks route, integer and page bounds', () => {
  assert.equal(nativeMomentPage(origin + '/moments/page/2?tag=%E5%B1%B1%E5%B7%9D', 1, 3), '/moments?tag=%E5%B1%B1%E5%B7%9D');
  assert.equal(nativeMomentPage(origin + '/moments', 3, 3), '/moments/page/3');
  for (const page of [0, 4, NaN, 1.5, Infinity]) assert.equal(nativeMomentPage(origin + '/moments', page, 3), null);
  assert.equal(nativeMomentPage(origin + '/moments/secret', 2, 3), null);
});
test('explicit timezones make day boundaries independent of the browser; invalid zones fall back UTC', () => {
  assert.match(formatMomentDate('2026-10-14T20:00:00Z', 'Asia/Shanghai'), /2026\/10\/15/);
  assert.match(formatMomentDate('2026-10-14T20:00:00Z', 'UTC'), /2026\/10\/14/);
  assert.equal(formatMomentDate('2026-10-14T20:00:00Z', 'bad-zone'), formatMomentDate('2026-10-14T20:00:00Z', 'UTC'));
  assert.equal(momentDate('2026-10-14T20:00:00'), null);
  assert.equal(momentDate('yesterday'), null);
});
test('feed supports explicit portable text/HTML, sorts and date-filters before num limit', () => {
  const items = [item('old', '2025-01-01T00:00:00Z'), {...item('b'), html: '<p>hello</p>'}, item('a'), item('new','2026-10-15T01:00:00+08:00')];
  const result = parseMomentFeed({items}, {origin, limit: 2, since: '2026-01-01T00:00:00Z'});
  assert.deepEqual(result.map(x => x.key), ['new','a']);
  assert.equal(parseMomentFeed(items,{origin})[2].html,true);
  assert.equal(parseMomentFeed([], {origin}).length, 0);
  assert.throws(() => parseMomentFeed(items, {origin, since:'2026-01-01'}));
  assert.throws(() => parseMomentFeed([item('a'),item('a')],{origin}));
  assert.throws(() => parseMomentFeed([item('a','invalid')],{origin}));
  assert.throws(() => parseMomentFeed(Array.from({length:1001},(_,i)=>item(String(i))),{origin}));
});
test('feed URLs reject credentials and insecure external sources; omitted author and avatars are safe', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'https://u:p@blog.example/a', 'http://other.example']) assert.equal(feedUrl(url, origin), null);
  assert.equal(feedUrl('/data/feed.json',origin), origin + '/data/feed.json');
  assert.equal(feedUrl('/feed.json','http://127.0.0.1:18431'),'http://127.0.0.1:18431/feed.json');
  const result=parseMomentFeed([{...item('a'),avatar:'javascript:alert(1)',author:null}],{origin});
  assert.equal(result[0].avatar,''); assert.equal(result[0].author,'访客');
});
test('stream length is bounded even without Content-Length; response and JSON failures propagate', async () => {
  assert.deepEqual(await readMomentFeed(Response.json([item('a')])),[item('a')]);
  await assert.rejects(readMomentFeed(new Response('x'.repeat(1024*1024+1))));
  await assert.rejects(readMomentFeed(new Response('{}',{status:503})));
  await assert.rejects(readMomentFeed(new Response('not-json')));
});
