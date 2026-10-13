/** Known optional providers on owned Halo; service counting responses are fixtures. */
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
const report={theme:installed,results:[],limitations:['Busuanzi remote response fixtures; no real service counters altered.','Physical Safari/devices and account-backed SDKs not accepted.']};
let browser;const save=()=>writeFile(path.join(output,'optional.json'),JSON.stringify(report,null,2)+'\n');
try{
 for(const engine of (process.env.ENGINES||'chromium,firefox,webkit').split(',')){
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  for(const width of [1440,390])for(const mode of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:1000},locale:'zh-CN'});
   await context.addInitScript(mode=>{localStorage.setItem('halo-butterfly-next.color-scheme',mode);window.fixtureFrames=0;const raf=window.requestAnimationFrame;window.requestAnimationFrame=fn=>raf.call(window,time=>{window.fixtureFrames++;fn(time)})},mode);
   const counters=[],resources=[],errors=[],trace=[];
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===base){if(/social-share.min.js|effects.min.js/.test(url.pathname))resources.push(url.pathname);return route.continue();}
    if(url.origin==='https://busuanzi.ibruce.info'&&url.pathname==='/busuanzi'){
     const callback=url.searchParams.get('jsonpCallback');assert.match(callback,/^__haloThemeBusuanzi\.c\d+$/);
     counters.push({callback,referrer:route.request().headers().referer});
     return route.fulfill({contentType:'application/javascript',body:`${callback}({site_pv:123,site_uv:45,page_pv:67});`});
    }
    return route.abort();
   });
   const p=await context.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='debug')trace.push({console:m.text()})});p.on('request',r=>trace.push({request:r.url()}));p.on('response',r=>trace.push({response:r.url(),status:r.status()}));
   await p.goto(base+'/archives/preview-1/',{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>!!MainApp.useCommon);await p.evaluate(()=>window.optionalSentinel='keep');
   const visit=async route=>{
    await p.evaluate(route=>{const a=document.createElement('a');a.href=route;document.body.append(a);a.click();a.remove()},route);
    try { await p.waitForFunction(route=>location.pathname===route&&!document.documentElement.classList.contains('theme-navigating')&&!!MainApp.useCommon,route,{polling:100}); } catch(error) { report.diagnostic={engine,width,mode,route,url:p.url(),state:await p.evaluate(()=>({className:document.documentElement.className,common:!!window.MainApp?.useCommon,hidden:document.hidden,sentinel:window.optionalSentinel,nav:window[Symbol.for('halo-butterfly-next.navigation-loading')]?.busy})),errors,trace:trace.slice(-40)};throw error; }
    assert.equal(await p.evaluate(()=>window.optionalSentinel),'keep');
   };
   for(let i=0;i<4;i++){
    if(i)await visit('/archives/preview-'+(i%2+1)+'/');
    await p.waitForSelector('[data-share-provider] .icon-wechat .qrcode canvas',{state:'attached'});
    await p.waitForSelector('canvas.appearance-effect');
    await p.waitForFunction(()=>document.getElementById('busuanzi_value_page_pv')?.textContent==='67');
    const share=await p.locator('[data-post-share]').evaluate(region=>({url:region.dataset.url,title:region.dataset.title,x:new URL(region.querySelector('.icon-x').href).searchParams.get('url'),text:new URL(region.querySelector('.icon-x').href).searchParams.get('text')}));
    assert.equal(share.x,share.url);assert.equal(share.text,share.title);
    assert.equal(await p.locator('canvas.appearance-effect').count(),1);
    assert.equal(await p.locator('link[href*="share.min.css"]').count(),1);
    await p.locator('.icon-wechat').click();assert.equal(await p.locator('.wechat-qrcode').isVisible(),true);
    await p.locator('.icon-wechat').press('Escape');assert.equal(await p.locator('.wechat-qrcode').isVisible(),false);
    await p.evaluate(()=>{window.previousEffects=document.querySelector('canvas.appearance-effect');window.previousShare=document.querySelector('[data-share-provider]')});
    await visit('/archives/');await p.waitForSelector('canvas.appearance-effect');
    assert.equal(await p.evaluate(()=>window.previousEffects.isConnected||window.previousShare.isConnected),false);
    assert.equal(await p.locator('canvas.appearance-effect').count(),1);
    const frames=await p.evaluate(()=>window.fixtureFrames);await p.waitForTimeout(150);assert((await p.evaluate(()=>window.fixtureFrames))>frames,'effects remain animated after navigation');
   }
   await p.emulateMedia({reducedMotion:'reduce'});try{await p.waitForFunction(()=>!document.querySelector('canvas.appearance-effect'),null,{polling:100});}catch(error){report.diagnostic={engine,width,mode,media:await p.evaluate(()=>({reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,canvas:document.querySelectorAll('canvas.appearance-effect').length,frames:window.fixtureFrames,scope:window[Symbol.for('halo-butterfly-next.page-scope')]?.active})),errors};throw error;}
   await p.emulateMedia({reducedMotion:'no-preference'});await p.waitForSelector('canvas.appearance-effect');assert.equal(await p.locator('canvas.appearance-effect').count(),1);
   assert.equal(resources.filter(x=>x.endsWith('social-share.min.js')).length,1);assert.equal(resources.filter(x=>x.endsWith('effects.min.js')).length,1);
   assert(counters.length>=4);assert(counters.every(row=>row.referrer?.startsWith(base+'/')));
   assert.equal(await p.evaluate(()=>Object.keys(window.__haloThemeBusuanzi).length),0);
   assert.deepEqual(errors,[]);report.results.push({engine,width,mode,cycles:4,resources,counters,result:'passed'});await save();
   await context.close();console.log('PASS',engine,width,mode);
  }
  await browser.close();browser=null;
 }
}catch(error){report.failure=error.stack;throw error;}finally{await browser?.close();await save();}
