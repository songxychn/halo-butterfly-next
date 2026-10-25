import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl} from '../../browser/support.mjs';
const file=await realpath(process.argv[2]);assert(file.startsWith(path.join(REPO,'.runtime')+path.sep));
const fixture=JSON.parse(await readFile(file)),output=path.dirname(file),runtime=await realpath(fixture.runtime);
assert.equal(fixture.owner,'comment-usage-followup-owner');assert.equal(await readFile(path.join(runtime,'acceptance-comments.lock'),'utf8'),fixture.runId);
assert.deepEqual(JSON.parse(await readFile(path.join(runtime,'installed-package.json'))),fixture.installed);
const base=validateBaseUrl(fixture.base,JSON.parse(await readFile(path.join(runtime,'lab.json'))));
const auth=JSON.parse(await readFile(path.join(output,'auth.private.json')));
Object.assign(process.env,browserEnvironment());const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const report={installed:fixture.installed,subject:fixture.post,scope:fixture.scope,answerSource:'Displayed CAPTCHA image; no answer read from server internals',cases:[]};
const save=()=>writeFile(path.join(output,'captcha-browser.json'),JSON.stringify(report,null,2)+'\n');
const endpoint='/apis/api.halo.run/v1alpha1/comments';
for(const {engine,signedIn} of fixture.cases){
 const row={engine,signedIn,status:'failed',requests:[],pageErrors:[],consoleErrors:[],assertions:[]};report.cases.push(row);
 let browser,context,page;const requests=new Map();
 try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});row.browserVersion=browser.version();
  context=await browser.newContext({viewport:{width:signedIn?1440:390,height:1000},locale:'zh-CN'});if(signedIn)await context.addCookies(auth.cookies);
  page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>row.pageErrors.push(e.message));page.on('console',e=>{if(e.type()==='error')row.consoleErrors.push({text:e.text(),location:e.location()});});
  page.on('request',r=>{const item={url:r.url(),method:r.method(),state:'pending'};requests.set(r,item);row.requests.push(item);});
  page.on('response',r=>{const item=requests.get(r.request());if(item)item.status=r.status();});
  page.on('requestfinished',r=>{if(requests.has(r))requests.get(r).state='finished';});
  page.on('requestfailed',r=>{if(requests.has(r)){requests.get(r).state='failed';requests.get(r).error=r.failure()?.errorText;}});
  await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());
   const submit=r.method()==='POST'&&u.pathname===endpoint&&r.postDataJSON()?.subjectRef?.name===fixture.post.name&&String(r.postDataJSON()?.raw).includes(fixture.runId);
   const tracker=r.method()==='POST'&&u.pathname==='/apis/api.halo.run/v1alpha1/trackers/counter'&&r.postDataJSON()?.name===fixture.post.name;
   return u.origin===base&&(['GET','HEAD','OPTIONS'].includes(r.method())||submit||tracker)?route.continue():route.abort('blockedbyclient');});
  assert.equal((await page.goto(base+fixture.post.path,{waitUntil:'domcontentloaded',timeout:30000})).status(),200);
  await page.locator('#post-comment').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('comment-widget')?.isInitialized===true);
  const form=page.locator('comment-form'),editor=form.locator('[contenteditable]'),text='Captcha '+engine+' '+signedIn+' '+fixture.runId;
  const state=await page.locator('comment-widget').evaluate(e=>({signedIn:!!e.currentUser,config:e.configMapData}));assert.equal(state.signedIn,signedIn);assert.equal(state.config.security.captcha.type,'ARITHMETIC');assert.equal(state.config.captchaRequired,!signedIn);
  if(engine==='webkit'){await editor.click();await editor.pressSequentially(text);}else await editor.fill(text);
  if(!signedIn){await form.locator('input[name="displayName"]').fill('Captcha '+fixture.runId);await form.locator('input[name="email"]').fill(engine+'-'+fixture.runId+'@example.invalid');}
  const input=form.locator('input[name="captchaCode"]');
  const postResponse=()=>page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===endpoint,{timeout:20000});
  if(!signedIn){
   await input.waitFor();const missing=postResponse();await form.locator('button.form-submit').click();const missingResponse=await missing;assert.equal(missingResponse.status(),403);
   row.missingRejection=await missingResponse.json();assert.equal(row.missingRejection.type,'https://www.halo.run/probs/captcha-required');requests.get(missingResponse.request()).expectedCaptchaRejection='captcha-required';await missingResponse.finished();
   await page.getByText('请先输入验证码',{exact:true}).waitFor();assert.equal((await editor.innerText()).trim(),text);row.assertions.push('missing-answer-server-rejection-keeps-draft');
   await input.fill('99999');await page.waitForTimeout(6500);const wrong=postResponse();await form.locator('button.form-submit').click();const rejected=await wrong;assert.equal(rejected.status(),403);
   row.rejection=await rejected.json();assert.equal(row.rejection.type,'https://www.halo.run/probs/captcha-invalid');requests.get(rejected.request()).expectedCaptchaRejection='captcha-invalid';await rejected.finished();
   await page.getByText('人机验证未通过，请重新验证后提交。',{exact:true}).waitFor();assert.equal((await editor.innerText()).trim(),text);row.assertions.push('wrong-answer-rejected-draft-preserved');
   const image=form.locator('.form-captcha img');const before=await image.getAttribute('src');
   await form.locator('.form-captcha button').click();
   await image.evaluate((e,old)=>new Promise((resolve,reject)=>{const deadline=Date.now()+20000;const poll=()=>{if(e.getAttribute('src')!==old)return resolve(true);if(Date.now()>deadline)return reject(new Error('CAPTCHA refresh deadline'));setTimeout(poll,50);};poll();}),before);
   const solveDisplayed=async(suffix='')=>{
    await image.evaluate(e=>e.decode());const picture=path.join(output,'captcha-'+engine+suffix+'.png'),answerFile=path.join(output,'captcha-'+engine+suffix+'-answer.txt');await image.screenshot({path:picture});
    await writeFile(path.join(output,'captcha-ready.json'),JSON.stringify({engine,picture,answerFile}));await save();console.log('CAPTCHA_IMAGE_READY',engine,picture);
    const deadline=Date.now()+45000;let answer;
    while(Date.now()<deadline){try{answer=(await readFile(answerFile,'utf8')).trim();break;}catch(e){if(e.code!=='ENOENT')throw e;}await new Promise(r=>setTimeout(r,250));}
    assert(/^-?\d{1,4}$/.test(answer||''),'Displayed CAPTCHA answer not supplied within 45s');await input.fill(answer);
   };
   await solveDisplayed();row.assertions.push('refreshed-image-answer-entered');
   if(fixture.scope==='captcha-expiry'){
    const expiryImage=await image.getAttribute('src'),generationCount=()=>row.requests.filter(r=>new URL(r.url).pathname==='/apis/api.commentwidget.halo.run/v1alpha1/captcha/-/generate').length;
    const generationsBefore=generationCount();row.expiry={startedAt:new Date().toISOString(),requiredWaitMs:65000};await save();const started=Date.now();
    await page.waitForTimeout(65000);row.expiry.waitedMs=Date.now()-started;assert(row.expiry.waitedMs>=65000);
    assert.equal(await image.getAttribute('src'),expiryImage);assert.equal(generationCount(),generationsBefore);row.expiry.challengeUnchangedDuringWait=true;
    const expired=postResponse();await form.locator('button.form-submit').click();const expiredResponse=await expired;assert.equal(expiredResponse.status(),403);
    const problem=await expiredResponse.json();assert.equal(problem.type,'https://www.halo.run/probs/captcha-invalid');requests.get(expiredResponse.request()).expectedCaptchaRejection='captcha-invalid';await expiredResponse.finished();
    await page.getByText('人机验证未通过，请重新验证后提交。',{exact:true}).waitFor();assert.equal((await editor.innerText()).trim(),text);row.assertions.push('naturally-expired-answer-rejected-draft-preserved');
    const old=await image.getAttribute('src');await form.locator('.form-captcha button').click();
    await image.evaluate((e,old)=>new Promise((resolve,reject)=>{const deadline=Date.now()+20000;const poll=()=>{if(e.getAttribute('src')!==old)return resolve(true);if(Date.now()>deadline)return reject(new Error('CAPTCHA renewal deadline'));setTimeout(poll,50);};poll();}),old);
    await solveDisplayed('-renewed');row.assertions.push('expired-challenge-renewed');
   }
  }else{assert.equal(await input.count(),0);row.assertions.push('signed-in-user-exempt');}
  await page.waitForTimeout(6500);const submitted=postResponse();await form.locator('button.form-submit').click();const response=await submitted;assert.equal(response.status(),200);const comment=await response.json();
  assert.equal(comment.spec.subjectRef.name,fixture.post.name);assert(comment.spec.raw.includes(text));assert.equal(comment.spec.approved,true);row.created={name:comment.metadata.name,creationTimestamp:comment.metadata.creationTimestamp};
  await page.locator('comment-item').filter({hasText:text}).waitFor();row.assertions.push('real-ui-submission-visible');await page.waitForLoadState('networkidle',{timeout:5000});row.status='passed';
 }catch(e){row.error=e.stack||String(e);}
 finally{
  for(const target of [context,browser])if(target)try{await target.close();}catch(e){(row.closeErrors??=[]).push(String(e));row.status='failed';}
  const expected=row.requests.filter(r=>['captcha-required','captcha-invalid'].includes(r.expectedCaptchaRejection)&&r.method==='POST'&&r.url===base+endpoint&&r.status===403&&r.state==='finished');
  const expectedConsole=row.consoleErrors.filter(e=>e.location.url===base+endpoint&&/^Failed to load resource: the server responded with a status of 403 \(Forbidden\)$/.test(e.text));
  row.finalErrors={page:row.pageErrors,requests:row.requests.filter(r=>r.state!=='finished'||(r.status>=400&&!expected.includes(r))),console:row.consoleErrors.filter(e=>!expectedConsole.includes(e)),excessExpectedConsole:Math.max(0,expectedConsole.length-expected.length),close:row.closeErrors||[]};
  if(Object.values(row.finalErrors).some(v=>Array.isArray(v)?v.length:!!v))row.status='failed';await save();
 }
 if(row.status==='failed')break;
}
report.passed=report.cases.filter(x=>x.status==='passed').length;report.status=report.passed===fixture.expectedCases?'passed-tested-scope':'failed';await save();console.log(report.passed+'/'+fixture.expectedCases);process.exitCode=report.status==='failed'?1:0;
