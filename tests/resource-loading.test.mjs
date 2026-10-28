import {test} from 'bun:test';
import {loadRenderer} from '../src/js/core/body-renderers.ts';
import assert from 'node:assert/strict';
import {loadManagedResource, resolveResource} from '../src/js/core/external-resource.ts';

function documentFixture() {
  const nodes=[];
  const document={baseURI:'https://site.test/',createElement:tag=>({tag,attrs:{},setAttribute(k,v){this.attrs[k]=v;},remove(){this.removed=true;}}),head:{append:node=>nodes.push(node)}};
  return {document,nodes};
}

test('only a valid unified directory supplies theme resources; legacy overrides are ignored',()=>{
  const local='/themes/halo-butterfly-next/assets/renderers/mermaid.min.js',file='renderers/mermaid.min.js';
  const legacy={option:{mermaid:'https://obsolete.invalid/adapter.js'}};
  assert.equal(resolveResource(local,legacy,'1.0.0',file),local);
  assert.equal(resolveResource(local,{...legacy,asset_base:'https://cdn.test/${name}/${version}/assets/'},'1.0.0',file),'https://cdn.test/halo-butterfly-next/1.0.0/assets/'+file);
  for(const asset_base of ['//evil.test/assets','javascript:alert(1)','https://user:password@cdn.test/assets','https://cdn.test/assets?x=1','https://cdn.test/assets#x','https://cdn.test/${unknown}'])assert.equal(resolveResource(local,{asset_base},'1.0.0',file),local);
});


test('native script error retries locally once; concurrent callers share the completion',async()=>{
  const {document,nodes}=documentFixture();
  const first=loadManagedResource('https://cdn.test/share.js','/local-share.js',{document});
  assert.equal(first,loadManagedResource('https://cdn.test/share.js','/local-share.js',{document}));
  assert.equal(nodes.length,1);nodes[0].onerror();assert.equal(nodes.length,2);
  assert.equal(nodes[1].src,'https://site.test/local-share.js');nodes[1].onload();assert.equal(await first,true);
});

test('missing library API triggers a single local fallback and failed fallback settles false',async()=>{
  const {document,nodes}=documentFixture();let usable=false;
  const pending=loadManagedResource('https://cdn.test/share.js','/local-share.js',{document,valid:()=>usable});
  nodes[0].onload();assert.equal(nodes.length,2);usable=true;nodes[1].onload();assert.equal(await pending,true);
  const second=documentFixture();const failed=loadManagedResource('https://cdn.test/bad.js','/bad.js',{document:second.document});
  second.nodes[0].onerror();second.nodes[1].onerror();assert.equal(await failed,false);assert.equal(second.nodes.length,2);
});

test('timeout does not retry executable bytes that may still be in flight',async()=>{
  const {document,nodes}=documentFixture();const pending=loadManagedResource('https://cdn.test/late.js','/local.js',{document,timeout:5});
  assert.equal(await pending,false);assert.equal(nodes.length,1);assert.equal(nodes[0].onload,null);assert.equal(nodes[0].removed,true);
});

test('stylesheet failure loads local CSS and successful styles are cached',async()=>{
  const {document,nodes}=documentFixture();const pending=loadManagedResource('https://cdn.test/share.css','/share.css',{document,kind:'style'});
  assert.equal(nodes[0].rel,'stylesheet');nodes[0].onerror();assert.equal(nodes[1].href,'https://site.test/share.css');nodes[1].onload();
  assert.equal(await pending,true);assert.equal(await loadManagedResource('https://cdn.test/share.css','/share.css',{document,kind:'style'}),true);assert.equal(nodes.length,2);
});




test('all three body renderers share native-error fallback and recover after definite failure',async()=>{
 for(const kind of ['mermaid','chartjs','abcjs']){
  const {document,nodes}=documentFixture();
  document.defaultView={MainApp:{conf:{assets_link:'/assets/'},resources:{asset_base:'https://cdn.test/assets'},version:'v1'},ThemeBodyRenderers:{}};
  const first=loadRenderer(kind,document); const rejected=assert.rejects(first,/渲染器加载失败/);
  nodes[0].onerror();nodes[1].onerror();await rejected;assert.equal(nodes.length,2);
  const api={render(){}};const next=loadRenderer(kind,document);assert.equal(nodes.length,3);
  document.defaultView.ThemeBodyRenderers[kind]=api;nodes[2].onload();assert.equal(await next,api);
 }
});

test('slow body-renderer CDN never starts another script on timeout or manual retry',async()=>{
 const timer=globalThis.setTimeout;
 globalThis.setTimeout=(fn,ms,...args)=>timer(fn,Math.min(ms,5),...args);
 try{
  for(const kind of ['mermaid','chartjs','abcjs']){
   const {document,nodes}=documentFixture();
   document.defaultView={MainApp:{conf:{assets_link:'/assets/'},resources:{asset_base:'https://cdn.test/assets'},version:'v1'},ThemeBodyRenderers:{}};
   await assert.rejects(loadRenderer(kind,document),/渲染器加载失败/);assert.equal(nodes.length,1);
   await assert.rejects(loadRenderer(kind,document),/渲染器加载失败/);assert.equal(nodes.length,1);
   const api={render(){}};document.defaultView.ThemeBodyRenderers[kind]=api;
   assert.equal(await loadRenderer(kind,document),api);assert.equal(nodes.length,1);
  }
 }finally{globalThis.setTimeout=timer;}
});


test('slow gallery loader keeps readable failure state and never requests the local script after timeout',async()=>{
 const {initializeArticleGallery,GALLERY_KEY}=await import('../src/js/core/article-gallery.ts');
 const {beginPage,disposePage}=await import('../src/js/core/page-lifecycle.ts');
 const {document,nodes}=documentFixture();const classes=new Set(),messages=[];
 const gallery={classList:{add:value=>classes.add(value)},ownerDocument:document,append:node=>messages.push(node)};
 const article={ownerDocument:document,querySelector:()=>gallery,querySelectorAll:()=>[gallery],isConnected:true};
 const keys=['window','document','MainApp'];const previous=keys.map(key=>[key,Object.hasOwn(globalThis,key),globalThis[key]]);
 const timer=globalThis.setTimeout;
 try{
  globalThis.document=document;globalThis.window={};
  globalThis.MainApp={conf:{assets_link:'/assets/'},resources:{asset_base:'https://slow.test/assets'},version:'v1'};
  globalThis.setTimeout=(fn,ms,...args)=>timer(fn,Math.min(ms,5),...args);beginPage();
  initializeArticleGallery(article);await new Promise(resolve=>timer(resolve,25));
  assert.equal(nodes.length,1);assert.equal(nodes[0].src,'https://slow.test/assets/js/gallery.min.js');
  assert(classes.has('loaded'));assert.equal(messages[0].textContent,'图库增强未能加载，请刷新重试。');
  let initialized=0;window[GALLERY_KEY]=()=>initialized++;
  initializeArticleGallery(article);assert.equal(initialized,1);assert.equal(nodes.length,1);
 }finally{disposePage();globalThis.setTimeout=timer;for(const [key,owned,value] of previous){if(owned)globalThis[key]=value;else delete globalThis[key];}}
});
