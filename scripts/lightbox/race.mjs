/** Actual theme adapter, deterministic native-load event ordering; never contacts Halo. */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'vite';
import {REPO, RUNTIME, browserEnvironment, sha256} from '../browser/support.mjs';

const args=process.argv.slice(2),expect=args[0],output=path.resolve(args[1]||'');
assert(['baseline','clean'].includes(expect),'Usage: bun scripts/lightbox/race.mjs baseline|clean .runtime/viewer-race-20261017/<new-run>');
const allowed=path.join(REPO,'.runtime/viewer-race-20261017');
assert(output.startsWith(allowed+path.sep),'Output must be a new child of the owned race runtime');
await mkdir(path.dirname(output),{recursive:true});assert.equal(await realpath(path.dirname(output)),path.dirname(output));
await mkdir(output);
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const source=path.join(REPO,'src/js/modules/AmplifyImg.ts');
const lifecycle=path.join(REPO,'src/js/core/page-lifecycle.ts');
const entry=path.join(output,'entry.js');
await writeFile(entry,`import AmplifyImg from ${JSON.stringify(source)};import {beginPage,pageScope} from ${JSON.stringify(lifecycle)};window.race={initialize:()=>new AmplifyImg(),beginPage,pageScope};window.race.initialize();`);
const built=await build({configFile:false,logLevel:'error',build:{write:false,target:'es2022',lib:{entry,name:'ActualThemeLightboxRace',formats:['iife']}}});
const bundle=(Array.isArray(built)?built[0]:built).output.find(x=>x.type==='chunk').code;
await writeFile(path.join(output,'bundle.js'),bundle);
await writeFile(path.join(output,'runner.mjs'),await readFile(fileURLToPath(import.meta.url)));
const base='http://theme-lightbox-race.invalid';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#367"/></svg>';
const html='<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>Actual adapter race</title><style>body{margin:0}.content img{width:160px;height:110px}.theme-lightbox-trigger{display:inline-block}</style></head><body><button id="outside">outside</button><div id="was-inert" inert>already inert</div><main class="main"><section class="content"><img id="one" src="/thumb.svg" data-lazy-src="/full-one.svg" data-lightbox-group="one" alt="one"><img id="two" src="/thumb.svg" data-lazy-src="/full-two.svg" data-lightbox-group="two" alt="two"></section></main><script src="/bundle.js"></script></body></html>';
const report={schema:1,expect,kind:'actual-compiled-theme-native-load-race',startedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:REPO,encoding:'utf8'}).trim(),runnerSha256:sha256(await readFile(fileURLToPath(import.meta.url))),bundleSha256:sha256(bundle),sources:{},limits:{actionMs:10000,caseMs:30000,closeMs:10000},cases:[],limitations:[
 'Synthetic local event ordering, not a recovered stack or causal proof for the earlier Halo navigation failure.',
 'A genuine native image load is held until the real adapter has opened. A document capture listener then dispatches a synthetic Escape key or calls the real exported beginPage before Viewer handles that same load.',
 'The normal path and reopened image close via Playwright keyboard input. No fake load, complete getter, vendor method override, product patch, dependency change or global exception suppression.',
 'The additional Chromium original-image404 case expects a local 404 and no viewed event; the adapter does not preserve a separate thumbnail fallback URL. It must still close and reopen another valid image without pageerror.',
 'All HTTP is intercepted and fulfilled locally; no server, Halo, user browser, external service, real device or full accessibility claim.'
]};
for(const file of ['src/js/modules/AmplifyImg.ts','src/js/core/page-lifecycle.ts','src/js/core/i18n.ts','node_modules/viewerjs/dist/viewer.esm.js','node_modules/viewerjs/dist/viewer.css','package.json','bun.lock']){const bytes=await readFile(path.join(REPO,file));report.sources[file]=sha256(bytes);await writeFile(path.join(output,file.replaceAll('/','__')),bytes);}
const save=()=>writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const bounded=async(fn,ms,label)=>{let t;try{return await Promise.race([fn(),new Promise((_,reject)=>{t=setTimeout(()=>reject(Error(label+' exceeded '+ms+'ms')),ms);})]);}finally{clearTimeout(t);}};
const emptyGate=()=>{let release;return {promise:new Promise(r=>{release=r;}),release:()=>release()};};
const snapshot=page=>page.evaluate(()=>{
 const scope=window.race.pageScope();return {hosts:document.querySelectorAll('.theme-lightbox').length,dialogs:document.querySelectorAll('.viewer-container').length,styles:document.querySelectorAll('style[data-theme-lightbox]').length,outsideInert:document.querySelector('#outside').inert,priorInert:document.querySelector('#was-inert').inert,focusImage:document.activeElement?.matches('.theme-lightbox-trigger')?document.activeElement.querySelector('img')?.id||null:null,activeElement:{tag:document.activeElement?.tagName,className:document.activeElement?.className},scopeActive:scope.active,scopeCleanups:scope.cleanups.size,oldScopeActive:window.raceObservation.oldScope?.active,oldScopeCleanups:window.raceObservation.oldScope?.cleanups.size,events:window.raceObservation.events,viewed:window.raceObservation.viewed};
});
let browser;
await save();
try{
 for(const engine of ['chromium','firefox','webkit']){
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  for(const id of [...['capture-escape','capture-page-cleanup','normal-viewed'],...(engine==='chromium'?['original-404']:[])]){
   let context,page;const gates={'/full-one.svg':emptyGate(),'/full-two.svg':emptyGate()};
   const row={engine,version:browser.version(),id,requests:[],pageErrors:[],consoleErrors:[],harnessResult:'running',productResult:'unknown'};report.cases.push(row);await save();
   try{
    await bounded(async()=>{
     context=await browser.newContext({viewport:{width:390,height:844}});
     await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());const rec={url:req.url(),method:req.method()};row.requests.push(rec);
      if(url.origin!==base||req.method()!=='GET'||!['/','/bundle.js','/thumb.svg','/full-one.svg','/full-two.svg'].includes(url.pathname)){rec.blocked=true;await route.abort();return;}
      if(gates[url.pathname])await gates[url.pathname].promise;
      const body=url.pathname==='/'?html:url.pathname==='/bundle.js'?bundle:svg;
      const status=id==='original-404'&&url.pathname==='/full-one.svg'?404:200;rec.status=status;
      try{await route.fulfill({status,contentType:status===404?'text/plain':url.pathname==='/'?'text/html':url.pathname==='/bundle.js'?'text/javascript':'image/svg+xml',body:status===404?'Not Found':body});rec.fulfilled=true;}catch(error){rec.fulfillError=String(error);}
     });
     await context.addInitScript(scenario=>{
      const state=window.raceObservation={events:[],viewed:[],closedAtCapture:false,oldScope:null,errorLoads:[]};
      document.addEventListener('error',event=>{const image=event.target;if(image instanceof HTMLImageElement&&image.matches('.theme-lightbox .viewer-canvas > img'))state.errorLoads.push({trusted:event.isTrusted,complete:image.complete,naturalWidth:image.naturalWidth,src:image.src});},true);
      document.addEventListener('load',event=>{
       const image=event.target;
       if(!(image instanceof HTMLImageElement)||!image.matches('.theme-lightbox .viewer-canvas > img'))return;
       state.events.push({type:'native-canvas-load-capture',trusted:event.isTrusted,complete:image.complete,naturalWidth:image.naturalWidth,src:image.src});
       if(!['capture-escape','capture-page-cleanup'].includes(scenario)||state.closedAtCapture)return;
       state.closedAtCapture=true;state.oldScope=window.race.pageScope();
       if(scenario==='capture-page-cleanup')window.race.beginPage();
       else document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true}));
       state.events.push({type:'capture-close-returned',hosts:document.querySelectorAll('.theme-lightbox').length});
      },true);
     },id);
     page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(10000);
     page.on('pageerror',error=>row.pageErrors.push({message:error.message,stack:error.stack}));
     page.on('console',m=>{if(m.type()==='error'||m.type()==='debug')row.consoleErrors.push({type:m.type(),text:m.text()});});
     await page.goto(base,{waitUntil:'load'});
     await page.waitForFunction(()=>document.querySelector('#one').complete&&document.querySelector('#two').complete);
     row.initial=await snapshot(page);assert.equal(row.initial.styles,1);assert.equal(row.initial.hosts,0);assert(row.initial.scopeActive);
     const open=async(image)=>{
      const trigger=page.locator('#'+image).locator('..');await trigger.focus();await page.keyboard.press('Enter');
      await page.locator('.theme-lightbox .viewer-container').waitFor({state:'visible'});
      await page.evaluate(()=>{
       const adapter=document[Symbol.for('halo-butterfly-next.lightbox')];
       // Read the public Viewer event target; do not call or replace a Viewer method.
       adapter.viewer.element.addEventListener('viewed',event=>window.raceObservation.viewed.push({src:event.detail.image.src,complete:event.detail.image.complete,naturalWidth:event.detail.image.naturalWidth}),{once:true});
      });
      const opened=await snapshot(page);assert.equal(opened.hosts,1);assert.equal(opened.dialogs,1);assert(opened.outsideInert&&opened.priorInert);return opened;
     };
     row.firstOpened=await open('one');gates['/full-one.svg'].release();
     if(id==='normal-viewed'){
      await page.waitForFunction(()=>window.raceObservation.viewed.length===1);
      row.firstViewed=await snapshot(page);await page.keyboard.press('Escape');
     }else if(id==='original-404'){
      await page.waitForFunction(()=>window.raceObservation.errorLoads.length===1);
      row.expectedImageFailure=await page.evaluate(()=>({errors:window.raceObservation.errorLoads,viewed:window.raceObservation.viewed,src:document.querySelector('.viewer-canvas > img').src}));
      assert.equal(row.expectedImageFailure.viewed.length,0);assert(row.expectedImageFailure.errors[0].trusted&&row.expectedImageFailure.errors[0].complete);assert.equal(row.expectedImageFailure.errors[0].naturalWidth,0);assert.equal(row.expectedImageFailure.src,base+'/full-one.svg');await page.keyboard.press('Escape');
     }else await page.waitForFunction(()=>window.raceObservation.closedAtCapture);
     await page.locator('.theme-lightbox').waitFor({state:'detached'});
     // A next animation frame observes the completed native event dispatch, including pageerror delivery.
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));
     row.afterFirstClose=await snapshot(page);
     assert.equal(row.afterFirstClose.hosts,0);assert.equal(row.afterFirstClose.dialogs,0);assert.equal(row.afterFirstClose.outsideInert,false);assert(row.afterFirstClose.priorInert);assert.equal(row.afterFirstClose.focusImage,'one');
     if(id==='capture-page-cleanup'){
      assert.equal(row.afterFirstClose.styles,0);assert.equal(row.afterFirstClose.oldScopeActive,false);assert.equal(row.afterFirstClose.oldScopeCleanups,0);assert.equal(row.afterFirstClose.scopeCleanups,0);
      await page.evaluate(()=>window.race.initialize());
     }else assert.equal(row.afterFirstClose.styles,1);
     if(['capture-escape','capture-page-cleanup'].includes(id)){
      const event=row.afterFirstClose.events.find(e=>e.type==='native-canvas-load-capture');assert(event?.trusted&&event.complete&&event.naturalWidth>0);
      assert.equal(row.afterFirstClose.viewed.length,0,'Early close must precede viewed');
     }
     const firstErrors=row.pageErrors.length;
     row.reopened=await open('two');gates['/full-two.svg'].release();
     await page.waitForFunction(()=>window.raceObservation.viewed.some(e=>e.src.endsWith('/full-two.svg')));
     row.reopenedViewed=await snapshot(page);assert.equal(row.reopenedViewed.styles,1);assert.equal(row.reopenedViewed.hosts,1);
     await page.keyboard.press('Escape');await page.locator('.theme-lightbox').waitFor({state:'detached'});
     row.afterReopenClose=await snapshot(page);assert.equal(row.afterReopenClose.focusImage,'two');assert.equal(row.afterReopenClose.outsideInert,false);assert(row.afterReopenClose.priorInert);
     assert.equal(row.pageErrors.length,firstErrors,'Reopening a different image must not add errors');
     await page.evaluate(()=>{window.raceObservation.oldScope=window.race.pageScope();window.race.beginPage();});
     row.final=await snapshot(page);assert.equal(row.final.hosts,0);assert.equal(row.final.styles,0);assert.equal(row.final.oldScopeActive,false);assert.equal(row.final.oldScopeCleanups,0);assert.equal(row.final.scopeCleanups,0);assert.equal(row.final.outsideInert,false);assert(row.final.priorInert);
     assert(!row.requests.some(r=>r.blocked));
     if(id==='original-404'){assert(row.requests.some(r=>r.status===404));assert(row.consoleErrors.every(e=>e.type==='error'&&/404/.test(e.text)));}
     else assert.deepEqual(row.consoleErrors,[]);
     const early=['capture-escape','capture-page-cleanup'].includes(id);
     row.productResult=row.pageErrors.length?'failed':'passed';
     if(expect==='baseline'&&early){assert.equal(row.pageErrors.length,1);assert.match(row.pageErrors[0].message,/null.*style|style.*null/i);assert(row.pageErrors[0].stack.includes('/bundle.js'));row.harnessResult='expected-baseline-failure-captured';}
     else{assert.deepEqual(row.pageErrors,[]);row.harnessResult='passed';}
    },30000,'Fixed '+engine+'/'+id+' case');
   }catch(error){row.harnessResult='failed';row.error=String(error.stack||error);}
   finally{
    Object.values(gates).forEach(g=>g.release());
    if(page)row.lastObservation=await bounded(()=>snapshot(page),1000,'Last observation').catch(error=>({error:String(error)}));
    if(context)await bounded(()=>context.close(),10000,'Context close').catch(error=>{row.harnessResult='failed';row.closeError=String(error);});
    await save();
   }
  }
  await bounded(()=>browser.close(),10000,'Browser close');browser=null;
 }
}finally{
 if(browser)await bounded(()=>browser.close(),10000,'Final browser close').catch(error=>{report.closeError=String(error);});
 report.finishedAt=new Date().toISOString();report.productFailures=report.cases.filter(c=>c.productResult==='failed').length;
 report.result=report.cases.length===10&&report.cases.every(c=>['passed','expected-baseline-failure-captured'].includes(c.harnessResult))&&!report.closeError?(expect==='baseline'?'baseline-captured':'passed'):'harness-or-expectation-failed';
 await save();console.log(JSON.stringify({output,result:report.result,productFailures:report.productFailures,cases:report.cases.map(c=>({engine:c.engine,id:c.id,result:c.harnessResult,error:c.error}))}));
 if(report.result==='harness-or-expectation-failed')process.exitCode=1;
}
