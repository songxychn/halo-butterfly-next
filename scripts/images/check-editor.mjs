/** Real editor -> reopen -> publish -> anonymous initial HTML. Owned local fixtures only. */
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
const save=()=>writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
report.signatureSha256=sha256(await readFile(new URL('./editor-signature.mjs',import.meta.url)));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const resourceRoot='/apis/content.halo.run/v1alpha1/';
const consoleRoot='/apis/api.console.halo.run/v1alpha1/';
let browser,context,page,parser,csrf,before;
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
const stage=async(item,name,markup)=>{
 await writeFile(path.join(output,item.id+'-'+name+'.html'),markup,{flag:'wx'});
 item.stages[name]={sha256:sha256(markup),...await signature(markup,name==='initial')};
};
const register=async(plural,name,title)=>{
 assert.match(name,/^[A-Za-z0-9._-]+$/);
 const obj=await api(resourceRoot+plural+'/'+name);assert.equal(obj.spec.title,title);assert(title.includes(runId));assert.equal(obj.spec.publish,false);
 if(!report.created.some(x=>x.name===name&&x.plural===plural))report.created.push({plural,name,title,uid:obj.metadata.uid});
 await save();
 // A fresh UI save is concurrently reconciled by Halo. Its returned immutable UID
 // plus this run's unique title establish ownership without a redundant metadata PUT.
 return name;
};
const publishAndRead=async(item,plural,name)=>{
 const registered=report.created.find(x=>x.plural===plural&&x.name===name);assert(registered);
 const owned=await api(resourceRoot+plural+'/'+name);assert.equal(owned.metadata.uid,registered.uid);assert.equal(owned.spec.title,registered.title);
 const owner=owned.metadata.labels?.['authored-images-owner'];assert(!owner||owner===runId);
 await api(consoleRoot+plural+'/'+name+'/publish','PUT');
 let post;
 for(let n=0;n<60;n++){post=await api(resourceRoot+plural+'/'+name);if(post.spec.publish&&post.status?.permalink)break;await sleep(250);}
 assert(post.spec.publish&&post.status?.permalink,'Published permalink not ready');
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
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   const allowedWrite=url.pathname==='/login'||url.pathname===consoleRoot+'posts'||/^\/apis\/api\.console\.halo\.run\/v1alpha1\/posts\/[^/]+\/content$/.test(url.pathname)||url.pathname==='/apis/api.halo.run/v1alpha1/trackers/counter';
   return url.origin===base&&(['GET','HEAD'].includes(request.method())||allowedWrite)?route.continue():route.abort();
  });
  await page.goto(base+'/login',{waitUntil:'domcontentloaded'});csrf=await page.locator('input[name="_csrf"]').inputValue();
  await page.locator('#username').fill(credentials.username);await page.locator('#plainPassword').fill(credentials.password);await page.locator('button[type="submit"]').click();await page.waitForURL(url=>!url.pathname.includes('login'));
  const current=await station();if(!before){before=current;report.before=before;}else assert.deepEqual(current,before);
  const plugin=current.plugins.find(p=>p.name==='hybrid-edit-block');assert.equal(plugin?.version,'1.7.0');assert.equal(plugin.enabled,true);report.plugin=plugin;
  const modes=['html-block','markdown-block','markdown-image',...(engine==='chromium'?['plain-paste','api-post','api-page']:[])];
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
     const resource=await api(resourceRoot+plural+'/'+name);const snapshotName=resource.spec.headSnapshot;assert.equal(typeof snapshotName,'string');assert(snapshotName);
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
    }
    await publishAndRead(item,plural,name);item.name=name;
    item.differences=Object.entries(item.stages).filter(([s])=>!(mode==='markdown-image'&&s==='reopened')).filter(([,v])=>canonical(v.images)!==canonical(item.expected)).map(([s,v])=>({stage:s,expected:item.expected,actual:v.images}));
    if(mode.startsWith('markdown-')&&item.reopenedInputMatches===false)item.differences.push({stage:'reopened-source',kind:'Markdown source differs from submitted input; see archived input and reopened files'});
    item.status=item.differences.length?'observed-differences':'preserved';
   }catch(error){item.status='failed';item.error=String(error.stack||error);report.failed=true;}
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
   if(!report.created.some(x=>x.plural===plural&&x.name===obj.metadata.name))report.created.push({plural,name:obj.metadata.name,title:obj.spec.title,uid:obj.metadata.uid});
  }
 }
 const errors=[];
 for(const obj of report.created){
  if(report.cleanup.some(x=>x.plural===obj.plural&&x.name===obj.name&&x.status==='deleted'))continue;
  try{
   const current=await api(resourceRoot+obj.plural+'/'+obj.name,'GET',undefined,true);
   if(current){
    assert.equal(current.metadata.uid,obj.uid);assert.equal(current.spec.title,obj.title);assert(current.spec.title.includes(runId));
    const owner=current.metadata.labels?.['authored-images-owner'];assert(!owner||owner===runId);
    await api(resourceRoot+obj.plural+'/'+obj.name,'DELETE');
   }
   let status;
   for(let n=0;n<60;n++){const r=await context.request.get(base+resourceRoot+obj.plural+'/'+obj.name,{timeout:20000,maxRedirects:0});status=r.status();if(status===404)break;assert.equal(status,200);await sleep(250);}
   assert.equal(status,404,'Own fixture deletion did not reconcile');report.cleanup.push({plural:obj.plural,name:obj.name,status:'deleted'});
  }catch(error){const message=String(error.stack||error);report.cleanup.push({plural:obj.plural,name:obj.name,status:'failed',error:message});errors.push(message);}
  await save();
 }
 if(errors.length)throw new Error('Cleanup failures: '+errors.join('\n'));
}
