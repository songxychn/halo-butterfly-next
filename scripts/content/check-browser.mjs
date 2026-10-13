/** Portable HTML regression against maintained code and built CSS, in isolated headless engines. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'vite';
const root=fileURLToPath(new URL('../../',import.meta.url));
const runtime=resolve(process.env.CONTENT_BROWSER_RUNTIME || join(root,'.runtime/browser-matrix'));
const output=resolve(process.argv[2] || join(root,'.runtime/content/runs',String(Date.now())));
await mkdir(output,{recursive:true});
const temp=join(root,'.runtime/content/tmp');await mkdir(temp,{recursive:true});
Object.assign(process.env,{PLAYWRIGHT_BROWSERS_PATH:join(runtime,'browsers'),PLAYWRIGHT_SKIP_BROWSER_GC:'1',TMPDIR:temp,TMP:temp,TEMP:temp});
const pw=await import(pathToFileURL(join(runtime,'deps/node_modules/playwright/index.mjs')));
const fixture=await readFile(join(root,'fixtures/content-extensions/article.html'),'utf8');
const css=await readFile(join(root,'templates/assets/css/post.min.css'));
const entry=join(output,'entry.js');
await writeFile(entry,`import {enhanceContent} from ${JSON.stringify(join(root,'src/js/core/content-extensions.ts'))};
import {ensureHeadingIds,bindArticleAnchors} from ${JSON.stringify(join(root,'src/js/core/article-anchor.ts'))};
import AmplifyImg from ${JSON.stringify(join(root,'src/js/modules/AmplifyImg.ts'))};
const article=document.querySelector('article.render');ensureHeadingIds(article);
window.initializeContent=()=>window.disposeContent=enhanceContent(article);
window.initializeContent();bindArticleAnchors(article,{clickToScroll:true,autoUpdate:true});new AmplifyImg();window.contentReady=true;`);
const compiled=await build({configFile:false,logLevel:'error',build:{write:false,target:'es2022',lib:{entry,name:'ContentFixture',formats:['iife']}}});
const bundle=(Array.isArray(compiled)?compiled[0]:compiled).output.find(x=>x.type==='chunk').code;
const html=(url)=>`<!doctype html><html lang="zh-CN" data-color-scheme="${url.includes('dark')?'dark':'light'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>正文扩展</title>${url.includes('plain')?'':'<link rel="stylesheet" href="/post.css">'}<style>body{margin:0;padding:24px}#Butterfly{min-height:0}.main{display:block;max-width:900px;margin:auto}.main>.content{padding:24px}article{max-width:100%}</style></head><body><div id="Butterfly" class="post"><main class="main"><section class="content card"><article class="render">${fixture}</article></section></main></div>${url.includes('plain')?'':'<script src="/bundle.js"></script>'}</body></html>`;
const server=createServer(async(req,res)=>{
 try{
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);}
  else if(req.url==='/post.css'){res.setHeader('Content-Type','text/css');res.end(css);}
  else if(req.url.startsWith('/lab/')){const file=join(root,'fixtures/comparison/assets',req.url.slice(5));res.setHeader('Content-Type','image/webp');res.end(await readFile(file));}
  else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html(req.url));}
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const digest=value=>createHash('sha256').update(value).digest('hex');
const report={sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceDirty:!!execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8'}).trim(),fixtureSha256:digest(fixture),cssSha256:digest(css),bundleSha256:digest(bundle),checks:[],limitations:['Isolated HTML fixture, not Halo editor roundtrip or phone hardware.']};
let currentBrowser;
try{
 for(const engine of ['chromium','firefox','webkit']){
  currentBrowser=await pw[engine].launch({headless:true,env:process.env,...(engine==='chromium'?{channel:'chromium'}:{})});
  for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}])for(const color of ['light','dark']){
   const context=await currentBrowser.newContext({viewport,locale:'zh-CN',colorScheme:color});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/'+color);await page.waitForFunction(()=>window.contentReady===true);
   const tabs=page.locator('#deploy-tabs > .content-tab-list');const first=tabs.getByRole('tab',{name:'Docker 部署',exact:true});const second=tabs.getByRole('tab',{name:'本地运行',exact:true});
   assert.equal(await page.locator('[data-content-tabs-ready]').count(),3);
   assert(await page.evaluate(()=>[...document.querySelectorAll('[role=tab]')].every(tab=>{const panel=document.getElementById(tab.getAttribute('aria-controls'));return panel?.getAttribute('role')==='tabpanel' && panel.getAttribute('aria-labelledby')===tab.id})));
   assert(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.length===new Set(ids).size}));
   assert.equal(await page.locator('#docker-panel').isVisible(),true);assert.equal(await page.locator('#local-panel').isVisible(),false);
   await page.evaluate(()=>{window.initializeContent();window.initializeContent()});assert.equal(await tabs.count(),1);
   await first.focus();await page.keyboard.press('ArrowLeft');assert.equal(await second.getAttribute('aria-selected'),'true');
   assert.equal(await second.evaluate(e=>e===document.activeElement),true);
   await page.keyboard.press('Home');assert.equal(await first.getAttribute('aria-selected'),'true');
   await page.keyboard.press('End');assert.equal(await second.getAttribute('aria-selected'),'true');
   await first.click();await second.focus();await page.keyboard.press('Enter');assert.equal(await second.getAttribute('aria-selected'),'true');
   await first.click();await second.focus();await page.keyboard.press('Space');assert.equal(await second.getAttribute('aria-selected'),'true');
   await page.keyboard.press('Tab');assert.equal(await page.locator('#local-panel').evaluate(e=>e===document.activeElement),true);
   assert.equal(await page.locator('#nested-tabs > .content-tab-list [aria-selected="true"]').textContent(),'Linux');
   await first.click();await page.locator('#jump-nested').click();assert.equal(await page.locator('#nested-target').isVisible(),true);
   await first.click();await page.locator('#jump-local').click();assert.equal(await page.locator('#local-target').isVisible(),true);
   await page.locator('#jump-answer').click();assert.equal(await page.locator('#answer-details').getAttribute('open'),'');
   await page.locator('#native-details > summary').click();assert.equal(await page.locator('#native-details').getAttribute('open'),'');
   await page.locator('#native-details > summary').click();assert.equal(await page.locator('#native-details').getAttribute('open'),null);
   await page.evaluate(()=>{window.dispatchEvent(new Event('beforeprint'))});await page.emulateMedia({media:'print'});
   assert.equal(await page.locator('#docker-text').isVisible(),true);assert.equal(await page.locator('#local-target').isVisible(),true);assert.equal(await page.locator('#native-details ol').isVisible(),true);
   await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.equal(await page.locator('#native-details').getAttribute('open'),null);assert.equal(await page.locator('#answer-details').getAttribute('open'),'');
   for(const id of ['invalid-tabs','missing-heading','stray-content'])assert.equal(await page.locator('#'+id+' > .content-tab-list').count(),0);
   assert.equal(await page.locator('#long-tabs .content-tab-list em').count(),0);assert.equal(await page.locator('#long-tabs > section h3 em').count(),1);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'page overflow');
   assert(await page.evaluate(()=>[...document.querySelectorAll('.content-tab-list')].every(e=>e.scrollWidth<=e.clientWidth+1)),'tab overflow');
   const photo=page.locator('#photo-gallery figure').first().locator('a');await photo.click();await page.locator('.theme-image-viewer').waitFor({state:'visible'});
   assert.equal(await page.locator('.viewer-list > li').count(),2);await page.keyboard.press('Escape');await page.locator('.theme-image-viewer').waitFor({state:'detached'});
   assert.equal(await page.locator('#group-gallery .theme-lightbox-trigger').count(),0);
   await page.evaluate(()=>{history.replaceState(null,'',location.pathname);document.getElementById('answer-details').open=false;window.disposeContent()});
   assert.equal(await page.locator('.content-tab-list').count(),0);assert.equal(await page.locator('[role=tabpanel]').count(),0);
   assert.equal(await page.locator('#docker-panel').getAttribute('id'),'docker-panel');assert.equal(await page.locator('#local-panel').isVisible(),true);
   await page.evaluate(()=>window.initializeContent());assert.equal(await tabs.count(),1);
   // An actual partial setup failure must roll back authored panel attributes and keep both panels visible.
   await page.evaluate(()=>{window.disposeContent();const el=document.getElementById('deploy-tabs');const prepend=el.prepend;el.prepend=()=>{throw Error('fixture initialization failure')};window.initializeContent();el.prepend=prepend});
   assert.equal(await tabs.count(),0);assert.equal(await page.locator('#docker-panel').isVisible(),true);assert.equal(await page.locator('#local-panel').isVisible(),true);
   await page.evaluate(()=>{window.disposeContent();window.initializeContent()});
   await page.locator('#content-tabs').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:join(output,`${engine}-${viewport.name}-${color}.png`)});
   assert.deepEqual(errors,[]);report.checks.push({engine,viewport:viewport.name,color,status:'passed'});await context.close();
  }
  // Direct fragments and browser history must reveal nested inactive content before scrolling.
  const context=await currentBrowser.newContext();const page=await context.newPage();await page.goto(base+'/light#nested-target');await page.waitForFunction(()=>window.contentReady===true);
  assert.equal(await page.locator('#nested-target').isVisible(),true);
  await page.goto(base+'/light');await page.waitForFunction(()=>window.contentReady===true);await page.locator('#jump-nested').click();await page.goBack();await page.goForward();assert.equal(await page.locator('#nested-target').isVisible(),true);await context.close();
  for(const mode of ['no-js','blocked-js','plain']){
   const fallback=await currentBrowser.newContext({javaScriptEnabled:mode!=='no-js'});const p=await fallback.newPage();
   if(mode==='blocked-js')await p.route('**/bundle.js',r=>r.abort());
   await p.goto(base+(mode==='plain'?'/plain':'/light'));
   for(const id of ['docker-text','local-target','nested-target'])assert.equal(await p.locator('#'+id).isVisible(),true,mode+' '+id);
   assert.equal(await p.locator('.content-tab-list').count(),0);
   await p.locator('#answer-details summary').click();assert.equal(await p.locator('#answer-target').isVisible(),true);
   assert.equal(await p.locator('#photo-gallery figure').first().locator('a').getAttribute('href'),'/lab/cover-turquoise-coast.webp');
   report.checks.push({engine,mode,status:'passed'});await fallback.close();
  }
  await currentBrowser.close();currentBrowser=null;
 }
 report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);process.exitCode=1;console.error(report.error);}
finally{await currentBrowser?.close();await new Promise(r=>server.close(r));await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,output}));}
