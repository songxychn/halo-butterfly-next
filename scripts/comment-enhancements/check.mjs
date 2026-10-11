/** Bounded checks and reversible writes in an explicitly owned synthetic lab. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {RUNTIME,browserEnvironment,validateBaseUrl,validatePackage,sha256} from '../browser/support.mjs';
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i]]=process.argv[i+1];
for(const key of ['--lab-runtime','--theme-package','--theme-source-sha','--output'])assert(args[key],key+' required');
assert.equal(args['--allow-synthetic-writes'],'yes');
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const runtime=await realpath(args['--lab-runtime']);
const base=validateBaseUrl(process.env.BASE_URL,await read(path.join(runtime,'lab.json')));
const fixture=await read(path.join(runtime,'comment-enhancements-fixture.json'));
assert.equal(fixture.owner,'halo-butterfly-next-comment-enhancements');assert.equal(fixture.schema,1);
const installed=await read(path.join(runtime,'installed-package.json'));
validatePackage(installed,args['--theme-source-sha'],sha256(await readFile(args['--theme-package'])));
const authPath=path.join(runtime,'plugin-auth.private.json');assert.equal((await stat(authPath)).mode&0o077,0);
const auth=await read(authPath),out=path.resolve(args['--output']);
await mkdir(path.dirname(out),{recursive:true});await mkdir(out);
const report={schema:1,startedAt:new Date().toISOString(),theme:installed,runnerSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runnerFileSha256:sha256(await readFile(new URL(import.meta.url))),widget:fixture.widget,checks:[],resourceFailures:[],restoreErrors:[],limitations:['Synthetic fixture only; no dual-site contract acceptance.','Headless engines and phone viewport, not physical Safari/mobile/assistive technology.','External requests blocked; avatar services not accepted.','Lazy widget mounting and Moment comments deferred.'],contractAcceptance:false};
const save=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const poll=async(fn,label)=>{const end=Date.now()+15000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,200));}throw Error(label);};
async function check(name,fn){try{report.checks.push({name,result:'passed',detail:await fn()});console.log('PASS',name);}catch(e){report.checks.push({name,result:'failed',error:e.message});console.log('FAIL',name,e.message.slice(0,300));}finally{await save();}}
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const browsers=[];let context;
const chromium=await pw.chromium.launch({headless:true,channel:'chromium'});browsers.push(chromium);
const admin=await chromium.newContext({storageState:{cookies:auth.cookies,origins:[]}});
async function api(url,method='GET',data){assert(url.startsWith('/'));const r=await admin.request.fetch(base+url,{method,data,headers:{'X-CSRF-TOKEN':auth.csrf},timeout:20000});assert(r.ok(),method+' '+url+' HTTP '+r.status());return r.status()===204?null:r.json();}
const configPath='/apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config',systemPath='/api/v1alpha1/configmaps/system',postPath='/apis/content.halo.run/v1alpha1/posts/preview-12';
const originalConfig=await api(configPath),originalSystem=await api(systemPath),originalPost=await api(postPath);
await writeFile(path.join(out,'restore.private.json'),JSON.stringify({originalConfig,originalSystem,originalPost}),{mode:0o600,flag:'wx'});
const configured=structuredClone(originalConfig);
configured.aside={...configured.aside,mobile:true,card_newest_comments:{enable:true,limit:3,sort_order:25,avatar:true,storage:10}};
configured.comments={...configured.comments,text:true,jump:true,notice:'请文明交流。\n<script>window.noticeXss=1</script>',closed_notice:'当前页面已关闭评论。',unavailable_notice:'评论组件暂不可用。'};
configured.anchor={...configured.anchor,auto_update:true,click_to_scroll:true};
const key='halo-butterfly-next.newest-comments.v1';
async function fresh(browser,width,mode,signedIn=false,options={}){
 if(context)await context.close();
 context=await browser.newContext({viewport:{width,height:width===390?844:1000},locale:'zh-CN',colorScheme:mode,javaScriptEnabled:options.js!==false,storageState:{cookies:signedIn?auth.cookies:[],origins:[{origin:base,localStorage:[{name:'halo-butterfly-next.color-scheme',value:mode}]}]}});
 if(options.denied)await context.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw Error('denied')}}));
 await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==base)return route.abort();if(!['GET','HEAD'].includes(r.method()))return route.fulfill({status:204,body:''});return route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>report.resourceFailures.push({type:'pageerror',message:e.message}));
 page.on('requestfailed',r=>{if(new URL(r.url()).origin===base)report.resourceFailures.push({type:'requestfailed',url:r.url(),error:r.failure()?.errorText});});
 page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===base)report.resourceFailures.push({type:'http',url:r.url(),status:r.status()});});
 page.expectedMode=mode;page.jsEnabled=options.js!==false;
 return page;
}
async function go(page,route='/'){const r=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(r.status(),200);if(page.jsEnabled){await page.waitForFunction(()=>!document.body.classList.contains('loading'));await page.waitForFunction(mode=>document.documentElement.dataset.colorScheme===mode,page.expectedMode);}}
async function loaded(page){const card=page.locator('#card-newest-comments');await card.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-newest-comments]')?.dataset.commentsState==='loaded');return card;}
async function expected(page,n=3){await loaded(page);const links=page.locator('.newest-comment-link');assert.equal(await links.count(),n);assert.equal(await links.nth(0).getAttribute('href'),'/about-preview/#post-comment');if(n>1)assert.equal(await links.nth(1).getAttribute('href'),'/archives/preview-12/#post-comment');const text=await links.allTextContents();assert(!text.join('').match(/不应公开/));assert.equal(await page.evaluate(()=>window.commentXss||window.noticeXss||0),0);return text;}
const initialMode=args['--baseline']==='yes';
try{
 if(initialMode){
  for(const width of [1440,390])for(const mode of ['light','dark'])await check('baseline-'+width+'-'+mode,async()=>{const p=await fresh(chromium,width,mode);await go(p,'/archives/preview-12/');assert.equal(await p.locator('#post-comment').count(),1);await p.screenshot({path:path.join(out,`article-${width}-${mode}.png`),fullPage:true});return {width,mode};});
 }else{
  await api(configPath,'PUT',configured);
  await poll(async()=> (await (await admin.request.get(base+'/')).text()).includes('data-newest-comments'),'Latest card config not applied');
  for(const engine of ['chromium','firefox','webkit']){
   const browser=engine==='chromium'?chromium:await pw[engine].launch({headless:true});if(browser!==chromium)browsers.push(browser);
   (report.engines??={})[engine]=browser.version();
   for(const width of [1440,390])for(const mode of ['light','dark']){
    const label=engine+'-'+width+'-'+mode;
    await check(label+'-latest-card',async()=>{const p=await fresh(browser,width,mode,true);let apiCount=0;const requests=[];p.on('request',r=>{if(r.url().includes('/v1alpha1/comments?')){apiCount++;requests.push({url:r.url(),cookie:r.headers()['cookie']||null});}});await go(p);const text=await expected(p);assert(requests.length>=3);assert(requests.every(x=>!x.cookie));assert(!requests.some(x=>/name=comment-fixture-(private|draft)/.test(x.url)));const cached=await p.evaluate(k=>sessionStorage.getItem(k),key);assert(cached);assert(!cached.match(/fixture@example|"email"|"ipAddress"|"raw"|not-persist/));const before=apiCount;await p.reload({waitUntil:'domcontentloaded'});await expected(p);assert.equal(apiCount,before);await p.locator('#card-newest-comments').screenshot({path:path.join(out,label+'-card.png')});return {text,requests,cacheWarmNoRequests:true};});
    for(const route of ['/archives/preview-12/?from=comment-check','/about-preview/?from=comment-check'])await check(label+'-jump-'+(route.includes('archives')?'post':'page'),async()=>{const p=await fresh(browser,width,mode);await go(p,route);const link=p.locator('#jump-comment');assert.equal(await link.count(),1);assert.equal(await p.locator('.comment-notice').textContent(),configured.comments.notice);await p.evaluate(()=>window.scrollTo(0,400));await link.focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.activeElement?.id==='comment-title'&&location.hash==='#post-comment');assert.equal(new URL(p.url()).search,'?from=comment-check');await p.waitForTimeout(250);assert.equal(new URL(p.url()).hash,'#post-comment');assert.equal(await p.locator('comment-widget').count(),1);await p.screenshot({path:path.join(out,label+'-'+(route.includes('archives')?'post':'page')+'.png')});await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.activeElement?.id==='comment-title');await p.goBack({waitUntil:'domcontentloaded'});assert.equal(new URL(p.url()).hash,'');await p.goForward({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.activeElement?.id==='comment-title');return {route,hashPreserved:true,focused:true,history:true};});
   }
  }
  await check('storage-denied',async()=>{const p=await fresh(chromium,1440,'light',false,{denied:true});await go(p);return expected(p);});
  await check('storage-corrupt-expired',async()=>{const p=await fresh(chromium,1440,'light');await p.addInitScript(k=>{if(!sessionStorage.getItem('test-corrupt-seeded')){sessionStorage.setItem(k,'{bad');sessionStorage.setItem('test-corrupt-seeded','true');}},key);await go(p);await expected(p);await p.evaluate(k=>{const v=JSON.parse(sessionStorage.getItem(k));for(const e of Object.values(v))e.expires=0;sessionStorage.setItem(k,JSON.stringify(v));},key);let n=0;p.on('request',r=>{if(r.url().includes('/v1alpha1/comments?'))n++;});await p.reload({waitUntil:'domcontentloaded'});await expected(p);assert(n>=3);return {refetched:n};});
  await check('latest-api-error-retry',async()=>{const p=await fresh(chromium,1440,'light');let injected=true;await context.route('**/apis/api.halo.run/v1alpha1/comments?**',r=>injected?r.fulfill({status:503,contentType:'application/json',body:'{}'}):r.continue());await go(p);await p.locator('#card-newest-comments').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('[data-newest-comments]')?.dataset.commentsState==='failed');assert.equal(await p.locator('.newest-comment-link').count(),0);injected=false;await p.locator('[data-comments-retry]').click();return expected(p);});
  await check('limit-avatar-cache-zero',async()=>{const cfg=structuredClone(configured);Object.assign(cfg.aside.card_newest_comments,{limit:1,avatar:false,storage:0});await api(configPath,'PUT',cfg);await poll(async()=> (await (await admin.request.get(base+'/')).text()).includes('data-limit="1"'),'Limit not applied');const p=await fresh(chromium,1440,'dark');await go(p);await expected(p,1);assert.equal(await p.locator('.newest-comment-link img').count(),0);assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),key),null);return {limit:1,avatar:false,storage:0};});
  await api(configPath,'PUT',configured);
  await check('disabled-subject-and-current-inventory',async()=>{const p=await fresh(chromium,1440,'light');await go(p);await expected(p);const post=await api(postPath);post.spec.allowComment=false;await api(postPath,'PUT',post);await poll(async()=> !(await (await admin.request.get(base+'/archives/preview-12/')).text()).includes('id="post-comment"'),'Subject still enabled');await p.reload({waitUntil:'domcontentloaded'});await loaded(p);assert(!await p.locator('.newest-comment-link[href="/archives/preview-12/#post-comment"]').count());await go(p,'/archives/preview-12/');assert.equal(await p.locator('#jump-comment').count(),0);assert.equal(await p.locator('.comment-unavailable').textContent(),configured.comments.closed_notice);return {oldCacheCannotRestoreDisabledSubject:true};});
  const post=await api(postPath);post.spec.allowComment=originalPost.spec.allowComment;await api(postPath,'PUT',post);
  await check('global-comment-disabled',async()=>{const system=await api(systemPath);system.data.comment=JSON.stringify({...JSON.parse(system.data.comment),enable:false});await api(systemPath,'PUT',system);await poll(async()=> !(await (await admin.request.get(base+'/')).text()).includes('data-newest-comments'),'Global disable not applied');const p=await fresh(chromium,1440,'light');await go(p,'/about-preview/');for(const selector of ['#post-comment','#jump-comment','#card-newest-comments'])assert.equal(await p.locator(selector).count(),0);assert.equal(await p.locator('.comment-unavailable').textContent(),configured.comments.closed_notice);});
  const system=await api(systemPath);system.data.comment=originalSystem.data.comment;await api(systemPath,'PUT',system);
  await check('text-jump-card-off-and-rightside-order',async()=>{const cfg=structuredClone(configured);cfg.comments.text=false;cfg.comments.jump=false;cfg.aside.card_newest_comments.enable=false;await api(configPath,'PUT',cfg);await poll(async()=> !(await (await admin.request.get(base+'/')).text()).includes('data-newest-comments'),'Card disable not applied');const p=await fresh(chromium,1440,'light');await go(p,'/archives/preview-12/');for(const s of ['#card-newest-comments','#jump-comment','.comment-notice'])assert.equal(await p.locator(s).count(),0);assert.equal(await p.locator('#post-comment').count(),1);cfg.comments.jump=true;cfg.rightside={...cfg.rightside,item_order:{enable:true,hide:'comment',show:'toc'}};await api(configPath,'PUT',cfg);await p.reload({waitUntil:'domcontentloaded'});await p.evaluate(()=>window.scrollTo(0,400));await p.waitForSelector('#rightside-config-hide #jump-comment');await p.locator('#rightside-config').click();await p.locator('#jump-comment').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.activeElement?.id==='comment-title');return {toggles:true,hiddenGroupKeyboard:true};});
  await api(configPath,'PUT',configured);
  await check('native-link-without-js',async()=>{const p=await fresh(chromium,1440,'light',false,{js:false});await go(p,'/archives/preview-12/');assert.equal(await p.locator('#jump-comment').getAttribute('href'),'#post-comment');await p.goto(base+'/archives/preview-12/#post-comment');assert.equal(await p.locator('#post-comment').count(),1);return {nativeHref:true};});
 }
}catch(e){report.checks.push({name:'runner',result:'failed',error:e.message});}
finally{
 for(const [name,fn] of [['theme-config',async()=>{await api(configPath,'PUT',originalConfig);assert.deepEqual(await api(configPath),originalConfig);}],['system-comment',async()=>{const x=await api(systemPath);x.data.comment=originalSystem.data.comment;await api(systemPath,'PUT',x);assert.equal((await api(systemPath)).data.comment,originalSystem.data.comment);}],['post-allow',async()=>{const x=await api(postPath);x.spec.allowComment=originalPost.spec.allowComment;await api(postPath,'PUT',x);assert.equal((await api(postPath)).spec.allowComment,originalPost.spec.allowComment);}]] )try{await fn();}catch(e){report.restoreErrors.push({name,error:e.message});}
 if(context)await context.close();await admin.close();for(const b of browsers)await b.close();
 report.finishedAt=new Date().toISOString();report.result=report.checks.some(x=>x.result==='failed')||report.restoreErrors.length?'failed':'passed';await save();
}
console.log(report.result,report.checks.length,'checks;',report.restoreErrors.length,'restore errors');
process.exitCode=report.result==='passed'?0:1;
