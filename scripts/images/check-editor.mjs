/** Real editor -> reopen -> optional real edit/resave -> publish -> anonymous initial HTML. Owned local fixtures only. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath,stat,open,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl,validatePackage,sha256} from '../browser/support.mjs';
import {imageSignature} from './editor-signature.mjs';

assert.equal(process.env.ALLOW_SYNTHETIC_WRITES,'yes');
assert(process.env.LAB_RUNTIME,'Explicit LAB_RUNTIME required');
const scenario=process.env.EDITOR_SCENARIO||'single-save';
assert(['single-save','resave'].includes(scenario),'Unknown EDITOR_SCENARIO');
const runtime=await realpath(path.resolve(process.env.LAB_RUNTIME));
assert(runtime.startsWith(path.join(REPO,'.runtime')+path.sep));
const base=validateBaseUrl(process.env.BASE_URL,JSON.parse(await readFile(path.join(runtime,'lab.json'))));
const installed=JSON.parse(await readFile(path.join(runtime,'installed-package.json')));
const sourceSha=process.env.THEME_SOURCE_SHA;
assert.equal(path.basename(installed.name),installed.name);
const packagePath=await realpath(path.resolve(process.env.PACKAGE||path.join(REPO,'dist',installed.name)));
assert(packagePath.startsWith(REPO),'Package must belong to this worktree');
validatePackage(installed,sourceSha,sha256(await readFile(packagePath)));
execFileSync('git',['diff','--exit-code',sourceSha,'--','src','i18n','settings.yaml','theme.yaml','scripts/build.mjs','package.json','bun.lock','bunfig.toml'],{cwd:REPO,stdio:'pipe'});
// Check the live process, official runtime, and every installed package file before writes.
const preflight=()=>JSON.parse(execFileSync('python3',['-c',`
import hashlib,json,pathlib,subprocess,sys,zipfile
repo,runtime,package=map(pathlib.Path,sys.argv[1:])
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
state=json.loads((runtime/'halo-process.json').read_text())
jar=runtime/'halo/halo-2.26.1.jar'
assert state['identity']==str(jar)
command=subprocess.check_output(['ps','-p',str(state['pid']),'-o','command='],text=True)
assert str(jar) in command and str(runtime/'halo/data') in command
assert 'max-keep-alive-requests' not in command and 'maxKeepAliveRequests' not in command
versions=json.loads((repo/'fixtures/comparison/versions.json').read_text())
assert digest(jar)==versions['halo']['sha256']
with zipfile.ZipFile(package) as z:
 files=[n for n in z.namelist() if not n.endswith('/')]
 assert len(files)==269
 for name in files:
  p=pathlib.Path(name)
  assert not p.is_absolute() and '..' not in p.parts
  assert (runtime/'halo/data/themes/halo-butterfly-next'/name).read_bytes()==z.read(name), name
plugins={p.name:digest(p) for p in sorted((runtime/'halo/data/plugins').glob('*.jar'))}
assert '6706fd5ab80551577522756b81dbbc29427a46b1951bb925a8f1fb8f5900ef1f' in plugins.values(), 'Pinned official hybrid editor JAR missing'
print(json.dumps({'pid':state['pid'],'haloSha256':digest(jar),'packageFiles':len(files),'pluginJars':plugins}))
`,REPO,runtime,packagePath],{encoding:'utf8',timeout:30000}));
const identity=preflight();
const credentialsPath=path.join(runtime,'halo/credentials.json');
assert.equal((await stat(credentialsPath)).mode&0o077,0);
const credentials=JSON.parse(await readFile(credentialsPath));
const runId=randomBytes(8).toString('hex');
const fixturePath=path.join(REPO,'fixtures/images/editor-content.html');
const fixture=(await readFile(fixturePath,'utf8')).replaceAll('__RUN__',runId);
const output=path.join(runtime,'authored-images',runId);await mkdir(output,{recursive:true});
const lock=path.join(runtime,'authored-image-editor.lock');
const handle=await open(lock,'wx',0o600);await handle.writeFile(runId+'\n');await handle.close();
const engines=(process.env.ENGINES||'chromium').split(',');assert(engines.every(e=>['chromium','firefox','webkit'].includes(e)));
Object.assign(process.env,browserEnvironment());
const report={schema:1,runId,base,sourceSha,installed,identity,runnerHead:execFileSync('git',['rev-parse','HEAD'],{cwd:REPO,encoding:'utf8'}).trim(),runnerSha256:sha256(await readFile(fileURLToPath(import.meta.url))),fixtureSha256:sha256(await readFile(fixturePath)),cases:[],created:[],cleanup:[],limitations:['Initial HTML semantics only; no image transfer, connection reliability, performance or full 1.0 claim.','Headless engines are not actual Safari or physical devices.','Plain paste is a synthetic text/html ClipboardEvent, not an OS clipboard or rich-text insert-image toolbar.','No runtime, theme configuration or plugin changes. Attribute differences are observations, not automatically product defects.']};
report.scenario=scenario;
report.fixtureIdentity={required:['metadata.name','spec.title (unique runId)','metadata.creationTimestamp (nonempty server value)'],optional:'metadata.uid is additionally compared only when present; Halo 2.26.1 does not provide it.',scope:'Creation timestamp is an observed identity field, not a UID guarantee. Earlier reports did not validate this field.'};
if(scenario==='resave'){
 report.schema=2;
 report.metadataUpdates=[];report.blockedRequests=[];
 report.limitations=report.limitations.filter(x=>!x.startsWith('Plain paste'));
 report.limitations.push('Two UI saves per case: create, reopen, append a unique text marker with the keyboard, blur, update, reopen again, then publish by API. Only HTML block, Markdown block and Markdown image are covered.','Reopened Markdown is source text, not rendered HTML. Source conversion is recorded separately; image preservation is judged from actual save HTML, stored content and anonymous initial HTML.');
}
const save=()=>writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
report.signatureSha256=sha256(await readFile(new URL('./editor-signature.mjs',import.meta.url)));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const resourceRoot='/apis/content.halo.run/v1alpha1/';
const consoleRoot='/apis/api.console.halo.run/v1alpha1/';
let browser,context,page,parser,csrf,before;
const metadataRequests=new Map();
const api=async(route,method='GET',data,allowMissing=false)=>{
 assert((route.startsWith('/apis/')||(method==='GET'&&route.startsWith('/api/v1alpha1/configmaps/')))&&!route.includes('://'));
 const response=await context.request.fetch(base+route,{method,data,headers:{Accept:'application/json','X-CSRF-TOKEN':csrf},timeout:20000,maxRedirects:0});
 if(allowMissing&&response.status()===404)return null;
 if(!response.ok())throw new Error(`${method} ${route}: HTTP ${response.status()}`);
 const body=await response.text();return body?JSON.parse(body):null;
};
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const station=async()=>{
 const plugins=(await api('/apis/plugin.halo.run/v1alpha1/plugins?size=100')).items;
 const config=await api(consoleRoot+'themes/halo-butterfly-next/json-config');
 const active=await api(consoleRoot+'themes/-/activation');
 assert.equal(active.metadata.name,'halo-butterfly-next');assert.equal(active.spec.version,installed.version);
 const pluginRecords=[];
 for(const p of plugins.sort((a,b)=>a.metadata.name.localeCompare(b.metadata.name))){
  let configSha256=null;
  if(p.spec.configMapName){const c=await api('/api/v1alpha1/configmaps/'+encodeURIComponent(p.spec.configMapName),'GET',undefined,true);configSha256=c?sha256(canonical(c.data||{})):'absent';}
  pluginRecords.push({name:p.metadata.name,uid:p.metadata.uid,version:p.spec.version,enabled:p.spec.enabled,phase:p.status?.phase,configSha256});
 }
 const contents={};
 for(const plural of ['posts','singlepages']){
  const list=await api(resourceRoot+plural+'?size=100');assert((list.total||list.items.length)<=100,'Content inventory exceeds bounded plan');
  contents[plural]=list.items.filter(x=>!x.spec.title?.includes(runId)).map(x=>({name:x.metadata.name,uid:x.metadata.uid,spec:x.spec})).sort((a,b)=>a.name.localeCompare(b.name));
 }
 return {theme:{name:active.metadata.name,uid:active.metadata.uid,version:active.spec.version},configurationSha256:sha256(canonical(config)),plugins:pluginRecords,existingContentSha256:sha256(canonical(contents))};
};
const signature=(html,initial=false)=>parser.evaluate(imageSignature,{html,runId,initial});
const archive=async(item,name,value)=>{
 const file=item.id+'-'+name;
 await writeFile(path.join(output,file),value,{flag:'wx'});
 return {file,sha256:sha256(value)};
};
const stage=async(item,name,markup)=>{
 await writeFile(path.join(output,item.id+'-'+name+'.html'),markup,{flag:'wx'});
 item.stages[name]={sha256:sha256(markup),...await signature(markup,name==='initial')};
};
const captureEditor=async(item,label)=>{
 const evidence=await page.locator('.tiptap').evaluate(root=>({html:root.innerHTML,text:root.textContent,documents:[...root.querySelectorAll('.cm-content')].map((e,index)=>({index,source:e.cmView?.view?.state.doc.toString()??null}))}));
 const documents=evidence.documents.map(doc=>({...doc,sha256:typeof doc.source==='string'?sha256(doc.source):null,hasRunId:doc.source?.includes(runId)||false,hasMarker:doc.source?.includes(item.marker)||false}));
 return {documents,html:await archive(item,label+'-editor.html',evidence.html),sources:await archive(item,label+'-documents.json',JSON.stringify(documents,null,2)+'\n'),text:await archive(item,label+'-text.txt',evidence.text||''),markerInText:evidence.text?.includes(item.marker)||false};
};
const fixtureRecord=(plural,obj)=>{
 assert.match(obj.metadata.name,/^[A-Za-z0-9._-]+$/);assert(obj.spec.title.startsWith(`Author images ${runId} `));
 const creationTimestamp=obj.metadata.creationTimestamp;
 assert.equal(typeof creationTimestamp,'string');assert(creationTimestamp.trim(),'Server creationTimestamp must be nonempty');assert(Number.isFinite(Date.parse(creationTimestamp)),'Server creationTimestamp must be a date');
 const record={plural,name:obj.metadata.name,title:obj.spec.title,creationTimestamp};
 if(obj.metadata.uid!==undefined&&obj.metadata.uid!==null){assert.equal(typeof obj.metadata.uid,'string');assert(obj.metadata.uid.trim());record.uid=obj.metadata.uid;}
 return record;
};
const sameFixture=(obj,record)=>!!record&&typeof record.creationTimestamp==='string'&&!!record.creationTimestamp.trim()&&obj?.metadata?.name===record.name&&obj?.spec?.title===record.title&&obj.metadata.creationTimestamp===record.creationTimestamp&&(!(obj.metadata.uid!=null||record.uid!=null)||obj.metadata.uid===record.uid);
const assertFixture=(obj,record)=>assert(sameFixture(obj,record),'Fixture name, unique title, creationTimestamp or optional UID differs from registration');
const register=async(plural,name,title)=>{
 assert.match(name,/^[A-Za-z0-9._-]+$/);
 const obj=await api(resourceRoot+plural+'/'+name);assert.equal(obj.metadata.name,name);assert.equal(obj.spec.title,title);assert(title.includes(runId));assert.equal(obj.spec.publish,false);
 const registered=report.created.find(x=>x.name===name&&x.plural===plural);
 if(registered)assertFixture(obj,registered);else report.created.push(fixtureRecord(plural,obj));
 await save();
 // Halo 2.26.1 has no metadata.uid. The exact name, unique run title and observed
 // server creation timestamp bound subsequent operations to this registration.
 return name;
};
const publishAndRead=async(item,plural,name)=>{
 const registered=report.created.find(x=>x.plural===plural&&x.name===name);assert(registered);
 const owned=await api(resourceRoot+plural+'/'+name);assertFixture(owned,registered);
 const owner=owned.metadata.labels?.['authored-images-owner'];assert(!owner||owner===runId);
 await api(consoleRoot+plural+'/'+name+'/publish','PUT');
 let post;
 for(let n=0;n<60;n++){post=await api(resourceRoot+plural+'/'+name);if(post.spec.publish&&post.status?.permalink)break;await sleep(250);}
 assert(post.spec.publish&&post.status?.permalink,'Published permalink not ready');
 assertFixture(post,registered);
 const url=new URL(post.status.permalink,base);assert.equal(url.origin,base);
 // fetch has no authenticated browser cookies, and this response is never executed.
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/^text\/html/);
 item.permalink=url.pathname;item.initialHttpStatus=response.status;await stage(item,'initial',await response.text());
};
try{
 const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
 for(const engine of engines){
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});page=await context.newPage();parser=await context.newPage();page.setDefaultTimeout(20000);
  context.on('response',response=>{const record=metadataRequests.get(response.request());if(record)record.status=response.status();});
  context.on('requestfailed',request=>{const record=metadataRequests.get(request);if(record)record.error=request.failure()?.errorText||'request failed';});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(scenario==='resave'&&url.origin===base&&request.method()==='PUT'&&url.pathname.startsWith(resourceRoot+'posts/')){
    const owned=report.created.find(x=>x.plural==='posts'&&url.pathname===resourceRoot+'posts/'+x.name);
    let payload;try{payload=request.postDataJSON();}catch{}
    // The official editor can update metadata before PUT /content. Only this
    // run's already registered unpublished fixture may pass that prerequisite.
    if(sameFixture(payload,owned)&&payload.spec.publish===false&&payload.spec.deleted===false){
     const record={method:request.method(),path:url.pathname,name:owned.name,creationTimestamp:owned.creationTimestamp,...(owned.uid!=null?{uid:owned.uid}:{}),title:owned.title,status:null};
     const index=report.metadataUpdates.length;report.metadataUpdates.push(record);
     record.request=await archive({id:'metadata-update-'+index},'request.json',request.postData());
     metadataRequests.set(request,record);
     return route.continue();
    }
    report.blockedRequests.push({method:request.method(),origin:url.origin,path:url.pathname,reason:'Resource PUT does not match this run registered name, title, creationTimestamp, optional UID and unpublished fixture state'});
    return route.abort();
   }
   const contentWrite=scenario==='resave'
    ? request.method()==='PUT'&&report.created.some(x=>x.plural==='posts'&&url.pathname===consoleRoot+'posts/'+x.name+'/content')
    : /^\/apis\/api\.console\.halo\.run\/v1alpha1\/posts\/[^/]+\/content$/.test(url.pathname);
   if(scenario==='resave'&&url.origin===base&&contentWrite){
    const owned=report.created.find(x=>x.plural==='posts'&&url.pathname===consoleRoot+'posts/'+x.name+'/content');
    try{assertFixture(await api(resourceRoot+'posts/'+owned.name),owned);}catch(error){
     report.blockedRequests.push({method:request.method(),origin:url.origin,path:url.pathname,reason:'Content PUT live identity check failed',error:String(error)});
     return route.abort();
    }
   }
   const allowedWrite=url.pathname==='/login'||url.pathname===consoleRoot+'posts'||contentWrite||url.pathname==='/apis/api.halo.run/v1alpha1/trackers/counter';
   if(url.origin===base&&(['GET','HEAD'].includes(request.method())||allowedWrite))return route.continue();
   if(scenario==='resave')report.blockedRequests.push({method:request.method(),origin:url.origin,path:url.pathname,reason:'Outside the local editor request allowlist'});
   return route.abort();
  });
  await page.goto(base+'/login',{waitUntil:'domcontentloaded'});csrf=await page.locator('input[name="_csrf"]').inputValue();
  await page.locator('#username').fill(credentials.username);await page.locator('#plainPassword').fill(credentials.password);await page.locator('button[type="submit"]').click();await page.waitForURL(url=>!url.pathname.includes('login'));
  const current=await station();if(!before){before=current;report.before=before;}else assert.deepEqual(current,before);
  const plugin=current.plugins.find(p=>p.name==='hybrid-edit-block');assert.equal(plugin?.version,'1.7.0');assert.equal(plugin.enabled,true);report.plugin=plugin;
  const modes=['html-block','markdown-block','markdown-image',...(scenario==='single-save'&&engine==='chromium'?['plain-paste','api-post','api-page']:[])];
  for(const mode of modes){
   const item={id:engine+'-'+mode,engine,version:browser.version(),mode,stages:{}};report.cases.push(item);await save();
   const title=`Author images ${runId} ${item.id}`;
   const markdown=`![author-markdown-${runId}](/lab/cover-golden-mountain.webp)`;
   const input=mode==='markdown-image'?markdown:fixture;
   await writeFile(path.join(output,item.id+'-input.txt'),input,{flag:'wx'});
   const expected=mode==='markdown-image'?`<img src="/lab/cover-golden-mountain.webp" alt="author-markdown-${runId}">`:fixture;
   item.expected=(await signature(expected)).images;
   assert.equal(item.expected.length,mode==='markdown-image'?1:4,'Fixture image signature must be nonempty and complete');
   let name,plural=mode==='api-page'?'singlepages':'posts';
   try{
    if(mode.startsWith('api-')){
     name='authored-'+runId+'-'+mode;
     const spec={title,slug:name,owner:credentials.username,allowComment:false,deleted:false,visible:'PUBLIC',publish:false,pinned:false,priority:0,cover:'',excerpt:{autoGenerate:true},...(plural==='posts'?{tags:[],categories:[]}:{})};
     const payload={[plural==='posts'?'post':'page']:{apiVersion:'content.halo.run/v1alpha1',kind:plural==='posts'?'Post':'SinglePage',metadata:{name,labels:{'authored-images-owner':runId}},spec},content:{rawType:'HTML',raw:input,content:input}};
     await writeFile(path.join(output,item.id+'-create-request.json'),JSON.stringify(payload,null,2)+'\n',{flag:'wx'});await stage(item,'submitted',input);
     await api(consoleRoot+plural,'POST',payload);
     await register(plural,name,title);
     const resource=await api(resourceRoot+plural+'/'+name);assertFixture(resource,report.created.find(x=>x.plural===plural&&x.name===name));const snapshotName=resource.spec.headSnapshot;assert.equal(typeof snapshotName,'string');assert(snapshotName);
     // Both official console content endpoints require snapshotName. headSnapshot
     // identifies the latest editable draft; no guesses about default snapshots.
     item.headSnapshot=snapshotName;
     const stored=await api(consoleRoot+plural+'/'+name+'/content?snapshotName='+encodeURIComponent(snapshotName));
     assert.equal(stored.snapshotName,snapshotName);
     assert.equal(typeof stored.content,'string');await stage(item,'stored',stored.content);
    }else{
     await page.goto(base+'/console',{waitUntil:'domcontentloaded'});await page.getByText('创建文章',{exact:true}).click();await page.locator('.tiptap').waitFor();await page.getByPlaceholder('请输入标题',{exact:true}).fill(title);await page.locator('.tiptap').click();
     if(mode==='plain-paste')await page.locator('.tiptap').evaluate((el,html)=>{const data=new DataTransfer();data.setData('text/html',html);data.setData('text/plain',new DOMParser().parseFromString(html,'text/html').body.textContent);el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},input);
     else {await page.keyboard.type('/');await page.getByText(mode==='html-block'?'HTML 编辑块':'Markdown 编辑块',{exact:true}).click();await page.locator('.cm-content').click();await page.keyboard.insertText(input);}
     await page.getByPlaceholder('请输入标题',{exact:true}).click();await page.waitForTimeout(1200);
     const savedResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===consoleRoot+'posts');
     await page.getByRole('button',{name:'保存',exact:true}).click();const response=await savedResponse;assert(response.ok());
     const saved=response.request().postDataJSON();
     if(scenario==='resave'){
      item.firstSaveRequest=await archive(item,'save-request.txt',response.request().postData());
      item.firstSaveResponse={status:response.status(),...await archive(item,'save-response.json',await response.text())};
     }
     await writeFile(path.join(output,item.id+'-save-request.json'),JSON.stringify(saved,null,2)+'\n',{flag:'wx'});await stage(item,'saved',saved.content.content);await save();
     await page.getByText('保存成功',{exact:true}).waitFor();
     const created=await response.json();name=created.metadata?.name||created.post?.metadata?.name||new URL(page.url()).searchParams.get('name');assert(name);
     await register(plural,name,title);
     await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(title=>document.querySelector('input[placeholder="请输入标题"]')?.value===title,title);await page.locator('.tiptap').waitFor();
     let reopened;
     if(mode==='plain-paste'){await page.waitForFunction(id=>document.querySelector('.tiptap')?.textContent.includes(id),runId);reopened=await page.locator('.tiptap').innerHTML();}
     else {await page.locator('.cm-content').waitFor();reopened=await page.locator('.cm-content').evaluate(e=>e.cmView?.view?.state.doc.toString());assert.equal(typeof reopened,'string');item.reopenedInputMatches=reopened===input;}
     await stage(item,'reopened',reopened);
     if(mode==='markdown-image')item.stages.reopened.kind='Markdown source: no img HTML expected';
     if(scenario==='resave'){
      item.marker=`editor-resave-${runId}-${item.id}`;
      const addition=`\n\n${item.marker}\n`;
      const editor=page.locator('.cm-content');
      // Reading CodeMirror's full document avoids its viewport-only DOM. All
      // mutations use keyboard events; never dispatch editor state transactions.
      await editor.click();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.press('ArrowRight');await page.keyboard.insertText(addition);
      const edited=await editor.evaluate(e=>e.cmView?.view?.state.doc.toString());
      assert.equal(edited,reopened+addition,'Keyboard append must preserve the complete reopened document');
      item.editedSource=await archive(item,'edited-source.txt',edited);
      item.sourceComparisons={firstReopenedEqualsInput:reopened===input,editedEqualsFirstReopenedPlusMarker:edited===reopened+addition,inputSha256:sha256(input),firstReopenedSha256:sha256(reopened),editedSha256:sha256(edited)};
      await page.getByPlaceholder('请输入标题',{exact:true}).click();await page.waitForTimeout(1200);
      const contentPath=consoleRoot+'posts/'+name+'/content';
      const updatedResponse=page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname===contentPath);
      await page.getByRole('button',{name:'保存',exact:true}).click();const updated=await updatedResponse;
      item.secondSaveRequest={method:updated.request().method(),path:contentPath,...await archive(item,'second-save-request.txt',updated.request().postData())};
      item.secondSaveResponse={status:updated.status(),...await archive(item,'second-save-response.json',await updated.text())};
      assert(updated.ok(),'Second UI save failed');
      const secondSaved=updated.request().postDataJSON();
      await archive(item,'second-save-request.json',JSON.stringify(secondSaved,null,2)+'\n');
      assert.equal(typeof secondSaved.raw,'string');assert.equal(typeof secondSaved.content,'string');
      item.markerChecks={secondRequestRaw:secondSaved.raw.includes(item.marker),secondRequestHtml:secondSaved.content.includes(item.marker)};
      assert(item.markerChecks.secondRequestRaw&&item.markerChecks.secondRequestHtml,'Second save request must contain the real edit');
      await stage(item,'second-saved',secondSaved.content);
      await page.getByText('保存成功',{exact:true}).waitFor();
      const resource=await api(resourceRoot+plural+'/'+name);assertFixture(resource,report.created.find(x=>x.plural===plural&&x.name===name));
      const snapshotName=resource.spec.headSnapshot;assert.equal(typeof snapshotName,'string');assert(snapshotName);
      item.secondHeadSnapshot=snapshotName;
      const stored=await api(consoleRoot+plural+'/'+name+'/content?snapshotName='+encodeURIComponent(snapshotName));
      assert.equal(stored.snapshotName,snapshotName);assert.equal(typeof stored.raw,'string');assert.equal(typeof stored.content,'string');
      item.secondStoredResponse=await archive(item,'second-stored-response.json',JSON.stringify(stored,null,2)+'\n');
      item.markerChecks.secondStoredRaw=stored.raw.includes(item.marker);item.markerChecks.secondStoredHtml=stored.content.includes(item.marker);
      assert(item.markerChecks.secondStoredRaw&&item.markerChecks.secondStoredHtml,'The updated snapshot must contain the real edit');
      await stage(item,'second-stored',stored.content);
      item.secondStoredEqualsRequest={raw:stored.raw===secondSaved.raw,content:stored.content===secondSaved.content};
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(title=>document.querySelector('input[placeholder="请输入标题"]')?.value===title,title);await page.locator('.cm-content').waitFor();
      await page.waitForFunction(runId=>[...document.querySelectorAll('.tiptap .cm-content')].some(e=>e.cmView?.view?.state.doc.toString().includes(runId)),runId);
      await page.waitForTimeout(1200);
      item.secondReopenEvidence=await captureEditor(item,'second-reopened');
      const secondReopened=item.secondReopenEvidence.documents[0]?.source;assert.equal(typeof secondReopened,'string');
      await stage(item,'second-reopened',secondReopened);
      item.stages['second-reopened'].sourceScope='First CodeMirror document only; see secondReopenEvidence for every document and editor DOM';
      item.sourceComparisons.secondReopenedEqualsEdited=secondReopened===edited;
      item.sourceComparisons.secondReopenedSha256=sha256(secondReopened);
      item.sourceComparisons.secondReopenedDocumentCount=item.secondReopenEvidence.documents.length;
      item.sourceComparisons.secondReopenedDocumentsEqualEdited=item.secondReopenEvidence.documents.map(doc=>doc.source===edited);
      item.markerChecks.secondReopened=item.secondReopenEvidence.documents.some(doc=>doc.hasMarker);
      item.markerChecks.secondReopenedEditorText=item.secondReopenEvidence.markerInText;
      if(mode.startsWith('markdown-'))for(const s of ['reopened','second-reopened'])item.stages[s].kind='Markdown source; HTML image signature is not a preservation verdict';
      await save();
     }
    }
    await publishAndRead(item,plural,name);item.name=name;
    if(scenario==='resave'){
     const initial=await readFile(path.join(output,item.id+'-initial.html'),'utf8');
     item.markerChecks.initialArticle=await parser.evaluate(({html,marker})=>new DOMParser().parseFromString(html,'text/html').querySelector('article.render')?.textContent.includes(marker),{html:initial,marker:item.marker});
     assert(item.markerChecks.initialArticle,'Published anonymous article must contain the second-save marker');
    }
    item.differences=Object.entries(item.stages).filter(([s])=>!(mode==='markdown-image'&&s==='reopened')&&!(scenario==='resave'&&mode.startsWith('markdown-')&&['reopened','second-reopened'].includes(s))).filter(([,v])=>canonical(v.images)!==canonical(item.expected)).map(([s,v])=>({stage:s,expected:item.expected,actual:v.images}));
    if(scenario==='resave'&&!item.markerChecks.secondReopened)item.differences.push({stage:'second-reopened-source',kind:item.markerChecks.secondReopenedEditorText?'Exact marker absent from all CodeMirror documents but present in editor DOM text; see archived documents for representation or location changes':'Exact marker absent from all CodeMirror documents and editor DOM text; see archived documents for representation changes. Stored and published marker checks remain independent.'});
    if(scenario==='single-save'&&mode.startsWith('markdown-')&&item.reopenedInputMatches===false)item.differences.push({stage:'reopened-source',kind:'Markdown source differs from submitted input; see archived input and reopened files'});
    item.status=item.differences.length?'observed-differences':'preserved';
   }catch(error){item.status='failed';item.error=String(error.stack||error);report.failed=true;if(scenario==='resave'){try{item.failureEditorEvidence=await captureEditor(item,'failure');}catch(captureError){item.failureEvidenceError=String(captureError);}}}
   await save();
  }
  // Cleanup occurs before closing the authenticated context, including after failed cases.
  await cleanup();
  report.after=await station();assert.deepEqual(report.after,before,'Station changed outside owned fixture records');
  await context.close();context=null;await browser.close();browser=null;
 }
 report.finalIdentity=preflight();assert.deepEqual(report.finalIdentity,identity,'Runtime/package/plugin JAR identity changed');report.status=report.failed?'failed':'completed';
}catch(error){report.status='failed';report.error=String(error.stack||error);}
finally{
 if(context){try{await cleanup();report.after=await station();assert.deepEqual(report.after,before);}catch(error){report.status='failed';report.cleanupError=String(error.stack||error);}}
 await browser?.close();await save();
 if(report.cleanup.every(x=>x.status==='deleted')&&report.created.length===report.cleanup.length)await unlink(lock);
 else report.lockRetained=true;
 await save();if(report.status==='failed')process.exitCode=1;
 console.log(JSON.stringify({status:report.status,output,cases:report.cases.length,cleanup:report.cleanup.length}));
}

async function cleanup(){
 // Recover a successful save whose UI failed before the response was registered.
 for(const plural of ['posts','singlepages']){
  const list=await api(resourceRoot+plural+'?size=200');assert((list.total||list.items.length)<=200,'Cleanup inventory exceeds bounded plan');
  for(const obj of list.items.filter(x=>x.spec.title?.startsWith(`Author images ${runId} `))){
   if(!report.created.some(x=>x.plural===plural&&x.name===obj.metadata.name))report.created.push(fixtureRecord(plural,obj));
  }
 }
 const errors=[];
 for(const obj of report.created){
  if(report.cleanup.some(x=>x.plural===obj.plural&&x.name===obj.name&&x.status==='deleted'))continue;
  try{
   const current=await api(resourceRoot+obj.plural+'/'+obj.name,'GET',undefined,true);
   if(current){
    assertFixture(current,obj);assert(current.spec.title.includes(runId));
    const owner=current.metadata.labels?.['authored-images-owner'];assert(!owner||owner===runId);
    await api(resourceRoot+obj.plural+'/'+obj.name,'DELETE');
   }
   let status;
   for(let n=0;n<60;n++){const r=await context.request.get(base+resourceRoot+obj.plural+'/'+obj.name,{timeout:20000,maxRedirects:0});status=r.status();if(status===404)break;assert.equal(status,200);await sleep(250);}
   assert.equal(status,404,'Own fixture deletion did not reconcile');report.cleanup.push({plural:obj.plural,name:obj.name,creationTimestamp:obj.creationTimestamp,status:'deleted'});
  }catch(error){const message=String(error.stack||error);report.cleanup.push({plural:obj.plural,name:obj.name,status:'failed',error:message});errors.push(message);}
  await save();
 }
 if(errors.length)throw new Error('Cleanup failures: '+errors.join('\n'));
}
