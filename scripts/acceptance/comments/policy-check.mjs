import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl} from '../../browser/support.mjs';
import {closeNavigationCase} from '../navigation/finalize.mjs';

const file=await realpath(process.argv[2]);
assert(file.startsWith(path.join(REPO,'.runtime')+path.sep));
const fixture=JSON.parse(await readFile(file)),output=path.dirname(file),runtime=await realpath(fixture.runtime);
assert.equal(fixture.owner,'comment-usage-followup-owner');
assert.equal(await readFile(path.join(runtime,'acceptance-comments.lock'),'utf8'),fixture.runId);
assert.deepEqual(JSON.parse(await readFile(path.join(runtime,'installed-package.json'))),fixture.installed);
const base=validateBaseUrl(fixture.base,JSON.parse(await readFile(path.join(runtime,'lab.json'))));
const auth=JSON.parse(await readFile(path.join(output,'auth.private.json')));
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const report={policy:fixture.policy,subject:fixture.post,installed:fixture.installed,cases:[],startedAt:new Date().toISOString()};
const save=()=>writeFile(path.join(output,fixture.policy+'-browser.json'),JSON.stringify(report,null,2)+'\n');
const cases=process.env.POLICY_DIAGNOSTIC==='yes'?fixture.cases.filter(c=>c.engine==='chromium'&&c.signedIn):fixture.cases;
report.diagnostic=cases.length!==fixture.expectedCases;
for(const {engine,signedIn} of cases){
 const row={engine,signedIn,status:'failed',requests:[],pageErrors:[],consoleErrors:[],assertions:[]};report.cases.push(row);
 let browser,context,page;
 try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  context=await browser.newContext({viewport:{width:signedIn?1440:390,height:1000},locale:'zh-CN'});
  if(signedIn)await context.addCookies(auth.cookies);
  page=await context.newPage();page.setDefaultTimeout(20000);
  const requests=new Map();
  page.on('pageerror',e=>row.pageErrors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')row.consoleErrors.push(e.text());});
  page.on('request',r=>{const item={url:r.url(),method:r.method(),state:'pending'};requests.set(r,item);row.requests.push(item);});
  page.on('response',r=>{const item=requests.get(r.request());if(item)item.httpStatus=r.status();});
  page.on('requestfinished',r=>{if(requests.has(r))requests.get(r).state='finished';});
  page.on('requestfailed',r=>{if(requests.has(r)){requests.get(r).state='failed';requests.get(r).error=r.failure()?.errorText;}});
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   const tracker=req.method()==='POST'&&url.pathname==='/apis/api.halo.run/v1alpha1/trackers/counter'&&req.postDataJSON()?.name===fixture.post.name;
   const moderation=fixture.policy==='moderation-enabled'&&!signedIn&&req.method()==='POST'&&url.pathname==='/apis/api.halo.run/v1alpha1/comments'&&req.postDataJSON()?.subjectRef?.name===fixture.post.name&&String(req.postDataJSON()?.raw).includes(fixture.runId);
   if(url.origin!==base||(!['GET','HEAD','OPTIONS'].includes(req.method())&&!tracker&&!moderation))return route.abort('blockedbyclient');
   return route.continue();
  });
  const response=await page.goto(base+fixture.post.path,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);
  row.initialCommentHost=/\bid="post-comment"/.test(await response.text());
  await page.waitForFunction(()=>!!window.MainApp?.useCommon,null,{timeout:20000});
  assert.equal(row.initialCommentHost,fixture.visible,'Initial HTML comment host visibility');
  row.assertions.push('initial-html-policy');
  if(!fixture.visible){
   assert.equal(await page.locator('comment-widget,#post-comment').count(),0);
   assert.equal(await page.locator('h2').filter({hasText:'Comment usage '+fixture.runId}).count(),1);
   row.assertions.push('closed-keeps-body-without-widget');
  }else{
   await page.locator('#post-comment').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>document.querySelector('comment-widget')?.isInitialized===true);
   assert.equal(await page.locator('comment-widget').count(),1);
   assert.deepEqual(await page.locator('comment-widget').evaluate(e=>[e.group,e.kind,e.name]),[fixture.post.group,fixture.post.kind,fixture.post.name]);
   const state=await page.locator('comment-widget').evaluate(e=>({allowAnonymous:e.allowAnonymousComments,user:!!e.currentUser,config:e.configMapData}));
   row.observed={allowAnonymous:state.allowAnonymous,signedIn:state.user};
   assert.equal(state.user,signedIn);
   assert.equal(state.allowAnonymous,fixture.policy!=='members-only');
   if(fixture.policy==='members-only'&&!signedIn){
    const form=page.locator('comment-form');
    await form.locator('a.form-login[href*="login"]').waitFor();
    await form.locator('input[name="displayName"]').waitFor({state:'detached'});
    const editor=form.locator('[contenteditable]');await editor.waitFor();
    const text='Members only '+fixture.runId;
    if(engine==='webkit'){await editor.click();await editor.pressSequentially(text);}else await editor.fill(text);
    await form.locator('button.form-submit').click();
    await page.getByText('请先登录',{exact:true}).waitFor();
    assert.equal(row.requests.filter(r=>r.method==='POST'&&new URL(r.url).pathname==='/apis/api.halo.run/v1alpha1/comments').length,0);
    row.assertions.push('anonymous-submit-keeps-draft-and-requires-login');
    assert.equal((await editor.innerText()).trim(),text);
   }else{
    await page.locator('comment-form [contenteditable]').waitFor();
    if(fixture.policy==='private-enabled'){assert.equal(state.config.basic.enablePrivateComment,true);await page.locator('comment-form input[name="hidden"]').waitFor();}
    if(fixture.policy==='upload-disabled'){assert.equal(state.config.editor.enableUpload,false);assert.equal(await page.locator('comment-form comment-editor').evaluate(e=>e.enableUpload),false);assert.equal(state.config.editor.enableEmoji,false);}
    if(fixture.policy==='captcha-anonymous'){assert.equal(state.config.security.captcha.enable,true);assert.equal(state.config.security.captcha.audience,'ANONYMOUS');assert.equal(state.config.security.captcha.type,'ARITHMETIC');}
    if(fixture.policy==='moderation-enabled'&&!signedIn){
     const form=page.locator('comment-form'),editor=form.locator('[contenteditable]'),text='Moderation '+engine+' '+fixture.runId;
     if(engine==='webkit'){await editor.click();await editor.pressSequentially(text);}else await editor.fill(text);
     await form.locator('input[name="displayName"]').fill('Policy '+fixture.runId);
     await form.locator('input[name="email"]').fill(engine+'-'+fixture.runId+'@example.invalid');
     await page.waitForTimeout(6500);
     const responsePromise=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/apis/api.halo.run/v1alpha1/comments',{timeout:20000});
     const refreshPromise=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/apis/api.halo.run/v1alpha1/comments'&&new URL(r.url()).searchParams.get('name')===fixture.post.name,{timeout:20000});
     await form.locator('button.form-submit').click();const response=await responsePromise;assert.equal(response.status(),200);
     const comment=await response.json();assert.equal(comment.spec.approved,false);assert.equal(comment.spec.subjectRef.name,fixture.post.name);assert.equal(comment.spec.allowNotification,true);assert(comment.spec.raw.includes(fixture.runId));
     row.created={name:comment.metadata.name,creationTimestamp:comment.metadata.creationTimestamp,approved:comment.spec.approved};
     row.assertions.push('real-anonymous-submission-pending-review');
     const refreshed=await refreshPromise;assert.equal(refreshed.status(),200);await refreshed.finished();assert.equal((await refreshed.json()).items.length,0);
     row.assertions.push('unapproved-comments-absent-from-public-refetch');
    }
   }
   row.assertions.push('official-subject-and-permission','configured-form-state');
  }
  await page.waitForLoadState('networkidle',{timeout:5000});
  row.status='passed';
 }catch(error){
  row.error=error.stack||String(error);
  if(page)row.failureState=await page.evaluate(()=>({scrollY,ready:document.readyState,widgets:[...document.querySelectorAll('comment-widget')].map(e=>({html:e.outerHTML,initialized:e.isInitialized,rect:e.getBoundingClientRect().toJSON()})),host:document.querySelector('#post-comment')?.outerHTML})).catch(e=>({error:String(e)}));
  if(page&&row.failureState?.widgets?.length===0&&fixture.visible){
   row.placeholderDiagnostic=await page.evaluate(()=>{const e=document.querySelector('[id^="comment-content-"]');if(!e)return null;const before={rect:e.getBoundingClientRect().toJSON(),viewport:{width:innerWidth,height:innerHeight},scrollY};e.scrollIntoView({block:'center'});return before;}).catch(e=>({error:String(e)}));
   if(row.placeholderDiagnostic)try{await page.waitForFunction(()=>document.querySelector('comment-widget')?.isInitialized===true,null,{timeout:5000});row.placeholderDiagnostic.mountedAfterTargetScroll=true;}catch{row.placeholderDiagnostic.mountedAfterTargetScroll=false;}
  }
 }
 finally{await closeNavigationCase(row,[context,browser],target=>target.close());await save();}
}
report.finishedAt=new Date().toISOString();report.passed=report.cases.filter(c=>c.status==='passed').length;
report.status=report.passed===fixture.expectedCases?'passed-tested-scope':'failed';await save();
console.log(fixture.policy,report.passed+'/'+fixture.expectedCases);process.exitCode=report.status==='failed'?1:0;
