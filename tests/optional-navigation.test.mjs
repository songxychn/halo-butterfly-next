import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {initializeBusuanzi} from '../src/js/core/busuanzi.ts';
import {beginPage,disposePage} from '../src/js/core/page-lifecycle.ts';
import {isThemeScriptSource} from '../src/js/core/external-resource.ts';

test('default Busuanzi owns callbacks per page, removes them and ignores stale responses',()=>{
 const old=globalThis.window;const win={};globalThis.window=win;
 const nodes=[];let field={dataset:{},textContent:'unavailable'},container={style:{}};
 const root={defaultView:win,getElementById:id=>id==='busuanzi_value_page_pv'?field:id==='busuanzi_container_page_pv'?container:null,createElement:()=>({dataset:{},remove(){this.removed=true}}),head:{append:node=>nodes.push(node)}};
 try{
  beginPage();initializeBusuanzi(root);initializeBusuanzi(root);assert.equal(nodes.length,1);const first=nodes[0].src.split('.').at(-1);
  const oldField=field;disposePage();assert.equal(nodes[0].removed,true);assert.equal(Object.keys(win.__haloThemeBusuanzi).length,0);
  beginPage();field={dataset:{},textContent:'unavailable'};initializeBusuanzi(root);const second=nodes[1].src.split('.').at(-1);
  win.__haloThemeBusuanzi[first]({page_pv:99});assert.equal(field.textContent,'unavailable');assert.equal(oldField.textContent,'unavailable');
  win.__haloThemeBusuanzi[second]({page_pv:7});assert.equal(field.textContent,'7');assert.equal(container.style.display,'inline');assert.equal(Object.keys(win.__haloThemeBusuanzi).length,0);
  beginPage();field={dataset:{},textContent:'unavailable'};initializeBusuanzi(root);const third=nodes[2].src.split('.').at(-1);win.__haloThemeBusuanzi[third]({page_pv:'<img onerror=alert(1)>'});assert.equal(field.textContent,'unavailable');
 }finally{disposePage();globalThis.window=old;}
});
test('optional script resource trust is restricted to exact effects and Share.js files',()=>{
 const root='https://site.test/themes/theme/assets/';
 for(const [key,file] of [['effects','js/effects.min.js'],['sharejs','plugins/sharejs/js/social-share.min.js']]){
  assert.equal(isThemeScriptSource(root+file,file,key,root),true);
  assert.equal(isThemeScriptSource('https://evil.test/'+file,file,key,root),false);
  assert.equal(isThemeScriptSource(root+'js/other.min.js','js/other.min.js',key,root),false);
 }
});
