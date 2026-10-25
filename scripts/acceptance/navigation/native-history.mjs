/** Native history under retained official plugin scripts; observes bfcache explicitly. */
import assert from 'node:assert/strict';
import {assertCleanNavigation, closeNavigationCase} from './finalize.mjs';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl,sha256} from '../../browser/support.mjs';
const file=await realpath(process.argv[2]);assert(file.startsWith(path.join(REPO,'.runtime')+path.sep));
const fixture=JSON.parse(await readFile(file)),output=path.dirname(file),runtime=await realpath(fixture.runtime);
assert(['official-history','official-history-webkit','official-history-webkit-diagnostic'].includes(fixture.profile));
const diagnostic=fixture.profile==='official-history-webkit-diagnostic';
const engines=fixture.profile==='official-history'?['chromium','firefox','webkit']:['webkit'];
const widths=diagnostic?[390]:[390,1440],colors=diagnostic?['light']:['light','dark'];
const expectedCases=engines.length*widths.length*colors.length;assert.equal(fixture.expectedCases,expectedCases);
assert.equal(await readFile(path.join(runtime,'acceptance-navigations.lock'),'utf8'),fixture.runId);
assert.deepEqual(JSON.parse(await readFile(path.join(runtime,'installed-package.json'))),fixture.installed);
const base=validateBaseUrl(fixture.base,JSON.parse(await readFile(path.join(runtime,'lab.json'))));
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const report={runId:fixture.runId,runnerSha256:sha256(await readFile(new URL(import.meta.url))),fixtureSha256:sha256(await readFile(file)),profile:fixture.profile,expectedCases,cases:[],status:'running',limitations:['Anonymous headless native history with official plugin scripts; not real devices or all plugin interactions.','Only actual saved anchors, native Back/Forward and real scroll; bfcache requires observed pageshow.persisted plus a previously recorded document identity.','No network-error exemption or automatic retry. No database-counter balance claim.']};
const reading=()=>({anchor:[...document.querySelectorAll('article.render p')].filter(e=>e.getBoundingClientRect().bottom>100).map(e=>({text:e.textContent,top:e.getBoundingClientRect().top}))[0],preHeight:document.querySelector('pre')?.getBoundingClientRect().height,toolbar:!!document.querySelector('.code-toolbar'),fonts:document.fonts.status,height:document.documentElement.scrollHeight});
const save=()=>writeFile(path.join(output,'browser-report.json'),JSON.stringify(report,null,2)+'\n');
const close=async target=>{let timer;try{await Promise.race([target.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Close timeout')),10000);})]);}finally{clearTimeout(timer);}};
await save();
for(const engine of engines)for(const width of widths)for(const color of colors){
 const row={engine,width,color,status:'running',requests:[],pageErrors:[],consoleErrors:[],checkpoints:[],navigations:[]};report.cases.push(row);await save();
 let browser,context;
 try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});row.version=browser.version();
  context=await browser.newContext({viewport:{width,height:844},colorScheme:color,locale:'en'});
  row.departures=[];
  await context.exposeBinding('__nativeHistoryDeparture',(_source,event)=>row.departures.push(event));
  await context.addInitScript(color=>{addEventListener('pagehide',event=>window.__nativeHistoryDeparture({url:location.href,y:scrollY,persisted:event.persisted,active:document.activeElement?.outerHTML?.slice(0,500),at:Date.now()}).catch(()=>{}));localStorage.setItem('halo-butterfly-next.color-scheme',color);window.__nativeHistoryObservation={id:crypto.randomUUID(),shows:[]};addEventListener('pageshow',e=>window.__nativeHistoryObservation.shows.push({persisted:e.persisted,at:Date.now()}));},color);
  if(diagnostic)await context.addInitScript(()=>{
   window.__layoutTimeline=[];const record=event=>{if(window.__layoutTimeline.length>=150)return;const pre=document.querySelector('pre');window.__layoutTimeline.push({event,ms:performance.now(),y:scrollY,height:document.documentElement?.scrollHeight,pre:pre?.getBoundingClientRect().height,toolbar:!!document.querySelector('.code-toolbar'),fonts:document.fonts?.status,history:history.state});};
   for(const event of ['scroll','DOMContentLoaded','load','pageshow','halo-butterfly-next:page-ready'])addEventListener(event,()=>record(event));
   addEventListener('DOMContentLoaded',()=>{document.fonts.ready.then(()=>record('fonts-ready'));const root=document.querySelector('article.render');if(root)new MutationObserver(()=>record('article-mutation')).observe(root,{childList:true,subtree:true,attributes:true});});
  });
  const page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(30000);
  const requests=new Map(),documents=new Map();
  page.on('request',r=>{const x={url:r.url(),method:r.method(),type:r.resourceType(),main:r.isNavigationRequest()&&r.frame()===page.mainFrame(),state:'pending',stage:row.stage};requests.set(r,x);row.requests.push(x);});
  page.on('response',r=>{const x=requests.get(r.request());if(x)x.status=r.status();});
  page.on('requestfinished',r=>{const x=requests.get(r);if(x)x.state='finished';});
  page.on('requestfailed',r=>{const x=requests.get(r);if(x){x.state='failed';x.failure=r.failure()?.errorText;}});
  page.on('pageerror',e=>row.pageErrors.push({message:e.message,stack:e.stack}));
  page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text().slice(0,2000));});
  const [a,b]=fixture.posts;
  const ready=async(post,y)=>{
   await page.waitForFunction(p=>location.pathname===p&&!!window.MainApp?.useCommon,post.path,{polling:100});
   await page.locator('article.render > h2').waitFor();assert.equal(await page.locator('article.render > h2').textContent(),post.title);
   assert.equal(new URL(await page.locator('link[rel=canonical]').getAttribute('href'),base).pathname,post.path);
   assert((await page.title()).includes(post.title));assert.equal(await page.locator('html').getAttribute('data-color-scheme'),color);
   await page.waitForLoadState('networkidle',{timeout:5000});
   await page.waitForFunction(y=>Math.abs(scrollY-y)<=2,y,{polling:100});
   assert.equal(await page.evaluate(()=>history.scrollRestoration),'auto');
   assertCleanNavigation(row);
   assert(row.requests.every(r=>new URL(r.url).origin===base));
   const observation=await page.evaluate(()=>({...window.__nativeHistoryObservation,y:scrollY}));
   row.checkpoints.push({stage:row.stage,path:post.path,expectedY:y,actualY:observation.y,document:observation});await save();return observation;
  };
  const scroll=async y=>{await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.waitForFunction(y=>Math.abs(scrollY-y)<=2,y,{polling:100});};
  row.stage='initial';assert.equal((await page.goto(base+a.path,{waitUntil:'domcontentloaded'})).status(),200);
  let current=await ready(a,0);documents.set(a.path,current.id);
  row.officialScripts=await page.locator('script[src]').evaluateAll(nodes=>nodes.filter(n=>n.src.includes('/plugins/PluginSearchWidget/')&&!n.dataset.themeScript).map(n=>n.src));assert(row.officialScripts.length,'Native fallback requires retained official SearchWidget script');
  const move=async(post,action,y)=>{
   const start=row.requests.length,previous=current.id;row.stage=action+'-'+post.label;
   (row.sourcePositions??=[]).push({action,url:page.url(),...await page.evaluate(()=>({y:scrollY,history:history.state,restoration:history.scrollRestoration})),reading:await page.evaluate(reading)});
   if(action==='back')await page.goBack({waitUntil:'domcontentloaded'});
   else if(action==='forward')await page.goForward({waitUntil:'domcontentloaded'});
   else{await page.locator('#navigation-'+post.label).evaluate(e=>e.focus({preventScroll:true}));await Promise.all([page.waitForURL(base+post.path,{waitUntil:'domcontentloaded'}),page.keyboard.press('Enter')]);}
   current=await ready(post,y);assert.notEqual(current.id,previous,'Must switch native document');
   const targets=row.requests.slice(start).filter(r=>r.main&&r.url===base+post.path);
   let mode='native-document';
   if(!targets.length){assert(['back','forward'].includes(action));assert.equal(current.id,documents.get(post.path));assert.equal(current.shows.at(-1)?.persisted,true);mode='native-bfcache';}
   else{assert.equal(targets.length,1);assert.equal(targets[0].status,200);assert.equal(targets[0].type,'document');}
   documents.set(post.path,current.id);row.navigations.push({action,path:post.path,mode,expectedY:y,actualY:current.y});await save();
  };
  await scroll(850);await move(b,'link',0);await scroll(1250);await move(a,'back',850);await move(b,'forward',1250);await move(a,'new-entry',0);
  assert.equal(row.checkpoints.length,5);assert.equal(row.navigations.length,4);row.status='passed';
 }catch(e){row.status='failed';row.error=e.stack||String(e);row.failureDocument=await context?.pages()[0]?.evaluate(()=>({url:location.href,y:scrollY,restoration:history.scrollRestoration,state:history.state,document:window.__nativeHistoryObservation,timeline:window.__layoutTimeline,active:document.activeElement?.outerHTML?.slice(0,500)})).catch(()=>null);row.failureReading=await context?.pages()[0]?.evaluate(reading).catch(()=>null);}
 finally{row.requestsBeforeClose=row.requests.map(r=>({...r}));await save();await closeNavigationCase(row,[context,browser],close);await save();}
}
report.status=report.cases.length===expectedCases&&report.cases.every(x=>x.status==='passed')?'passed-tested-scope':'failed';await save();process.exitCode=report.status==='failed'?1:0;
