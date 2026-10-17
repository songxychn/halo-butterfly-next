/** One local-draft diagnostic. No authenticated API or business writes. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl,sha256} from '../../browser/support.mjs';
const runtime=await realpath(process.argv[2]), output=path.resolve(process.argv[3]);
assert(runtime.startsWith(path.join(REPO,'.runtime')+path.sep));assert(output.startsWith(path.join(REPO,'.runtime')+path.sep));
assert.equal((await readdir(runtime)).filter(n=>n.endsWith('.lock')).length,0,'Another exclusive lab run is active');
const marker=JSON.parse(await readFile(path.join(runtime,'lab.json'))),base=validateBaseUrl('http://127.0.0.1:'+marker.ports.halo,marker);
const state=JSON.parse(await readFile(path.join(runtime,'halo-process.json')));
assert(execFileSync('ps',['-p',String(state.pid),'-o','command='],{encoding:'utf8'}).includes(path.join(runtime,'halo/halo-2.26.1.jar')));
await mkdir(output,{recursive:false});
const runId=randomBytes(10).toString('hex'),report={schema:1,runId,startedAt:new Date().toISOString(),runnerSha256:sha256(await readFile(new URL(import.meta.url))),installed:JSON.parse(await readFile(path.join(runtime,'installed-package.json'))),route:'/archives/preview-1/',status:'running',snapshots:[],requests:[],blockedWrites:[],pageErrors:[]};
const save=()=>writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await save();
Object.assign(process.env,browserEnvironment());const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
let browser,context,hardTimer;
const close=async(target)=>{let timer;try{await Promise.race([target.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('close exceeded 10s')),10000);})]);}finally{clearTimeout(timer);}};
try{
 browser=await pw.webkit.launch({headless:true});report.version=browser.version();context=await browser.newContext({viewport:{width:390,height:900},locale:'zh-CN'});
 hardTimer=setTimeout(()=>{report.hardTimeout=true;void context.close();},90000);
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.pageErrors.push(e.message));
 await context.route('**/*',async route=>{const r=route.request(),url=new URL(r.url());report.requests.push({url:r.url(),method:r.method()});if(!['GET','HEAD','OPTIONS'].includes(r.method())){report.blockedWrites.push({url:r.url(),method:r.method()});return route.abort('blockedbyclient');}if(['http:','https:'].includes(url.protocol)&&url.origin!==base){report.externalBlocked??=[];report.externalBlocked.push(r.url());return route.abort('blockedbyclient');}return route.continue();});
 const response=await page.goto(base+report.route,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);
 await page.locator('#post-comment').scrollIntoViewIfNeeded();const form=page.locator('comment-form');const editable=form.locator('[contenteditable]');await editable.waitFor();
 const capture=async(label)=>{const value=await form.locator('comment-editor').evaluate(el=>{
  const dom=el.shadowRoot?.querySelector('[contenteditable]');const host=el.getRootNode().host;
  const store=window.__commentInputDiagnostic??=( {ids:new WeakMap(),next:0} );
  const id=node=>node?(store.ids.has(node)?store.ids.get(node):(store.ids.set(node,++store.next),store.next)):null;
  return {editorElementId:id(el),editableId:id(dom),baseFormId:id(host),innerHTML:dom?.innerHTML,innerText:dom?.innerText,textContent:dom?.textContent,visible:dom?{display:getComputedStyle(dom).display,visibility:getComputedStyle(dom).visibility,width:dom.getBoundingClientRect().width,height:dom.getBoundingClientRect().height}:null,loading:el.loading,isDestroyed:el.editor?.isDestroyed,editorHTML:el.editor?.getHTML(),editorText:el.editor?.getText(),initialContent:el.initialContent,draftKey:el.draftKey,draftRevision:el.draftRevision,baseFormDraftKey:host?.draftKey,baseFormDraftContent:host?.draftContent,localDrafts:Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('halo-comment-draft:')).map(k=>[k,JSON.parse(localStorage.getItem(k))]))};
 });report.snapshots.push({label,at:new Date().toISOString(),...value});await save();return value;};
 await capture('before-fill');
 const text='WebKit draft diagnostic '+runId;report.inputText=text;
 await editable.fill(text);await capture('immediately-after-fill');
 await form.locator('input[name="displayName"]').fill('Diagnostic '+runId);await capture('after-display-name');
 await form.locator('input[name="email"]').fill(runId+'@example.invalid');await capture('after-email');
 const start=Date.now();for(const offset of [100,500,1000,3000]){const delay=start+offset-Date.now();if(delay>0)await page.waitForTimeout(delay);await capture('after-'+offset+'ms');}
 // Observation only: do not repair state, retype, submit or retry this case.
 report.status='observed';
}catch(error){report.status='failed';report.error=error.stack||String(error);}
finally{clearTimeout(hardTimer);if(context)try{await close(context);report.localContextDestroyed=true;}catch(e){report.closeError=String(e);report.status='failed';}if(browser)try{await close(browser);}catch(e){report.browserCloseError=String(e);report.status='failed';}report.finishedAt=new Date().toISOString();await save();}
process.exitCode=report.status==='observed'?0:1;
