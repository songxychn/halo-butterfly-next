import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {appendAttribution, bindCopyAttribution} from '../src/js/core/copy-attribution.ts';
import {safeShareUrl} from '../src/js/core/share.ts';
import {beginPage, disposePage} from '../src/js/core/page-lifecycle.ts';
import {createTranslateState, initializeTranslate, translatePage, readSavedEncoding, writeSavedEncoding} from '../src/js/core/translate.ts';

test('复制版权严格超过阈值才追加，保留换行与正文，0 阈值有效', () => {
  assert.equal(appendAttribution('短文', 2, '作者', '/post', '站点', '许可'), '短文');
  assert.equal(appendAttribution('正文\n下一行', 0, '作者', 'https://example.invalid/post', '站点', 'CC BY'), '正文\n下一行\n\n作者：作者\n链接：https://example.invalid/post\n来源：站点\n著作权归作者所有。CC BY');
});
test('分享 URL 不接受 javascript', () => {
  assert.equal(safeShareUrl('/post?a=1&b=中文', 'https://example.invalid/'), 'https://example.invalid/post?a=1&b=%E4%B8%AD%E6%96%87');
  assert.equal(safeShareUrl('javascript:alert(1)', 'https://example.invalid/'), 'https://example.invalid/');
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

test('局部换页移除旧文档复制监听，不继续处理旧正文选区', () => {
  const savedWindow=globalThis.window, savedElement=globalThis.Element;
  try {
    globalThis.window={}; globalThis.Element=class {}; beginPage();
    const node={parentElement:{closest:()=>null}};
    const article={dataset:{copyEnabled:'true',copyCopyright:'true',copyLimit:'0',copyUrl:'https://example.invalid/old'},contains:()=>true};
    const root=new EventTarget();root.querySelector=()=>article;
    root.getSelection=()=>({isCollapsed:false,anchorNode:node,focusNode:node,toString:()=> '正文'});
    let writes=0;
    const copy=()=>{const event=new Event('copy',{cancelable:true});event.clipboardData={setData:()=>writes++};root.dispatchEvent(event);return event.defaultPrevented;};
    bindCopyAttribution(root);assert.equal(copy(),true);assert.equal(writes,1);
    beginPage();assert.equal(copy(),false);assert.equal(writes,1);
  } finally {disposePage();globalThis.window=savedWindow;globalThis.Element=savedElement;}
});
