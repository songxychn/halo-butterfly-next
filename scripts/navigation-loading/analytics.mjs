/** Real Halo markup and official comments, synthetic GA4 SDK; never sends analytics. */
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
const output=path.join(REPO,'.runtime/navigation-loading');await mkdir(output,{recursive:true});
const report={theme:installed,results:[],limitations:['GA4 SDK response simulated; property enhanced-history measurement must be disabled.','No service-account DebugView acceptance; Cloudflare and other providers retain native navigation.']};
let browser;const save=()=>writeFile(path.join(output,'analytics.json'),JSON.stringify(report,null,2)+'\n');
const sdk=`window.fixtureCalls=[];const receive=a=>window.fixtureCalls.push(Array.from(a));window.dataLayer.forEach(receive);const push=window.dataLayer.push;window.dataLayer.push=function(...args){args.forEach(receive);return push.apply(this,args)};`;
try{
 for(const engine of (process.env.ENGINES||'chromium,firefox,webkit').split(',')){
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  for(const width of [1440,390])for(const mode of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:1000},locale:'zh-CN'});
   await context.addInitScript(mode=>localStorage.setItem('halo-butterfly-next.color-scheme',mode),mode);
   let requests=0;const errors=[];
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin===base)return route.continue();
    if(url.href==='https://www.googletagmanager.com/gtag/js?id=G-TEST123'){requests++;return route.fulfill({contentType:'application/javascript',body:sdk});}
    return route.abort();
   });
   const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/archives/preview-1/',{waitUntil:'domcontentloaded'});
   const calls=()=>page.evaluate(()=>window.fixtureCalls.filter(a=>a[0]==='event').map(a=>a[2]));
   await page.waitForFunction(()=>window.fixtureCalls?.some(a=>a[0]==='event'),null,{polling:100});
   await page.evaluate(()=>window.analyticsSentinel=true);
   const expected=[];
   const recorded=async()=>{expected.push({url:page.url().split('#')[0],title:await page.title()});await page.waitForFunction(count=>window.fixtureCalls.filter(a=>a[0]==='event').length===count,expected.length,{polling:100});};
   await recorded();
   const settled=async route=>{await page.waitForFunction(route=>location.pathname===route&&!document.documentElement.classList.contains('theme-navigating')&&!!MainApp.useCommon,route,{polling:100});assert.equal(await page.evaluate(()=>window.analyticsSentinel),true);await recorded();};
   const visit=async route=>{await page.evaluate(route=>{const a=document.createElement('a');a.href=route;document.body.append(a);a.click();a.remove()},route);await settled(route);};
   await visit('/archives/');await visit('/archives/preview-2/');await visit('/about-preview/');
   await page.goBack();await settled('/archives/preview-2/');await page.goForward();await settled('/about-preview/');
   await visit('/archives/preview-1/');
   await page.evaluate(()=>document.getElementById('post-comment').dispatchEvent(new Event('theme:load-comments')));
   const editor=page.locator('comment-widget [contenteditable="true"]').first();await editor.click();await editor.pressSequentially('Manual analytics pending draft',{delay:5});
   await page.waitForFunction(()=>Object.keys(localStorage).some(k=>(localStorage.getItem(k)||'').includes('Manual analytics pending draft')),null,{polling:100});
   const before=(await calls()).length;
   const dialogPromise=page.waitForEvent('dialog');await page.evaluate(()=>history.back());const dialog=await dialogPromise;assert.equal(dialog.type(),'beforeunload');await dialog.dismiss();
   await page.waitForFunction(()=>location.pathname==='/archives/preview-1/',null,{polling:100});await page.waitForTimeout(150);
   assert.equal((await calls()).length,before);assert.match(await editor.innerText(),/Manual analytics pending draft/);assert.equal(await page.evaluate(()=>window.analyticsSentinel),true);
   await editor.press('ControlOrMeta+A');await editor.press('Backspace');
   await page.waitForFunction(()=>!Object.keys(localStorage).some(k=>(localStorage.getItem(k)||'').includes('Manual analytics pending draft')),null,{polling:100});
   await page.goBack();await settled('/about-preview/');
   const events=await calls();assert.deepEqual(events.map(v=>({url:v.page_location,title:v.page_title})),expected);
   assert.deepEqual(events.slice(1).map(v=>v.page_referrer),expected.slice(0,-1).map(v=>v.url));
   assert.equal(await page.evaluate(()=>fixtureCalls.filter(a=>a[0]==='config').length),1);
   assert.equal(await page.evaluate(()=>fixtureCalls.find(a=>a[0]==='config')[2].send_page_view),false);
   assert.equal(requests,1);assert.deepEqual(errors,[]);
   report.results.push({engine,width,mode,events:events.length,sdkRequests:requests,cancelledHistoryEvents:0,result:'passed'});await save();await context.close();console.log('PASS',engine,width,mode);
  }
  const context=await browser.newContext();await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const page=await context.newPage();await page.goto(base+'/archives/preview-1/',{waitUntil:'networkidle'});await page.evaluate(()=>window.analyticsSentinel=true);
  await Promise.all([page.waitForURL(base+'/archives/'),page.evaluate(()=>{const a=document.createElement('a');a.href='/archives/';document.body.append(a);a.click()})]);
  assert.equal(await page.evaluate(()=>window.analyticsSentinel),undefined);report.results.push({engine,scenario:'sdk-failure-native-navigation',result:'passed'});await save();await context.close();
  await browser.close();browser=null;
 }
}catch(error){report.failure=error.stack;throw error;}finally{await browser?.close();await save();}
