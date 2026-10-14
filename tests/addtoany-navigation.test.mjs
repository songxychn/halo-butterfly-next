import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {mountAddToAny,isOwnedAddToAnyNode} from '../src/js/core/addtoany-navigation.ts';
test('reused AddToAny anchors expose the new URL and translated caption before any SDK event',()=>{
 const previousWindow=globalThis.window,previousNode=globalThis.Node;
 try{
  globalThis.Node={TEXT_NODE:3};
  const caption={nodeType:3,textContent:'复制链接'},svg={nodeType:1},attrs={'href':'https://old.test/','aria-label':'分享到复制链接','target':'_top'};
  const anchor={childNodes:[svg,caption],setAttribute:(key,value)=>attrs[key]=value};
  const kit={dataset:{},querySelector:()=>anchor};let replacement;
  const fresh={textContent:'Copy link',getAttribute:key=>({'href':'https://new.test/','aria-label':'Share to Copy link','rel':'noopener noreferrer'})[key]};
  globalThis.window={[Symbol.for('halo-butterfly-next.addtoany')]:{kit,items:'copy_link',ready:true}};
  mountAddToAny({querySelector:()=>fresh,replaceWith:node=>replacement=node},['copy_link'],'https://new.test/','New title');
  assert.equal(replacement,kit);assert.deepEqual(kit.dataset,{a2aUrl:'https://new.test/',a2aTitle:'New title'});
  assert.equal(attrs.href,'https://new.test/');assert.equal(attrs['aria-label'],'Share to Copy link');assert.equal(caption.textContent,'Copy link');
  assert.equal(attrs.target,'_top');assert.equal(anchor.childNodes[0],svg,'SDK icon and original anchor are retained');
  assert.equal(isOwnedAddToAnyNode({src:'https://static.addtoany.com/menu/page.js'}),false,'same URL is not ownership');
 }finally{globalThis.window=previousWindow;globalThis.Node=previousNode}
});
