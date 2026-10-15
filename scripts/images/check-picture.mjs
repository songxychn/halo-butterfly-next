/** Responsive-picture regression against the actual lightbox module, with no Halo mutation or dist writes. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL, fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'vite';
import {REPO, RUNTIME, browserEnvironment, sha256} from '../browser/support.mjs';

const output=path.resolve(process.argv[2] || path.join(REPO,'.runtime/platform-acceptance/picture-'+Date.now()));
assert(output.startsWith(path.join(REPO,'.runtime')+path.sep),'Output must stay inside this worktree runtime');
await mkdir(path.dirname(output),{recursive:true}); await mkdir(output);
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const entry=path.join(output,'entry.js');
await writeFile(entry,`import AmplifyImg from ${JSON.stringify(path.join(REPO,'src/js/modules/AmplifyImg.ts'))};window.initializeLightbox=()=>new AmplifyImg();`);
const compiled=await build({configFile:false,logLevel:'error',build:{write:false,target:'es2022',lib:{entry,name:'PictureFixture',formats:['iife']}}});
const bundle=(Array.isArray(compiled)?compiled[0]:compiled).output.find(x=>x.type==='chunk').code;
const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Responsive picture fixture</title><style>img{width:180px;height:120px}body{margin:0}</style></head><body><main class="main"><section class="content"><picture id="responsive"><source media="(min-width: 800px)" srcset="/wide.svg"><img id="responsive-image" src="/fallback.svg" srcset="/narrow.svg 1x, /narrow2.svg 2x" loading="eager" alt="Responsive fixture"></picture><a id="linked" href="/full.svg"><picture><source media="(min-width: 800px)" srcset="/linked-wide.svg"><img id="linked-image" src="/linked-narrow.svg" alt="Linked picture"></picture></a></section></main><script src="/bundle.js"></script></body></html>';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#469"/></svg>';
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':req.url.endsWith('.svg')?'image/svg+xml':'text/html');res.end(req.url==='/bundle.js'?bundle:req.url.endsWith('.svg')?svg:html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const report={kind:'responsive-picture-regression',sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:REPO,encoding:'utf8'}).trim(),productFile:'src/js/modules/AmplifyImg.ts',productSha256:sha256(await readFile(path.join(REPO,'src/js/modules/AmplifyImg.ts'))),runnerSha256:sha256(await readFile(fileURLToPath(import.meta.url))),bundleSha256:sha256(bundle),checks:[],limitations:['Synthetic headless browsers only; no installed Halo, physical device, or actual Safari verification.']};
const snapshot=page=>page.locator('#responsive-image').evaluate(img=>({parent:img.parentElement.tagName,src:img.getAttribute('src'),srcset:img.getAttribute('srcset'),currentSrc:img.currentSrc,loading:img.loading,picture:document.querySelector('#responsive').outerHTML,triggerCount:document.querySelectorAll('#responsive .theme-lightbox-trigger').length}));
let browser;
try {
 for(const engine of (process.env.ENGINES || 'chromium,firefox,webkit').split(',')){
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1});const page=await context.newPage();page.setDefaultTimeout(8000);
   const item={engine,width,errors:[]};page.on('pageerror',e=>item.errors.push(e.message));
   await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
   try{
    await page.goto(base);await page.waitForFunction(()=>document.querySelector('#responsive-image').complete&&document.querySelector('#responsive-image').naturalWidth>0);
    item.before=await snapshot(page);assert.equal(item.before.currentSrc,base+(width>=800?'/wide.svg':'/narrow.svg'),'Baseline must select the native picture candidate');
    await page.evaluate(()=>{window.initializeLightbox();window.initializeLightbox();});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    item.after=await snapshot(page);
    assert.equal(item.after.parent,'PICTURE','Lightbox must keep img as a direct child of picture');
    assert.equal(item.after.currentSrc,item.before.currentSrc,'Lightbox changed the native responsive candidate');
    assert.equal(item.after.src,item.before.src);assert.equal(item.after.srcset,item.before.srcset);assert.equal(item.after.loading,'eager');
    assert.equal(await page.locator('#responsive source').getAttribute('srcset'),'/wide.svg');
    assert.equal(await page.locator('.theme-lightbox-trigger .theme-lightbox-trigger').count(),0);
    assert.equal(await page.locator('#responsive').locator('..').getAttribute('role'),'button');
    await page.locator('#responsive').locator('..').focus();await page.keyboard.press('Enter');
    await page.waitForSelector('.viewer-canvas > img',{state:'visible'});
    assert.equal(await page.locator('.viewer-canvas > img').getAttribute('src'),item.before.currentSrc);
    await page.keyboard.press('Escape');await page.waitForSelector('.theme-lightbox',{state:'detached'});
    assert(await page.locator('#responsive').locator('..').evaluate(el=>el===document.activeElement));
    const changedWidth=width>=800?390:1440;await page.setViewportSize({width:changedWidth,height:900});
    await page.waitForFunction(expected=>document.querySelector('#responsive-image').currentSrc===expected,base+(changedWidth>=800?'/wide.svg':'/narrow.svg'));
    item.afterResize=await snapshot(page);
    await page.locator('#linked-image').click();await page.waitForSelector('.viewer-canvas > img',{state:'visible'});
    assert.equal(await page.locator('.viewer-canvas > img').getAttribute('src'),base+'/full.svg');
    assert.equal(await page.locator('#linked-image').evaluate(el=>el.parentElement.tagName),'PICTURE');
    await page.keyboard.press('Escape');assert.deepEqual(item.errors,[]);item.result='passed';
   }catch(error){item.result='failed';item.error=error.stack;process.exitCode=1;}
   finally{report.checks.push(item);await context.close();console.log(engine,width,item.result);}
  }
  await browser.close();browser=null;
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));report.result=report.checks.length&&report.checks.every(x=>x.result==='passed')?'passed':'failed';await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(output);}
