/** Real Halo + fully intercepted synthetic SDKs. No account/service requests leave the machine. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync,spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {browserEnvironment,RUNTIME,validateBaseUrl,validatePackage,sha256} from '../browser/support.mjs';
const [baseInput,runtimeInput]=process.argv.slice(2);
assert(runtimeInput,'Usage: bun scripts/integrations/check-browser.mjs BASE LAB_RUNTIME');
const lab=resolve(runtimeInput),root=resolve(new URL('../..',import.meta.url).pathname);
const identity=JSON.parse(await readFile(join(lab,'lab.json'),'utf8'));
const base=validateBaseUrl(baseInput,identity);
Object.assign(process.env,browserEnvironment());
const require=createRequire(join(RUNTIME,'deps/node_modules/playwright/package.json'));
const playwright=require('playwright');
const report={sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),artifactSha256:sha256(await readFile(join(root,'dist/halo-butterfly-next-0.1.0-alpha.4.zip'))),haloVersion:'2.26.1',playwright:require('playwright/package.json').version,cases:[],limitations:['All external SDKs are synthetic local fixtures, not real account acceptance.','Headless desktop/mobile viewports, not real Safari or physical devices.','Optional Hexo reference failed to start; no dual-site parity claim.']};
validatePackage(JSON.parse(await readFile(join(lab,'installed-package.json'),'utf8')),report.sourceSha,report.artifactSha256);
report.startedAt=new Date().toISOString();report.engines={};
const controller=spawn('python3',[join(root,'scripts/integrations/profile.py'),'--runtime',lab,'--profile','serve'],{stdio:['pipe','pipe','inherit']});
const responses=[];let notify;
const lines=createInterface({input:controller.stdout});
lines.on('line',line=>{try {responses.push(JSON.parse(line));notify?.();} catch {console.log(line);}});
let closed=false;controller.on('exit',()=>{closed=true;notify?.();});
async function nextResponse() {
 while(!responses.length) {if(closed)throw Error('Owned-lab configuration helper exited');await new Promise(resolve=>notify=resolve);}
 return responses.shift();
}
assert.equal((await nextResponse()).ready,true);
const profile=async name=>{controller.stdin.write(JSON.stringify(name)+'\n');return nextResponse();};
const stub=provider=>`window.integrationLoads=window.integrationLoads||[];window.integrationLoads.push(${JSON.stringify(provider)});window.integrationCalls=window.integrationCalls||[];`+({
 chatra:`var queue=window.Chatra.q||[];window.Chatra=(...args)=>window.integrationCalls.push(args);queue.forEach(args=>window.Chatra(...args));`,
 crisp:`var queue=Array.isArray(window.$crisp)?window.$crisp:[];window.$crisp={push:args=>window.integrationCalls.push(args)};queue.forEach(args=>window.$crisp.push(args));`,
 tidio:`setTimeout(()=>{window.tidioChatApi={open:()=>window.integrationCalls.push(['open']),close:()=>window.integrationCalls.push(['close']),show:()=>window.integrationCalls.push(['show']),hide:()=>window.integrationCalls.push(['hide']),on:(event,fn)=>{if(event==='ready')fn();}};document.dispatchEvent(new Event('tidioChat-ready'));},40);`,
 knocket:`setTimeout(()=>{const widget=document.createElement('div');widget.id='contact-widget-auto';widget.textContent='Synthetic contact';document.body.append(widget);},40);`,
 umami_analytics:`window.umami={track:fn=>window.integrationCalls.push(['umami',fn({})])};`,
}[provider]||'');
try {
 for(const engine of (process.env.ENGINES||'chromium,firefox,webkit').split(',')) {
  const browser=await playwright[engine].launch({headless:true, ...(engine==='chromium'?{executablePath:playwright.chromium.executablePath()}: {})});
  report.engines[engine]=browser.version();
  try {
   for(const variant of ['disabled','all','chatra','tidio','crisp','knocket','native','failed','resources','bad-resources','invalid-resources','versionless','layout6','layout7','jsdelivr','unpkg','cdnjs']) {
    await profile(variant);console.log(engine+': '+variant);
    for(const width of [1440,390]) for(const mode of ['light','dark']) {
     const result={engine,width,mode,profile:variant,checks:[],errors:[],requestFailures:[],blockedExternal:[]};report.cases.push(result);
     const context=await browser.newContext({viewport:{width,height:900},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
     await context.addInitScript(mode=>localStorage.setItem('halo-butterfly-next.color-scheme',mode),mode);
     const requested=[];
     await context.route('**/*',async route=>{
      const url=new URL(route.request().url());requested.push(url.href);
      if(url.origin===base) {
       if(url.pathname==='/integration-stub.js')return route.fulfill({contentType:'text/javascript',body:stub(url.searchParams.get('provider'))});
       if(url.pathname==='/integration-fail.js')return route.fulfill({status:503,body:'synthetic failure'});
       if(url.pathname==='/integration-stats')return route.fulfill({contentType:'application/json',body:JSON.stringify({site_uv:12,site_pv:34,page_pv:56})});
       if(url.pathname.startsWith('/theme-mirror/')) {
        const file=url.pathname.replace('/theme-mirror/','');
        const target=resolve(root,'templates/assets',file==='css/all.min.css'?'plugins/fontawesome/'+file:file);
        assert(target.startsWith(join(root,'templates/assets')+'/'));
        try{return await route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream',body:await readFile(target)});}catch{return route.fulfill({status:404});}
       }
       return route.continue();
      }
      // Font provider checks also intercept the SDK CSS/fonts. They are served from bundled bytes.
      if(variant==='jsdelivr'||variant==='unpkg'||variant==='cdnjs') {
       if(url.pathname.endsWith('/css/all.min.css'))return route.fulfill({contentType:'text/css',body:await readFile(join(root,'templates/assets/plugins/fontawesome/css/all.min.css'))});
       if(url.pathname.includes('/webfonts/'))return route.fulfill({body:await readFile(join(root,'templates/assets/plugins/fontawesome/webfonts',url.pathname.split('/').at(-1)))});
      }
      result.blockedExternal.push(url.origin);return route.abort();
     });
     const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.stack||e.message));
     page.on('requestfailed',request=>result.requestFailures.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText}));
     try {
      const path=['all','layout6','layout7','resources','bad-resources','invalid-resources','versionless'].includes(variant)?'/archives/preview-1/':'/';
      const response=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:45000});assert.equal(response.status(),200);
      await page.waitForFunction(()=>window.MainApp?.useCommon && !document.body.classList.contains('loading'));
      assert.equal(await page.locator('html').getAttribute('data-color-scheme'),mode);result.checks.push('rendered core and mode');
      if(variant==='disabled') {
       assert.equal(requested.some(url=>url.includes('integrations.min.js')),false);assert.equal(await page.locator('.theme-ad').count(),0);assert.equal(await page.locator('#chat-btn').count(),0);result.checks.push('disabled makes no optional request');
      } else if(['all','layout6','layout7','chatra','tidio','crisp','knocket'].includes(variant)) {
       const button=page.locator('#chat-btn');await page.waitForFunction(()=>document.getElementById('chat-btn')?.disabled===false);
       await page.evaluate(()=>document.getElementById('rightside').classList.add('active'));
       await button.focus();await page.keyboard.press('Enter');assert.equal(await button.getAttribute('aria-expanded'),'true');
       await page.keyboard.press('Space');assert.equal(await button.getAttribute('aria-expanded'),'false');result.checks.push('chat keyboard toggle');
       assert.equal(await page.evaluate(()=>new Set(window.integrationLoads).size),await page.evaluate(()=>window.integrationLoads.length));
       if(['all','layout6','layout7'].includes(variant)) {
        await page.waitForFunction(()=>document.querySelector('[data-umami-stat="page_pv"]')?.textContent==='56');
        assert.equal(await page.locator('.ad-post').count(),1);assert.equal(await page.locator('.ad-aside').count(),1);assert.equal(await page.locator('.ad-index').count(),0);
        assert.equal((await page.content()).includes('synthetic-token-must-not-render'),false);
        assert.equal(await page.evaluate(()=>window.adsbygoogle.length),3);result.checks.push('all analytics, public stats, ads and token exclusion');
        // Let Halo's own visit-counter fetch finish before intentionally leaving the article.
        await page.waitForLoadState('networkidle');
        await page.goto(base+'/');await page.waitForFunction(()=>window.integrationLoads?.length===8);
        assert.equal(await page.locator('.ad-index').count(),Math.floor(await page.locator('.essay.home-layout > li.item').count()/3));assert.equal(await page.locator('.ad-post').count(),0);assert.equal(await page.locator('.theme-ad ins').count(),await page.locator('.ad-index').count()+1);await page.waitForFunction(()=>document.querySelector('[data-umami-stat="site_uv"]')?.textContent==='12');result.checks.push('home ad every three posts and site counters');
        await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
        const geometry=await page.evaluate(()=>{
         const cards=[...document.querySelectorAll('.essay.home-layout > li')];
         return cards.filter(node=>node.classList.contains('ad-index')).every(ad=>{
          const a=ad.getBoundingClientRect();
          return a.width>0 && a.right<=innerWidth+1 && cards.every(other=>{
           if(other===ad)return true;const b=other.getBoundingClientRect();
           return Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1;
          });
         });
        });assert.equal(geometry,true);result.checks.push('ad cards have width and do not overlap posts');
       }
      } else if(variant==='native') {
       await page.waitForFunction(()=>window.integrationLoads?.includes('chatra'));
       assert.equal(await page.locator('#chat-btn').count(),0);result.checks.push('native launcher retained');
      } else if(variant==='failed') {
       await page.waitForFunction(()=>!document.getElementById('chat-btn'));result.checks.push('failed SDK no inactive button or loading mask');
      } else if(variant==='resources') {
       assert(requested.some(url=>url.includes('/theme-mirror/js/post.min.js')));assert(requested.some(url=>url.includes('/theme-mirror/plugins/prism/prism.min.js')));await page.waitForSelector('.code-toolbar');result.checks.push('custom file and version resolve with bundled Prism');
      } else if(variant==='bad-resources') {
       assert(requested.some(url=>url.includes('/integration-fail.js')));await page.waitForSelector('.code-toolbar');assert(requested.some(url=>url.includes('/assets/js/post.min.js')));result.checks.push('CSS/script/Prism failure falls back');
      } else if(variant==='invalid-resources') {
       await page.waitForSelector('.code-toolbar');assert(requested.some(url=>url.includes('/assets/js/post.min.js')));result.checks.push('invalid and protocol-relative sources use local assets');
      } else if(variant==='versionless') {
       assert(requested.some(url=>url.endsWith('/assets/js/post.min.js')));assert(requested.some(url=>url.endsWith('/assets/plugins/prism/prism.min.css')));result.checks.push('version=false retains paths without query');
      } else {assert(requested.some(url=>new URL(url).origin!==base && url.endsWith('/css/all.min.css')));result.checks.push('font provider URL resolved');}
      if(engine==='chromium' && mode==='light' && ['disabled','all'].includes(variant)) {
       const screenshot=join(lab,`${variant}-${width}.png`);await page.screenshot({path:screenshot,fullPage:true});result.screenshot=screenshot;
      }
      assert.deepEqual(result.errors,[]);assert.deepEqual(result.blockedExternal,[]);result.status='passed';
     } catch(error){result.status='failed';result.error=error.message;throw error;} finally {await context.close();}
    }
   }
  } finally {await browser.close();}
  console.log(engine+': integration scenarios passed');
 }
} finally {
 try {await profile('restore');report.configurationRestored=true;}
 catch(error) {report.configurationRestored=false;report.restoreError=error.message;throw error;}
 finally {
  controller.stdin.end();lines.close();
  report.finishedAt=new Date().toISOString();
  const output=join(lab,'integration-browser.json');await writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log('Report:',output);
 }
}
