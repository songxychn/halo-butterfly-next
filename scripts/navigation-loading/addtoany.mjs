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
const files=[['/menu/page.js','/tmp/pjax-addtoany.js','46bfe099d913a7ecb4bc106e638d734abc31ba0f9a5bfc2f55b0636978cc9ff6'],['/menu/modules/core.iho16r34.js','/tmp/pjax-addtoany-core.js','44fd58c7f24a00b6f1293debb9b0713d3808bd031886d76515c139ec956bb5e2'],['/menu/sm.25.html','/tmp/pjax-addtoany-utility.html',null]];
const sdk=new Map();for(const [url,file,digest] of files){const body=await readFile(file);if(digest)assert.equal(sha256(body),digest);sdk.set(url,body)}
const output=path.join(REPO,'.runtime/navigation-loading');await mkdir(output,{recursive:true});
const report={theme:installed,results:[],sdk:files.map(([url,,digest])=>({url,digest})),limitations:['Official pinned SDK executed with all outbound sharing and service traffic intercepted. Physical browsers/devices not covered.']};
let browser;const save=()=>writeFile(path.join(output,'addtoany.json'),JSON.stringify(report,null,2)+'\n');
try{for(const engine of (process.env.ENGINES||'chromium,firefox,webkit').split(',')){
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
 for(const width of [1440,390])for(const mode of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'zh-CN'});
  await context.addInitScript(mode=>{localStorage.setItem('halo-butterfly-next.color-scheme',mode);window.open=(url)=>{window.shareDestination=String(url);return null}},mode);
  const requests=[],errors=[];
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base)return route.continue();requests.push(url.href);if(url.origin==='https://static.addtoany.com'&&sdk.has(url.pathname))return route.fulfill({contentType:url.pathname.endsWith('.html')?'text/html':'application/javascript',headers:{'access-control-allow-origin':'*'},body:sdk.get(url.pathname)});return route.abort()});
  const p=await context.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/archives/preview-1/',{waitUntil:'domcontentloaded'});
  try{await p.waitForFunction(()=>window[Symbol.for('halo-butterfly-next.addtoany')]?.ready)}catch(e){report.diagnostic=await p.evaluate(()=>({scripts:[...document.scripts].map(s=>s.src),styles:[...document.head.querySelectorAll('style')].map(s=>s.textContent.slice(0,70)),ready:window[Symbol.for('halo-butterfly-next.addtoany')]?.ready,main:window.a2a?.main?.outerHTML.slice(0,300)}));report.errors=errors;throw e}
  await p.evaluate(()=>{window.addToAnySentinel='keep';window.addToAnyOriginalBody=document.body;window.addToAnyOriginalFrame=document.getElementById('a2a_sm_ifr');window.addToAnyFrameWindow=window.addToAnyOriginalFrame.contentWindow;window.addToAnyOriginalKit=document.querySelector('[data-share-provider]');window.addToAnyIndex=window.addToAnyOriginalKit.a2a_index;window.addToAnyDetached=false;new MutationObserver(()=>{if(!window.addToAnyOriginalFrame.isConnected)window.addToAnyDetached=true}).observe(document,{childList:true,subtree:true})});
  const visit=async route=>{report.beforeVisit=await p.evaluate(()=>({scripts:[...document.scripts].map(s=>({src:s.src,kind:s.dataset.themeScript})),iframes:[...document.querySelectorAll('iframe')].map(x=>x.src),menus:[...document.querySelectorAll('.a2a_menu,#a2a_modal,#a2a_overlay')].map(e=>({id:e.id,display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility})),ready:window[Symbol.for('halo-butterfly-next.addtoany')]?.ready,no:[...document.querySelectorAll('[data-no-pjax]')].map(e=>e.outerHTML.slice(0,200))}));await save();await p.evaluate(route=>{const a=document.createElement('a');a.href=route;document.body.append(a);a.click();a.remove()},route);await p.waitForFunction(route=>location.pathname===route&&!document.documentElement.classList.contains('theme-navigating')&&!!MainApp.useCommon,route,{polling:100});assert.equal(await p.evaluate(()=>window.addToAnySentinel),'keep');};
  for(let i=0;i<4;i++){
   if(i)await visit('/archives/preview-'+(i%2+1)+'/');
   await p.locator('.a2a_button_facebook').click();
   const identity=await p.evaluate(()=>({destination:window.shareDestination,url:document.querySelector('[data-post-share]').dataset.url,title:document.querySelector('[data-post-share]').dataset.title,kitSame:window.addToAnyOriginalKit===document.querySelector('[data-share-provider]'),indexSame:window.addToAnyIndex===window.addToAnyOriginalKit.a2a_index}));
   assert(identity.destination.includes(encodeURIComponent(identity.url)),JSON.stringify(identity));assert(identity.destination.includes(encodeURIComponent(identity.title)),JSON.stringify(identity));assert(identity.kitSame&&identity.indexSame);
   await p.locator('.a2a_button_copy_link').click();await p.waitForSelector('#a2a_copy_link_text',{state:'visible'});assert.equal(await p.locator('#a2a_copy_link_text').inputValue(),identity.url);await p.waitForFunction(()=>getComputedStyle(document.getElementById('a2a_modal')).opacity==='1'&&!document.getElementById('a2a_modal').classList.contains('a2a_starting'));await p.waitForTimeout(180);await p.locator('#a2a_copy_link_text').press('Escape');await p.waitForSelector('#a2a_copy_link_text',{state:'hidden'});
   await visit('/archives/');
   assert(await p.evaluate(()=>document.body===window.addToAnyOriginalBody&&window.addToAnyOriginalFrame.isConnected&&window.addToAnyOriginalFrame.contentWindow===window.addToAnyFrameWindow&&!window.addToAnyDetached));
  }
  assert.equal(requests.filter(url=>url.endsWith('/menu/page.js')).length,1);assert.equal(requests.filter(url=>url.endsWith('/menu/modules/core.iho16r34.js')).length,1);assert.equal(requests.filter(url=>url.includes('/menu/sm.25.html')).length,1);
  assert.deepEqual(errors,[]);report.results.push({engine,width,mode,cycles:4,result:'passed'});await save();console.log('PASS',engine,width,mode);await context.close();
 }
 await browser.close();browser=null;
}}catch(error){report.failure=error.stack;throw error}finally{await browser?.close();await save()}
