import assert from 'node:assert/strict';
import {readFile,writeFile,realpath,mkdir,chmod,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl} from '../../browser/support.mjs';
import {finalUploadErrors} from './upload-final-errors.mjs';
const file=await realpath(process.argv[2]),output=path.dirname(file);
assert(file.startsWith(path.join(REPO,'.runtime')+path.sep));
const fixture=JSON.parse(await readFile(file)),runtime=await realpath(fixture.runtime);
assert.equal(fixture.owner,'comment-usage-followup-owner');
assert.equal(await readFile(path.join(runtime,'acceptance-comments.lock'),'utf8'),fixture.runId);
assert.deepEqual(JSON.parse(await readFile(path.join(runtime,'installed-package.json'))),fixture.installed);
const base=validateBaseUrl(fixture.base,JSON.parse(await readFile(path.join(runtime,'lab.json'))));
const auth=JSON.parse(await readFile(path.join(output,'auth.private.json')));
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const report={runId:fixture.runId,subject:fixture.post,installed:fixture.installed,expectedCases:fixture.expectedCases,scope:fixture.scope,startedAt:new Date().toISOString(),cases:[]};
const save=()=>writeFile(path.join(output,'upload-browser.json'),JSON.stringify(report,null,2)+'\n');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGMQyduCFTEMLQkAIIpNgfY33vIAAAAASUVORK5CYII=','base64');
for(const {engine,signedIn} of fixture.cases){
 const id=engine+'-'+(signedIn?'signed':'anonymous');
 const row={id,engine,signedIn,status:'failed',assertions:[],created:[],uploads:[],submissions:[],requests:[],pageErrors:[],consoleErrors:[]};report.cases.push(row);await save();
 let browser,context,page,profile;
 try{
  const options={viewport:{width:signedIn?1440:390,height:1000},locale:'zh-CN'};
  if(engine==='webkit'){
   // Ephemeral WebKit contexts cannot reliably persist File in IndexedDB.
   // Use a new, task-owned disk profile; this is still headless WebKit, not actual Safari.
   profile=path.join(output,'profile-'+id);await mkdir(profile,{mode:0o700});await chmod(profile,0o700);
   context=await pw.webkit.launchPersistentContext(profile,{headless:true,...options});browser=context.browser();row.storageMode='fresh-persistent-profile';
  }else{browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});context=await browser.newContext(options);row.storageMode='isolated-ephemeral-context';}
  row.version=browser.version();
  if(signedIn)await context.addCookies(auth.cookies);
  page=await context.newPage();page.setDefaultTimeout(20000);
  const requestRows=new Map();
  page.on('request',r=>{const x={url:r.url(),method:r.method(),state:'pending'};requestRows.set(r,x);row.requests.push(x);});
  page.on('response',r=>{const x=requestRows.get(r.request());if(x)x.status=r.status();});
  page.on('requestfinished',r=>{const x=requestRows.get(r);if(x)x.state='finished';});
  page.on('requestfailed',r=>{const x=requestRows.get(r);if(x){x.state='failed';x.failure=r.failure()?.errorText;}});
  page.on('pageerror',e=>row.pageErrors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')row.consoleErrors.push(e.text());});
  let failUpload=false;
  await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url()),method=r.method();
   if(['data:','blob:'].includes(u.protocol))return route.continue();
   if(u.origin!==base)return route.abort('blockedbyclient');
   if(fixture.scope==='upload-isolated'&&r.isNavigationRequest()&&u.pathname===fixture.post.path){
    row.isolatedOfficialWidget=true;
    return route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><script type="module" src="/plugins/PluginCommentWidget/assets/static/a.ff4cd3aa.js"></script></head><body><main><h1>Owned official component control</h1><div id="post-comment"><comment-widget group="${fixture.post.group}" kind="${fixture.post.kind}" name="${fixture.post.name}"></comment-widget></div></main></body></html>`});
   }
   if(['GET','HEAD','OPTIONS'].includes(method))return route.continue();
   const upload=method==='POST'&&u.pathname==='/apis/api.commentwidget.halo.run/v1alpha1/upload';
   const submission=u.pathname.startsWith('/apis/api.commentwidget.halo.run/v1alpha1/submissions')&&['POST','DELETE'].includes(method);
   let owned=false;
   if(!upload&&!submission){
    let body;try{body=r.postDataJSON();}catch{}
    owned=method==='POST'&&((u.pathname==='/apis/api.halo.run/v1alpha1/trackers/counter'&&body?.name===fixture.post.name)||
     (u.pathname==='/apis/api.halo.run/v1alpha1/comments'&&body?.subjectRef?.name===fixture.post.name&&body.raw.includes(fixture.runId))||
     (row.created.some(x=>u.pathname===`/apis/api.halo.run/v1alpha1/comments/${x.name}/reply`)&&body?.raw?.includes(fixture.runId)));
   }
   if(!upload&&!submission&&!owned)return route.abort('blockedbyclient');
   if(upload&&failUpload){failUpload=false;row.injected503=true;requestRows.get(r).expectedInjected503=true;return route.fulfill({status:503,contentType:'application/problem+json',body:JSON.stringify({title:'Upload temporarily unavailable',detail:'Owned upload failure '+fixture.runId})});}
   return route.continue();
  });
  page.on('response',async r=>{if(r.request().method()==='POST'&&new URL(r.url()).pathname==='/apis/api.commentwidget.halo.run/v1alpha1/submissions'){
   const entry={status:r.status(),receivedAt:new Date().toISOString()};row.submissions.push(entry);try{entry.body=await r.json();}catch{}await save();
  }if(r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/v1alpha1/upload')){
   const entry={status:r.status()};row.uploads.push(entry);try{entry.body=await r.json();}catch{}await save();
  }});
  const mount=async()=>{await page.locator('#post-comment').scrollIntoViewIfNeeded();await page.locator('comment-form [contenteditable="true"]').waitFor();assert.deepEqual(await page.locator('comment-widget').evaluate(e=>[e.group,e.kind,e.name]),[fixture.post.group,fixture.post.kind,fixture.post.name]);};
  const select=async(form,name,mimeType,buffer)=>{const chooser=page.waitForEvent('filechooser');await form.getByRole('button',{name:'上传',exact:true}).click();await(await chooser).setFiles({name,mimeType,buffer});};
  const identity=async form=>{if(signedIn)return;if(engine==='webkit')await page.waitForTimeout(150);for(const [name,value] of [['displayName','Upload '+fixture.runId],['email',id+'-'+fixture.runId+'@example.invalid']]){const input=form.locator(`input[name="${name}"]`);if(await input.inputValue()===value)continue;if(engine==='webkit'){for(let step=0;step<20&&!await input.evaluate(e=>e.getRootNode().activeElement===e);step++)await page.keyboard.press('Tab');assert.equal(await input.evaluate(e=>e.getRootNode().activeElement===e),true,'Keyboard must reach the actual anonymous identity field');row.identityInputMethod='keyboard-tab';await page.keyboard.press('Meta+A');await page.keyboard.type(value,{delay:50});const actual=await input.inputValue();(row.identityInputs??=[]).push({field:name,expected:value,actual});assert.equal(actual,value);}else await input.fill(value);}};
  const enter=async(form,text)=>{const ed=form.locator('[contenteditable="true"]');if(engine==='webkit'){await ed.click();/* Official editor click schedules focus after 100ms. */await page.waitForTimeout(150);await ed.pressSequentially(text);await ed.press('Tab');}else await ed.fill(text);assert.equal((await ed.innerText()).trim(),text);await identity(form);assert.equal((await ed.innerText()).trim(),text);};
  const settle=async()=>{const until=Date.now()+5000;while(row.requests.some(x=>x.state==='pending')&&Date.now()<until)await page.waitForTimeout(100);assert.deepEqual(row.requests.filter(x=>x.state==='pending'),[]);};
  const imageLoaded=async(locator)=>{await locator.waitFor();await locator.evaluate(img=>new Promise((resolve,reject)=>{if(img.complete)return img.naturalWidth>0?resolve():reject(Error('Image failed'));img.addEventListener('load',resolve,{once:true});img.addEventListener('error',()=>reject(Error('Image failed')),{once:true});}));};
  assert.equal((await page.goto(base+fixture.post.path,{waitUntil:'domcontentloaded',timeout:30000})).status(),200);await mount();
  assert.equal(await page.locator('comment-widget').evaluate(e=>!!e.currentUser),signedIn);
  let form=page.locator('comment-form');
  assert.equal(await form.locator('comment-editor').evaluate(e=>e.enableUpload),true);
  const text='Upload parent '+id+' '+fixture.runId;await enter(form,text);
  await select(form,fixture.runId+'.svg','image/svg+xml',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'));
  await page.getByText(/仅支持 JPEG|Only JPEG/).first().waitFor();assert.equal(await form.locator('[contenteditable="true"] img[src]').count(),0);
  await select(form,fixture.runId+'-large.png','image/png',Buffer.alloc(1048577,1));
  await page.getByText(/1 MiB/).first().waitFor();assert.equal(await form.locator('[contenteditable="true"] img[src]').count(),0);
  assert.equal(row.uploads.length,0);row.assertions.push('invalid-format-and-size-rejected-before-network');
  await select(form,fixture.runId+'-'+id+'-parent.png','image/png',png);
  await imageLoaded(form.locator('[contenteditable="true"] img[src]'));row.assertions.push('local-image-preview');
  if(!['upload-direct','upload-webkit-direct'].includes(fixture.scope)){
  // Observe completion of the real asynchronous IndexedDB write, without flushing or changing it.
  await page.waitForFunction(async()=>{
   // Query nested open shadow roots; component boundaries can change between versions.
   const all=(root)=>[...root.querySelectorAll('*')].flatMap(e=>[e,...(e.shadowRoot?all(e.shadowRoot):[])]);
   const host=all(document).find(e=>e.localName==='comment-editor'&&e.draftKey);
   if(!host)return false;
   return new Promise(resolve=>{const req=indexedDB.open('halo-comment-uploads',1);req.onerror=()=>resolve(false);req.onsuccess=()=>{
    const db=req.result;if(!db.objectStoreNames.contains('drafts')){db.close();resolve(false);return;}
    const tx=db.transaction('drafts','readonly'),get=tx.objectStore('drafts').get(host.draftKey);
    get.onsuccess=()=>{const d=get.result;const hasFile=n=>n?.attrs?.file instanceof Blob||(n?.content||[]).some(hasFile);resolve(d?.revision===host.draftRevision&&hasFile(d.document));};
    get.onerror=()=>resolve(false);tx.oncomplete=()=>db.close();
   };});
  },null,{timeout:20000});row.assertions.push('image-draft-write-complete');
  // Reload before submitting: persisted local image draft must survive.
  await settle();await page.reload({waitUntil:'domcontentloaded',timeout:30000});await mount();form=page.locator('comment-form');
  assert((await form.locator('[contenteditable="true"]').innerText()).includes(text));await imageLoaded(form.locator('[contenteditable="true"] img[src]'));
  row.assertions.push('text-and-image-draft-survives-reload');
  }else row.assertions.push('direct-submit-scope-no-unsubmitted-image-refresh');
  await identity(form);
  failUpload=true;const rejected=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/v1alpha1/upload'));
  await form.locator('button.form-submit').click();assert.equal((await rejected).status(),503);
  await page.getByText(new RegExp('Owned upload failure '+fixture.runId)).first().waitFor();
  assert((await form.locator('[contenteditable="true"]').innerText()).includes(text));assert.equal(await form.locator('[contenteditable="true"] img[src]').count(),1);row.assertions.push('upload-503-preserves-draft');
  const submit=async(f,isReply,visibleText)=>{
   await page.waitForTimeout(6500);assert.equal((await f.locator('[contenteditable="true"]').innerText()).trim(),visibleText);
   const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.startsWith('/apis/api.halo.run/v1alpha1/comments')&&(isReply?r.url().endsWith('/reply'):r.url().endsWith('/comments')));
   await f.locator('button.form-submit').click();const r=await response;assert.equal(r.status(),200);const obj=await r.json();if(isReply)assert(row.created.some(x=>x.kind==='Comment'&&obj.spec.commentName===x.name));else assert.deepEqual(obj.spec.subjectRef,{group:fixture.post.group,version:'v1alpha1',kind:fixture.post.kind,name:fixture.post.name});assert.equal(await page.evaluate(raw=>new DOMParser().parseFromString(raw,'text/html').body.textContent.trim(),obj.spec.raw),visibleText);assert(obj.spec.raw.includes(fixture.runId));assert(obj.spec.raw.includes('<img'));assert(!obj.spec.raw.includes('blob:'));assert.equal(obj.spec.allowNotification,true);
   const item={kind:isReply?'Reply':'Comment',name:obj.metadata.name,creationTimestamp:obj.metadata.creationTimestamp,raw:obj.spec.raw,visibleText};row.created.push(item);await save();
   const content=page.locator('comment-content').filter({hasText:visibleText}).first();await content.waitFor();await imageLoaded(content.locator('img').first());
   return item;
  };
  const parent=await submit(form,false,text);row.assertions.push('parent-retry-upload-submit-and-public-image');
  const item=page.locator('comment-item').filter({has:page.locator('comment-content').getByText(text,{exact:true})}).first();
  if(await item.locator('.reply-button').count())await item.locator('.reply-button').first().click();else await item.locator('.show-replies-button').first().click();
  const replyForm=item.locator('reply-form').first();await replyForm.locator('[contenteditable="true"]').waitFor();
  const replyText='Upload reply '+id+' '+fixture.runId;await enter(replyForm,replyText);
  await select(replyForm,fixture.runId+'-'+id+'-reply.png','image/png',png);await imageLoaded(replyForm.locator('[contenteditable="true"] img[src]'));
  await submit(replyForm,true,replyText);row.assertions.push('reply-upload-submit-and-public-image');
  await settle();await page.reload({waitUntil:'domcontentloaded',timeout:30000});await mount();
  const readItem=page.locator('comment-item').filter({has:page.locator('comment-content').getByText(text,{exact:true})}).first();await readItem.waitFor();
  if(await readItem.locator('.show-replies-button').count())await readItem.locator('.show-replies-button').first().click();
  for(const t of [text,replyText]){const content=page.locator('comment-content').filter({hasText:t}).first();await content.waitFor();await imageLoaded(content.locator('img').first());}
  assert.equal(row.uploads.filter(x=>x.status===200).length,2);assert.equal(row.uploads.filter(x=>x.status===503).length,1);
  assert.equal(row.pageErrors.length,0);row.assertions.push('persisted-parent-and-reply-images-after-refresh');await settle();row.status='passed';
 }catch(error){row.error=error.stack||String(error);if(page)row.failureState=await page.locator('comment-form comment-editor').evaluate(async e=>{
  const summarize=n=>({type:n.type,attrs:n.attrs?Object.fromEntries(Object.entries(n.attrs).map(([k,v])=>[k,k==='file'?{constructor:v?.constructor?.name,isFile:v instanceof File,isBlob:v instanceof Blob,size:v?.size,type:v?.type}:v])):undefined,content:n.content?.map(summarize)});
  const req=indexedDB.open('halo-comment-uploads',1);const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const d=await new Promise((resolve,reject)=>{const r=db.transaction('drafts','readonly').objectStore('drafts').get(e.draftKey);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
  return {editor:summarize(e.editor.getJSON()),draft:d?{revision:d.revision,document:summarize(d.document)}:null,revision:e.draftRevision,dom:e.shadowRoot.innerHTML};
 }).catch(e=>({error:String(e)}));}
 finally{
  for(const target of [context,browser])if(target)try{await target.close();}catch(e){row.closeError=String(e);row.status='failed';}
  if(profile)try{await rm(profile,{recursive:true});row.profileRemoved=true;}catch(e){row.closeError=String(e);row.status='failed';}
  row.finalErrors=finalUploadErrors(row);
  if(Object.values(row.finalErrors).some(x=>Array.isArray(x)?x.length:!!x))row.status='failed';
  await save();
 }
 if(row.status!=='passed')break; // Preserve the first failure; remaining declared cases are untested.
}
report.finishedAt=new Date().toISOString();report.passed=report.cases.filter(x=>x.status==='passed').length;report.status=report.passed===fixture.expectedCases?'passed-tested-scope':'failed';await save();
console.log('uploads',report.passed+'/'+fixture.expectedCases);process.exitCode=report.status==='failed'?1:0;
