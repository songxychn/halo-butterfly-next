import {test} from 'bun:test';
import assert from 'node:assert/strict';
import { navigationURL, allowsPartialPageExit, isManagedKatexScript } from '../src/js/core/navigation-loading.ts';
import { imageLoadingOptions, initializeImageLoading } from '../src/js/core/image-loading.ts';
import { snackbarPosition } from '../src/js/core/_message.ts';
import {beginPage, disposePage, onPageCleanup, pageListen, pageScope} from '../src/js/core/page-lifecycle.ts';

test('navigation retains native anchors, external/download/admin destinations and configured exclusions', () => {
  const base = 'https://example.test/archives/one/';
  for (const target of ['#chapter', base+'#chapter','mailto:a@example.test','https://other.test/','/console','/console/posts','/%61pis/a','/logout','/file.zip','/rss.xml','/feed.xml','/sitemap.xml','https://a:b@example.test/x','javascript:alert(1)']) assert.equal(navigationURL(target,base),null,target);
  assert.equal(navigationURL('/archives/two/',base).pathname,'/archives/two/');
  assert.equal(navigationURL('/photos?group=a',base).search,'?group=a');
  assert.equal(navigationURL('/private/x',base,'/private/*'),null);
  assert.equal(navigationURL('/about/',base,['/about/']),null);
  assert.equal(navigationURL('/about-more/',base,'/about/').pathname,'/about-more/');
});
test('unsaved editor beforeunload veto retains native leave-page confirmation', () => {
  const target = new EventTarget();
  assert.equal(allowsPartialPageExit(target),true);
  const veto = event => event.preventDefault();
  target.addEventListener('beforeunload',veto);
  assert.equal(allowsPartialPageExit(target),false);
  target.removeEventListener('beforeunload',veto);
  assert.equal(allowsPartialPageExit(target),true);
  const legacy = event => { event.returnValue = 'Unsaved draft'; };
  target.addEventListener('beforeunload',legacy);
  assert.equal(allowsPartialPageExit(target),false);
  target.removeEventListener('beforeunload',legacy);
  target.onbeforeunload = () => 'Unsaved draft';
  assert.equal(allowsPartialPageExit(target),false);
});
test('legacy image configuration stays native/site/unblurred; explicit false and post scope work', () => {
  assert.deepEqual(imageLoadingOptions({}),{enabled:true,native:true,field:'site',blur:false});
  assert.deepEqual(imageLoadingOptions({lazyload_enable:'false',lazyload_native:false,lazyload_field:'post',lazyload_blur:'true'}),{enabled:false,native:false,field:'post',blur:true});
  assert.equal(snackbarPosition('top-right'),'top-right'); assert.equal(snackbarPosition('invalid'),'bottom-left');
});
test('page disposal removes global handlers exactly once across repeated entries and isolates late work', () => {
  const old = globalThis.window; globalThis.window = {};
  try {
    const target = new EventTarget(); let calls=0, cleanups=0;
    for(let i=0;i<6;i++) {
      beginPage(); const scope=pageScope();
      pageListen(target,'click',()=>calls++);
      onPageCleanup(()=>cleanups++);
      target.dispatchEvent(new Event('click')); assert.equal(calls,i+1);
      disposePage(); disposePage();
      target.dispatchEvent(new Event('click')); assert.equal(calls,i+1);
      assert.equal(scope.active,false);
      let late=0; scope.add(()=>late++); assert.equal(late,1);
    }
    assert.equal(cleanups,6);
  } finally {globalThis.window=old;}
});

test('cached shared bad images fall back once in native, disabled and post-only loading modes',()=>{
  const oldWindow=globalThis.window, oldDocument=globalThis.document;
  try {
    for(const config of [{},{lazyload_enable:false},{lazyload_field:'post'}]) {
      globalThis.window={};
      const attrs=new Map([['src','/missing.svg'],['srcset','/missing.svg 1x'],['sizes','100vw'],['data-theme-image',''],['data-theme-image-fallback','/fallback.svg']]);
      const classes=new Set(); let replacements=0;
      const image=new EventTarget();
      Object.assign(image,{dataset:{themeImageFallback:'/fallback.svg'},loading:'lazy',complete:true,naturalWidth:0,
        classList:{remove:k=>classes.delete(k),add:k=>classes.add(k)},closest:()=>null,
        hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)??null,removeAttribute:k=>attrs.delete(k)});
      Object.defineProperty(image,'src',{get:()=>new URL(attrs.get('src')||'', 'https://example.test/').href,set:value=>{attrs.set('src',value);replacements++}});
      globalThis.document={baseURI:'https://example.test/',querySelectorAll:()=>[image]};
      initializeImageLoading(config);initializeImageLoading(config);
      assert.equal(replacements,1);assert.equal(image.src,'https://example.test/fallback.svg');
      assert.equal(attrs.has('srcset'),false);assert.equal(attrs.has('sizes'),false);
      image.dispatchEvent(new Event('error'));image.dispatchEvent(new Event('error'));
      assert.equal(replacements,1);assert.equal(attrs.has('src'),false);assert.equal(classes.has('image-failed'),true);
      disposePage();assert.equal(image.dataset.fallbackBound,undefined);
    }
  } finally {globalThis.window=oldWindow;globalThis.document=oldDocument;}
});


test('KaTeX navigation accepts only the versioned opt-in bootstrap and exact local renderer', () => {
  const source = (dataset, src, textContent = '/* halo-katex-demand:v1 */\n(function(){})();') => ({
    dataset, textContent, ownerDocument: { URL: 'https://site.test/post' },
    hasAttribute: name => name === 'src' && src !== undefined,
    getAttribute: name => name === 'src' ? src : null,
  });
  assert.equal(isManagedKatexScript(source({katexDemand:'1',katexVersion:'3.0.0-demand.1'})),true);
  for (const version of ['', '3.0.0', '3.0.0-demand.0', '4.0.0-demand.1'])
    assert.equal(isManagedKatexScript(source({katexDemand:'1',katexVersion:version})),false);
  assert.equal(isManagedKatexScript(source({katexDemand:'1',katexVersion:'3.0.0-demand.1'}, undefined, 'alert(1)')),false);
  const marker = {katexDemandResource:'1'};
  assert.equal(isManagedKatexScript(source(marker,'/plugins/plugin-katex/assets/static/katex.min.js?version=3.0.0-demand.1')),true);
  for (const url of ['https://evil.test/plugins/plugin-katex/assets/static/katex.min.js?version=3.0.0-demand.1', '/plugins/plugin-katex/assets/static/other.js?version=3.0.0-demand.1', '/plugins/plugin-katex/assets/static/katex.min.js', '/plugins/plugin-katex/assets/static/katex.min.js?version=3.0.0-demand.1&other=1', '/plugins/plugin-katex/assets/static/katex.min.js?version=3.0.0-demand.1#x'])
    assert.equal(isManagedKatexScript(source(marker,url)),false,url);
  assert.equal(isManagedKatexScript(source({},'/plugins/plugin-katex/assets/static/katex.min.js?version=3.0.0-demand.1')),false);
});
