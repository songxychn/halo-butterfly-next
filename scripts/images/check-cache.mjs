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
const lock=path.join(runtime,'native-image-cache.lock');
const handle=await open(lock,'wx',0o600);await handle.writeFile(runId+'\n');await handle.close();
const output=path.join(runtime,'native-image-cache',runId);await mkdir(output,{recursive:true});
Object.assign(process.env,browserEnvironment());
const report={schema:1,kind:'native-image-cache-runtime-acceptance',runId,sourceSha,runnerHead:execFileSync('git',['rev-parse','HEAD'],{cwd:REPO,encoding:'utf8'}).trim(),artifactSha256:installed.sha256,halo:process.env.HALO_VERSION||'2.26.1',runnerSha256:sha256(await readFile(fileURLToPath(import.meta.url))),controllerSha256:sha256(await readFile(new URL('./native-fixture.py',import.meta.url))),checks:[],gaps:[],limitations:['Headless browser checks; not physical phones, actual Safari, screen reader or full fixed-Hexo parity.','Native lazy loading may fetch near-viewport images before entry; there is no zero-request-before-viewport assertion.','Ordinary author img without a loading attribute is recorded separately; post-parse JS lazy does not prove initial request deferral.','Broken authored images without an explicit fallback retain their URL and readable alt; no replacement is promised.']};
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

try{
 const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
 assert(process.env.DEBUG?.includes('pw:protocol'),'Protocol capture is required; run with DEBUG=pw:protocol');
 controller=spawn('python3',['-B','scripts/images/native-fixture.py','--runtime',runtime,'--source-sha',sourceSha,'--run-id',runId,'--allow-synthetic-writes','yes'],{cwd:REPO,env:process.env,stdio:['pipe','pipe','inherit']});
 controller.stdin.on('error',error=>{report.controllerInputError=error.message;process.exitCode=1;});
 childExit=new Promise((resolve,reject)=>{controller.once('exit',code=>resolve(code));controller.once('error',reject);});
 replyIterator=createInterface({input:controller.stdout})[Symbol.asyncIterator]();
 const fixture=await receive('ready');report.fixture=fixture;await configure('native-post');await save();
 const target=new URL(fixture.routes.a,base);assert.equal(target.origin,base);
 for(const engine of ['firefox','webkit']){
  console.error('CACHE_BOUNDARY '+JSON.stringify({engine,round:'setup',runId}));
  browser=await pw[engine].launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});
  // Deliberately no route interception: it disables the browser HTTP cache.
  await context.addInitScript(()=>{window.imageBoundSnapshots=[];new MutationObserver(records=>{for(const r of records){const i=r.target;if(i.id==='native-plain'&&i.hasAttribute('data-fallback-bound'))window.imageBoundSnapshots.push({complete:i.complete,width:i.naturalWidth,pending:i.classList.contains('theme-image-pending')});}}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-fallback-bound']});});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  try{
   for(const round of ['cold','warm','cache-disabled']){
    if(round==='cache-disabled')await context.route('**/*',route=>route.continue());
    console.error('CACHE_BOUNDARY '+JSON.stringify({engine,round,runId}));
    const response=round==='cold'?await page.goto(target.href,{waitUntil:'load',timeout:20000}):await page.reload({waitUntil:'load',timeout:20000});assert.equal(response.status(),200);
    await page.waitForFunction(()=>!!window.MainApp?.useCommon);
    const images=[];
    for(const id of ['native-eager','native-plain','native-lazy','native-responsive']){
     await page.locator('#'+id).scrollIntoViewIfNeeded();
     await page.waitForFunction(id=>{const i=document.getElementById(id);return i?.complete&&i.naturalWidth>0&&!i.classList.contains('theme-image-pending')&&getComputedStyle(i).filter==='none';},id);
     images.push(await page.locator('#'+id).evaluate(i=>({id:i.id,url:i.currentSrc,width:i.naturalWidth,loading:i.loading,parent:i.parentElement.tagName,filter:getComputedStyle(i).filter,pending:i.classList.contains('theme-image-pending'),timing:performance.getEntriesByName(i.currentSrc).map(e=>({transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize}))})));
    }
    assert(images[2].loading==='lazy'&&images[3].parent==='PICTURE');
    const binding=await page.evaluate(()=>window.imageBoundSnapshots);
    if(round==='warm')assert(binding.some(r=>r.complete&&r.width>0&&!r.pending),'No already-complete image binding observation');
    assert(images.every(i=>i.url.startsWith(base+'/lab/')&&i.url.includes(runId)));
    report.checks.push({engine,version:browser.version(),round,images,binding,result:'browser-passed-protocol-pending'});await save();

   }
   assert.deepEqual(errors,[]);
   assert(requests.every(r=>r.url==='about:blank'||new URL(r.url).origin===base),'Unexpected external request');
   assert(requests.every(r=>['GET','HEAD'].includes(r.method)||(r.method==='POST'&&new URL(r.url).pathname==='/apis/api.halo.run/v1alpha1/trackers/counter')),'Unexpected mutation');
  }finally{await context.close();await browser.close();browser=null;console.error('CACHE_BOUNDARY '+JSON.stringify({engine,round:'closed',runId}));}
 }
 report.protocolRequired=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
 await browser?.close();
 if(controller){
  try{if(!controller.stdin.destroyed)controller.stdin.end('restore\n');if(!restored)await receive('restored');assert.equal(report.restoration.result,'passed');}
  catch(error){report.restorationError=error.stack;process.exitCode=1;}
  try{report.controllerExitCode=await childExit;if(report.controllerExitCode!==0)process.exitCode=1;}
  catch(error){report.controllerExitError=error.stack;process.exitCode=1;}
 }
 report.result=process.exitCode===1||report.checks.length!==6?'failed':'protocol-verification-required';
 report.limitations=['Only Firefox/WebKit headless 390px, four actual same-origin images, one cold/warm/cache-disabled sequence per engine.','Cold and warm use no interception. The final declared routing control disables HTTP caching. Full raw protocol and identical-image DOM observations are required; Resource Timing alone is not a cache verdict.','Not persistent disk-cache, offline, physical-device or all-profile acceptance.'];
 await save();if(restored&&report.restoration?.result==='passed')await unlink(lock);console.log('Cache evidence: '+output);
}
