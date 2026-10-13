import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { galleryImages, galleryUrl, galleryOptions, fetchGallery, MAX_GALLERY_BYTES } from '../src/js/core/gallery-data.ts';
import { convertGallery } from '../scripts/gallery/convert.mjs';

const base = 'https://example.test/posts/one/';
test('gallery JSON preserves text, relative URLs and order without accepting executable/credential URLs', () => {
  assert.deepEqual(galleryImages([{url:'../a.jpg',alt:'<img onerror=alert(1)>',title:'中文 "标题"'}, {url:'/b.jpg'}], base), [
    {url:'https://example.test/posts/a.jpg',alt:'<img onerror=alert(1)>',title:'中文 "标题"'},
    {url:'https://example.test/b.jpg',alt:'',title:''},
  ]);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'https://u:p@example.test/a', 'http://example.test/a', 'https://x.test/\na', '/\\evil.test/a']) {
    assert.equal(galleryUrl(url,base),''); assert.throws(()=>galleryImages([{url}],base));
  }
  assert.throws(()=>galleryImages({},base));assert.throws(()=>galleryImages([null],base));
  assert.throws(()=>galleryImages(Array(5001).fill({url:'/a.jpg'}),base));
  assert.deepEqual(galleryImages([],base),[]);
});
test('batch counts have defaults, floor and upper bound', () => {
  assert.deepEqual(galleryOptions({dataset:{}}),{button:false,limit:10,first:10});
  assert.deepEqual(galleryOptions({dataset:{button:'true',limit:'3',first:'2'}}),{button:true,limit:3,first:2});
  assert.deepEqual(galleryOptions({dataset:{button:'false',limit:'0',first:'-3'}}),{button:false,limit:10,first:10});
  assert.deepEqual(galleryOptions({dataset:{limit:'1.9',first:'999999'}}),{button:false,limit:1,first:200});
});
test('remote JSON uses credential-free requests and Butterfly article-relative paths', async () => {
  let observed;
  const value = await fetchGallery('/data/gallery.json',base,new AbortController().signal,async (url,options)=>{
    observed={url,options};return new Response('[{"url":"photo.jpg","alt":"A"}]');
  });
  assert.equal(observed.url,'https://example.test/data/gallery.json');
  assert.equal(observed.options.credentials,'omit');assert.equal(observed.options.referrerPolicy,'no-referrer');
  assert.equal(value[0].url,'https://example.test/posts/one/photo.jpg');
});
test('remote HTTP, invalid JSON and oversized chunked bodies fail, cancelling the stream', async () => {
  const request = response=>async()=>response;
  await assert.rejects(fetchGallery('/data.json',base,new AbortController().signal,request(new Response('x',{status:500}))));
  await assert.rejects(fetchGallery('/data.json',base,new AbortController().signal,request(new Response('not-json'))));
  let cancelled=false;
  const stream = new ReadableStream({pull(c){c.enqueue(new Uint8Array(MAX_GALLERY_BYTES+1));},cancel(){cancelled=true;}});
  await assert.rejects(fetchGallery('/data.json',base,new AbortController().signal,request(new Response(stream))),/过大/);
  assert.equal(cancelled,true);
});
test('gallery-only conversion preserves surrounding Markdown and unrelated tags, escapes data', () => {
  const input = '# Title\n{% gallery true,2,1 %}\n![A <tag>](/a.jpg "Title")\n![B](/b.jpg)\n{% endgallery %}\n{% note %}untouched{% endnote %}';
  const html = convertGallery(input);
  assert.match(html,/^# Title/);assert.match(html,/data-type="data" data-button="true" data-limit="2" data-first="1"/);
  assert.match(html,/A &lt;tag&gt;/);assert.match(html,/&quot;title&quot;:&quot;Title&quot;/);
  assert.match(html,/{% note %}untouched{% endnote %}/);assert.doesNotMatch(html,/{% (?:end)?gallery/);
});
test('conversion handles URL galleries, quoted group cards and consecutive galleries', () => {
  const input = '{% galleryGroup "旅行相册" "海边 与 山" /album/ /cover.jpg %}\n{% gallery url,/data.json,true,3,2 %}{% endgallery %}\n{% gallery false %}![a](/a.jpg){% endgallery %}';
  const html=convertGallery(input);
  assert.match(html,/class="gallery-group"/);assert.match(html,/海边 与 山/);assert.match(html,/aria-label="旅行相册"/);
  assert.match(html,/data-type="url"[^]*?>\/data.json<\/div>/);
  assert.equal((html.match(/class="gallery-container"/g)||[]).length,2);
  for (const input of ['{% gallery true %}![x](/a.jpg)', '{% gallery true,0 %}{% endgallery %}', '{% gallery url,javascript:bad %}{% endgallery %}', '{% galleryGroup x y javascript:bad /x %}']) assert.throws(()=>convertGallery(input));
});
test('conversion preserves gallery source shown inside fenced code examples', () => {
  const code='```text\n{% gallery true %}![a](/a.jpg){% endgallery %}\n```\n';
  assert.equal(convertGallery(code),code);
  assert.match(convertGallery(code+'{% gallery false %}![a](/a.jpg){% endgallery %}'),/```text[^]*?```[^]*class="gallery-container"/);
});
