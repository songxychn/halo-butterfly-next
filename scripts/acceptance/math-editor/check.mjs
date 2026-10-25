/** Declared official default-editor workflows and four reader states. */
import assert from 'node:assert/strict';
import {readFile, writeFile, realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO, RUNTIME, browserEnvironment, validateBaseUrl, sha256} from '../../browser/support.mjs';

assert.equal(process.argv[2], '--plan');
const planPath = await realpath(process.argv[3]);
assert(planPath.startsWith(path.join(REPO, '.runtime') + path.sep));
const plan = JSON.parse(await readFile(planPath));
const {runId, runtime, output, phase} = plan;
assert.match(runId, /^[a-f0-9]{20}$/);
assert.equal(await realpath(output), path.dirname(planPath));
assert.equal((await readFile(path.join(runtime, 'math-editor.lock'), 'utf8')), runId);
const base = validateBaseUrl(plan.base, JSON.parse(await readFile(path.join(runtime, 'lab.json'))));
assert(['author', 'enabled', 'theme-off', 'plugin-off', 'restored'].includes(phase));
const ENGINES=plan.engines||['chromium','firefox'];
assert(ENGINES.length&&new Set(ENGINES).size===ENGINES.length&&ENGINES.every(x=>['chromium','firefox','webkit'].includes(x)));
const EXPECTED_CASES=ENGINES.length*2;
const readiness=new Map();
const report = {schema:1,expectedCases:EXPECTED_CASES,engines:ENGINES, runId, phase, status:'running', runnerSha256:sha256(await readFile(new URL(import.meta.url))), cases:[], created:[], pending:[], blockedRequests:[]};
const save = () => writeFile(path.join(output, phase + '.json'), JSON.stringify(report, null, 2) + '\n');
const archive = async (id, label, text) => {
  const file = phase + '-' + id + '-' + label;
  await writeFile(path.join(output, file), text, {flag:'wx'});
  return {file, sha256:sha256(text)};
};
const jsonArchive = (id, label, value) => archive(id, label + '.json', JSON.stringify(value, null, 2) + '\n');
const POST = '/apis/content.halo.run/v1alpha1/posts';
const CONSOLE = '/apis/api.console.halo.run/v1alpha1/posts';
const same = (obj, row) => row && obj?.metadata?.name === row.name && obj?.spec?.title === row.title && obj?.metadata?.creationTimestamp === row.creationTimestamp && obj?.metadata?.uid === row.uid && obj?.spec?.owner === row.owner;
report.codeMirrorReader={module:plan.haloVersion==='2.27.1'?'vendor~Codemirror~index~index~index~index~index~index-Vcls81jG.js':'vendor~Codemirror~index~index~index~index~index~index-CGuvB-w4.js',export:'M',method:'EditorView.findFromDOM(element).state.doc.toString()',scope:'Import the already-loaded official module; read only, no dispatch or editor mutation'};
const fixtures = [{mode:'inline', first:'x^2+y^2=z^2', second:'a^2+b^2=c^2'}, {mode:'block', first:'\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{6}', second:'\\sum_{i=1}^{3}i=6'}];
const env = browserEnvironment(); Object.assign(process.env, env);
const pw = await import(pathToFileURL(path.join(RUNTIME, 'deps/node_modules/playwright/index.mjs')));
let browser, context, page, csrf, pendingCase, username;
const canonical = value => JSON.stringify(value, (_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v);
const api = async (url, method='GET', data, missing=false) => {
  assert(url.startsWith('/apis/'));
  const response = await context.request.fetch(base + url, {method, data, headers:{Accept:'application/json', 'X-CSRF-TOKEN':csrf}, timeout:20000, maxRedirects:0});
  if (missing && response.status() === 404) return null;
  assert(response.ok(), `${method} ${url}: HTTP ${response.status()}`);
  const text = await response.text(); return text ? JSON.parse(text) : null;
};
const boundedClose = async (object) => {
  if (!object) return;
  let timer;
  try { await Promise.race([object.close(), new Promise((_, reject) => {timer=setTimeout(()=>reject(Error('Browser close exceeded 10s')),10000);})]); }
  finally { clearTimeout(timer); }
};
const signature = (html, initial=false) => page.evaluate(({html,initial}) => {
  const doc = new DOMParser().parseFromString(html,'text/html');
  if(initial&&doc.querySelectorAll('article.render').length!==1)throw Error('Expected exactly one initial article');
  const root = initial?doc.querySelector('article.render'):doc.body;
  return {formulas:[...root.querySelectorAll('span.katex-inline,div.katex-block')].map(node=>({kind:node.matches('span.katex-inline')?'inline':'block', mathCount:node.querySelectorAll('math').length, mathNamespace:node.querySelector('math')?.namespaceURI, tex:[...node.querySelectorAll('annotation[encoding="application/x-tex"]')].map(x=>x.textContent)})), text:root.textContent};
},{html,initial});
const formulaCheck = (data, mode, tex) => {
  assert.equal(data.formulas.length,1,'Exactly one authored formula required');
  assert.deepEqual(data.formulas[0],{kind:mode,mathCount:1,mathNamespace:'http://www.w3.org/1998/Math/MathML',tex:[tex]});
};
const capture = async (item, label) => {
  const value = await page.evaluate(()=>({editor:document.querySelector('.tiptap')?.innerHTML||null, code:[...document.querySelectorAll('.katex-block-code .cm-content,.katex-inline-view-code .cm-content')].map(node=>({visible:!!node.getClientRects().length,source:window.__mathEditorView?.findFromDOM(node)?.state.doc.toString()??null})), active:{tag:document.activeElement?.tagName,className:document.activeElement?.className}, popups:[...document.querySelectorAll('.v-popper__popper')].filter(p=>p.querySelector('.katex-inline-view-code')).map(p=>p.outerHTML)}));
  return jsonArchive(item.id,label,value);
};
const codeLocator = mode => page.locator(mode==='block'?'.katex-block-code .cm-content':'.v-popper__popper[aria-hidden="false"] .katex-inline-view-code .cm-content').filter({visible:true});
const waitCache = async (item, tex, edited) => {
  const expected={name:item.name||'',body:item.body,mode:item.mode,tex};
  await page.waitForFunction(expected=>{
    const values=JSON.parse(localStorage.getItem('post-content-cache')||'[]');
    const matches=values.filter(row=>{
      if(row.name!==expected.name||typeof row.content!=='string')return false;
      const doc=new DOMParser().parseFromString(row.content,'text/html');
      const nodes=doc.querySelectorAll(expected.mode==='inline'?'span.katex-inline':'div.katex-block');
      return nodes.length===1&&nodes[0].querySelector('annotation[encoding="application/x-tex"]')?.textContent===expected.tex&&doc.body.textContent.includes(expected.body);
    });
    return matches.length===1;
  },expected);
  const value=await page.evaluate(name=>JSON.parse(localStorage.getItem('post-content-cache')||'[]').find(row=>row.name===name),expected.name);
  const parsed=await signature(value.content);formulaCheck(parsed,item.mode,tex);assert(parsed.text.includes(expected.body));
  readiness.set(item.id,value);
  item[edited?'secondSaveCache':'firstSaveCache']={...await jsonArchive(item.id,edited?'second-save-ready-cache':'first-save-ready-cache',value),cacheName:value.name,routeName:new URL(page.url()).searchParams.get('name'),contentSha256:sha256(value.content)};
  await save();
};
const openCode = async mode => {
  if (mode==='inline' && !(await codeLocator(mode).count())) await page.locator('.tiptap .katex-inline-container .katex-node-view-content-wrapper').click();
  const code = codeLocator(mode);
  await code.waitFor({state:'visible'}); assert.equal(await code.count(),1);
  // Halo's own VCodemirror uses a WeakMap-backed EditorView. Import exactly
  // its already-loaded official module and call the public read-only lookup.
  await page.evaluate(async moduleName=>{
    if(window.__mathEditorView)return;
    const urls=[...new Set(performance.getEntriesByType('resource').map(x=>x.name).filter(value=>{const url=new URL(value);return url.origin===location.origin&&url.pathname.endsWith('/'+moduleName);}))];
    if(urls.length!==1)throw Error('Expected one loaded official CodeMirror module');
    const module=await import(urls[0]);
    if(typeof module.M?.findFromDOM!=='function')throw Error('Official EditorView lookup missing');
    window.__mathEditorView=module.M;
  },report.codeMirrorReader.module);
  await code.click();
  await page.waitForFunction(selector=>{const n=[...document.querySelectorAll(selector)].find(x=>x.getClientRects().length);return n&&(n===document.activeElement||n.contains(document.activeElement));},mode==='block'?'.katex-block-code .cm-content':'.v-popper__popper[aria-hidden="false"] .katex-inline-view-code .cm-content');
  return code;
};
const replaceFormula = async (item, tex) => {
  const code = await openCode(item.mode);
  await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(tex);
  await page.waitForFunction(({mode,tex})=>{
    const selector=mode==='block'?'.katex-block-code .cm-content':'.v-popper__popper[aria-hidden="false"] .katex-inline-view-code .cm-content';
    const cm=[...document.querySelectorAll(selector)].find(x=>x.getClientRects().length);
    const preview=document.querySelector(mode==='block'?'.katex-block-preview':'.katex-inline-container');
    return (cm&&window.__mathEditorView?.findFromDOM(cm)?.state.doc.toString())===tex&&preview?.querySelector('annotation[encoding="application/x-tex"]')?.textContent===tex;
  },{mode:item.mode,tex});
  assert.equal(await code.evaluate(e=>window.__mathEditorView?.findFromDOM(e)?.state.doc.toString()),tex);
};
const settlePost = async (name, published=false) => {
  await page.waitForFunction(async ({name,published})=>{
    const response=await fetch('/apis/content.halo.run/v1alpha1/posts/'+name,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)return false;const obj=await response.json();
    return !!obj.spec.headSnapshot&&obj.metadata.version!=null&&obj.status?.observedVersion===obj.metadata.version&&(!published||(obj.spec.publish&&obj.status.phase==='PUBLISHED'&&obj.status.inProgress===false&&obj.spec.releaseSnapshot===obj.spec.headSnapshot&&!!obj.status.permalink));
  },{name,published});
};
const register = async (item, name) => {
  const row = report.pending.find(p=>p.name===name); assert(row && row.title===item.title);
  await settlePost(name);
  const obj = await api(POST+'/'+name);
  const requestText=await readFile(path.join(output,row.request.file),'utf8');assert.equal(sha256(requestText),row.request.sha256);
  const submitted=JSON.parse(requestText);assert.equal(submitted.post.metadata.name,name);assert.equal(submitted.post.spec.title,item.title);
  const stored=await api(CONSOLE+'/'+name+'/content?snapshotName='+encodeURIComponent(obj.spec.headSnapshot));
  assert.equal(stored.snapshotName,obj.spec.headSnapshot);assert.equal(stored.raw,submitted.content.raw);assert.equal(stored.content,submitted.content.content);
  assert.equal(obj.spec.title,item.title); assert.equal(obj.spec.publish,false); assert.equal(obj.spec.owner,username);
  assert(obj.metadata.creationTimestamp && Number.isFinite(Date.parse(obj.metadata.creationTimestamp)));
  assert(Date.parse(obj.metadata.creationTimestamp)>=Date.parse(row.beforeRequestAt)-1000,'Created before registered request');
  const existing=report.created.find(p=>p.name===name);
  if(existing)assert(same(obj,existing));
  else report.created.push({name,title:item.title,creationTimestamp:obj.metadata.creationTimestamp,owner:username,specSha256:sha256(canonical(obj.spec)),...(obj.metadata.uid!==undefined?{uid:obj.metadata.uid}:{}),id:item.id});
  item.name=name; await save(); return obj;
};
const storeStage = async (item, label, content, tex) => {
  assert.equal(typeof content.raw,'string');assert.equal(typeof content.content,'string');
  const parsed=await signature(content.content);formulaCheck(parsed,item.mode,tex);assert(parsed.text.includes(item.body));
  item.stages[label]={...await jsonArchive(item.id,label,content),signature:parsed.formulas,bodyPresent:parsed.text.includes(item.body)};
  return parsed;
};
const reopen = async (item, expected) => {
  await page.reload({waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(title=>document.querySelector('input[placeholder="请输入标题"]')?.value===title,item.title);
  await page.locator('.tiptap').waitFor();
  const code=await openCode(item.mode);
  await page.waitForFunction(({selector,expected})=>[...document.querySelectorAll(selector)].some(x=>x.getClientRects().length&&window.__mathEditorView?.findFromDOM(x)?.state.doc.toString()===expected),{selector:item.mode==='block'?'.katex-block-code .cm-content':'.v-popper__popper[aria-hidden="false"] .katex-inline-view-code .cm-content',expected});
  assert.equal(await code.evaluate(e=>window.__mathEditorView?.findFromDOM(e)?.state.doc.toString()),expected);
};
const guard = async route => {
  const req=route.request(), url=new URL(req.url());
  let allowed=false;
  try {
    if(url.origin===base && ['GET','HEAD'].includes(req.method()))allowed=true;
    else if(url.origin===base&&url.pathname==='/login'&&req.method()==='POST')allowed=true;
    else if(url.origin===base&&url.pathname==='/apis/api.halo.run/v1alpha1/trackers/counter'&&req.method()==='POST')allowed=true;
    else if(url.origin===base&&phase==='author'&&url.pathname===CONSOLE&&req.method()==='POST') {
      const data=req.postDataJSON(),obj=data.post;
      assert(pendingCase && obj.spec.title===pendingCase.title && obj.spec.publish===false && obj.spec.deleted===false);
      assert(obj.spec.owner===undefined||obj.spec.owner===username,'Create owner differs');
      const ready=readiness.get(pendingCase.id);assert(ready&&ready.name==='','New editor cache must use its actual empty route key');assert.equal(data.content.raw,ready.content);assert.equal(data.content.content,ready.content);
      assert.match(obj.metadata.name,/^[A-Za-z0-9._-]+$/);
      assert.equal(await api(POST+'/'+obj.metadata.name,'GET',undefined,true),null,'UI-selected name must not already exist');
      assert(!report.pending.some(x=>x.name===obj.metadata.name),'Duplicate create request');
      const request=await archive(pendingCase.id,'create-request.json',req.postData());
      report.pending.push({name:obj.metadata.name,title:obj.spec.title,id:pendingCase.id,beforeRequestAt:new Date().toISOString(),absentBeforeRequest:true,request});await save();allowed=true;
    } else if(url.origin===base&&phase==='author'&&req.method()==='PUT') {
      const row=report.created.find(x=>url.pathname===POST+'/'+x.name||url.pathname===CONSOLE+'/'+x.name+'/content');
      assert(row,'Write outside registered fixture');assert(same(await api(POST+'/'+row.name),row));
      if(url.pathname===POST+'/'+row.name){const obj=req.postDataJSON();assert(same(obj,row)&&obj.spec.publish===false&&obj.spec.deleted===false);}
      else{const ready=readiness.get(row.id),data=req.postDataJSON();assert(ready&&ready.name===row.name);assert.equal(data.raw,ready.content);assert.equal(data.content,ready.content);}
      allowed=true;
    }
  } catch(error) { report.blockedRequests.push({method:req.method(),path:url.pathname,error:String(error)}); }
  if(allowed)return route.continue();
  report.blockedRequests.push({method:req.method(),origin:url.origin,path:url.pathname});await save();return route.abort();
};
const authors = async engine => {
  context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});
  await context.route('**/*',guard);
  page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(20000);
  const credentials=path.join(runtime,'halo/credentials.json');assert.equal((await stat(credentials)).mode&0o077,0);
  const auth=JSON.parse(await readFile(credentials));username=auth.username;
  const login={engine,responses:[],requestFailures:[]};(report.logins||=[]).push(login);
  page.on('response',response=>{if(response.request().isNavigationRequest()){const url=new URL(response.url());login.responses.push({method:response.request().method(),path:url.pathname,status:response.status()});}});
  page.on('requestfailed',request=>{const url=new URL(request.url());login.requestFailures.push({method:request.method(),path:url.pathname,error:request.failure()?.errorText});});
  await page.goto(base+'/login',{waitUntil:'domcontentloaded'});csrf=await page.locator('input[name="_csrf"]').inputValue();
  try{await page.locator('#username').fill(auth.username);await page.locator('#plainPassword').fill(auth.password);await page.locator('button[type="submit"]').click();await page.waitForURL(url=>!url.pathname.includes('login'));login.status='passed';}
  catch(error){login.status='failed';throw error;}
  finally{login.path=new URL(page.url()).pathname;login.documentReadyState=await page.evaluate(()=>document.readyState).catch(()=>null);await save();}
  for(const fixture of fixtures){
    const item={id:engine+'-'+fixture.mode,engine,version:browser.version(),...fixture,stages:{}};
    item.title=`Math author ${runId} ${item.id}`;item.body=`body-${runId}-${item.id}`;report.cases.push(item);pendingCase=item;await save();
    try {
      await boundedClose(page);page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(20000);
      await page.goto(base+'/console',{waitUntil:'domcontentloaded'});await page.getByText('创建文章',{exact:true}).click();await page.locator('.tiptap').waitFor();
      await page.getByPlaceholder('请输入标题',{exact:true}).fill(item.title);await page.locator('.tiptap').click();
      await page.keyboard.insertText(item.body);await page.keyboard.press('Enter');await page.keyboard.type('/');
      await page.getByText(item.mode==='inline'?'KaTeX 行内公式':'KaTeX 块级公式',{exact:true}).click();
      await replaceFormula(item,item.first);item.inserted=await capture(item,'inserted');
      await page.getByPlaceholder('请输入标题',{exact:true}).click();await waitCache(item,item.first,false);
      const firstResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===CONSOLE,{timeout:20000});
      await page.getByRole('button',{name:'保存',exact:true}).click();const first=await firstResponse;
      item.firstResponse={status:first.status(),...await archive(item.id,'first-response.json',await first.text())};assert(first.ok());
      const payload=first.request().postDataJSON();await register(item,payload.post.metadata.name);
      await storeStage(item,'saved',payload.content,item.first);
      await page.getByText('保存成功',{exact:true}).waitFor();await reopen(item,item.first);item.reopened=await capture(item,'reopened');
      await replaceFormula(item,item.second);
      item.edited=await capture(item,'edited');
      await page.getByPlaceholder('请输入标题',{exact:true}).click();await waitCache(item,item.second,true);
      const nextResponse=page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname===CONSOLE+'/'+item.name+'/content',{timeout:20000});
      await page.getByRole('button',{name:'保存',exact:true}).click();const next=await nextResponse;
      item.secondResponse={status:next.status(),...await archive(item.id,'second-response.json',await next.text())};assert(next.ok());
      const second=next.request().postDataJSON();const parsed=await storeStage(item,'second-saved',second,item.second);assert(parsed.text.includes(item.body));
      await page.getByText('保存成功',{exact:true}).waitFor();
      await settlePost(item.name);
      const row=report.created.find(x=>x.name===item.name),obj=await api(POST+'/'+item.name);assert(same(obj,row));
      assert(obj.spec.headSnapshot);const stored=await api(CONSOLE+'/'+item.name+'/content?snapshotName='+encodeURIComponent(obj.spec.headSnapshot));
      assert.equal(stored.snapshotName,obj.spec.headSnapshot);assert.equal(stored.raw,second.raw);assert.equal(stored.content,second.content);
      await storeStage(item,'stored',stored,item.second);item.headSnapshot=obj.spec.headSnapshot;item.storedEqualsSecondSave=true;row.specSha256=sha256(canonical(obj.spec));await save();
      await reopen(item,item.second);assert((await page.locator('.tiptap').innerText()).includes(item.body));item.secondReopened=await capture(item,'second-reopened');
      const beforePublish=await api(POST+'/'+item.name);assert(same(beforePublish,row));assert.equal(sha256(canonical(beforePublish.spec)),row.specSha256,'Fixture changed before publish');
      await api(CONSOLE+'/'+item.name+'/publish','PUT');item.publishMethod='official API';
      await settlePost(item.name,true);
      const released=await api(CONSOLE+'/'+item.name+'/release-content');assert.equal(released.raw,second.raw);assert.equal(released.content,second.content);
      item.releaseContent=await jsonArchive(item.id,'release-content',released);item.releaseEqualsSecondSave=true;
      const published=await api(POST+'/'+item.name);assert(same(published,row));const url=new URL(published.status.permalink,base);assert.equal(url.origin,base);item.permalink=url.pathname;row.specSha256=sha256(canonical(published.spec));await save();
      item.status='passed';
    }catch(error){
      item.status='failed';item.error=String(error.stack||error);
      try{item.failure=await capture(item,'failure');}catch(e){item.captureError=String(e);}
      // A response can fail after the server accepts creation. Only a name whose
      // absence and exact request were persisted is eligible for recovery.
      const pending=report.pending.find(x=>x.id===item.id&&!report.created.some(r=>r.name===x.name));
      if(pending){try{if(await api(POST+'/'+pending.name,'GET',undefined,true))await register(item,pending.name);}catch(e){item.registrationError=String(e);}}
    }finally{pendingCase=null;await save();}
  }
};
const readers = async engine => {
  const authored=JSON.parse(await readFile(path.join(output,'author.json')));assert.equal(authored.status,'passed');
  for(const source of authored.cases.filter(c=>c.engine===engine)){
    const item={id:source.id,engine,version:browser.version(),mode:source.mode,tex:source.second,permalink:source.permalink,resources:[],requestFailures:[],jsErrors:[]};report.cases.push(item);await save();
    try{
      context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});await context.route('**/*',guard);
      page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(20000);
      page.on('pageerror',e=>item.jsErrors.push(e.message));page.on('requestfailed',r=>item.requestFailures.push({url:r.url(),error:r.failure()?.errorText}));
      page.on('response',r=>{if(r.url().includes('/plugins/plugin-katex/'))item.resources.push({url:r.url(),status:r.status()});});
      const response=await page.goto(base+source.permalink,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
      const html=await response.text();item.initial=await archive(item.id,'initial.html',html);const initial=await signature(html,true);formulaCheck(initial,source.mode,source.second);assert(initial.text.includes(source.body));
      await page.locator('article.render .theme-math-copy').waitFor();
      await page.waitForFunction(()=>document.fonts.status==='loaded');
      const observation=await page.locator('article.render').evaluate(root=>{
        const formula=root.querySelector('.katex-inline,.katex-block'),math=formula?.querySelector('math'),source=root.querySelector('.theme-math-source'),button=root.querySelector('.theme-math-copy');
        return {mathCount:root.querySelectorAll('math').length,tex:[...root.querySelectorAll('annotation[encoding="application/x-tex"]')].map(n=>n.textContent),mathNamespace:math?.namespaceURI,formulaVisible:!!formula?.getClientRects().length,mathWidth:math?.getBoundingClientRect().width,sourceText:source?.textContent??null,sourceVisible:!!source?.getClientRects().length,sourceView:formula?.hasAttribute('data-math-source-view'),copyCount:root.querySelectorAll('.theme-math-copy').length,copyName:button?.getAttribute('aria-label'),text:root.textContent};
      });
      item.observation=observation;assert.equal(observation.mathCount,1);assert.deepEqual(observation.tex,[source.second]);assert.equal(observation.mathNamespace,'http://www.w3.org/1998/Math/MathML');assert(observation.text.includes(source.body));
      assert.equal(observation.copyCount,1,'math.copy_tex remains enabled in every state');
      if(phase==='theme-off'){assert(observation.sourceVisible&&observation.sourceView);assert.equal(observation.sourceText,source.second);assert(!observation.formulaVisible);}
      else{assert(observation.formulaVisible&&observation.mathWidth>0);assert(!observation.sourceView);}
      // Capture the installed handler's output only. This does not claim OS
      // clipboard integration, and never supplies or renders formula content.
      await page.evaluate(()=>{window.mathEditorCopied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.mathEditorCopied.push(value)}});});
      await page.locator('article.render .theme-math-copy').click();await page.waitForFunction(()=>window.mathEditorCopied.length===1);
      item.copyOutput=await page.evaluate(()=>window.mathEditorCopied);assert.deepEqual(item.copyOutput,[source.second]);
      item.copyStatus=await page.locator('article.render .theme-math-status').innerText();assert(item.copyStatus);
      item.rendered=await archive(item.id,'rendered.html',await page.locator('article.render').innerHTML());
      assert.equal(item.jsErrors.length,0);assert.equal(item.requestFailures.length,0);
      if(phase==='plugin-off')assert.equal(item.resources.length,0,'Disabled plugin must not inject its assets');
      else{assert(item.resources.some(x=>x.url.includes('katex.min.css')&&x.status===200));assert(!item.resources.some(x=>x.url.includes('katex.min.js')),'Frontend re-rendering must remain off');}
      item.status='passed';
    }catch(error){item.status='failed';item.error=String(error.stack||error);}
    finally{await boundedClose(context);context=null;await save();}
  }
};
await save();
try{
  for(const engine of ENGINES){
    browser=await pw[engine].launch({headless:true,env,...(engine==='chromium'?{channel:'chromium'}:{})});
    try{if(phase==='author')await authors(engine);else await readers(engine);}
    finally{await boundedClose(context);context=null;await boundedClose(browser);browser=null;}
  }
  report.status=report.cases.length===EXPECTED_CASES&&report.cases.every(x=>x.status==='passed')&&!report.blockedRequests.length?'passed':'failed';
}catch(error){report.status='failed';report.error=String(error.stack||error);}
finally{await boundedClose(context);await boundedClose(browser);await save();}
console.log(JSON.stringify({phase,status:report.status,cases:report.cases.length,created:report.created.length}));
if(report.status!=='passed')process.exitCode=1;
