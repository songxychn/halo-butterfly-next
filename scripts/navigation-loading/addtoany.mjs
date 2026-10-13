/** Real, digest-pinned AddToAny bytes; all share/analytics outbound requests blocked. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl,validatePackage,sha256} from '../browser/support.mjs';
const lab=path.join(REPO,'.runtime/comparison'),base=validateBaseUrl(process.env.BASE_URL,JSON.parse(await readFile(path.join(lab,'lab.json'))));
const installed=JSON.parse(await readFile(path.join(lab,'installed-package.json')));
validatePackage(installed,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha256(await readFile(path.join(REPO,'dist',installed.name))));
Object.assign(process.env,browserEnvironment());const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const files=JSON.parse(await readFile(new URL('./addtoany-sdk.json',import.meta.url)));
const sdk=new Map();for(const row of files){const body=await readFile(path.join(REPO,'.runtime/navigation-loading/addtoany-sdk',row.file));assert.equal(sha256(body),row.sha256);sdk.set(row.path,body)}
const output=path.join(REPO,'.runtime/navigation-loading');await mkdir(output,{recursive:true});
const report={theme:installed,results:[],sdk:files,limitations:['Official pinned SDK executed with all outbound sharing and service traffic intercepted. Physical browsers/devices not covered.']};
let browser;const save=()=>writeFile(path.join(output,'addtoany.json'),JSON.stringify(report,null,2)+'\n');
try{for(const engine of (process.env.ENGINES||'chromium,firefox,webkit').split(',')){
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
 for(const width of [1440,390])for(const mode of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'zh-CN'});
  await context.addInitScript(mode=>{localStorage.setItem('halo-butterfly-next.color-scheme',mode);window.open=(url)=>{window.shareDestination=String(url);return null}},mode);
  const requests=[],errors=[];
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base)return route.continue();requests.push(url.href);if(url.origin==='https://static.addtoany.com'&&sdk.has(url.pathname))return route.fulfill({contentType:url.pathname.endsWith('.html')?'text/html':'application/javascript',headers:{'access-control-allow-origin':'*'},body:sdk.get(url.pathname)});return route.abort()});
  const p=await context.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='debug'){report.debug??=[];report.debug.push(m.text())}});
  await p.goto(base+'/archives/preview-1/',{waitUntil:'domcontentloaded'});
  try{await p.waitForFunction(()=>window[Symbol.for('halo-butterfly-next.addtoany')]?.ready)}catch(e){report.diagnostic=await p.evaluate(()=>({scripts:[...document.scripts].map(s=>s.src),styles:[...document.head.querySelectorAll('style')].map(s=>s.textContent.slice(0,70)),ready:window[Symbol.for('halo-butterfly-next.addtoany')]?.ready,main:window.a2a?.main?.outerHTML.slice(0,300)}));report.errors=errors;throw e}
  await p.evaluate(()=>{window.addToAnySentinel='keep';window.addToAnyOriginalBody=document.body;window.addToAnyOriginalFrame=document.getElementById('a2a_sm_ifr');window.addToAnyFrameWindow=window.addToAnyOriginalFrame.contentWindow;window.addToAnyOriginalKit=document.querySelector('[data-share-provider]');window.addToAnyIndex=window.addToAnyOriginalKit.a2a_index;window.addToAnyDetached=false;new MutationObserver(()=>{if(!window.addToAnyOriginalFrame.isConnected)window.addToAnyDetached=true}).observe(document,{childList:true,subtree:true})});
  const visit=async route=>{report.beforeVisit=await p.evaluate(()=>({navigation:document.documentElement.dataset.themeNavigation,custom:[...document.querySelectorAll('*')].filter(e=>e.localName.includes('-')).map(e=>e.outerHTML.slice(0,100)),scripts:[...document.scripts].map(s=>({src:s.src,text:s.src?'':s.textContent.slice(0,220),type:s.type,kind:s.dataset.themeScript})),iframes:[...document.querySelectorAll('iframe')].map(x=>x.src),menus:[...document.querySelectorAll('.a2a_menu,#a2a_modal,#a2a_overlay')].map(e=>({id:e.id,display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility})),ready:window[Symbol.for('halo-butterfly-next.addtoany')]?.ready,owned:(()=>{const s=window[Symbol.for('halo-butterfly-next.addtoany')];return {locale:s?.locale?.src,style:s?.style?.isConnected,main:s?.main.parentNode===document.body,frame:s?.frame.src,rects:[...s.main.querySelectorAll('.a2a_menu,#a2a_modal,#a2a_overlay')].map(e=>[e.id,e.getClientRects().length]),items:s?.items,region:document.querySelector('[data-post-share]')?.dataset.items}})(),no:[...document.querySelectorAll('[data-no-pjax]')].map(e=>e.outerHTML.slice(0,200))}));await save();await p.evaluate(route=>{const a=document.createElement('a');a.href=route;document.body.append(a);a.click();a.remove()},route);await p.waitForFunction(route=>location.pathname===route&&!document.documentElement.classList.contains('theme-navigating')&&!!MainApp.useCommon,route,{polling:100});assert.equal(await p.evaluate(()=>window.addToAnySentinel),'keep');};
  for(let i=0;i<4;i++){
   if(i)await visit('/archives/preview-'+(i%2+1)+'/');
   if(i){const initial=await p.locator('[data-post-share]').evaluate(region=>({href:region.querySelector('.a2a_button_facebook').href,url:region.dataset.url,title:region.dataset.title}));assert(initial.href.includes(encodeURIComponent(initial.url)));assert(initial.href.includes(encodeURIComponent(initial.title)));}
   await p.locator('.a2a_button_facebook').click();
   const identity=await p.evaluate(()=>({destination:window.shareDestination,url:document.querySelector('[data-post-share]').dataset.url,title:document.querySelector('[data-post-share]').dataset.title,kitSame:window.addToAnyOriginalKit===document.querySelector('[data-share-provider]'),indexSame:window.addToAnyIndex===window.addToAnyOriginalKit.a2a_index}));
   assert(identity.destination.includes(encodeURIComponent(identity.url)),JSON.stringify(identity));assert(identity.destination.includes(encodeURIComponent(identity.title)),JSON.stringify(identity));assert(identity.kitSame&&identity.indexSame);
   await p.locator('.a2a_button_copy_link').click();await p.waitForSelector('#a2a_copy_link_text',{state:'visible'});assert.equal(await p.locator('#a2a_copy_link_text').inputValue(),identity.url);await p.waitForFunction(()=>getComputedStyle(document.getElementById('a2a_modal')).opacity==='1'&&!document.getElementById('a2a_modal').classList.contains('a2a_starting'));await p.waitForTimeout(180);await p.locator('#a2a_copy_link_text').press('Escape');await p.waitForSelector('#a2a_copy_link_text',{state:'hidden'});
   await visit('/archives/');
   assert(await p.evaluate(()=>document.body===window.addToAnyOriginalBody&&window.addToAnyOriginalFrame.isConnected&&window.addToAnyOriginalFrame.contentWindow===window.addToAnyFrameWindow&&!window.addToAnyDetached));
  }
  await visit('/archives/preview-1/');
  await p.evaluate(()=>document.getElementById('post-comment').dispatchEvent(new Event('theme:load-comments')));
  const editor=p.locator('comment-widget [contenteditable="true"]').first();await editor.click();await editor.pressSequentially('AddToAny pending draft',{delay:5});
  await p.waitForFunction(()=>Object.keys(localStorage).some(k=>(localStorage.getItem(k)||'').includes('AddToAny pending draft')),null,{polling:100});
  const pending=p.waitForEvent('dialog');await p.evaluate(()=>history.back());const dialog=await pending;assert.equal(dialog.type(),'beforeunload');await dialog.dismiss();
  await p.waitForFunction(()=>location.pathname==='/archives/preview-1/',null,{polling:100});assert.match(await editor.innerText(),/AddToAny pending draft/);
  assert(await p.evaluate(()=>window.addToAnySentinel==='keep'&&window.addToAnyOriginalFrame.contentWindow===window.addToAnyFrameWindow));
  await editor.press('ControlOrMeta+A');await editor.press('Backspace');await p.waitForFunction(()=>!Object.keys(localStorage).some(k=>(localStorage.getItem(k)||'').includes('AddToAny pending draft')),null,{polling:100});
  await p.goBack();await p.waitForFunction(()=>location.pathname==='/archives/'&&!document.documentElement.classList.contains('theme-navigating'),null,{polling:100});assert.equal(await p.evaluate(()=>window.addToAnySentinel),'keep');
  assert.equal(requests.filter(url=>url.endsWith('/menu/page.js')).length,1);assert.equal(requests.filter(url=>url.endsWith('/menu/modules/core.iho16r34.js')).length,1);assert.equal(requests.filter(url=>url.includes('/menu/sm.25.html')).length,1);
  assert.deepEqual(errors,[]);
  await visit('/archives/preview-2/');
  await p.locator('.a2a_button_copy_link').click();await p.waitForSelector('#a2a_copy_link_text',{state:'visible'});
  await p.evaluate(()=>{const a=document.createElement('a');a.href='/archives/';document.body.append(a);a.click()});
  await p.waitForFunction(()=>location.pathname==='/archives/'&&!!window.MainApp?.useCommon,null,{polling:100});assert.equal(await p.evaluate(()=>window.addToAnySentinel),undefined,'An open SDK modal retains native navigation');
  report.results.push({engine,width,mode,cycles:4,result:'passed'});await save();console.log('PASS',engine,width,mode);await context.close();
 }
 for(const scenario of ['unknown-iframe','late-iframe','failed-loader','delayed-loader']){
  const context=await browser.newContext({locale:'zh-CN'});
  let release,requested;const pendingRequest=new Promise(resolve=>requested=resolve);
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===base){if(scenario==='late-iframe'&&url.pathname==='/archives/'&&route.request().resourceType()==='fetch'){await new Promise(resolve=>{release=resolve;requested()})}return route.continue();}
   if(url.pathname==='/menu/page.js'&&scenario==='failed-loader')return route.abort();
   if(url.pathname==='/menu/page.js'&&scenario==='delayed-loader')await new Promise(resolve=>setTimeout(resolve,1000));
   if(url.origin==='https://static.addtoany.com'&&sdk.has(url.pathname)){try{return await route.fulfill({contentType:url.pathname.endsWith('.html')?'text/html':'application/javascript',headers:{'access-control-allow-origin':'*'},body:sdk.get(url.pathname)})}catch{return}}
   return route.abort();
  });
  const p=await context.newPage();await p.goto(base+'/archives/preview-1/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>!!window[Symbol.for('halo-butterfly-next.addtoany')],null,{polling:50});
  if(['unknown-iframe','late-iframe'].includes(scenario))await p.waitForFunction(()=>window[Symbol.for('halo-butterfly-next.addtoany')]?.ready,null,{polling:100});
  if(scenario==='unknown-iframe'){await p.waitForFunction(()=>window[Symbol.for('halo-butterfly-next.addtoany')]?.ready,null,{polling:100});await p.evaluate(()=>{const frame=document.createElement('iframe');frame.src='about:blank';document.body.append(frame)})}
  await p.evaluate(()=>{window.fallbackSentinel=true;const a=document.createElement('a');a.href='/archives/';document.body.append(a);a.click()});
  if(scenario==='late-iframe'){await pendingRequest;await p.evaluate(()=>{const frame=document.createElement('iframe');frame.src='about:blank';document.body.append(frame)});release();}
  await p.waitForFunction(()=>location.pathname==='/archives/'&&!!window.MainApp?.useCommon,null,{polling:100});
  assert.equal(await p.evaluate(()=>window.fallbackSentinel),undefined);
  await p.waitForTimeout(1200);assert.equal(await p.locator('#a2a_menu_container').count(),0,'A late old document SDK cannot mount on the native target');
  report.results.push({engine,scenario,result:'passed'});await save();await context.close();console.log('PASS',engine,scenario);
 }
 await browser.close();browser=null;
}}catch(error){report.failure=error.stack;throw error}finally{await browser?.close();await save()}
