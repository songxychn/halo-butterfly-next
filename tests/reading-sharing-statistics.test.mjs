import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {appendAttribution} from '../src/js/core/copy-attribution.ts';
import {parseShareItems, safeShareUrl} from '../src/js/core/share.ts';
import {countPublishedWords} from '../src/js/core/site-statistics.ts';
import {createTranslateState, initializeTranslate, translatePage, readSavedEncoding, writeSavedEncoding} from '../src/js/core/translate.ts';

test('复制版权严格超过阈值才追加，保留换行与正文，0 阈值有效', () => {
  assert.equal(appendAttribution('短文', 2, '作者', '/post', '站点', '许可'), '短文');
  assert.equal(appendAttribution('正文\n下一行', 0, '作者', 'https://example.invalid/post', '站点', 'CC BY'), '正文\n下一行\n\n作者：作者\n链接：https://example.invalid/post\n来源：站点\n著作权归作者所有。CC BY');
});
test('分享平台保序去重，过滤可执行字符；URL 不接受 javascript', () => {
  assert.deepEqual(parseShareItems(' x,facebook,x,wechat, <script>,invalid ', ['x','facebook','wechat']), ['x','facebook','wechat']);
  assert.deepEqual(parseShareItems(''), []);
  assert.equal(safeShareUrl('/post?a=1&b=中文', 'https://example.invalid/'), 'https://example.invalid/post?a=1&b=%E4%B8%AD%E6%96%87');
  assert.equal(safeShareUrl('javascript:alert(1)', 'https://example.invalid/'), 'https://example.invalid/');
});
test('全站字数处理多页公开文章及不同大小页，详情最多两个并发', async () => {
  let active = 0, max = 0;
  const urls = [];
  const count = await countPublishedWords(async url => {
    urls.push(url);
    if (url.includes('?page=1')) return {items:[{metadata:{name:'a'}},{metadata:{name:'b'}}],total:3,hasNext:true};
    if (url.includes('?page=2')) return {items:[{metadata:{name:'c'}}],total:3,hasNext:false};
    active++; max=Math.max(max,active);
    await new Promise(resolve=>setTimeout(resolve,5)); active--;
    return {content:{content:'<p>中文 hello</p><script>ignore</script>'}};
  });
  assert.equal(count,9); assert.equal(max,2);
  assert.ok(urls.every(url=>url.startsWith('/apis/api.content.halo.run/v1alpha1/posts')));
});
test('空站为 0，正文失败、重复分页、发布集变化均拒绝输出部分总数', async () => {
  assert.equal(await countPublishedWords(async()=>({items:[],total:0,hasNext:false})),0);
  await assert.rejects(countPublishedWords(async url=>url.includes('?') ? {items:[{metadata:{name:'a'}}],total:1,hasNext:false} : {}), /Missing published body/);
  await assert.rejects(countPublishedWords(async url=>({items:[{metadata:{name:'a'}}],total:url.includes('page=1')?2:3,hasNext:true})), /Publication changed/);
  await assert.rejects(countPublishedWords(async()=>({items:[{metadata:{name:'a'}},{metadata:{name:'a'}}],total:2,hasNext:false})), /duplicate/);
});
test('繁体原文、按钮文案与存储被禁时仍可切换，不改脚本/代码/表单', () => {
  const storage = {getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')},removeItem(){throw new Error('blocked')}};
  assert.equal(readSavedEncoding(storage),undefined); writeSavedEncoding(1,storage);
  const bodyText={nodeType:3,data:'簡體'};
  const codeText={nodeType:3,data:'簡體'};
  const body={childNodes:[bodyText,{nodeType:1,tagName:'CODE',childNodes:[codeText]}]};
  const button={textContent:'简'}, html={lang:''};
  const state=createTranslateState({body,button,html,storage,defaultEncoding:1,msgToTraditionalChinese:'转繁',msgToSimplifiedChinese:'转简'});
  initializeTranslate(state); assert.equal(html.lang,'zh-TW');
  translatePage(state); assert.equal(bodyText.data,'简体'); assert.equal(codeText.data,'簡體'); assert.equal(button.textContent,'转繁');
});
