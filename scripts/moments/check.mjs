/** Real-Halo checks; only the explicit owned fixture and loopback origin are allowed. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { browserEnvironment, RUNTIME, validateBaseUrl, sha256 } from '../browser/support.mjs';
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i]]=process.argv[i+1];
for(const key of ['--runtime','--output','--package'])assert(args[key],key+' required');
assert.equal(args['--allow-synthetic-writes'],'yes');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const runtime=await realpath(args['--runtime']),fixture=await read(path.join(runtime,'moments-fixture.json'));
assert(!path.relative(path.resolve('.runtime'),runtime).startsWith('..'),'Only this worktree runtime is allowed');
assert.equal(fixture.owner,'halo-butterfly-next-moments-fixture');
const base=validateBaseUrl(process.env.BASE_URL,await read(path.join(runtime,'lab.json')));
const installed=await read(path.join(runtime,'installed-package.json'));
assert.equal(installed.sha256,sha256(await readFile(args['--package'])));
const out=path.resolve(args['--output']);await mkdir(out,{recursive:true});
const report={schema:1,startedAt:new Date().toISOString(),base,installed,fixture,checks:[],screenshots:[],limitations:['Headless browser engines and phone viewport; not physical device or assistive-technology acceptance.','No dual-site parity or full-release acceptance.']};
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')).href);
const auth=await read(path.join(runtime,'moments-auth.private.json'));
const admin=await pw.request.newContext({baseURL:base,storageState:{cookies:auth.cookies,origins:[]},extraHTTPHeaders:{'X-CSRF-TOKEN':auth.csrf}});
const configPath='/apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config';
const configResponse=await admin.get(configPath);assert(configResponse.ok());const initialConfig=await configResponse.json();
const pluginPath='/apis/api.console.halo.run/v1alpha1/plugins/PluginCommentWidget/plugin-state';
const check=async(name,fn)=>{const item={name};report.checks.push(item);try{await fn();item.pass=true;}catch(e){item.pass=false;item.error=String(e.stack||e);throw e;}finally{await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}};
async function goto(p,url){const r=await p.goto(base+url,{waitUntil:'networkidle',timeout:30000});assert.equal(r.status(),200);await p.waitForFunction(()=>!!window.MainApp?.useCommon);}
try {
 for(const engine of ['chromium','firefox','webkit']) {
  const browser=await pw[engine].launch({headless:true,env:browserEnvironment(),...(engine==='chromium'?{channel:'chromium'}:{})});
  try {
   for(const width of [1440,390])for(const scheme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:width===390?844:1000},colorScheme:scheme,locale:'zh-CN'});
    await context.addInitScript(s=>localStorage.setItem('halo-butterfly-next.color-scheme',s),scheme);
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
    const label=`${engine}-${width}-${scheme}`;
    await check(label+' native list, labels and pagination',async()=>{
     await goto(p,'/moments?tag=%E5%B1%B1%E5%B7%9D');
     assert.equal(await p.locator('.content > .list > .item').count(),10);
     assert.equal(await p.locator('html').getAttribute('data-color-scheme'),scheme);
     assert.equal(await p.locator('#Butterfly > .moment-byline').count(),0);
     await p.locator('[data-moment-page-jump] input').fill('2');await Promise.all([p.waitForURL(/\/moments\/page\/2\?tag=/),p.locator('[data-moment-page-jump] button').click()]);
     await p.waitForLoadState('networkidle');assert.equal(await p.locator('.content > .list > .item').count(),fixture.publicMoments-10);assert.equal(new URL(p.url()).searchParams.get('tag'),'山川');
     assert.equal(await p.locator('[data-moment-key="moment-fixture-13"]').count(),0);
    });
    await check(label+' official comment identity and jump',async()=>{
     await goto(p,'/moments/moment-fixture-12#post-comment');
     await p.waitForSelector('comment-widget');
     assert.deepEqual(await p.locator('comment-widget').evaluate(el=>[el.group,el.kind,el.name]),['moment.halo.run','Moment','moment-fixture-12']);
     assert.equal(await p.locator('comment-widget').count(),1);
     assert.equal(await p.locator('#jump-comment').count(),1);
     await p.locator('.moment-comment-link').click();assert.equal(await p.evaluate(()=>document.activeElement?.id),'comment-title');
     assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
     assert.deepEqual(errors,[]);
     if(engine==='chromium'){const file=label+'-moment.png';await p.screenshot({path:path.join(out,file),fullPage:true});report.screenshots.push(file);}
    });
    await context.close();
   }
   const context=await browser.newContext({locale:'zh-CN'});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const p=await context.newPage();
   await check(engine+' private/missing moments expose no content or comments',async()=>{
    for(const name of ['moment-fixture-13','does-not-exist',...(fixture.pendingRetained?['moment-fixture-14']:[])]) {
     const r=await p.goto(base+'/moments/'+name,{waitUntil:'networkidle'});assert.ok([200,404].includes(r.status()));
     assert.equal(await p.locator('comment-widget,.content > .list > .item').count(),0);
    }
   });
   await context.close();
  } finally { await browser.close(); }
 }
 // Explicit integration variants run on the same isolated fixture, with config restoration.
 const browser=await pw.chromium.launch({headless:true,channel:'chromium',env:browserEnvironment()});
 try {
  const context=await browser.newContext();const p=await context.newPage();
  await check('disabled official widget removes comment controls without breaking content',async()=>{
   assert((await admin.put(pluginPath,{data:{enable:false,async:false}})).ok());
   await goto(p,'/moments/moment-fixture-12');assert.equal(await p.locator('#post-comment,.moment-comment-link').count(),0);assert.equal(await p.locator('.content > .list > .item').count(),1);
  });
  await context.close();
 } finally {await browser.close();}
 const nojs=await pw.chromium.launch({headless:true,channel:'chromium',env:browserEnvironment()});
 try {
  const context=await nojs.newContext({javaScriptEnabled:false});const p=await context.newPage();
  await check('no JavaScript keeps native text, absolute dates and next-page links',async()=>{
   const r=await p.goto(base+'/moments');assert.equal(r.status(),200);assert.equal(await p.locator('.content > .list > .item').count(),10);assert.equal(await p.locator('.plugin-pagination .next').getAttribute('href'),'/moments/page/2');assert.equal(await p.locator('.moment-permalink time').first().textContent(),fixture.latestRelease);assert.equal(await p.locator('[data-moment-page-jump]').isHidden(),true);
  });await context.close();
 } finally {await nojs.close();}
} finally {
 assert((await admin.put(configPath,{data:initialConfig})).ok());
 assert((await admin.put(pluginPath,{data:{enable:true,async:false}})).ok());
 await admin.dispose();report.finishedAt=new Date().toISOString();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(x=>!x.pass).length,out}));
