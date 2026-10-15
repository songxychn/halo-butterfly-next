/** Focused acceptance against an owned, real Halo; never an existing user browser. */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {RUNTIME, browserEnvironment, validateBaseUrl, sha256} from '../browser/support.mjs';
const runtime=path.resolve(process.env.LAB_RUNTIME || '.runtime/platform-demand/halo-lab');
const read=async f=>JSON.parse(await readFile(f,'utf8'));
const identity=await read(path.join(runtime,'lab.json'));
const base=validateBaseUrl(process.env.BASE_URL || 'http://127.0.0.1:18627',identity);
const platform=await read(path.join(runtime,'platform.json'));
assert.equal(platform.version,'2.27.0');
const processState=await read(path.join(runtime,'halo-process.json'));
assert(execFileSync('ps',['-p',String(processState.pid),'-o','command='],{encoding:'utf8'}).includes(path.join(runtime,'halo/halo-2.27.0.jar')));
const installed=await read(path.join(runtime,'installed-package.json'));
const plugins=await Promise.all(['PluginCommentWidget','plugin-katex'].map(n=>read(path.join(runtime,n+'-artifact.json'))));
const output=path.resolve(process.env.DEMAND_REPORT || '.runtime/platform-demand/browser-report.json');
await mkdir(path.dirname(output),{recursive:true});
Object.assign(process.env,browserEnvironment());
const browsers=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const report={startedAt:new Date().toISOString(),platform,installed,plugins,runnerSha256:sha256(await readFile(new URL(import.meta.url))),sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:!!execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),cases:[],limitations:['Synthetic HTML content; not editor save/reopen acceptance.','Headless engines; not Safari application, physical devices or screen reader.','Focused resource/lifecycle checks, not complete 1.0 acceptance.']};
const save=()=>writeFile(output,JSON.stringify(report,null,2)+'\n');
const commentData=url=>/\/apis\/api(?:\.commentwidget)?\.halo\.run\/v1alpha1\/(?:comments|config)(?:\?|$)/.test(url);
const comment=url=>url.includes('/plugins/PluginCommentWidget/assets/');
const katex=url=>/\/plugins\/plugin-katex\/assets\/static\/katex\.min\.(?:css|js)/.test(url);
const engines=(process.env.DEMAND_ENGINES||'chromium,firefox,webkit').split(',');
for(const engine of engines){
 assert(['chromium','firefox','webkit'].includes(engine));
 const browser=await browsers[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
 const cases=[
  ['home', '/'], ['closed','/archives/demand-closed/'], ['lazy','/archives/demand-none/'],
  ['mathml','/archives/demand-mathml/'], ['raw','/archives/demand-raw/'], ['page','/demand-page/'],
  ['anchor','/archives/demand-none/#post-comment'], ['css-retry','/archives/demand-none/'], ['pjax','/archives/demand-none/'],
 ];
 try {for(const [name,route] of cases){
  const row={engine,version:browser.version(),name,route,checks:[],requests:[],responses:[],errors:[],debug:[]};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'en'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('request',r=>row.requests.push({url:r.url(),resourceType:r.resourceType()}));
  page.on('response',r=>{if(commentData(r.url()))row.responses.push({url:r.url(),status:r.status()});});
  page.on('pageerror',e=>row.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='debug')row.debug.push(m.text().slice(0,1000));});
  let blockStyle=name==='css-retry';
  if(blockStyle)await context.route('**/plugins/PluginCommentWidget/assets/static/index.css?*',r=>blockStyle?r.abort():r.continue());
  const resources=filter=>row.requests.filter(r=>filter(r.url));
  try{
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);
   await page.waitForFunction(()=>!!window.MainApp?.useCommon);
   assert.equal(await page.locator('meta[name="halo-comment-widget-contract"]').getAttribute('content'),'1');
   assert.equal(await page.locator('link[rel="modulepreload"][href*="PluginCommentWidget"]').count(),0);
   row.checks.push('real head exposes resource contract without modulepreload');
   if(['home','closed','lazy','css-retry','pjax'].includes(name)){
    if(!['home','closed'].includes(name))await page.waitForFunction(()=>document.querySelector('[data-comment-lazy]')?.getAttribute('data-comment-state')==='idle');
    await page.waitForTimeout(600);
    assert.equal(resources(comment).length,0);assert.equal(resources(commentData).length,0);assert.equal(resources(katex).length,0);
    row.checks.push('no comment or KaTeX asset request before demand');
   }
   if(['lazy','anchor','css-retry'].includes(name)){
    if(name!=='anchor')await page.locator('#post-comment').scrollIntoViewIfNeeded();
    if(name==='css-retry'){
     await page.waitForFunction(()=>document.querySelector('[data-comment-lazy]')?.getAttribute('data-comment-state')==='failed');
     assert.equal(await page.locator('comment-widget').count(),0);
     blockStyle=false;await page.locator('[data-comment-retry]').click();row.checks.push('failed CSS blocks mount and explicit retry recovers');
    }
    await page.waitForFunction(()=>document.querySelector('[data-comment-lazy]')?.getAttribute('data-comment-state')==='mounted');
    assert.equal(await page.locator('comment-widget').count(),1);
    assert(resources(comment).some(r=>r.url.includes('comment-widget.js')));
    assert(resources(comment).some(r=>r.url.includes('index.css')));
    assert.deepEqual(await page.locator('comment-widget').evaluate(w=>[w.group,w.kind,w.name]),['content.halo.run','Post','demand-none']);
    await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('/apis/api.halo.run/v1alpha1/comments?')));
    assert(row.responses.some(r=>r.url.includes('/api.halo.run/v1alpha1/comments?')&&r.status===200));
    await page.locator('comment-widget').locator('comment-form').waitFor({state:'attached'});
    row.checks.push('demand mounts one official component with correct subject and editor; comment API returns 200');
   }
   if(name==='mathml'){
    await page.waitForFunction(()=>[...document.querySelectorAll('link')].some(n=>n.href.includes('/plugin-katex/')&&n.sheet));
    assert(resources(katex).some(r=>r.url.includes('.css')));assert.equal(resources(katex).filter(r=>r.url.includes('.js')).length,0);
    assert.equal(await page.locator('math annotation[encoding="application/x-tex"]').first().textContent(),'x+1');
    row.checks.push('existing MathML preserved; CSS only');
   }
   if(['raw','page'].includes(name)){
    await page.waitForSelector('.math-inline .katex',{state:'attached'});
    assert(resources(katex).some(r=>r.url.includes('.js')));assert(resources(katex).some(r=>r.url.includes('.css')));
    assert.equal(await page.locator('.math-inline .katex').count(),1);
    await page.locator('#post-comment').scrollIntoViewIfNeeded();await page.waitForSelector('comment-widget');
    assert.equal(await page.locator('comment-widget').evaluate(w=>w.kind),name==='page'?'SinglePage':'Post');
    row.checks.push('raw formula rendered once; correct post/page comment subject');
   }
   if(name==='pjax'){
    await page.evaluate(()=>window.demandSentinel='retained');
    for(let i=0;i<5;i++){
     await page.locator('#to-raw').first().click();
     await page.waitForFunction(()=>location.pathname==='/archives/demand-raw/'&&!document.documentElement.classList.contains('theme-navigating'));
     assert.equal(await page.evaluate(()=>window.demandSentinel),'retained');
     await page.waitForSelector('.math-inline .katex',{state:'attached'});assert.equal(await page.locator('.math-inline .katex').count(),1);
     await page.locator('#post-comment').scrollIntoViewIfNeeded();await page.waitForSelector('comment-widget');assert.equal(await page.locator('comment-widget').count(),1);
     await page.locator('#to-none').first().click();
     await page.waitForFunction(()=>location.pathname==='/archives/demand-none/'&&!document.documentElement.classList.contains('theme-navigating'));
     assert.equal(await page.evaluate(()=>window.demandSentinel),'retained');assert.equal(await page.locator('comment-widget').count(),0);
    }
    assert.equal(resources(katex).filter(r=>r.url.includes('.js')).length,1);
    row.checks.push('five real PJAX roundtrips preserve document, formula and component uniqueness; render JS loaded once');
   }
   assert.deepEqual(row.errors,[]);row.result='passed';
  }catch(error){row.result='failed';row.failure=String(error);row.htmlState=await page.evaluate(()=>({url:location.href,comment:document.querySelector('[data-comment-lazy]')?.outerHTML.slice(0,1800),scripts:[...document.scripts].map(s=>({src:s.src,attributes:[...s.attributes].map(a=>[a.name,a.value])}))})).catch(()=>null);}
  finally{await context.close();await save();}
  console.log(engine,name,row.result,row.failure||'');
 }}finally{await browser.close();}
}
report.finishedAt=new Date().toISOString();report.result=report.cases.every(r=>r.result==='passed')?'passed':'failed';await save();
if(report.result==='failed')process.exitCode=1;
