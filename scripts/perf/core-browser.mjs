/** Focused real-Halo regression for the core performance changes; no user browser. */
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {options, localBase} from './support.mjs';
import {browserEnvironment, RUNTIME} from '../browser/support.mjs';
const args=options(process.argv.slice(2),['--base','--output','--scenario']);
assert.ok(!args.scenario || ['all','delayed'].includes(args.scenario), 'Unknown scenario');
const base=localBase(args.base),output=path.resolve(args.output);
Object.assign(process.env,browserEnvironment());
const playwright=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const report={base,scope:'Real Halo core home/longform, light/dark desktop/mobile; delayed bundle and no-JS fallback. Automation engines, not real devices or Safari.',checks:[]};
async function check(name,run){try{const detail=await run();report.checks.push({name,result:'passed',detail});}catch(error){report.checks.push({name,result:'failed',error:error.message});}await writeFile(output,JSON.stringify(report,null,2)+'\n');}
await mkdir(path.dirname(output),{recursive:true});
for(const engine of ['chromium','firefox','webkit']){
 const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
 try{
  if(args.scenario!=='delayed')for(const width of [390,1440])for(const mode of ['light','dark'])for(const route of ['/','/archives/perf-longform-v1/']){
   await check(`${engine}/${width}/${mode}/${route}`,async()=>{
    const context=await browser.newContext({viewport:{width,height:844},colorScheme:mode,storageState:{cookies:[],origins:[{origin:base,localStorage:[{name:'halo-butterfly-next.color-scheme',value:mode}]}]}});
    try{
     await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
     const page=await context.newPage(),errors=[],requests=[];
     page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
     const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
     await page.waitForFunction(()=>window.MainApp.useCommon&&!document.body.classList.contains('loading'));
     assert.equal(await page.locator('html').getAttribute('data-color-scheme'),mode);
     const hero=await page.locator('.header > .above').evaluate(el=>({background:getComputedStyle(el).backgroundImage,height:el.getBoundingClientRect().height,title:el.querySelector('h1')?.textContent}));
     assert.ok(hero.title);assert.notEqual(hero.background,'none');
     assert.equal(hero.height,route==='/'?844:(width===390?360:400));
     const preload=page.locator('link[rel=preload][as=image]');assert.equal(await preload.count(),1);assert.equal(await preload.getAttribute('fetchpriority'),'high');
     const configured=await page.evaluate(()=>window.MainApp.conf.above_background);
     assert.equal(await preload.getAttribute('href'),configured);
     assert.ok(hero.background.includes(configured));
     const heroTransfers=await page.evaluate(url=>performance.getEntriesByName(url).map(e=>({initiator:e.initiatorType,transfer:e.transferSize})),new URL(configured,base).href);
     // WebKit emits a second request event for a list image using the preloaded
     // hero URL even when it reuses memory cache (transferSize=0).
     assert.ok(heroTransfers.length>0);
     assert.ok(heroTransfers.filter(entry=>entry.transfer>0).length<=1,'hero must not be downloaded twice');
     assert.equal(requests.filter(url=>/plugins\/(loading\/.*\.js|cursor\/simple\.min\.css)/.test(url)).length,0,'inlined resources should not be fetched');
     assert.ok(await page.locator('.main img[loading=lazy][decoding=async]').count());
     if(width===390){await page.locator('.bars').click();assert.equal(await page.locator('.bars').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('.bars').getAttribute('aria-expanded'),'false');}
     if(route!=='/'){
      await page.waitForSelector('.code-toolbar');
      const copy=page.locator('.code-copy').first();assert.ok(await copy.count());
      await copy.scrollIntoViewIfNeeded();await copy.click();await page.waitForSelector('.copy-notice');
      const notice=await page.locator('.copy-notice').last().textContent();assert.ok(notice&&!notice.includes('失败'));
      if(width===390){await page.locator('#mobile-toc-button').click();await page.locator('.aside-toc .toc-link').first().waitFor({state:'visible'});await page.locator('#mobile-toc-button').click();}
      else assert.ok(await page.locator('.aside-toc .toc-link').count());
      const image=page.locator('article.render img').first();await image.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('article.render img')?.naturalWidth>0);
      const trigger=page.locator('article.render .theme-lightbox-trigger').first();await trigger.click();await page.locator('.theme-lightbox .viewer-container').waitFor({state:'visible'});await page.keyboard.press('Escape');await page.locator('.theme-lightbox').waitFor({state:'detached'});
     }
     assert.deepEqual(errors,[]);
     await page.screenshot({path:path.join(path.dirname(output),`${engine}-${width}-${mode}-${route==='/'?'home':'longform'}.png`)});
     return {hero,errors,preload:configured,heroTransfers};
    }finally{await context.close();}
   });
  }
  await check(`${engine}/blocked-page-bundle`,async()=>{
   const context=await browser.newContext({viewport:{width:390,height:844}});let release;
   const gate=new Promise(resolve=>release=resolve);
   try{
    await context.addInitScript(()=>{
     window.__performanceDOMContentLoaded=false;
     document.addEventListener('DOMContentLoaded',()=>{window.__performanceDOMContentLoaded=true;});
    });
    await context.route('**/*',async r=>{const url=new URL(r.request().url());if(url.origin!==base)return r.abort();if(url.pathname.includes('/assets/js/'))await gate;return r.continue();});
    const page=await context.newPage();await page.goto(base+'/',{waitUntil:'commit'});
    await page.waitForFunction(()=>document.getElementById('theme-content-ready')&&!document.body.classList.contains('loading')&&!window.MainApp.useCommon);
    assert.equal(await page.locator('.above-title').isVisible(),true);assert.notEqual(await page.locator('.above').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
    const before=await page.evaluate(()=>({readyState:document.readyState,domContentLoaded:window.__performanceDOMContentLoaded,enhanced:!!window.MainApp.useCommon,loading:document.body.classList.contains('loading')}));
    assert.equal(before.domContentLoaded,false);release();await page.waitForFunction(()=>!!window.MainApp.useCommon);
    return {before,enhancedAfterRelease:true};
   }finally{release?.();await context.close();}
  });
  if(args.scenario!=='delayed')await check(`${engine}/no-JS`,async()=>{
   const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
   try{const page=await context.newPage();await page.goto(base+'/archives/perf-longform-v1/');assert.equal(await page.locator('article.render').isVisible(),true);assert.ok(await page.locator('article.render #perf-section-20').count());return {bodyVisible:true};}finally{await context.close();}
  });
 }finally{await browser.close();}
 console.log(engine,report.checks.filter(c=>c.name.startsWith(engine)&&c.result==='passed').length,'passed');
}
report.result=report.checks.every(c=>c.result==='passed')?'passed':'failed';await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(output,report.result);if(report.result!=='passed')process.exitCode=1;
