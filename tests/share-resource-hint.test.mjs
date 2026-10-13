import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {initializeShare} from '../src/js/core/share.ts';

test('AddToAny hints its actual SDK origin only when requested', async () => {
  const saved = Object.fromEntries(['document','window','location','navigator'].map(key=>[key,globalThis[key]]));
  const hints=[],scripts=[];
  const host={dataset:{},append(){}};
  const region={dataset:{postShare:'addtoany',items:'email'},querySelector:selector=>selector==='[data-share-provider]'?host:null};
  const document={baseURI:'https://site.test/post',title:'Post',querySelector:()=>region,
    createElement:tag=>({tag,dataset:{},setAttribute(){},hasAttribute(){return false;}}),
    head:{querySelectorAll:()=>hints,append:n=>hints.push(n)},
    body:{append:n=>{scripts.push(n);queueMicrotask(()=>n.onload());}}};
  globalThis.document=document;globalThis.window={};globalThis.location={href:document.baseURI};globalThis.navigator={};
  try {
    region.dataset.postShare='disabled';initializeShare(document);assert.equal(hints.length,0);
    delete region.dataset.initialized;region.dataset.postShare='addtoany';initializeShare(document);
    assert.equal(scripts.length,1);assert.equal(hints.length,1);assert.equal(hints[0].href,'https://static.addtoany.com');
    await Promise.resolve();
  }finally{for(const [key,value] of Object.entries(saved)) value===undefined?delete globalThis[key]:globalThis[key]=value;}
});
