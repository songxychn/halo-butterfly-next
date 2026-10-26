/** Existing native-image behavior on an explicitly owned Halo candidate; never equate JS mutation with initial lazy HTML. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath,unlink,open} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {randomBytes} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl,validatePackage,sha256,requestPolicy} from '../browser/support.mjs';

const runId=randomBytes(8).toString('hex');
const navigationMode=process.env.IMAGE_NAVIGATION_MODE||'pjax';assert(['native','pjax'].includes(navigationMode));
assert.equal(process.env.ALLOW_SYNTHETIC_WRITES,'yes','ALLOW_SYNTHETIC_WRITES=yes is required');
assert(process.env.LAB_RUNTIME,'LAB_RUNTIME is required');
const runtime=await realpath(path.resolve(process.env.LAB_RUNTIME));
assert(runtime.startsWith(path.join(REPO,'.runtime')+path.sep),'Only this worktree runtime is allowed');
const identity=JSON.parse(await readFile(path.join(runtime,'lab.json'),'utf8'));
const base=validateBaseUrl(process.env.BASE_URL,identity);
const sourceSha=process.env.THEME_SOURCE_SHA;
assert.match(sourceSha||'',/^[a-f0-9]{40}$/,'THEME_SOURCE_SHA must identify the installed product');
const installed=JSON.parse(await readFile(path.join(runtime,'installed-package.json'),'utf8'));
assert.equal(path.basename(installed.name),installed.name,'Unsafe package filename');
validatePackage(installed,sourceSha,sha256(await readFile(path.join(REPO,'dist',installed.name))));
// Evidence tools/documents may advance, but never attribute a changed product to an old installed SHA.
execFileSync('git',['diff','--exit-code',sourceSha,'--','src','i18n','settings.yaml','theme.yaml','scripts/build.mjs','package.json','bun.lock','bunfig.toml'],{cwd:REPO,stdio:'pipe'});
const lock=path.join(runtime,'native-image-acceptance.lock');
const handle=await open(lock,'wx',0o600);await handle.writeFile(runId+'\n');await handle.close();
const output=path.join(runtime,'native-images',runId);await mkdir(output,{recursive:true});
Object.assign(process.env,browserEnvironment());
const report={schema:1,kind:'native-image-runtime-acceptance',runId,sourceSha,runnerHead:execFileSync('git',['rev-parse','HEAD'],{cwd:REPO,encoding:'utf8'}).trim(),artifactSha256:installed.sha256,halo:process.env.HALO_VERSION||'2.26.1',runnerSha256:sha256(await readFile(fileURLToPath(import.meta.url))),controllerSha256:sha256(await readFile(new URL('./native-fixture.py',import.meta.url))),checks:[],gaps:[],limitations:['Headless browser checks; not physical phones, actual Safari, screen reader or full fixed-Hexo parity.','Native lazy loading may fetch near-viewport images before entry; there is no zero-request-before-viewport assertion.','Ordinary author img without a loading attribute is recorded separately; post-parse JS lazy does not prove initial request deferral.','Broken authored images without an explicit fallback retain their URL and readable alt; no replacement is promised.']};
const save=()=>writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
let controller,browser,childExit,replyIterator,restored=false;
const receive=async event=>{
 for(;;){
  const reply=await replyIterator.next();
  if(reply.done)throw new Error('Fixture controller ended before '+event);
  const data=JSON.parse(reply.value);
  if(data.event==='error'){report.controllerError=data;await save();if(event!=='restored')throw new Error('Fixture controller '+data.stage+': '+data.message);}
  if(data.event==='restored'){report.restoration=data;restored=true;await save();}
  if(data.event===event)return data;
  if(data.event==='restored')throw new Error('Fixture restored before '+event);
 }
};
const configure=async profile=>{controller.stdin.write(profile+'\n');const result=await receive('configured');assert.equal(result.profile,profile);};
const imageState=(page,markup)=>page.evaluate(raw=>{
 const doc=raw===null?document:new DOMParser().parseFromString(raw,'text/html');
 const attrs=el=>el?Object.fromEntries([...el.attributes].map(x=>[x.name,x.value])):null;
 return {images:Object.fromEntries(['eager','plain','lazy','responsive','fallback','broken'].map(name=>{
  const img=doc.getElementById('native-'+name);return [name,{attrs:attrs(img),parent:img?.parentElement?.tagName,currentSrc:raw===null?img?.currentSrc:null,naturalWidth:raw===null?img?.naturalWidth:null}];
 })),source:attrs(doc.querySelector('#native-picture source')),theme:[...doc.querySelectorAll('img[data-theme-image]')].map(attrs),preloads:[...doc.querySelectorAll('link[rel=preload][as=image]')].map(attrs),end:doc.getElementById('native-images-end')?.textContent};
},markup??null);
const responsiveCandidate=(state,width)=>width>=800?state.source.srcset.trim():state.images.responsive.attrs.srcset.split(',').map(value=>value.trim().split(/\s+/)).find(([,density])=>density==='1x')[0];
const initialAssertions=(data,profile,letter)=>{
 const {images}=data;
 assert.equal(images.eager.attrs.loading,'eager');assert.equal(images.eager.attrs.fetchpriority,'high');
 assert.equal(images.lazy.attrs.loading,'lazy');assert.equal(images.responsive.attrs.loading,'lazy');
 assert.equal(images.plain.attrs.loading,undefined,'Plain author fixture unexpectedly changed; audit its server-side processor before updating expectations');
 assert.equal(images.responsive.parent,'PICTURE');assert.match(images.responsive.attrs.srcset,/narrow 1x, .*narrow2 2x$/);
 assert.equal(data.source.media,'(min-width: 800px)');assert(data.source.srcset.endsWith('-'+letter+'-wide'));
 assert(data.theme.length>0,'Need actual theme-generated images to test native scope');
 for(const img of data.theme){assert(img.src);assert.equal(img['data-lazy-src'],undefined);assert.equal(img.loading,profile==='native-site'?'lazy':'eager');}
 assert(data.preloads.some(x=>x.href==='/lab/cover-autumn-forest.webp?native-cover='+runId+'-'+letter&&x.fetchpriority==='high'),'Post first-screen cover must retain high-priority preload');
 assert.match(data.end,/仍可阅读/);
};
const loaded=async(page,id)=>{await page.locator('#'+id).scrollIntoViewIfNeeded();await page.waitForFunction(id=>{const i=document.getElementById(id);return i?.complete&&i.naturalWidth>0;},id);};
try{
 const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
 controller=spawn('python3',['-B','scripts/images/native-fixture.py','--runtime',runtime,'--source-sha',sourceSha,'--run-id',runId,'--allow-synthetic-writes','yes'],{cwd:REPO,env:process.env,stdio:['pipe','pipe','inherit']});
 controller.stdin.on('error',error=>{report.controllerInputError=error.message;process.exitCode=1;});
 childExit=new Promise((resolve,reject)=>{controller.once('exit',code=>resolve(code));controller.once('error',reject);});
 replyIterator=createInterface({input:controller.stdout})[Symbol.asyncIterator]();
 const fixture=await receive('ready');report.fixture=fixture;report.navigationMode=navigationMode;await save();
 const routeA=new URL(fixture.routes.a,base);assert.equal(routeA.origin,base);const routeB=new URL(fixture.routes.b,base);assert.equal(routeB.origin,base);
 for(const profile of ['native-site','native-post','disabled']){
  await configure(profile);
  const response=await fetch(routeA,{redirect:'error'});assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/^text\/html/);
  const markup=await response.text();await writeFile(path.join(output,profile+'-initial.html'),markup);
  for(const engine of (process.env.ENGINES||'chromium,firefox,webkit').split(',')){
   assert(['chromium','firefox','webkit'].includes(engine));
   browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
   for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
    const page=await context.newPage();page.setDefaultTimeout(10000);
    const item={profile,engine,width,js:true,requests:[],responses:[],errors:[],blocked:[]};
    page.on('pageerror',e=>item.errors.push(e.message));
    page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/lab/'))item.requests.push({url:r.url(),at:Date.now(),kind:r.resourceType()});});
    page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/lab/'))item.responses.push({url:r.url(),status:r.status()});});
    await context.route('**/*',route=>{const r=route.request();if(requestPolicy(r.url(),r.method(),base)==='blocked'){item.blocked.push({url:r.url(),method:r.method()});return route.abort();}return route.continue();});
    try{
     item.initial=await imageState(page,markup);initialAssertions(item.initial,profile,'a');
     await page.goto(routeA.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.MainApp?.useCommon);
     item.beforeScroll=await imageState(page);
     assert.equal(item.beforeScroll.images.eager.attrs.loading,'eager');
     for(const name of ['eager','plain','lazy','responsive']){
      assert.equal(item.beforeScroll.images[name].attrs.src,item.initial.images[name].attrs.src,'Author source changed: '+name);
      assert.equal(item.beforeScroll.images[name].attrs.srcset,item.initial.images[name].attrs.srcset,'Author srcset changed: '+name);
     }
     assert.equal(item.beforeScroll.images.responsive.parent,'PICTURE','Lightbox broke native picture source association');
     assert.equal(item.beforeScroll.source.srcset,item.initial.source.srcset);
     assert.equal(item.beforeScroll.images.plain.attrs.loading,profile==='disabled'?undefined:'lazy');
     item.firstScrollAt=Date.now();
     for(const name of ['native-eager','native-plain','native-lazy','native-responsive','native-fallback'])await loaded(page,name);
     await page.locator('#native-broken').scrollIntoViewIfNeeded();
     await page.waitForFunction(()=>document.getElementById('native-broken').complete);
     item.afterScroll=await imageState(page);
     assert.equal(item.afterScroll.images.responsive.currentSrc,new URL(responsiveCandidate(item.initial,width),base).href);
     assert.equal(item.afterScroll.images.fallback.currentSrc,base+item.initial.images.fallback.attrs['data-theme-image-fallback']);
     assert.equal(item.afterScroll.images.broken.attrs.src,item.initial.images.broken.attrs.src);assert.equal(item.afterScroll.images.broken.naturalWidth,0);assert(item.afterScroll.images.broken.attrs.alt);
     if(profile==='native-site'){
      await page.evaluate(()=>window.nativeImageSentinel='retained');
      item.navigation=[];
      for(let n=0;n<5;n++){
       const target=n%2===0?routeB:routeA;
       assert.equal(new URL(await page.locator('#native-next').getAttribute('href'),base).href,target.href,'Fixture next link must use actual Halo permalink');
       await page.locator('#native-next').click();
       await page.waitForFunction(target=>location.href===target&&!document.documentElement.classList.contains('theme-navigating')&&!!window.MainApp?.useCommon,target.href);
       assert.equal(await page.evaluate(()=>window.nativeImageSentinel),navigationMode==='pjax'?'retained':undefined,'Navigation must match declared '+navigationMode+' profile');
       assert.equal(await page.locator('#native-picture > img').count(),1);assert.equal(await page.locator('.theme-lightbox-trigger .theme-lightbox-trigger').count(),0);
       assert.equal(await page.locator('#native-eager').getAttribute('loading'),'eager');
       await loaded(page,'native-responsive');
       const selected=await page.locator('#native-responsive').evaluate(i=>i.currentSrc);
       assert(selected.endsWith((n%2===0?'-b':'-a')+(width>=800?'-wide':'-narrow')));
       item.navigation.push({path:target.pathname,currentSrc:selected,mode:navigationMode});
      }
     }
     assert.deepEqual(item.errors,[]);assert.deepEqual(item.blocked,[]);item.result='passed';
    }catch(error){item.result='failed';item.error=error.stack;process.exitCode=1;}
    finally{report.checks.push(item);await context.close();await save();console.log(profile,engine,width,item.result);}
   }
   if(engine==='chromium'){
    for(const width of [1440,390]){
     const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,javaScriptEnabled:false});
     const page=await context.newPage();page.setDefaultTimeout(10000);
     const item={profile,engine,width,js:false,blocked:[]};
     await context.route('**/*',route=>{if(requestPolicy(route.request().url(),route.request().method(),base)==='blocked'){item.blocked.push(route.request().url());return route.abort();}return route.continue();});
     try{
      await page.goto(routeA.href);item.initial=await imageState(page);initialAssertions(item.initial,profile,'a');
      for(const id of ['native-eager','native-plain','native-lazy','native-responsive'])await loaded(page,id);
      item.afterScroll=await imageState(page);assert.equal(item.afterScroll.images.responsive.parent,'PICTURE');
      assert.equal(item.afterScroll.images.responsive.currentSrc,new URL(responsiveCandidate(item.initial,width),base).href);
      assert.equal(item.afterScroll.images.plain.attrs.loading,undefined);assert.match(await page.locator('#native-images-end').innerText(),/仍可阅读/);assert.deepEqual(item.blocked,[]);item.result='passed';
     }catch(error){item.result='failed';item.error=error.stack;process.exitCode=1;}
     finally{report.checks.push(item);await context.close();await save();console.log(profile,engine,width,'no-js',item.result);}
    }
   }
   await browser.close();browser=null;
  }
 }
 report.gaps.push({id:'author-plain-initial-loading',status:'mapping-required',finding:'The fixture without loading is unchanged in initial HTML. With native enabled, theme JS later sets loading=lazy. Initial request deferral for arbitrary unannotated author images remains unproven; author-supplied native loading is tested separately.'});
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
 await browser?.close();
 if(controller){
  try{if(!controller.stdin.destroyed){controller.stdin.end('restore\n');}if(!restored)await receive('restored');assert.equal(report.restoration.result,'passed');}
  catch(error){report.restorationError=error.stack;process.exitCode=1;}
  try{report.controllerExitCode=await childExit;if(report.controllerExitCode!==0)process.exitCode=1;}
  catch(error){report.controllerExitError=error.stack;process.exitCode=1;}
 }
 report.result=process.exitCode===1||!report.checks.length?'failed':'scoped-passed-with-open-mapping';
 await save();await unlink(lock);console.log('Native image evidence:',output);
}
