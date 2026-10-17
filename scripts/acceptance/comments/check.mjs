/** Real official CommentWidget forms; no source injection or request-body rewrite. */
import assert from 'node:assert/strict';
import {readFile, writeFile, realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl,sha256} from '../../browser/support.mjs';
const file=await realpath(process.argv[2]), phase=process.argv[3];
assert(['usage','disabled','restored'].includes(phase));
assert(file.startsWith(path.join(REPO,'.runtime')+path.sep));
const fixture=JSON.parse(await readFile(file)), output=path.dirname(file), runtime=await realpath(fixture.runtime);
assert.equal(fixture.owner,'comment-usage-followup-owner');assert.equal(fixture.cases.length,fixture.expectedCases);assert.equal(new Set(fixture.cases.map(x=>x.engine+':'+x.signedIn)).size,fixture.expectedCases);for(const c of fixture.cases)assert(['chromium','firefox','webkit'].includes(c.engine)&&typeof c.signedIn==='boolean');assert.match(fixture.runId,/^[0-9a-f]{20}$/);
assert.equal(await readFile(path.join(runtime,'acceptance-comments.lock'),'utf8'),fixture.runId);
const base=validateBaseUrl(fixture.base,JSON.parse(await readFile(path.join(runtime,'lab.json'))));
assert.deepEqual(JSON.parse(await readFile(path.join(runtime,'installed-package.json'))),fixture.installed);
assert.equal(new URL(fixture.post.path,base).origin,base);
const processState=JSON.parse(await readFile(path.join(runtime,'halo-process.json')));
assert(execFileSync('ps',['-p',String(processState.pid),'-o','command='],{encoding:'utf8'}).includes(path.join(runtime,'halo/halo-2.26.1.jar')));
const auth=JSON.parse(await readFile(path.join(output,'auth.private.json')));
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const report={schema:1,phase,runId:fixture.runId,startedAt:new Date().toISOString(),runnerSha256:sha256(await readFile(new URL(import.meta.url))),fixtureSha256:sha256(await readFile(file)),cases:[],limitations:[`Headless local synthetic Post, ${fixture.expectedCases} declared anonymous/signed-in flows (${fixture.scope}); not full provider/configuration, email delivery, physical device or PJAX acceptance.`,...(['corrected-five','reply-three'].includes(fixture.scope)?['Firefox anonymous is excluded because its first-batch 30s connection/readiness failure is retained without resampling.']:[]),...(fixture.scope==='lifecycle-only'?['Parent and reply are API-created reading fixtures only; this phase provides no browser submission/retry/draft acceptance.']:[]),...(fixture.scope==='webkit-two'?['Fixed WebKit keyboard-input supplement; earlier fill-based empty-editor failures and both Firefox connection/readiness failures remain retained.']:[]),...(fixture.scope==='reply-three'?['The two WebKit editor-empty failures are retained for separate bounded diagnosis, not marked passed by this three-case reply batch.']:[]),'Exactly one 503-injected reply attempt followed by one real user retry per usage case. No navigation or measurement retry.','Official allowNotification:true remains unchanged. Coordinator requires unconfigured/disabled SMTP and .invalid identities.']};
const reportFile=path.join(output,phase+'-browser-report.json');
await writeFile(reportFile,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const save=()=>writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
const close=async(target,label)=>{let t;try{await Promise.race([target.close(),new Promise((_,reject)=>{t=setTimeout(()=>reject(Error(label+' close timeout 10s')),10000);})]);}finally{clearTimeout(t);}};
for(const engine of ['chromium','firefox','webkit']){
 if(phase==='usage'&&!fixture.cases.some(c=>c.engine===engine))continue;
 let browser;
 try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  for(const signedIn of phase==='usage'?fixture.cases.filter(c=>c.engine===engine).map(c=>c.signedIn):[engine==='firefox']){
   const id=engine+'-'+(signedIn?'signed':'anonymous'),row={id,engine,version:browser.version(),signedIn,width:signedIn?1440:390,status:'running',checkpoints:[],requests:[],pageErrors:[],consoleErrors:[],dialogs:[],created:[]};report.cases.push(row);await save();
   let context;
   try{
    context=await browser.newContext({viewport:{width:row.width,height:900},locale:'zh-CN',colorScheme:signedIn?'dark':'light',storageState:{cookies:signedIn?auth.cookies:[],origins:[]}});
    const page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(30000);
    const requestRows=new Map();let failNextReply=false;
    page.on('request',request=>{const r={url:request.url(),method:request.method(),type:request.resourceType(),mainDocument:request.isNavigationRequest()&&request.frame()===page.mainFrame(),state:'pending',stage:row.stage};if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/apis/api.halo.run/v1alpha1/comments'))r.payload=request.postDataJSON();requestRows.set(request,r);row.requests.push(r);});
    page.on('response',response=>{const r=requestRows.get(response.request());if(r)r.status=response.status();});
    page.on('requestfinished',r=>{const v=requestRows.get(r);if(v)v.state='finished';});
    page.on('requestfailed',r=>{const v=requestRows.get(r);if(v){v.state='failed';v.failure=r.failure()?.errorText;}});
    page.on('pageerror',e=>row.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
    await context.route('**/*',async route=>{
     const request=route.request(),url=new URL(request.url());
     if(url.origin!==base&&['http:','https:'].includes(url.protocol)){row.externalBlocked??=[];row.externalBlocked.push(request.url());await route.abort('blockedbyclient');return;}
     if(!['GET','HEAD','OPTIONS'].includes(request.method())){
      let allowed=false;
      if(request.method()==='POST'){
       const payload=request.postDataJSON();
       if(url.pathname==='/apis/api.halo.run/v1alpha1/comments')allowed=payload.subjectRef?.name===fixture.post.name&&payload.subjectRef?.kind==='Post'&&String(payload.raw).includes(fixture.runId);
       else if(/^\/apis\/api.halo.run\/v1alpha1\/comments\/[^/]+\/reply$/.test(url.pathname))allowed=row.created.some(x=>x.kind==='Comment'&&url.pathname===`/apis/api.halo.run/v1alpha1/comments/${x.name}/reply`)&&String(payload.raw).includes(fixture.runId);
       else if(url.pathname==='/apis/api.halo.run/v1alpha1/trackers/counter')allowed=payload.name===fixture.post.name&&payload.plural==='posts';
      }
      if(!allowed){row.unexpectedWrites??=[];row.unexpectedWrites.push({url:request.url(),method:request.method()});await route.abort('blockedbyclient');return;}
     }
     if(failNextReply&&request.method()==='POST'&&/^\/apis\/api.halo.run\/v1alpha1\/comments\/[^/]+\/reply$/.test(url.pathname)){
      failNextReply=false;const r=requestRows.get(request);if(r)r.expectedInjected503=true;
      await route.fulfill({status:503,contentType:'application/problem+json',body:JSON.stringify({title:'合成服务不可用',detail:'Owned fixed reply failure '+fixture.runId})});return;
     }
     await route.continue();
    });
    const checkpoint=async(name)=>{assert.deepEqual(row.pageErrors,[]);assert.deepEqual(row.externalBlocked||[],[]);assert.deepEqual(row.unexpectedWrites||[],[]);row.checkpoints.push({name,url:page.url(),at:new Date().toISOString()});await save();};
    const navigate=async(route)=>{const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);await page.waitForFunction(()=>!!window.MainApp?.useCommon,null,{timeout:20000});};
    const mount=async()=>{await page.locator('#post-comment').scrollIntoViewIfNeeded();await page.locator('comment-form [contenteditable]').waitFor();assert.equal(await page.locator('comment-widget').count(),1);assert.equal(await page.locator('comment-widget').evaluate(e=>e.name),fixture.post.name);};
    const draft=()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('halo-comment-draft:')).map(k=>[k,JSON.parse(localStorage.getItem(k))])));
    const editor=(form)=>form.locator('[contenteditable]');
    const enterText=async(form,text)=>{if(engine==='webkit'){const state=await form.locator('comment-editor').evaluate(e=>({loading:e.loading,destroyed:e.editor?.isDestroyed,text:e.editor?.getText()}));assert.equal(state.loading,false);assert.equal(state.destroyed,false);assert.equal(state.text,'');await editor(form).click();await editor(form).pressSequentially(text);row.inputMethod='real-key-events';}else{await editor(form).fill(text);row.inputMethod='fill';}};
    const fillIdentity=async(form)=>{if(!signedIn){await form.locator('input[name="displayName"]').fill('Usage '+id+' '+fixture.runId);await form.locator('input[name="email"]').fill(id+'-'+fixture.runId+'@example.invalid');}};
    const itemFor=text=>page.locator('comment-item').filter({has:page.locator('comment-content').getByText(text,{exact:true})}).first();
    const showReply=async(item)=>{if(await item.locator('.reply-button').count())await item.locator('.reply-button').first().click();else await item.locator('.show-replies-button').first().click();const form=item.locator('reply-form').first();await editor(form).waitFor();return form;};
    const captureHtml=async(form,text)=>{const actual=await editor(form).evaluate(e=>({html:e.innerHTML,text:e.innerText}));assert.equal(actual.text.trim(),text);assert(actual.html.includes(fixture.runId));assert(actual.html.startsWith('<p>')&&actual.html.endsWith('</p>'),'Expected actual rich-text paragraph HTML');return actual.html;};
    const submit=async(form,text,html,reply,expectedStatus)=>{
     assert.equal(await captureHtml(form,text),html);
     const responsePromise=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.startsWith('/apis/api.halo.run/v1alpha1/comments')&&(reply?new URL(r.url()).pathname.endsWith('/reply'):new URL(r.url()).pathname.endsWith('/comments')),{timeout:20000});
     await form.locator('button.form-submit').click();const response=await responsePromise;assert.equal(response.status(),expectedStatus);
     const payload=response.request().postDataJSON();assert.equal(payload.raw,html);assert.equal(payload.content,html);assert.equal(payload.allowNotification,true);
     if(expectedStatus===200){const obj=await response.json();assert(obj.metadata?.name&&obj.metadata?.creationTimestamp);assert.equal(obj.spec.raw,html);row.created.push({kind:reply?'Reply':'Comment',name:obj.metadata.name,creationTimestamp:obj.metadata.creationTimestamp,subjectRef:obj.spec.subjectRef,commentName:obj.spec.commentName,raw:html,visibleText:text});await save();return obj;}
    };
    row.stage='initial';await navigate(fixture.post.path);
    if(phase==='disabled'){
     await page.locator('.comment-unavailable').waitFor();
     assert.equal(await page.locator('#post-comment').count(),0);
     assert.equal(await page.locator('comment-widget').count(),0);
     assert.equal(await page.locator('[data-comment-lazy]').count(),0);
     assert.equal(row.requests.filter(r=>r.url.includes('/plugins/PluginCommentWidget/')).length,0);
     assert.equal(await page.locator('.comment-unavailable').innerText(),'Owned comment plugin unavailable '+fixture.runId);assert(await page.locator('article.render').isVisible());assert(await page.locator('article.render > h2').isVisible());assert.equal(await page.locator('article.render > h2').textContent(),'Comment usage '+fixture.runId);
     await checkpoint('official-plugin-disabled-core-and-fallback');
    }else if(phase==='restored'){
     await mount();
     const pairs=fixture.scope==='lifecycle-only'?[fixture.lifecycleSeed]:(JSON.parse(await readFile(path.join(output,'usage-browser-report.json')))).cases.map(old=>({parent:old.created.find(x=>x.kind==='Comment'),reply:old.created.find(x=>x.kind==='Reply')}));
     for(const {parent,reply} of pairs){assert(parent&&reply);const item=itemFor(parent.visibleText);await item.waitFor();await showReply(item);await page.locator('comment-content').getByText(reply.visibleText,{exact:true}).waitFor();}
     await checkpoint('official-plugin-restored-declared-parents-and-replies');
    }else{
     await mount();let form=page.locator('comment-form');const text='Usage parent '+id+' '+fixture.runId,replyText='Usage reply '+id+' '+fixture.runId;
     await enterText(form,text);await fillIdentity(form);
     const parentHtml=await captureHtml(form,text);row.parentHtml=parentHtml;await save();
     await page.waitForFunction(text=>Object.keys(localStorage).some(k=>k.startsWith('halo-comment-draft:')&&JSON.parse(localStorage.getItem(k)).content===text),parentHtml);
     assert.equal(await form.locator('comment-editor').evaluate(e=>e.editor?.getText()),text);
     row.draftBefore=await draft();await checkpoint('draft-saved');
     // Real trusted click gives the browser an activation; native beforeunload
     // is observed, not replaced with a synthetic browser event or dialog.
     row.stage='draft-dismiss';
     await Promise.all([page.waitForEvent('dialog',{timeout:20000}).then(async d=>{row.dialogs.push({type:d.type(),action:'dismiss'});assert.equal(d.type(),'beforeunload');await d.dismiss();}),page.locator('#comment-usage-away').click({noWaitAfter:true})]);
     assert.equal(new URL(page.url()).pathname,fixture.post.path);assert.equal(await editor(form).innerText(),text);await checkpoint('draft-leave-dismissed');
     row.stage='draft-leave';
     await Promise.all([page.waitForEvent('dialog',{timeout:20000}).then(async d=>{row.dialogs.push({type:d.type(),action:'accept'});assert.equal(d.type(),'beforeunload');await d.accept();}),page.waitForURL(base+'/',{waitUntil:'domcontentloaded',timeout:30000}),page.locator('#comment-usage-away').click({noWaitAfter:true})]);
     await navigate(fixture.post.path);await mount();form=page.locator('comment-form');assert.equal(await editor(form).innerText(),text);await fillIdentity(form);await checkpoint('draft-restored-after-native-return');
     row.stage='parent-submit';const parent=await submit(form,text,parentHtml,false,200);assert.equal(parent.spec.subjectRef.name,fixture.post.name);
     await itemFor(text).waitFor();await page.waitForFunction(text=>!Object.keys(localStorage).some(k=>k.startsWith('halo-comment-draft:')&&JSON.parse(localStorage.getItem(k)).content===text),parentHtml);assert.equal((await editor(form).innerText()).trim(),'');await checkpoint('real-parent-200-draft-cleared');
     const replyForm=await showReply(itemFor(text));await enterText(replyForm,replyText);await fillIdentity(replyForm);
     const replyHtml=await captureHtml(replyForm,replyText);row.replyHtml=replyHtml;await save();
     const node=await editor(replyForm).elementHandle();row.stage='reply-injected-503';failNextReply=true;await submit(replyForm,replyText,replyHtml,true,503);
     await page.getByText('合成服务不可用 - Owned fixed reply failure '+fixture.runId,{exact:true}).waitFor();assert.equal(await editor(replyForm).innerText(),replyText);assert.equal(await node.evaluate(e=>e.isConnected),true);assert(Object.values(await draft()).some(x=>x.content===replyHtml));await checkpoint('reply-503-editor-and-draft-retained');
     row.stage='reply-user-retry';const reply=await submit(replyForm,replyText,replyHtml,true,200);assert.equal(reply.spec.commentName,parent.metadata.name);
     await page.locator('comment-content').getByText(replyText,{exact:true}).waitFor();await page.waitForFunction(text=>!Object.keys(localStorage).some(k=>k.startsWith('halo-comment-draft:')&&JSON.parse(localStorage.getItem(k)).content===text),replyHtml);await checkpoint('real-reply-retry-200-draft-cleared');
     row.stage='refresh';const refreshed=await page.reload({waitUntil:'domcontentloaded',timeout:30000});assert.equal(refreshed.status(),200);await mount();const parentItem=itemFor(text);await parentItem.waitFor();await showReply(parentItem);await page.locator('comment-content').getByText(replyText,{exact:true}).waitFor();assert.equal(await page.locator('comment-content').getByText(text,{exact:true}).count(),1);assert.equal(await page.locator('comment-content').getByText(replyText,{exact:true}).count(),1);await checkpoint('refresh-one-parent-one-reply');
     const posts=row.requests.filter(r=>r.payload);assert.equal(posts.length,3);assert.equal(posts.filter(r=>r.expectedInjected503).length,1);assert.equal(posts.filter(r=>r.status===200).length,2);
    }
    const deadline=Date.now()+5000;while(row.requests.some(r=>r.state==='pending')&&Date.now()<deadline)await page.waitForTimeout(100);
    assert.deepEqual(row.requests.filter(r=>r.state==='pending'),[],'Pending network requests');
    assert.deepEqual(row.requests.filter(r=>r.state==='failed'||(r.status>=400&&!r.expectedInjected503)),[],'Unexpected failed requests');
    row.status='passed';
   }catch(error){row.status='failed';row.error=error.stack||String(error);}
   finally{if(context)try{await close(context,'context');}catch(e){row.status='failed';row.closeError=String(e);}await save();}
  }
 }catch(error){report.cases.push({engine,status:'failed',setupError:error.stack||String(error)});await save();}
 finally{if(browser)try{await close(browser,'browser');}catch(e){report.cases.push({engine,status:'failed',closeError:String(e)});await save();}}
}
report.finishedAt=new Date().toISOString();report.passed=report.cases.filter(c=>c.status==='passed').length;report.failed=report.cases.length-report.passed;await save();
process.exitCode=report.failed||report.cases.length!==(phase==='usage'?fixture.expectedCases:3)?1:0;
