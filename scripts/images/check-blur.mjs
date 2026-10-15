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
const lock=path.join(runtime,'image-blur-acceptance.lock');
const handle=await open(lock,'wx',0o600);await handle.writeFile(runId+'\n');await handle.close();
const output=path.join(runtime,'image-blur',runId);await mkdir(output,{recursive:true});
Object.assign(process.env,browserEnvironment());
const report={schema:1,kind:'image-blur-runtime-acceptance',runId,sourceSha,runnerHead:execFileSync('git',['rev-parse','HEAD'],{cwd:REPO,encoding:'utf8'}).trim(),artifactSha256:installed.sha256,halo:'2.26.1',runnerSha256:sha256(await readFile(fileURLToPath(import.meta.url))),controllerSha256:sha256(await readFile(new URL('./native-fixture.py',import.meta.url))),checks:[],gaps:[],limitations:['Headless browser checks; not physical phones, actual Safari, screen reader or full fixed-Hexo parity.','Native lazy loading may fetch near-viewport images before entry; there is no zero-request-before-viewport assertion.','Ordinary author img without a loading attribute is recorded separately; post-parse JS lazy does not prove initial request deferral.','Broken authored images without an explicit fallback retain their URL and readable alt; no replacement is promised.']};
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
const state=page=>page.evaluate(()=>Object.fromEntries(['eager','plain','lazy','responsive','fallback','broken'].map(key=>{const i=document.getElementById('native-'+key);return [key,{src:i.getAttribute('src'),loading:i.getAttribute('loading'),pending:i.classList.contains('theme-image-pending'),filter:getComputedStyle(i).filter,complete:i.complete,width:i.naturalWidth,currentSrc:i.currentSrc,alt:i.alt,parent:i.parentElement.tagName}];})));
const loaded=async(page,id)=>{await page.locator('#native-'+id).scrollIntoViewIfNeeded();await page.waitForFunction(id=>{const i=document.getElementById('native-'+id);return i.complete&&i.naturalWidth>0&&!i.classList.contains('theme-image-pending');},id,{timeout:10000});};
try{
 const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
 controller=spawn('python3',['-B','scripts/images/native-fixture.py','--runtime',runtime,'--source-sha',sourceSha,'--run-id',runId,'--allow-synthetic-writes','yes'],{cwd:REPO,env:process.env,stdio:['pipe','pipe','inherit']});
 controller.stdin.on('error',error=>{report.controllerInputError=error.message;process.exitCode=1;});
 childExit=new Promise((resolve,reject)=>{controller.once('exit',code=>resolve(code));controller.once('error',reject);});
 replyIterator=createInterface({input:controller.stdout})[Symbol.asyncIterator]();
 const fixture=await receive('ready');report.fixture=fixture;await save();
 const routeA=new URL(fixture.routes.a,base);assert.equal(routeA.origin,base);
 await configure('native-post');
 const response=await fetch(routeA,{redirect:'error'});assert.equal(response.status,200);
 const markup=await response.text();await writeFile(path.join(output,'initial.html'),markup);
 report.initialHtmlSha256=sha256(markup);
 report.gaps.push({id:'author-plain-initial-loading',status:'mapping-required',finding:'Initial server HTML preserves author img without loading. Subsequent JS lazy attribute does not prove initial request deferral.'});
 for(const engine of ['chromium','firefox','webkit']){
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,locale:'zh-CN'});
   const page=await context.newPage();page.setDefaultTimeout(10000);
   const item={engine,version:browser.version(),width,js:true,requests:[],errors:[],blocked:[],assertions:[]};
   const ledger=new Map();let requestId=0;page.on('request',r=>{const row={id:++requestId,url:r.url(),type:r.resourceType(),state:'pending'};ledger.set(r,row);item.requests.push(row);});
   page.on('response',r=>{const row=ledger.get(r.request());if(row)row.status=r.status();});
   page.on('requestfinished',r=>{const row=ledger.get(r);if(row)row.state='finished';});
   page.on('requestfailed',r=>{const row=ledger.get(r);if(row){row.state='failed';row.error=r.failure()?.errorText;}});
   page.on('pageerror',e=>item.errors.push(e.message));
   let release;const gate=new Promise(resolve=>release=resolve);let held=false;let signalHeld;const heldRequest=new Promise(resolve=>signalHeld=resolve);
   await context.route('**/*',async route=>{const r=route.request();if(requestPolicy(r.url(),r.method(),base)==='blocked'){item.blocked.push({url:r.url(),method:r.method()});return route.abort();}
    if(new URL(r.url()).searchParams.get('native')===runId+'-a-lazy'){held=true;signalHeld();const upstream=await route.fetch();item.heldResponse={status:upstream.status(),bodySha256:sha256(await upstream.body())};await gate;return route.fulfill({response:upstream});}
    return route.continue();
   });
   try{
    item.initial=await page.evaluate(raw=>{const doc=new DOMParser().parseFromString(raw,'text/html');return ['eager','plain','lazy'].map(name=>{const i=doc.getElementById('native-'+name);return {name,loading:i.getAttribute('loading'),pending:i.classList.contains('theme-image-pending')};});},markup);
    assert.deepEqual(item.initial,[{name:'eager',loading:'eager',pending:false},{name:'plain',loading:null,pending:false},{name:'lazy',loading:'lazy',pending:false}]);
    await page.goto(routeA.href,{waitUntil:'domcontentloaded',timeout:20000});await page.waitForFunction(()=>!!window.MainApp?.useCommon);
    await page.locator('#native-lazy').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.querySelector('#native-lazy').classList.contains('theme-image-pending'));
    await Promise.race([heldRequest,new Promise((_,reject)=>setTimeout(()=>reject(Error('Lazy request was not intercepted within 10s')),10000))]);item.pending=await state(page);assert(held,'Lazy request was not intercepted');assert.equal(item.pending.lazy.width,0);assert.match(item.pending.lazy.filter,/blur\(50px\)/);assert.equal(item.pending.eager.pending,false);assert.equal(item.pending.eager.loading,'eager');assert.equal(item.pending.plain.loading,'lazy');
    await page.screenshot({path:path.join(output,engine+'-'+width+'-pending.png'),timeout:5000,animations:'disabled'});item.assertions.push('Pending native image has blur(50px); explicit eager image exempt; initial unannotated HTML remains unmapped');
    release();await loaded(page,'lazy');
    item.loaded=await state(page);assert.equal(item.loaded.lazy.filter,'none');assert.equal(item.loaded.lazy.src,item.pending.lazy.src);assert.equal(item.heldResponse.status,200);
    await page.screenshot({path:path.join(output,engine+'-'+width+'-loaded.png'),timeout:5000,animations:'disabled'});item.assertions.push('Successful load removes pending class and filter without changing author URL');
    await loaded(page,'responsive');await loaded(page,'fallback');await page.locator('#native-broken').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>{const i=document.getElementById('native-broken');return i.complete&&!i.classList.contains('theme-image-pending');});
    item.final=await state(page);assert.equal(item.final.responsive.parent,'PICTURE');assert(item.final.responsive.currentSrc.endsWith(width>=800?'-a-wide':'-a-narrow'));assert(item.final.fallback.currentSrc.endsWith('-a-fallback'));assert.equal(item.final.fallback.filter,'none');assert.equal(item.final.broken.width,0);assert.equal(item.final.broken.filter,'none');assert.equal(item.final.broken.src,item.pending.broken.src);assert(item.final.broken.alt);item.assertions.push('Responsive picture preserved; explicit 404 fallback loads without blur; missing author image retains URL/alt without blur');
    assert.deepEqual(item.errors,[]);assert.deepEqual(item.blocked,[]);item.result='passed';
   }catch(error){item.result='failed';item.error=error.stack;process.exitCode=1;}
   finally{release();item.beforeClose=await state(page).catch(e=>({error:e.message}));item.pendingBeforeClose=item.requests.filter(r=>r.state==='pending').map(r=>({...r}));report.checks.push(item);await save();await context.close();console.log(engine,width,item.result);}
  }
  // Independent no-script context: server HTML and normal native images remain readable.
  const context=await browser.newContext({viewport:{width:390,height:900},javaScriptEnabled:false});const page=await context.newPage();page.setDefaultTimeout(10000);
  const item={engine,version:browser.version(),width:390,js:false,errors:[]};
  try{await page.goto(routeA.href,{waitUntil:'domcontentloaded',timeout:20000});for(const id of ['eager','plain','lazy','responsive'])await loaded(page,id);item.state=await state(page);for(const value of Object.values(item.state)){assert.equal(value.pending,false);assert.equal(value.filter,'none');}assert.equal(item.state.plain.loading,null);assert.match(await page.locator('#native-images-end').innerText(),/仍可阅读/);assert.equal(item.state.responsive.parent,'PICTURE');item.result='passed';}catch(e){item.result='failed';item.error=e.stack;process.exitCode=1;}finally{report.checks.push(item);await save();await context.close();}
  await browser.close();browser=null;
 }
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
 await browser?.close();
 if(controller){
  try{if(!controller.stdin.destroyed)controller.stdin.end('restore\n');if(!restored)await receive('restored');assert.equal(report.restoration.result,'passed');}
  catch(error){report.restorationError=error.stack;process.exitCode=1;}
  try{report.controllerExitCode=await childExit;if(report.controllerExitCode!==0)process.exitCode=1;}catch(error){report.controllerExitError=error.stack;process.exitCode=1;}
 }
 report.result=process.exitCode===1||report.checks.length!==9?'failed':'scoped-passed-with-open-mapping';
 await save();await unlink(lock);console.log('Image blur evidence:',output);
}
