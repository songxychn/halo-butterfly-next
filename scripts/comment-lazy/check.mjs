/** Real, task-owned Halo only; no existing browser/session or remote writes. */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, stat, realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {RUNTIME, browserEnvironment, validateBaseUrl, validatePackage, sha256} from '../browser/support.mjs';
const args = {};
for(let i=2;i<process.argv.length;i+=2) args[process.argv[i]]=process.argv[i+1];
for(const key of ['--lab-runtime','--theme-package','--theme-source-sha','--output']) assert(args[key],key+' required');
assert.equal(args['--allow-synthetic-writes'],'yes');
const selectedEngines=(args['--engines']??'chromium,firefox,webkit').split(',');assert(selectedEngines.length&&selectedEngines.every(e=>['chromium','firefox','webkit'].includes(e)));
const specialOnly=args['--special-only']==='yes';
const read = async file => JSON.parse(await readFile(file,'utf8'));
const runtime=await realpath(args['--lab-runtime']);
const base=validateBaseUrl(process.env.BASE_URL,await read(path.join(runtime,'lab.json')));
const processRecord=await read(path.join(runtime,'halo-process.json'));
assert(execFileSync('ps',['-p',String(processRecord.pid),'-o','command='],{encoding:'utf8'}).includes(path.join(runtime,'halo/halo-2.26.1.jar')),'Owned Halo process required');
const installed=await read(path.join(runtime,'installed-package.json'));
validatePackage(installed,args['--theme-source-sha'],sha256(await readFile(args['--theme-package'])));
const authFile=path.join(runtime,'plugin-auth.private.json');
assert.equal((await stat(authFile)).mode & 0o077,0);
const auth=await read(authFile), fixture=await read(path.join(runtime,'comment-enhancements-fixture.json'));
assert.equal(fixture.owner,'halo-butterfly-next-comment-enhancements');
assert.equal(fixture.widget.version,'3.3.2');
const out=path.resolve(args['--output']);
await mkdir(path.dirname(out),{recursive:true}); await mkdir(out);
Object.assign(process.env,browserEnvironment());
const {chromium,firefox,webkit}=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const report={schema:1,startedAt:new Date().toISOString(),theme:installed,widget:fixture.widget,checks:[],restoreErrors:[],limitations:['Package identity is checked against the caller-supplied source SHA and ZIP digest; source digests recorded separately.','Real Halo with headless engines; no physical Safari/mobile or full 1.0 contract.','Plugin-owned modulepreload/CSS retained; data/submission failures belong to official UI.'],sourceDigests:{}};
for(const file of ['settings.yaml','src/html/post.html','src/html/page.html','src/html/views/comment-lazy.html','src/js/core/comment-lazy.ts','src/js/core/comment-jump.ts','src/js/core/common.ts','src/scss/core/comments.scss']) report.sourceDigests[file]=sha256(await readFile(file));
const save=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const browser=await chromium.launch({headless:true,channel:'chromium'});
const admin=await browser.newContext({storageState:{cookies:auth.cookies,origins:[]}});
async function api(url,method='GET',data){const r=await admin.request.fetch(base+url,{method,data,headers:{'X-CSRF-TOKEN':auth.csrf}});assert(r.ok(),method+' '+url+' '+r.status());return r.status()===204?null:r.json();}
const configPath='/apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config';
const original=await api(configPath);
await writeFile(path.join(out,'restore.private.json'),JSON.stringify(original),{mode:0o600,flag:'wx'});
const routes=[];
for(const [plural,kind,key,name] of [['posts','Post','post','lazy-comment-post'],['singlepages','SinglePage','page','lazy-comment-page']]){
 const collection='/apis/content.halo.run/v1alpha1/'+plural;
 const existing=await admin.request.get(base+collection+'/'+name);
 if(existing.status()===404){
  const html='<h2>评论懒加载合成样本</h2>'+Array.from({length:90},(_,i)=>'<p>合成段落 '+i+'，用于检查接近评论区域前不初始化组件，正文滚动后保留评论输入。</p>').join('');
  const spec={title:'评论懒加载合成样本',slug:name,allowComment:true,deleted:false,pinned:false,priority:0,publish:false,visible:'PUBLIC',owner:'admin',excerpt:{autoGenerate:true},cover:'',publishTime:'2026-08-01T04:00:00Z'};
  const user=await api('/apis/api.console.halo.run/v1alpha1/users/-'); spec.owner=user.user.metadata.name;
  if(kind==='Post') Object.assign(spec,{tags:[],categories:[]});
  await api('/apis/api.console.halo.run/v1alpha1/'+plural,'POST',{[key]:{apiVersion:'content.halo.run/v1alpha1',kind,metadata:{name,labels:{'comment-lazy-fixture':'true'}},spec},content:{rawType:'HTML',raw:html,content:html}});
  await api('/apis/api.console.halo.run/v1alpha1/'+plural+'/'+name+'/publish','PUT');
 } else {assert(existing.ok()); assert.equal((await existing.json()).metadata.labels?.['comment-lazy-fixture'],'true');}
 for(let i=0;i<60;i++){
  const subject=await api(collection+'/'+name);
  if(subject.status?.permalink){routes.push({route:new URL(subject.status.permalink,base).pathname,kind,name,collection});break;}
  await new Promise(r=>setTimeout(r,200));
 }
}
assert.equal(routes.length,2);
const configured=structuredClone(original);
configured.comments={...configured.comments,lazyload:true,jump:true};
configured.aside={...configured.aside,card_newest_comments:{...configured.aside?.card_newest_comments,enable:false}};
let context; let pageErrors=[];
async function check(name,fn){pageErrors=[];try{const detail=await fn();assert.deepEqual(pageErrors,[],'Uncaught page errors');report.checks.push({name,result:'passed',detail});console.log('PASS',name);}catch(e){report.checks.push({name,result:'failed',error:e.message});console.log('FAIL',name,e.message);if(context)await context.pages()[0]?.screenshot({path:path.join(out,name+'-failed.png'),fullPage:true}).catch(()=>{});}finally{if(context){await context.close();context=null;}await save();}}
async function page(engine,width=1440,mode='light',hold=false){
 context=await engine.newContext({viewport:{width,height:width===1440?1000:844}});
 await context.addInitScript(({mode,hold})=>{
  localStorage.setItem('halo-butterfly-next.color-scheme',mode);
  if(hold){const Original=window.IntersectionObserver;window.IntersectionObserver=class extends Original{constructor(callback,options){super(options?.rootMargin==='300px 0px'?()=>{}:callback,options);}};}
 },{mode,hold});
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
 const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>pageErrors.push(e.message));p.lazyTestMode=mode;return p;
}
async function ready(p,route){const r=await p.goto(base+route,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200);await p.waitForFunction(()=>document.querySelector('[data-comment-lazy]')?.dataset.commentLazyBound==='true');assert.equal(await p.locator('html').getAttribute('data-color-scheme'),p.lazyTestMode);}
async function mounted(p,subject){await p.waitForFunction(()=>document.querySelector('[data-comment-lazy]')?.dataset.commentState==='mounted');assert.equal(await p.locator('comment-widget').count(),1);const props=await p.locator('comment-widget').evaluate(el=>({kind:el.kind,name:el.name,group:el.group,version:el.version}));assert.deepEqual(props,{kind:subject.kind,name:subject.name,group:'content.halo.run',version:'v1alpha1'});}
try{
 await api(configPath,'PUT',configured);
 for(const [engineName,launcher] of [['chromium',chromium],['firefox',firefox],['webkit',webkit]]){
  if(!selectedEngines.includes(engineName))continue;
  const engine=engineName==='chromium'?browser:await launcher.launch({headless:true});
  try{
   if(!specialOnly)for(const width of [1440,390])for(const mode of ['light','dark'])for(const subject of routes){
    const label=engineName+'-'+width+'-'+mode+'-'+subject.kind;
    await check(label+'-auto',async()=>{
     const p=await page(engine,width,mode);let calls=0;
     p.on('request',r=>{if(r.url().includes('/apis/api.commentwidget.halo.run/v1alpha1/config')||r.url().includes('/apis/api.halo.run/v1alpha1/comments?'))calls++;});
     await ready(p,subject.route);await p.waitForTimeout(350);
     const top=await p.locator('#post-comment').evaluate(el=>el.getBoundingClientRect().top);
     assert(top> (width===1440?1000:844)+300,'Long fixture must start outside margin');
     assert.equal(await p.locator('comment-widget').count(),0);assert.equal(calls,0);
     await p.locator('#post-comment').evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-innerHeight-200));
     await mounted(p,subject);assert((await p.locator('#post-comment').evaluate(el=>el.getBoundingClientRect().top))> (width===1440?1000:844),'Mount must occur before entering viewport');
     await p.locator('#post-comment').scrollIntoViewIfNeeded();
     const input=p.locator('comment-widget input').first();await input.waitFor({state:'visible'});await input.fill('保留输入');
     await p.evaluate(()=>window.scrollTo(0,0));await p.locator('#post-comment').scrollIntoViewIfNeeded();
     assert.equal(await p.locator('comment-widget').count(),1);assert.equal(await input.inputValue(),'保留输入');
     return {noInitialCommentRequests:true,mountedOutsideViewport:true,inputPreserved:true};
    });
    await check(label+'-jump',async()=>{
     const p=await page(engine,width,mode,true);await ready(p,subject.route+'?from=lazy-test');
     assert.equal(await p.locator('comment-widget').count(),0);
     await p.locator('#jump-comment').focus();await p.keyboard.press('Enter');await mounted(p,subject);
     assert.equal(new URL(p.url()).search,'?from=lazy-test');assert.equal(new URL(p.url()).hash,'#post-comment');
     assert.equal(await p.evaluate(()=>document.activeElement.id),'comment-title');
    });
    await check(label+'-fragment',async()=>{const p=await page(engine,width,mode,true);await ready(p,subject.route+'#post-comment');await mounted(p,subject);});
   }
   await check(engineName+'-module-failure-retry',async()=>{
    const p=await page(engine,1440,'light',true);let fail=true;
    await p.route('**/plugins/PluginCommentWidget/assets/static/comment-widget.js*',route=>fail?route.abort('failed'):route.continue());
    await ready(p,routes[0].route);await p.evaluate(()=>window.scrollTo(0,400));await p.locator('#jump-comment').click();
    await p.waitForFunction(()=>document.querySelector('[data-comment-lazy]')?.dataset.commentState==='failed');
    assert.equal(await p.locator('comment-widget').count(),0);fail=false;
    await p.locator('[data-comment-retry]').click();await mounted(p,routes[0]);
   });
   await check(engineName+'-missing-observer-fallback',async()=>{const p=await page(engine);await p.addInitScript(()=>{delete window.IntersectionObserver;});await ready(p,routes[0].route);await mounted(p,routes[0]);});
  }finally{if(engine!==browser)await engine.close();}
 }
 for(const lazyload of [false,undefined])await check('eager-'+String(lazyload),async()=>{
  const c=structuredClone(configured);if(lazyload===undefined)delete c.comments.lazyload;else c.comments.lazyload=false;await api(configPath,'PUT',c);
  const p=await page(browser);await p.goto(base+routes[0].route,{waitUntil:'domcontentloaded'});
  assert.equal(await p.locator('[data-comment-lazy]').count(),0);assert.equal(await p.locator('script[type=module][data-pjax]').count(),1);
  await p.locator('#post-comment').scrollIntoViewIfNeeded();await p.locator('comment-widget').waitFor({state:'attached'});
 });
 await api(configPath,'PUT',configured);
 await check('global-comments-off',async()=>{
  const system=await api('/api/v1alpha1/configmaps/system');const originalComment=system.data.comment;
  try{system.data.comment=JSON.stringify({...JSON.parse(originalComment),enable:false});await api('/api/v1alpha1/configmaps/system','PUT',system);
   const p=await page(browser);await p.goto(base+routes[0].route,{waitUntil:'domcontentloaded'});assert.equal(await p.locator('#post-comment').count(),0);assert.equal(await p.locator('#jump-comment').count(),0);
  }finally{const current=await api('/api/v1alpha1/configmaps/system');current.data.comment=originalComment;await api('/api/v1alpha1/configmaps/system','PUT',current);assert.equal((await api('/api/v1alpha1/configmaps/system')).data.comment,originalComment);}
 });
}catch(e){report.executionError=e.message;console.error(e);
}finally{
 try{await api(configPath,'PUT',original);assert.deepEqual(await api(configPath),original);}catch(e){report.restoreErrors.push(e.message);}
 if(context)await context.close();await admin.close();await browser.close();
 report.finishedAt=new Date().toISOString();report.result=report.executionError||report.checks.length!==(selectedEngines.length*(specialOnly?2:26)+3)||report.restoreErrors.length||report.checks.some(x=>x.result==='failed')?'failed':'passed';await save();
 console.log(report.result,report.checks.length,'checks',path.join(out,'report.json'));if(report.result==='failed')process.exitCode=1;
}
