/** Combined portable content, locale, native Moment comments and pending feed navigation. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl,validatePackage,sha256} from '../browser/support.mjs';
const lab=path.resolve(process.env.LAB_RUNTIME || '');
assert(lab.startsWith(path.join(REPO,'.runtime/')),'Explicit owned runtime required');
const base=validateBaseUrl(process.env.BASE_URL,JSON.parse(await readFile(path.join(lab,'lab.json'))));
const installed=JSON.parse(await readFile(path.join(lab,'installed-package.json')));
validatePackage(installed,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha256(await readFile(path.join(REPO,'dist',installed.name))));
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const out=path.resolve(process.argv[2]||path.join(REPO,'.runtime/confirmed-gaps/combinations'));await mkdir(out,{recursive:true});
const report={installed,startedAt:new Date().toISOString(),cases:[],limitations:['Owned synthetic Halo 2.26.1 / Moments 1.18.0 / CommentWidget 3.3.2 / Links 2.3.0.','Headless engines; no real devices, Safari application or external service accounts.']};
const save=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const engine of (process.env.ENGINES||'chromium,firefox,webkit').split(',')){
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
 try{for(const width of [1440,390])for(const color of ['light','dark']){
  const row={engine,version:browser.version(),width,color,checks:[],errors:[],requests:[],console:[]};report.cases.push(row);
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},locale:'en',colorScheme:color});
  await context.addInitScript(color=>localStorage.setItem('halo-butterfly-next.color-scheme',color),color);
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>row.errors.push(e.message));page.on('console',m=>{if(['error','debug'].includes(m.type()))row.console.push(m.text().slice(0,1000));});page.on('request',r=>row.requests.push({url:r.url(),status:'pending'}));page.on('requestfinished',r=>{const x=row.requests.find(x=>x.url===r.url()&&x.status==='pending');if(x)x.status='finished';});page.on('requestfailed',r=>{const x=row.requests.find(x=>x.url===r.url()&&x.status==='pending');if(x)x.status=r.failure()?.errorText||'failed';});
  const navigate=async route=>{row.stage=route;
   await page.evaluate(route=>{const a=document.createElement('a');a.href=route;document.body.append(a);a.click();a.remove();},route);
   await page.waitForFunction(route=>location.pathname+location.search===route&&!document.documentElement.classList.contains('theme-navigating')&&!!window.MainApp?.useCommon,route,{timeout:30000});
   assert.equal(await page.evaluate(()=>window.combinationSentinel),'retained','Expected scoped navigation to '+route);
   assert.equal(await page.locator('html').getAttribute('data-color-scheme'),color);
  };
  try{
   const response=await page.goto(base+'/archives/preview-1/?language=en',{waitUntil:'networkidle'});assert.equal(response.status(),200);
   await page.waitForFunction(()=>!!window.MainApp?.useCommon);await page.evaluate(()=>window.combinationSentinel='retained');
   await navigate('/categories?language=ja');assert.equal(await page.locator('html').getAttribute('lang'),'ja');assert.equal(await page.locator('h1.above-title').textContent(),'カテゴリー');assert.equal(await page.evaluate(()=>MainApp.messages['ui.copyCode']),'コードをコピー');row.checks.push('PJAX changes document and browser message locale');
   await navigate('/moments/moment-fixture-12?language=en');
   await page.waitForSelector('comment-widget');assert.deepEqual(await page.locator('comment-widget').evaluate(w=>[w.group,w.kind,w.name]),['moment.halo.run','Moment','moment-fixture-12']);
   assert.equal(await page.locator('#comment-title').textContent().then(x=>x.trim()),'Comments');await page.evaluate(()=>window.previousMoment=document.querySelector('comment-widget'));
   await navigate('/archives/preview-1/?language=ko');await page.waitForSelector('comment-widget');assert.deepEqual(await page.locator('comment-widget').evaluate(w=>[w.group,w.kind,w.name]),['content.halo.run','Post','preview-1']);assert.equal(await page.evaluate(()=>window.previousMoment.isConnected),false);assert.equal(await page.locator('html').getAttribute('lang'),'ko');row.checks.push('Moment/Post comment identities and disconnected old editor');
   await navigate('/archives/portable-content/?language=en');await page.waitForSelector('#deploy-tabs[data-content-tabs-ready]');await page.locator('#deploy-tabs > .content-tab-list').getByRole('tab',{name:'Docker 部署',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#local-target').isVisible(),true);await page.evaluate(()=>window.oldTabs=document.querySelector('#deploy-tabs'));await navigate('/links?language=en');assert.equal(await page.evaluate(()=>window.oldTabs.isConnected),false);await page.waitForSelector('[data-links-state="loaded"]');assert.equal(await page.locator('[data-links-items] .link').count(),3);row.checks.push('Portable tabs and remote links enter/leave with single instances');
   await navigate('/archives/preview-2/?language=en');
   let release;const pending=new Promise(resolve=>release=resolve);let requested;const seen=new Promise(resolve=>requested=resolve);
   const hold=async route=>{requested();await pending;try{await route.fulfill({json:[{name:'late',links:[{name:'late',url:base+'/'}]}]});}catch{/* Aborted request has no response consumer. */}};
   await page.route('**/lab/site-content-links.json',hold);await navigate('/links?language=en');await seen;await page.evaluate(()=>window.oldLinks=document.querySelector('[data-remote-links]'));
   await navigate('/archives/preview-1/?language=en');release();await page.unroute('**/lab/site-content-links.json',hold);await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>window.oldLinks.isConnected),false);assert.notEqual(await page.evaluate(()=>window.oldLinks.dataset.linksState),'loaded');assert.equal(await page.locator('[data-links-items]').count(),0);
   await navigate('/links?language=en');await page.waitForSelector('[data-links-state="loaded"]');assert.equal(await page.locator('[data-links-items] .link').count(),3);row.checks.push('Pending remote request cannot mutate detached page; reentry succeeds');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(row.errors,[]);row.pass=true;
  }catch(error){row.pass=false;row.error=String(error.stack||error);row.url=page.url();try{row.state=await Promise.race([page.evaluate(()=>({ready:!!window.MainApp?.useCommon,classes:document.documentElement.className,lang:document.documentElement.lang,sentinel:window.combinationSentinel,scripts:[...document.scripts].map(x=>({src:x.src,kind:x.dataset.themeScript})),custom:[...document.querySelectorAll('*')].filter(x=>x.localName.includes('-')).map(x=>x.localName)})),new Promise((_,reject)=>setTimeout(()=>reject(Error('snapshot timeout')),2000))]);}catch{}throw error;}
  finally{await context.close();await save();console.log(engine,width,color,row.pass?'passed':'failed');}
 }}finally{await browser.close();}
}
report.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({cases:report.cases.length,failed:report.cases.filter(x=>!x.pass).length}));
