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
const lock=path.join(runtime,'image-blur-options.lock');
const handle=await open(lock,'wx',0o600);await handle.writeFile(runId+'\n');await handle.close();
const output=path.join(runtime,'image-blur-options',runId);await mkdir(output,{recursive:true});
Object.assign(process.env,browserEnvironment());
const report={schema:1,kind:'image-blur-options-runtime-acceptance',runId,sourceSha,runnerHead:execFileSync('git',['rev-parse','HEAD'],{cwd:REPO,encoding:'utf8'}).trim(),artifactSha256:installed.sha256,halo:'2.26.1',runnerSha256:sha256(await readFile(fileURLToPath(import.meta.url))),controllerSha256:sha256(await readFile(new URL('./native-fixture.py',import.meta.url))),checks:[],gaps:[],limitations:['Headless browser checks; not physical phones, actual Safari, screen reader or full fixed-Hexo parity.','Native lazy loading may fetch near-viewport images before entry; there is no zero-request-before-viewport assertion.','Ordinary author img without a loading attribute is recorded separately; post-parse JS lazy does not prove initial request deferral.','Broken authored images without an explicit fallback retain their URL and readable alt; no replacement is promised.']};
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

const scope=process.env.BLUR_OPTIONS_SCOPE||'full';assert(['full','site-blur-only'].includes(scope),'Unsupported blur option scope');report.scope=scope;
const selectors={inside:'#native-lazy',outside:'#pagination img[data-theme-image]',plain:'#native-plain'};
const state=page=>page.evaluate(selectors=>Object.fromEntries(Object.entries(selectors).map(([key,selector])=>{const i=document.querySelector(selector);return [key,{src:i.getAttribute('src'),url:i.currentSrc||i.src,loading:i.getAttribute('loading'),pending:i.classList.contains('theme-image-pending'),filter:getComputedStyle(i).filter,complete:i.complete,width:i.naturalWidth,inArticle:!!i.closest('article.render')}];})),selectors);
const waitBounded=promise=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Held target request not observed within 10s')),10000);promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
try{
 const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
 controller=spawn('python3',['-B','scripts/images/native-fixture.py','--runtime',runtime,'--source-sha',sourceSha,'--run-id',runId,'--allow-synthetic-writes','yes'],{cwd:REPO,env:process.env,stdio:['pipe','pipe','inherit']});
 controller.stdin.on('error',error=>{report.controllerInputError=error.message;process.exitCode=1;});
 childExit=new Promise((resolve,reject)=>{controller.once('exit',code=>resolve(code));controller.once('error',reject);});
 replyIterator=createInterface({input:controller.stdout})[Symbol.asyncIterator]();
 const fixture=await receive('ready');report.fixture=fixture;await save();
 const routeA=new URL(fixture.routes.a,base);assert.equal(routeA.origin,base);
 for(const [profile,field,blur] of [['native-post','post',true],['native-post-clear','post',false],['native-site-blur','site',true],['native-site','site',false]].filter(([name])=>scope==='full'||name==='native-site-blur')){
  await configure(profile);
  const response=await fetch(routeA,{redirect:'error'});assert.equal(response.status,200);const markup=await response.text();await writeFile(path.join(output,profile+'-initial.html'),markup);
  for(const engine of ['chromium','firefox','webkit']){
   browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
   const context=await browser.newContext({viewport:{width:390,height:900},deviceScaleFactor:1,locale:'zh-CN'});
   const page=await context.newPage();page.setDefaultTimeout(10000);
   const item={engine,version:browser.version(),width:390,profile,field,blur,errors:[],blocked:[],rounds:[]};
   page.on('pageerror',e=>item.errors.push(e.message));
   const initial=await page.evaluate(({raw,selectors})=>{const doc=new DOMParser().parseFromString(raw,'text/html');return Object.fromEntries(Object.entries(selectors).map(([key,selector])=>{const i=doc.querySelector(selector);return [key,{src:i.getAttribute('src'),loading:i.getAttribute('loading'),inArticle:!!i.closest('article.render')}];}));},{raw:markup,selectors});item.initial=initial;
   assert(initial.inside.inArticle&&!initial.outside.inArticle,'Require actual inside/outside theme DOM');
   const targetUrls=new Set([new URL(initial.inside.src,base).href,new URL(initial.outside.src,base).href]);
   let activeRound;
   await context.route('**/*',async route=>{const r=route.request();if(requestPolicy(r.url(),r.method(),base)==='blocked'){item.blocked.push(r.url());return route.abort();}
    if(activeRound&&targetUrls.has(r.url())){const round=activeRound;const upstream=await route.fetch();const body=await upstream.body();round.held[r.url()]={status:upstream.status(),bodySha256:sha256(body)};if(Object.keys(round.held).length===2)round.observed();await round.gate;return route.fulfill({response:upstream,body});}
    return route.continue();
   });
   try{
    for(const navigation of ['initial','refresh']){
     let release,observed;const gate=new Promise(r=>release=r),seen=new Promise(r=>observed=r);activeRound={held:{},gate,observed};const round={navigation};item.rounds.push(round);
     try{
      if(navigation==='initial')await page.goto(routeA.href,{waitUntil:'domcontentloaded',timeout:20000});else await page.reload({waitUntil:'domcontentloaded',timeout:20000});
      await page.waitForFunction(()=>!!window.MainApp?.useCommon);
      for(const key of ['inside','outside'])await page.locator(selectors[key]).scrollIntoViewIfNeeded();await waitBounded(seen);
      round.held=activeRound.held;for(const key of ['inside','outside']){const expected=blur&&(key==='inside'||field==='site')?'blur(50px) brightness(1)':'none';await page.waitForFunction(({selector,expected})=>getComputedStyle(document.querySelector(selector)).filter===expected,{selector:selectors[key],expected},{timeout:10000});}round.pending=await state(page);
      for(const key of ['inside','outside']){const expected=blur&&(key==='inside'||field==='site');assert.equal(round.pending[key].pending,expected,key+' pending scope');assert.equal(round.pending[key].filter,expected?'blur(50px) brightness(1)':'none',key+' filter scope');assert.equal(round.pending[key].loading,key==='inside'||field==='site'?'lazy':'eager');assert.equal(round.held[new URL(initial[key].src,base).href].status,200);}
      release();
      for(const key of ['inside','outside']){await page.locator(selectors[key]).scrollIntoViewIfNeeded();await page.waitForFunction(selector=>{const i=document.querySelector(selector);return i.complete&&i.naturalWidth>0&&!i.classList.contains('theme-image-pending')&&getComputedStyle(i).filter==='none';},selectors[key]);}
      round.loaded=await state(page);for(const key of ['inside','outside']){assert.equal(round.loaded[key].filter,'none');assert.equal(round.loaded[key].src,initial[key].src);}
      round.result='passed';
     }finally{release();activeRound=null;}
    }
    assert.deepEqual(item.errors,[]);assert.deepEqual(item.blocked,[]);item.result='passed';
   }catch(e){item.result='failed';item.error=e.stack;process.exitCode=1;}
   finally{report.checks.push(item);await save();await context.close();await browser.close();browser=null;console.log(profile,engine,item.result);}
  }
 }
 if(scope==='full'){await configure('native-post');
 for(const engine of ['chromium','firefox','webkit']){
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  // No route interception: Playwright routing disables HTTP caching.
  const context=await browser.newContext({viewport:{width:390,height:900},deviceScaleFactor:1});
  await context.addInitScript(()=>{window.imageBoundSnapshots=[];new MutationObserver(records=>{for(const r of records){const i=r.target;if(i.id==='native-plain'&&i.hasAttribute('data-fallback-bound'))window.imageBoundSnapshots.push({complete:i.complete,width:i.naturalWidth,pending:i.classList.contains('theme-image-pending')});}}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-fallback-bound']});});
  const page=await context.newPage();page.setDefaultTimeout(10000);const item={engine,version:browser.version(),width:390,profile:'native-post',kind:'actual-cache-refresh',errors:[],foreignRequests:[]};page.on('pageerror',e=>item.errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==base)item.foreignRequests.push(r.url());});
  try{
   await page.goto(routeA.href,{waitUntil:'domcontentloaded',timeout:20000});await page.locator(selectors.plain).scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const i=document.getElementById('native-plain');return i.complete&&i.naturalWidth>0&&!i.classList.contains('theme-image-pending');});
   item.warm=await state(page);
   await page.reload({waitUntil:'domcontentloaded',timeout:20000});await page.waitForFunction(()=>!!window.MainApp?.useCommon);await page.waitForFunction(()=>{const i=document.getElementById('native-plain');return i.complete&&i.naturalWidth>0&&!i.classList.contains('theme-image-pending');});
   item.refreshed=await state(page);item.binding=await page.evaluate(()=>window.imageBoundSnapshots);item.resourceTiming=await page.evaluate(()=>performance.getEntriesByName(document.getElementById('native-plain').src).map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize,duration:e.duration})));
   assert(item.resourceTiming.some(r=>r.transferSize===0&&r.decodedBodySize>0),'No actual image cache-hit timing evidence');assert(item.binding.some(r=>r.complete&&r.width>0&&!r.pending),'No complete cached-image binding observation');assert.equal(item.refreshed.plain.filter,'none');assert.equal(item.refreshed.plain.src,item.warm.plain.src);assert.deepEqual(item.errors,[]);assert.deepEqual(item.foreignRequests,[]);item.result='passed';
  }catch(e){item.result='failed';item.error=e.stack;process.exitCode=1;}finally{report.checks.push(item);await save();await context.close();await browser.close();browser=null;console.log('cache',engine,item.result);}
 }
}
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
 await browser?.close();if(controller){try{if(!controller.stdin.destroyed)controller.stdin.end('restore\n');if(!restored)await receive('restored');assert.equal(report.restoration.result,'passed');}catch(error){report.restorationError=error.stack;process.exitCode=1;}try{report.controllerExitCode=await childExit;if(report.controllerExitCode!==0)process.exitCode=1;}catch(error){report.controllerExitError=error.stack;process.exitCode=1;}}
 report.result=process.exitCode===1||report.checks.length!==(scope==='full'?15:3)?'failed':'scoped-passed-with-open-mapping';await save();await unlink(lock);console.log('Image options evidence:',output);
}
