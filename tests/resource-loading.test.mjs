import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {isThemeScriptSource, loadManagedResource, resolveResource} from '../src/js/core/external-resource.ts';

function documentFixture() {
  const nodes=[];
  const document={baseURI:'https://site.test/',createElement:tag=>({tag,attrs:{},setAttribute(k,v){this.attrs[k]=v;},remove(){this.removed=true;}}),head:{append:node=>nodes.push(node)}};
  return {document,nodes};
}

test('PJAX trusts exact configured files and local fallbacks, not other files on the CDN',()=>{
  const root='https://site.test/themes/next/assets/';
  const config={internal_provider:'custom',asset_base:'https://cdn.test/v1/assets'};
  const check=(url,file='js/index.min.js',key='main')=>isThemeScriptSource(url,file,key,root,config,'v1');
  assert(check('https://cdn.test/v1/assets/js/index.min.js'));
  assert(check(root+'js/index.min.js?v=v1'));
  for(const url of ['https://cdn.test/foreign.js','https://cdn.test/v1/assets/js/other.min.js','https://cdn.test.evil/v1/assets/js/index.min.js',root+'js/index.min.js?v=wrong']) assert.equal(check(url),false);
  for(const file of ['js/../index.min.js','js/%2e%2e/index.min.js','//evil.test/index.min.js','js/index.min.js?extra']) assert.equal(check('https://cdn.test/v1/assets/'+file,file),false);
  assert.equal(check('https://cdn.test/v1/assets/js/index.min.js','js/index.min.js','loading'),false);
  assert(isThemeScriptSource('https://override.test/entry.js','js/index.min.js','main',root,{option:{main:'https://override.test/entry.js'}},'v1'));
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

test('service URLs stay official unless overridden, even with a unified theme directory',()=>{
  const official='https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
  const config={internal_provider:'custom',asset_base:'https://cdn.test/assets'};
  assert.equal(resolveResource('busuanzi',official,config,'v1'),official);
  assert.equal(resolveResource('busuanzi',official,{...config,option:{busuanzi:'https://stats.test/entry.js'}},'v1'),'https://stats.test/entry.js');
});
