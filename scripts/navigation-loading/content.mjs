/** Full content navigation against this checkout's owned Halo fixture. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl,validatePackage,sha256} from '../browser/support.mjs';
const lab=path.join(REPO,'.runtime/comparison');
const identity=JSON.parse(await readFile(path.join(lab,'lab.json')));
const base=validateBaseUrl(process.env.BASE_URL,identity);
const installed=JSON.parse(await readFile(path.join(lab,'installed-package.json')));
validatePackage(installed,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha256(await readFile(path.join(REPO,'dist',installed.name))));
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const output=path.join(REPO,'.runtime/navigation-loading');await mkdir(output,{recursive:true});
const report={theme:installed,halo:'2.26.1',widget:'3.3.2',results:[],limitations:['Headless browsers only; physical Safari/devices and fixed-Hexo full contract pending.','Unknown scripts, SDKs, custom elements and embeds keep full document navigation.']};
let browser;
const save=()=>writeFile(path.join(output,'content.json'),JSON.stringify(report,null,2)+'\n');
try{
 for(const engine of (process.env.ENGINES||'chromium,firefox,webkit').split(',')){
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  for(const width of [1440,390])for(const mode of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
   await context.addInitScript(mode=>localStorage.setItem('halo-butterfly-next.color-scheme',mode),mode);
   await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
   const page=await context.newPage(),errors=[],views=[],counterStatuses=[];
   page.setDefaultTimeout(15000);
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(process.env.DEBUG_NAV)console.log(engine,width,m.text());});
   page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/apis/api.halo.run/v1alpha1/trackers/counter'))views.push(r.postDataJSON());});
   page.on('response',r=>{if(r.request().method()==='POST'&&r.url().endsWith('/apis/api.halo.run/v1alpha1/trackers/counter'))counterStatuses.push(r.status());});
   const navigate=async route=>{
    if(process.env.DEBUG_NAV)console.log('before',route,await page.evaluate(()=>({scripts:[...document.scripts].map(s=>({type:s.type,kind:s.dataset.themeScript,src:s.src,inline:s.src?'':s.textContent.slice(0,120)})),custom:[...document.querySelectorAll('*')].filter(n=>n.localName.includes('-')).map(n=>[n.localName,!!n.closest('[data-comment-lazy][data-group="content.halo.run"] [data-comment-host]')]),blocked:document.querySelector('base,iframe,object,embed,halo-comment,[data-no-pjax]')?.outerHTML})));
    await page.evaluate(route=>{const a=document.createElement('a');a.href=route;document.body.append(a);a.click();a.remove();},route);
    await page.waitForFunction(route=>location.pathname===route&&!document.documentElement.classList.contains('theme-navigating')&&!!MainApp.useCommon,route,{timeout:30000});
    assert.equal(await page.evaluate(()=>window.contentNavigationSentinel),'persistent',engine+' '+route+' reloaded');
    assert.equal(await page.locator('html').getAttribute('data-color-scheme'),mode);
   };
   await page.goto(base+'/archives/preview-1/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.MainApp?.useCommon);
   await page.evaluate(()=>window.contentNavigationSentinel='persistent');
   assert.equal(await page.locator('script[src*="halo-tracker.js"]').count(),0);
   const subjects=[['/archives/preview-1/','Post','preview-1'],['/archives/preview-2/','Post','preview-2'],['/about-preview/','SinglePage','about-preview'],['/archives/preview-1/','Post','preview-1']];
   for(let cycle=0;cycle<2;cycle++)for(const [index,[route,kind,name]] of subjects.entries()){
    if(cycle||index)await navigate(route);
    await page.evaluate(()=>document.getElementById('post-comment').dispatchEvent(new Event('theme:load-comments')));
    await page.waitForSelector('comment-widget',{state:'attached'});
    assert.deepEqual(await page.locator('comment-widget').evaluate(w=>({kind:w.kind,name:w.name})),{kind,name});
    assert.equal(await page.locator('comment-widget').count(),1);
    // The old widget must disconnect, while a new subject gets a fresh editor.
    await page.evaluate(()=>window.oldCommentWidget=document.querySelector('comment-widget'));
    await navigate('/archives/');
    assert.equal(await page.evaluate(()=>window.oldCommentWidget.isConnected),false);
   }
   assert.deepEqual(views.map(v=>[v.plural,v.name]),[...subjects,...subjects].map(([,kind,name])=>[kind==='Post'?'posts':'singlepages',name]));
   await page.goBack();await page.waitForFunction(()=>location.pathname==='/archives/preview-1/'&&!document.documentElement.classList.contains('theme-navigating'));
   await page.waitForFunction(()=>document.querySelector('comment-widget')?.name==='preview-1');
   assert.equal(await page.evaluate(()=>window.contentNavigationSentinel),'persistent');
   assert.equal(views.at(-1).name,'preview-1');assert.equal(views.length,9);
   await page.goForward();await page.waitForFunction(()=>location.pathname==='/archives/'&&!document.documentElement.classList.contains('theme-navigating'));
   assert.equal(views.length,9);
   for(let i=0;i<2;i++){
    await navigate('/archives/pjax-rich-content/');
    await page.waitForFunction(()=>document.querySelectorAll('[data-render-state="rendered"]').length===3,{},{timeout:30000});
    await page.waitForFunction(()=>document.querySelector('.gallery-container')?.classList.contains('loaded'));
    assert.equal(await page.locator('.theme-render-output canvas').count(),1);
    assert(await page.locator('.theme-render-output svg').count()>=2);
    await page.evaluate(()=>window.oldRenderer=document.querySelector('.theme-render-output'));
    await navigate('/archives/');
    assert.equal(await page.evaluate(()=>window.oldRenderer.isConnected),false);
   }
   await navigate('/archives/preview-1/');
   const editor=page.locator('comment-widget [contenteditable="true"]').first();
   await editor.click();await editor.pressSequentially('Unsubmitted PJAX fixture draft',{delay:10});
   await page.waitForFunction(()=>Object.keys(localStorage).some(key=>(localStorage.getItem(key)||'').includes('Unsubmitted PJAX fixture draft')));
   const dialogPromise=page.waitForEvent('dialog');
   const leave=page.evaluate(()=>{const a=document.createElement('a');a.href='/archives/';document.body.append(a);a.click();a.remove();});
   const dialog=await dialogPromise;assert.equal(dialog.type(),'beforeunload');await dialog.dismiss();await leave;
   assert.equal(new URL(page.url()).pathname,'/archives/preview-1/');
   assert.equal(await page.evaluate(()=>window.contentNavigationSentinel),'persistent');
   assert.match(await editor.innerText(),/Unsubmitted PJAX fixture draft/);
   await editor.press('ControlOrMeta+A');await editor.press('Backspace');
   await page.waitForFunction(()=>!Object.keys(localStorage).some(key=>(localStorage.getItem(key)||'').includes('Unsubmitted PJAX fixture draft')));
   await navigate('/archives/');
   assert.equal(counterStatuses.length,views.length);assert(counterStatuses.every(status=>status===200));
   await page.screenshot({path:path.join(output,`content-${engine}-${width}-${mode}.png`)});
   assert.deepEqual(errors,[]);
   report.results.push({engine,width,mode,cycles:2,rendererCycles:2,draftExitProtection:'native-dialog-dismissed',counterStatuses,visits:views.length,identities:views.map(v=>[v.plural,v.name]),result:'passed'});await save();
   await context.close();console.log('PASS',engine,width,mode);
  }
  await browser.close();browser=null;
 }
}catch(error){report.failure=error.stack;throw error;}finally{await browser?.close();await save();}
