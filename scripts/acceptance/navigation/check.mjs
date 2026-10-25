/** Current installed product: plugin-disabled core PJAX, actual fixture anchors. */
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl,sha256} from '../../browser/support.mjs';
const file=await realpath(process.argv[2]);
assert(file.startsWith(path.join(REPO,'.runtime')+path.sep));
const fixture=JSON.parse(await readFile(file));
assert.equal(fixture.owner,'navigation-followup-owner');assert.match(fixture.runId,/^[0-9a-f]{20}$/);
const diagnostic=fixture.profile==='chromium-diagnostic';
assert(['three-engines','chromium-diagnostic','history-matrix','history-webkit-followup'].includes(fixture.profile));
const engines=fixture.profile==='history-webkit-followup'?['webkit']:(diagnostic?['chromium']:['chromium','firefox','webkit']);
const historyMatrix=['history-matrix','history-webkit-followup'].includes(fixture.profile);
const variants=fixture.profile==='history-webkit-followup'?[{width:390,color:'dark'},{width:1440,color:'light'}]:historyMatrix?[{width:390,color:'light'},{width:390,color:'dark'},{width:1440,color:'light'},{width:1440,color:'dark'}]:[{width:390,color:'light'}];
const expectedCases=engines.length*variants.length;
assert.deepEqual(fixture.engines,engines);assert.equal(fixture.expectedCases,expectedCases);assert.deepEqual(fixture.posts.map(p=>p.label),['a','b','excluded']);
const output=path.dirname(file),runtime=await realpath(fixture.runtime);
assert.equal(await readFile(path.join(runtime,'acceptance-navigations.lock'),'utf8'),fixture.runId);
const base=validateBaseUrl(fixture.base,JSON.parse(await readFile(path.join(runtime,'lab.json'))));
assert.deepEqual(JSON.parse(await readFile(path.join(runtime,'installed-package.json'))),fixture.installed);
const state=JSON.parse(await readFile(path.join(runtime,'halo-process.json')));
assert(execFileSync('ps',['-p',String(state.pid),'-o','command='],{encoding:'utf8'}).includes(path.join(runtime,'halo',fixture.haloJar)));
for(const post of fixture.posts)assert.equal(new URL(post.path,base).origin,base);
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const report={schema:1,runId:fixture.runId,startedAt:new Date().toISOString(),runnerSha256:sha256(await readFile(new URL(import.meta.url))),fixtureSha256:sha256(await readFile(file)),installed:fixture.installed,configuration:'all-installed-plugins-disabled-core',profile:fixture.profile,expectedCases,cases:[],limitations:['Fixed mobile/light headless profile only; official-plugin native fallback retains its separate existing evidence.','No script/resource stripping, product-code injection, navigation retry or connection workaround. All link clicks target actual API-saved fixture anchors.','Counter evidence counts actual per-navigation POST requests and HTTP status, not database counter balances.','No official comment draft, plugin lifecycle, physical Safari/device, performance or full contract claim.']};
const save=()=>writeFile(path.join(output,'browser-report.json'),JSON.stringify(report,null,2)+'\n');
const close=async(target)=>{let timer;try{await Promise.race([target.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Close exceeded 10s')),10000);})]);}finally{clearTimeout(timer);}};
await save();
for(const engine of engines)for(const variant of variants){
 let browser,context;
 const row={engine,...variant,status:'running',stages:[],navigations:[],requests:[],pageErrors:[],consoleErrors:[]};
 report.cases.push(row);await save();
 try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});row.version=browser.version();
  context=await browser.newContext({viewport:{width:variant.width,height:844},locale:'en',colorScheme:variant.color});
  await context.addInitScript(color=>localStorage.setItem('halo-butterfly-next.color-scheme',color),variant.color);
  if(diagnostic){
   row.timeline=[];row.pageErrorDetails=[];
   await context.exposeBinding('__navigationObservation',(_source,event)=>row.timeline.push({...event,receivedAt:new Date().toISOString(),stage:row.stage}));
   await context.addInitScript(()=>{
    const emit=(event,details={})=>window.__navigationObservation({event,at:new Date().toISOString(),performanceNow:performance.now(),url:location.href,...details}).catch(()=>{});
    for(const event of ['pjax:send','halo-butterfly-next:before-replace','pjax:complete','pjax:error'])document.addEventListener(event,()=>emit(event));
    window.addEventListener('error',event=>emit('window-error',{message:event.message,stack:event.error?.stack??null,filename:event.filename,line:event.lineno,column:event.colno}));
    let host=null;
    new MutationObserver(()=>{const current=document.querySelector('.theme-lightbox');if(current!==host){emit(current?'lightbox-host-added':'lightbox-host-removed');host=current;}}).observe(document,{childList:true,subtree:true});
   });
  }
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const observe=event=>{if(diagnostic)row.timeline.push({event,at:new Date().toISOString(),url:page.url(),stage:row.stage});};
  const requests=new Map();let nextId=0;
  page.on('request',r=>{const item={id:++nextId,url:r.url(),method:r.method(),resourceType:r.resourceType(),isMainFrameNavigation:r.isNavigationRequest()&&r.frame()===page.mainFrame(),stage:row.stage,state:'pending'};if(r.method()==='POST'&&new URL(r.url()).pathname==='/apis/api.halo.run/v1alpha1/trackers/counter')item.counterPayload=r.postDataJSON();requests.set(r,item);row.requests.push(item);});
  page.on('response',r=>{const item=requests.get(r.request());if(item)item.httpStatus=r.status();});
  page.on('requestfinished',r=>{const item=requests.get(r);if(item)item.state='finished';});
  page.on('requestfailed',r=>{const item=requests.get(r);if(item){item.state='failed';item.failure=r.failure()?.errorText;}});
  page.on('pageerror',e=>{row.pageErrors.push(e.message);if(diagnostic)row.pageErrorDetails.push({message:e.message,stack:e.stack,url:page.url(),stage:row.stage,at:new Date().toISOString()});});
  page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text().slice(0,2000));});
  const ready=async(post)=>{
   await page.waitForFunction(path=>location.pathname===path&&!document.documentElement.classList.contains('theme-navigating')&&!!window.MainApp?.useCommon,post.path,{timeout:30000,polling:100});
   assert.equal(await page.locator('html').getAttribute('data-color-scheme'),variant.color);
   assert.equal(await page.locator('article.render > h2').textContent(),post.title);
   assert((await page.title()).includes(post.title));
   assert.equal(new URL(await page.locator('link[rel=canonical]').getAttribute('href'),base).pathname,post.path);
   await page.locator('article.render .code-toolbar').waitFor();
   assert.equal(await page.locator('article.render .code-toolbar').count(),1);
   assert.equal(await page.locator('article.render .code-toolbar .toolbar').count(),1);
   assert.equal(await page.locator('.theme-lightbox-trigger .theme-lightbox-trigger').count(),0);
   assert.equal(await page.locator('comment-widget').count(),0);
   await page.waitForFunction(()=>document.querySelector('#navigation-image')?.naturalWidth>0);
   const trigger=page.locator('#navigation-image').locator('..');
   assert.equal(await trigger.getAttribute('role'),'button');
   await trigger.focus();observe('lightbox-enter-key');await page.keyboard.press('Enter');
   await page.locator('.theme-lightbox .viewer-container').waitFor({state:'visible'});observe('lightbox-visible');
   assert.equal(await page.locator('.theme-lightbox .viewer-container').count(),1);
   assert.equal(await page.locator('.viewer-canvas > img').getAttribute('src'),base+'/lab/avatar.svg');
   observe('lightbox-escape-key');await page.keyboard.press('Escape');await page.locator('.theme-lightbox').waitFor({state:'detached'});observe('lightbox-detached');
   assert(await trigger.evaluate(n=>n===document.activeElement));
   const until=Date.now()+5000;
   while(row.requests.some(r=>r.state==='pending')&&Date.now()<until)await page.waitForTimeout(100);
   assert.deepEqual(row.requests.filter(r=>r.state==='pending'||r.state==='failed'||r.httpStatus>=400),[]);
   assert(row.requests.every(r=>new URL(r.url).origin===base),'Every recorded request must stay on the owned origin');
   assert.deepEqual(row.pageErrors,[]);assert.deepEqual(row.consoleErrors,[]);
  };
  const counter=async(post,start)=>{
   const counters=row.requests.slice(start).filter(r=>r.counterPayload);
   assert.equal(counters.length,1,'Exactly one observed counter request per committed content navigation');
   assert.equal(counters[0].httpStatus,200);assert.equal(counters[0].state,'finished');
   assert.deepEqual([counters[0].counterPayload.group,counters[0].counterPayload.plural,counters[0].counterPayload.name,counters[0].counterPayload.url],['content.halo.run','posts',post.name,post.path]);
   return counters[0].id;
  };
  const checkpoint=async(post,start)=>{await ready(post);const counterRequestId=await counter(post,start);row.stages.push({name:row.stage,url:page.url(),counterRequestId});await save();};
  const transition=async(post,action,mode='pjax')=>{
   const start=row.requests.length;row.stage=action+'-'+post.label;observe('navigation-action-start');
   await page.evaluate(run=>{window.navigationSentinel=run;window.previousNavigationNode=document.querySelector('article.render');window.previousNavigationScope=window[Symbol.for('halo-butterfly-next.page-scope')];},fixture.runId);
   let expectedScroll=null;
   if(historyMatrix){
    const currentLabel=fixture.posts.find(p=>p.path===new URL(page.url()).pathname).label;
    const y=currentLabel==='a'?850:1250;
    await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);
    await page.waitForFunction(y=>Math.abs(scrollY-y)<=2,y,{polling:100});
    // Let the native scroll event persist the source history entry before traversal.
    await page.waitForFunction(y=>Object.values(history.state||{}).some(v=>v&&typeof v==='object'&&Math.abs(v.y-y)<=2),y,{polling:100});
    expectedScroll=['back','forward'].includes(action)?(post.label==='a'?850:1250):0;
   }
   if(action==='back')await page.goBack({waitUntil:'domcontentloaded',timeout:30000});
   else if(action==='forward')await page.goForward({waitUntil:'domcontentloaded',timeout:30000});
   else if(historyMatrix){await page.locator('article.render #navigation-'+post.label).evaluate(e=>e.focus({preventScroll:true}));await page.keyboard.press('Enter');}
   else await page.locator('article.render #navigation-'+post.label).click();
   if(historyMatrix&&mode==='pjax'){
    await page.waitForFunction(path=>location.pathname===path&&!document.documentElement.classList.contains('theme-navigating'),post.path,{timeout:30000,polling:100});
    await page.waitForFunction(y=>Math.abs(scrollY-y)<=2,expectedScroll,{polling:100});
    (row.scrollChecks??=[]).push({action,target:post.path,expected:expectedScroll,actual:await page.evaluate(()=>scrollY)});
   }
   await checkpoint(post,start);
   const observed=await page.evaluate(()=>({sentinel:window.navigationSentinel,oldConnected:window.previousNavigationNode?.isConnected,oldScopeActive:window.previousNavigationScope?.active,oldCleanupCount:window.previousNavigationScope?.cleanups.size}));
   const targetRequests=row.requests.slice(start).filter(r=>r.url===base+post.path&&r.method==='GET');
   assert.equal(targetRequests.length,1,'Exactly one target page fetch/document request');
   assert.equal(targetRequests[0].httpStatus,200);
   if(mode==='pjax'){
    assert.equal(observed.sentinel,fixture.runId,'Expected same document PJAX');
    assert.equal(observed.oldConnected,false);assert.equal(observed.oldScopeActive,false);assert.equal(observed.oldCleanupCount,0);
    assert.equal(targetRequests[0].resourceType,'fetch');assert.equal(targetRequests[0].isMainFrameNavigation,false);
    assert.equal(row.requests.slice(start).filter(r=>r.isMainFrameNavigation).length,0);
   }else{
    assert.equal(observed.sentinel,undefined,'Excluded target must load native document');
    assert.equal(targetRequests[0].isMainFrameNavigation,true);assert.equal(targetRequests[0].resourceType,'document');
   }
   row.navigations.push({action,target:post.path,mode,pageRequestId:targetRequests[0].id,observed});await save();
  };
  row.stage='initial-a';
  const response=await page.goto(base+fixture.posts[0].path,{waitUntil:'networkidle',timeout:20000});assert.equal(response.status(),200);
  await checkpoint(fixture.posts[0],0);
  row.initialScripts=await page.locator('script').evaluateAll(nodes=>nodes.map(n=>({src:n.src,type:n.type,themeScript:n.dataset.themeScript||null})));
  for(let cycle=1;cycle<=5;cycle++){
   await transition(fixture.posts[1],'cycle'+cycle);
   await transition(fixture.posts[0],'cycle'+cycle);
  }
  await transition(fixture.posts[1],'back');await transition(fixture.posts[0],'forward');
  await transition(fixture.posts[2],'exclude','native');
  assert.equal(row.navigations.length,13);assert.equal(row.stages.length,14);
  row.status='passed';
 }catch(error){row.status='failed';row.error=String(error.stack||error);if(context){row.documentAtFailure=await context.pages()[0]?.evaluate(()=>({url:location.href,classes:document.documentElement.className,y:scrollY,history:history.state,ready:document.readyState,initialized:!!window.MainApp?.useCommon})).catch(()=>null);}row.pendingAtFailure=row.requests.filter(r=>r.state==='pending').map(r=>({...r}));}
 finally{
  row.requestsBeforeClose=row.requests.map(r=>({...r}));await save();
  for(const target of [context,browser])if(target){try{await close(target);}catch(error){row.status='failed';(row.closeErrors??=[]).push(String(error));}}
  await save();console.log(engine,row.status,row.error||'');
 }
}
report.finishedAt=new Date().toISOString();report.status=report.cases.length===expectedCases&&report.cases.every(r=>r.status==='passed')?'passed-tested-scope':'failed';await save();process.exitCode=report.status==='failed'?1:0;
