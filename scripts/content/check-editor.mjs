/** Real default-editor roundtrip, confined to new unpublished drafts in an owned local Halo. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {validateBaseUrl} from '../browser/support.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
assert.ok(process.env.LAB_RUNTIME,'LAB_RUNTIME must explicitly identify an owned local lab');
const lab=resolve(process.env.LAB_RUNTIME), runtime=resolve(process.env.CONTENT_BROWSER_RUNTIME||join(root,'.runtime/browser-matrix'));
const base=validateBaseUrl(process.env.BASE_URL,JSON.parse(await readFile(join(lab,'lab.json'))));
const credentialsPath=join(lab,'halo/credentials.json');assert.equal((await stat(credentialsPath)).mode&0o077,0,'Credentials must be private');
const credentials=JSON.parse(await readFile(credentialsPath));
const fixture=await readFile(join(root,'fixtures/content-extensions/article.html'),'utf8');
const output=resolve(process.argv[2]||join(root,'.runtime/content/editor',String(Date.now())));await mkdir(output,{recursive:true});
process.env.PLAYWRIGHT_BROWSERS_PATH=join(runtime,'browsers');
const engines=(process.env.CONTENT_EDITOR_ENGINES||'chromium,firefox,webkit').split(',');assert.ok(engines.every(x=>['chromium','firefox','webkit'].includes(x)));
const pw=await import(pathToFileURL(join(runtime,'deps/node_modules/playwright/index.mjs')));
const sha=value=>createHash('sha256').update(value).digest('hex');
const report={haloVersion:'2.26.1',installedTheme:JSON.parse(await readFile(join(lab,'installed-package.json'))),fixtureSha256:sha(fixture),cases:[],limitations:['Only new local unpublished drafts are written. No publish action or theme/configuration changes.','Editor roundtrip is independent of installed theme behavior; no public rendering claim.','Plain paste negative control is Chromium-only, delivered through a ClipboardEvent with text/html, not a physical clipboard. Firefox synthetic paste did not roundtrip content and is not qualified.','CodeMirror document is read after reload to include offscreen lines. No editor state is injected for HTML-block input.']};
let browser;
try{
 for(const engine of engines){
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});const page=await context.newPage();page.setDefaultTimeout(20000);
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.goto(base+'/login');await page.locator('#username').fill(credentials.username);await page.locator('#plainPassword').fill(credentials.password);await page.locator('button[type="submit"]').click();await page.waitForURL(url=>!url.pathname.includes('login'));
  const plugins=await context.request.get(base+'/apis/plugin.halo.run/v1alpha1/plugins');assert.equal(plugins.status(),200);
  const plugin=(await plugins.json()).items.find(x=>/hybrid-edit-block/i.test(JSON.stringify(x.spec))||/hybrid/i.test(x.metadata.name));assert.ok(plugin?.spec.enabled,'Official HTML block plugin must be enabled');
  report.plugin={name:plugin.metadata.name,version:plugin.spec.version,enabled:plugin.spec.enabled};
  // Synthetic HTML clipboard delivery is qualified only in Chromium.
  for(const mode of engine==='chromium'?['html-block','plain-paste']:['html-block']){
   const title=`Content editor acceptance ${engine} ${mode} ${Date.now()}`;
   await page.goto(base+'/console');await page.getByText('创建文章',{exact:true}).click();await page.locator('.tiptap').waitFor();await page.getByPlaceholder('请输入标题',{exact:true}).fill(title);
   await page.locator('.tiptap').click();
   if(mode==='html-block'){
    await page.keyboard.type('/');await page.getByText('HTML 编辑块',{exact:true}).click();await page.locator('.cm-content').click();await page.keyboard.insertText(fixture);
   }else{
    await page.locator('.tiptap').evaluate((element,html)=>{const data=new DataTransfer();data.setData('text/html',html);data.setData('text/plain',new DOMParser().parseFromString(html,'text/html').body.textContent);element.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},fixture);
   }
   // HTML block synchronizes code on blur/debounce. Do not save stale node attributes.
   await page.getByPlaceholder('请输入标题',{exact:true}).click();await page.waitForTimeout(1200);
   const saveRequest=page.waitForRequest(r=>r.method()==='POST'&&new URL(r.url()).pathname==='/apis/api.console.halo.run/v1alpha1/posts');
   await page.getByRole('button',{name:'保存',exact:true}).click();const saved=(await saveRequest).postDataJSON();await page.getByText('保存成功',{exact:true}).waitFor();assert.equal(saved.post.spec.publish,false);
   const draftUrl=page.url();await page.reload();await page.waitForFunction(title=>document.querySelector('input[placeholder="请输入标题"]')?.value===title,title);await page.locator('.tiptap').waitFor();
   let reopened;
   if(mode==='html-block'){
    await page.locator('.cm-content').waitFor();reopened=await page.locator('.cm-content').evaluate(e=>e.cmView?.view?.state.doc.toString());assert.equal(typeof reopened,'string');
   }else {await page.waitForFunction(()=>document.querySelector('.tiptap')?.textContent.includes('标准 Markdown 与 HTML'));reopened=await page.locator('.tiptap').innerHTML();}
   const signatures=await page.evaluate(({fixture,saved,reopened})=>{
    const signature=html=>{const doc=new DOMParser().parseFromString(html,'text/html');const wrapper=doc.querySelector('.html-edited');const body=wrapper||doc.body;
     const tree=node=>{if(node.nodeType===3){const text=node.textContent.replace(/\s+/g,' ').trim();return text||null;}if(node.nodeType!==1)return null;return {tag:node.tagName,attrs:[...node.attributes].map(x=>[x.name,x.value]).sort(),children:[...node.childNodes].map(tree).filter(Boolean)};};
     return {tree:[...body.childNodes].map(tree).filter(Boolean),attributes:[...body.querySelectorAll('*')].flatMap(e=>[...e.attributes].filter(a=>a.name.startsWith('data-content-')).map(a=>[e.tagName,a.name,a.value])),text:body.textContent.replace(/\s+/g,' ').trim()};};
    return {expected:signature(fixture),saved:signature(saved),reopened:signature(reopened)};
   },{fixture,saved:saved.content.content,reopened});
   const draftName=new URL(draftUrl).searchParams.get('name');assert.ok(draftName);const resource=await context.request.get(base+'/apis/content.halo.run/v1alpha1/posts/'+encodeURIComponent(draftName));assert.equal(resource.status(),200);assert.equal((await resource.json()).spec.publish,false);
   if(mode==='html-block'){
    assert.deepEqual(signatures.saved.tree,signatures.expected.tree,'Saved HTML retains complete fixture structure/text/attributes');assert.deepEqual(signatures.reopened.tree,signatures.expected.tree,'Reopened HTML block retains complete fixture structure/text/attributes');
   }else{
    assert.ok(signatures.expected.attributes.length>0);assert.equal(signatures.saved.attributes.length,0,'Ordinary paste does not preserve enhancement attributes');assert.equal(signatures.reopened.attributes.length,0);assert.ok(signatures.reopened.text.includes('标准 Markdown 与 HTML'));
   }
   const result={engine,version:browser.version(),mode,draftName,published:false,fixtureAttributes:signatures.expected.attributes.length,savedAttributes:signatures.saved.attributes.length,reopenedAttributes:signatures.reopened.attributes.length,savedContentSha256:sha(saved.content.content),reopenedContentSha256:sha(reopened),status:'passed'};
   report.cases.push(result);await writeFile(join(output,`${engine}-${mode}-saved.html`),saved.content.content);await writeFile(join(output,`${engine}-${mode}-reopened.html`),reopened);await page.screenshot({path:join(output,`${engine}-${mode}.png`)});console.log(JSON.stringify(result));
  }
  await context.close();await browser.close();browser=null;
 }
 report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);process.exitCode=1;console.error(report.error);}
finally{await browser?.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:report.cases.length,output}));}
