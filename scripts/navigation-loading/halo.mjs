import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {browserEnvironment,RUNTIME,REPO,validateBaseUrl,validatePackage,sha256} from '../browser/support.mjs';
const lab=path.join(REPO,'.runtime/comparison');
const identity=JSON.parse(await readFile(path.join(lab,'lab.json')));
const base=validateBaseUrl(process.env.BASE_URL,identity);
const installed=JSON.parse(await readFile(path.join(lab,'installed-package.json')));
validatePackage(installed,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha256(await readFile(path.join(REPO,'dist',installed.name))));
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const results=[];
const controller=spawn('python3',['scripts/navigation-loading/lab.py','--stream'],{cwd:REPO,env:{...process.env,HALO_PORT:String(identity.ports.halo),HEXO_PORT:String(identity.ports.hexo)},stdio:['pipe','pipe','inherit']});
const replies=createInterface({input:controller.stdout})[Symbol.asyncIterator]();
const profile=async name=>{
  controller.stdin.write(name+'\n');
  for(;;){const reply=await replies.next();if(reply.done)throw new Error('Lab configuration process ended');if(reply.value==='configured:'+name)return;}
};
let browser;
try {
  await profile('native');
  for(const engine of (process.env.NAV_PROFILES_ONLY ? [] : (process.env.ENGINES||'chromium,firefox,webkit').split(','))) {
    browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
    for(const width of [1440,390]) for(const mode of ['light','dark']) {
      console.log(engine,width,mode,'starting');
      const context=await browser.newContext({viewport:{width,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
      await context.addInitScript(mode=>{if(!localStorage.getItem('halo-butterfly-next.color-scheme'))localStorage.setItem('halo-butterfly-next.color-scheme',mode);},mode);
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.MainApp?.useCommon&&!document.body.classList.contains('loading'));
      await page.evaluate(()=>window.navigationSentinel='halo');
      const routes=['/page/2/','/categories/','/tags/','/archives/','/page/2/','/'];
      for(const route of routes) {
        console.log(engine,width,mode,route);
        // Use a real link activation with the normal document event chain.
        await page.evaluate(route=>{const a=document.createElement('a');a.href=route;a.textContent='fixture navigation';document.querySelector('main').prepend(a);a.click();a.remove();},route);
        await page.waitForFunction(path=>location.pathname===path&&!document.documentElement.classList.contains('theme-navigating')&&!!MainApp.useCommon,route,{timeout:20000});
        assert.equal(await page.evaluate(()=>window.navigationSentinel),'halo',`${engine} ${route}: unexpected reload`);
        assert.equal(await page.locator('html').getAttribute('data-color-scheme'),mode);
        assert.equal(await page.locator('#Butterfly').count(),1);
        if(route==='/archives/preview-1/') await page.waitForSelector('.code-toolbar');
      }
      await page.evaluate(()=>scrollTo({top:700,behavior:'instant'}));
      await page.locator('#rightside-config').click();
      await page.locator('#darkmode').click();
      assert.equal(await page.locator('.theme-notice').count(),1);
      assert.equal(await page.locator('html').getAttribute('data-color-scheme'),mode==='dark'?'light':'dark');
      await page.screenshot({path:path.join(RUNTIME,`navigation-${engine}-${width}-${mode}.png`),fullPage:false});
      await page.evaluate(()=>{const a=document.createElement('a');a.href='/archives/preview-1/';document.body.append(a);a.click();});
      await page.waitForFunction(()=>window.navigationSentinel===undefined);
      await page.waitForSelector('.code-toolbar');
      assert.equal(await page.locator('html').getAttribute('data-color-scheme'),mode==='dark'?'light':'dark');
      assert.deepEqual(errors,[],`${engine}/${width}/${mode}`);
      results.push({engine,width,mode,routes,status:'passed'});await context.close();
    }
    await browser.close();browser=null;console.log(engine+': real Halo navigation passed');
  }
  browser=await pw.chromium.launch({headless:true,channel:'chromium'});
  for(const name of ['deferred','post','off']) {
    console.log('image profile:',name);await profile(name);
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!MainApp.useCommon);
    assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('loading')),false);
    const images=page.locator('img[data-theme-image]');assert(await images.count()>0);
    if(name==='deferred') {
      const late=page.locator('.home-layout img[data-lazy-src]:visible').last();assert(await late.count()>0);
      await late.evaluate(image=>image.id='navigation-image-target');
      await late.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.getElementById('navigation-image-target').hasAttribute('data-lazy-src'));
    } else {assert.equal(await page.locator('img[data-lazy-src]').count(),0);assert.equal(await images.first().getAttribute('loading'),'eager');}
    if(name==='off') assert.equal(await page.evaluate(()=>MainApp.conf.pjax_enable),false);
    results.push({profile:name,status:'passed'});await page.close();
  }
  await profile('deferred');
  const nojs=await browser.newContext({javaScriptEnabled:false});const page=await nojs.newPage();
  await page.goto(base);assert(await page.locator('noscript img').count()>0);assert(await page.locator('noscript img').first().isVisible());await nojs.close();
  results.push({profile:'deferred-no-js',status:'passed'});
}finally{
  await browser?.close();
  try {await profile('native');} finally {controller.stdin.end();}
  await mkdir(path.join(REPO,'.runtime/navigation-loading'),{recursive:true});
  await writeFile(path.join(REPO,process.env.NAV_PROFILES_ONLY ? '.runtime/navigation-loading/halo-profiles.json' : '.runtime/navigation-loading/halo.json'),JSON.stringify({sourceSha:installed.sourceCommit,artifactSha256:installed.sha256,halo:'2.26.1',results,limitations:['Optional plugins disabled','Headless browsers, not real Safari/devices','No full fixed-Hexo parity acceptance']},null,2)+'\n');
}
