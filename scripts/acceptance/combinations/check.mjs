/** Reads only owned API fixtures. Never inserts product code or retries navigation. */
import assert from 'node:assert/strict';
import {readFile, writeFile, realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO, RUNTIME, browserEnvironment, validateBaseUrl, sha256} from '../../browser/support.mjs';
const file=await realpath(process.argv[2]);
assert(file.startsWith(path.join(REPO,'.runtime')+path.sep));
const fixture=JSON.parse(await readFile(file));
assert.equal(fixture.owner,'combination-followup-owner');
assert.match(fixture.runId,/^[0-9a-f]{20}$/);
const output=path.dirname(file),runtime=await realpath(fixture.runtime);
assert.equal(await readFile(path.join(runtime,'acceptance-combinations.lock'),'utf8'),fixture.runId);
const base=validateBaseUrl(fixture.base,JSON.parse(await readFile(path.join(runtime,'lab.json'))));
assert.deepEqual(JSON.parse(await readFile(path.join(runtime,'installed-package.json'))),fixture.installed);
const state=JSON.parse(await readFile(path.join(runtime,'halo-process.json')));
assert(execFileSync('ps',['-p',String(state.pid),'-o','command='],{encoding:'utf8'}).includes(path.join(runtime,'halo/halo-2.26.1.jar')));
for(const route of [fixture.post.path,fixture.moment.path])assert.equal(new URL(route,base).origin,base);
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const report={schema:1,runId:fixture.runId,startedAt:new Date().toISOString(),runnerSha256:sha256(await readFile(new URL(import.meta.url))),fixtureSha256:sha256(await readFile(file)),installed:fixture.installed,expectedNavigation:'native-official-plugin-compatibility',cases:[],limitations:['Six mobile headless light/dark combinations only; not whole-contract acceptance.','Real installed theme/plugin browser code; no compiled source injection. Clipboard API is instrumented solely to capture copy output, not OS clipboard evidence.','API-created official-renderer MathML is a saved-format control, not editor UI acceptance.','Fresh initial navigation once per case, five native article/Moment/Links/article loops with official scripts retained; no PJAX disposal claim, retries or temporary server workaround.']};
const save=()=>writeFile(path.join(output,'browser-report.json'),JSON.stringify(report,null,2)+'\n');
const boundedClose=async(target,label)=>{
 let timer;
 try{await Promise.race([target.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' close exceeded 10s')),10000);})]);}
 finally{clearTimeout(timer);}
};
await save();
for(const engine of ['chromium','firefox','webkit']){
 let browser;
 try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  for(const color of ['light','dark']){
   const row={engine,version:browser.version(),color,width:390,stages:[],requests:[],pageErrors:[],consoleErrors:[],status:'running'};
   report.cases.push(row);await save();
   const context=await browser.newContext({viewport:{width:390,height:844},locale:'en',colorScheme:color});
   const page=await context.newPage();page.setDefaultTimeout(20000);
   const requests=new Map();let nextId=0;
   page.on('request',r=>{const v={id:++nextId,url:r.url(),method:r.method(),resourceType:r.resourceType(),isMainFrameNavigation:r.isNavigationRequest()&&r.frame()===page.mainFrame(),stage:row.stage,startedAt:new Date().toISOString(),state:'pending'};requests.set(r,v);row.requests.push(v);});
   page.on('response',r=>{const v=requests.get(r.request());if(v){v.httpStatus=r.status();v.responseAt=new Date().toISOString();}});
   page.on('requestfinished',r=>{const v=requests.get(r);if(v){v.state='finished';v.finishedAt=new Date().toISOString();}});
   page.on('requestfailed',r=>{const v=requests.get(r);if(v){v.state='failed';v.failure=r.failure()?.errorText;v.finishedAt=new Date().toISOString();}});
   page.on('pageerror',e=>row.pageErrors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text().slice(0,2000));});
   await context.addInitScript(color=>localStorage.setItem('halo-butterfly-next.color-scheme',color),color);
   const checkpoint=async(name)=>{
    assert.equal(await page.locator('html').getAttribute('data-color-scheme'),color);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Horizontal page overflow');
    assert.deepEqual(row.pageErrors,[],'Uncaught page errors');
    const pending=()=>row.requests.filter(r=>r.state==='pending');
    const deadline=Date.now()+5000;
    while(pending().length&&Date.now()<deadline)await page.waitForTimeout(100);
    assert.deepEqual(pending(),[],'Requests remain pending before checkpoint');
    assert.deepEqual(row.requests.filter(r=>r.state==='failed'||r.httpStatus>=400),[],'Network errors before checkpoint');
    row.stages.push({name,url:page.url(),requestCount:row.requests.length});await save();
   };
   const navigate=async(route)=>{
    row.stage=route;
    const scripts=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>({src:n.src,type:n.type,themeScript:n.dataset.themeScript||null})).filter(n=>/\/plugins\/(PluginCommentWidget|PluginSearchWidget)\/assets\//.test(new URL(n.src).pathname)));
    assert(scripts.some(s=>!s.themeScript&&!/application\/(?:ld\+)?json/i.test(s.type)),'Expected retained official script requiring native lifecycle');
    const previousCount=row.requests.length;
    await page.evaluate(run=>window.combinationFollowupSentinel=run,fixture.runId);
    await page.evaluate(route=>{const a=document.createElement('a');a.href=route;document.body.append(a);a.click();a.remove();},route);
    await page.waitForFunction(route=>location.pathname+location.search===route&&!document.documentElement.classList.contains('theme-navigating')&&!!window.MainApp?.useCommon,route,{timeout:30000,polling:100});
    assert.equal(await page.evaluate(()=>window.combinationFollowupSentinel),undefined,'Official plugin page must receive a fresh document lifecycle');
    const documents=row.requests.slice(previousCount).filter(r=>r.isMainFrameNavigation&&r.url===base+route);
    assert.equal(documents.length,1,'Expected one actual main-frame document request');
    assert.equal(documents[0].httpStatus,200);
    (row.navigations??=[]).push({route,mode:'native',officialScripts:scripts,documentRequestId:documents[0].id});
   };
   const comment=async(kind,name)=>{
    await page.locator('#post-comment').scrollIntoViewIfNeeded();
    await page.locator('comment-widget').waitFor({state:'attached'});
    assert.equal(await page.locator('comment-widget').count(),1);
    assert.deepEqual(await page.locator('comment-widget').evaluate(w=>[w.group,w.kind,w.name]),[kind==='Moment'?'moment.halo.run':'content.halo.run',kind,name]);
    await page.locator('comment-widget form').first().waitFor({state:'attached'});
   };
   const article=async(locale)=>{
    assert.equal(await page.locator('html').getAttribute('lang'),locale);
    await page.waitForSelector('article.render .theme-math-copy');
    assert.equal(await page.locator('article.render math').count(),1);
    assert.equal(await page.locator('article.render .theme-math-block').count(),1);
    assert.equal(await page.locator('article.render .theme-math-copy').count(),1);
    assert.equal(await page.locator('article.render annotation[encoding="application/x-tex"]').textContent(),fixture.tex);
    assert.equal(await page.locator('#combo-picture > source').getAttribute('srcset'),'/lab/avatar.svg');
    assert.equal(await page.locator('#combo-picture > img').getAttribute('loading'),'eager');
    await page.waitForFunction(()=>document.querySelector('#combo-picture > img')?.naturalWidth>0);
    await page.waitForSelector('article.render .code-toolbar');
    assert.equal(await page.locator('article.render .code-toolbar').count(),1);
    assert.equal(await page.locator('article.render .code-toolbar .toolbar').count(),1);
    assert.equal(await page.locator('article.render .theme-lightbox-trigger .theme-lightbox-trigger').count(),0);
    const trigger=page.locator('#combo-picture').locator('..');
    assert.equal(await trigger.getAttribute('role'),'button');
    await trigger.focus();await page.keyboard.press('Enter');
    await page.locator('.viewer-canvas > img').waitFor({state:'visible'});
    assert.equal(await page.locator('.viewer-canvas > img').getAttribute('src'),base+'/lab/avatar.svg');
    assert.equal(await page.locator('.theme-lightbox .viewer-container').count(),1);
    assert.equal(await page.locator('.theme-lightbox .viewer-container').isVisible(),true);
    await page.keyboard.press('Escape');
    await page.locator('.theme-lightbox').waitFor({state:'detached'});
    assert(await trigger.evaluate(element=>element===document.activeElement),'Lightbox close must restore trigger focus');
    await page.evaluate(()=>{window.comboCopied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.comboCopied.push(text)}});});
    await page.locator('.theme-math-copy').click();
    assert.deepEqual(await page.evaluate(()=>window.comboCopied),[fixture.tex]);
    await comment('Post',fixture.post.name);
   };
   try{
    row.stage='initial';
    const response=await page.goto(base+fixture.post.path+'?language=en',{waitUntil:'networkidle',timeout:20000});
    assert.equal(response.status(),200);
    await page.waitForFunction(()=>!!window.MainApp?.useCommon);
    await page.evaluate(run=>window.combinationFollowupSentinel=run,fixture.runId);
    await article('en');await checkpoint('initial-article');
    for(let cycle=1;cycle<=5;cycle++){
     await navigate(fixture.moment.path+'?language=ja');
     assert.equal(await page.locator('html').getAttribute('lang'),'ja');
     assert.equal(await page.evaluate(()=>window.MainApp.messages['ui.copyCode']),'コードをコピー');
     await comment('Moment',fixture.moment.name);
     await checkpoint('cycle-'+cycle+'-moment-ja');
     await navigate('/links?language=ko');
     assert.equal(await page.locator('html').getAttribute('lang'),'ko');
     assert.equal(await page.evaluate(()=>window.MainApp.messages['ui.copyCode']),'코드 복사');
     const link=page.locator('[data-link-list] > a').filter({has:page.locator('.n',{hasText:fixture.linkTitle})});
     assert.equal(await link.count(),1);assert.equal(await link.getAttribute('href'),base+fixture.post.path);
     assert.equal(await page.locator('comment-widget').count(),0);
     await checkpoint('cycle-'+cycle+'-links-ko');
     await navigate(fixture.post.path+'?language=en');
     await article('en');await checkpoint('cycle-'+cycle+'-article-en');
    }
    row.status='passed';
   }catch(error){
    row.status='failed';row.error=String(error.stack||error);row.failedUrl=page.url();
    row.pendingAtFailure=row.requests.filter(r=>r.state==='pending').map(r=>({...r}));
    try{row.failureState=await Promise.race([page.evaluate(()=>({url:location.href,readyState:document.readyState,lang:document.documentElement.lang,classes:document.documentElement.className,sentinel:window.combinationFollowupSentinel,math:document.querySelectorAll('article.render math').length,comments:document.querySelectorAll('comment-widget').length})),new Promise((_,reject)=>setTimeout(()=>reject(Error('snapshot timed out')),2000))]);}catch(e){row.snapshotError=String(e);}
   }finally{
    row.requestsBeforeClose=row.requests.map(r=>({...r}));
    await save();await boundedClose(context,'context');await save();
    console.log(engine,color,row.status,row.error||'');
   }
  }
 }catch(error){report.executionErrors??=[];report.executionErrors.push({engine,error:String(error.stack||error)});await save();}
 finally{if(browser){try{await boundedClose(browser,'browser');}catch(error){report.executionErrors??=[];report.executionErrors.push({engine,error:String(error)});await save();}}}
}
// Recheck the final arrays after context/browser shutdown so late errors cannot
// leave a case marked passed. Keep checkpoint failures and their original stacks.
for(const row of report.cases){
 row.finalErrors={page:row.pageErrors.length,console:row.consoleErrors.length,network:row.requests.filter(r=>r.state!=='finished'||r.httpStatus>=400).length};
 if(Object.values(row.finalErrors).some(Boolean)&&row.status==='passed'){
  row.status='failed';row.error='Final error gate failed: '+JSON.stringify(row.finalErrors);
 }
}
report.finishedAt=new Date().toISOString();report.status=report.cases.length===fixture.expectedCases&&report.cases.every(c=>c.status==='passed')&&!report.executionErrors?.length?'passed-tested-scope':'failed';await save();console.log(report.status,path.join(output,'browser-report.json'));process.exitCode=report.status==='failed'?1:0;
