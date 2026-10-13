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
    await check(label+' native list, external feed, labels, sanitation, pagination',async()=>{
     await goto(p,'/moments?tag=%E5%B1%B1%E5%B7%9D');
     await p.waitForSelector('[data-feed-state="loaded"]');
     assert.equal(await p.locator('.content > .list > .item').count(),10);
     assert.equal(await p.locator('html').getAttribute('data-color-scheme'),scheme);
     assert.equal(await p.locator('#Butterfly > .moment-byline').count(),0);
     assert.equal(await p.locator('[data-feed-items] > .item').count(),3);
     assert.equal(await p.locator('[data-feed-items] > .item').first().getAttribute('data-moment-key'),'feed-15');
     assert.match(await p.locator('[data-feed-items] time').first().textContent(),/10\/16/);
     assert.equal(await p.locator('[data-feed-items] script,[data-feed-items] [onerror],[data-feed-items] [href^="javascript:"]').count(),0);
     assert.equal(await p.evaluate(()=>window.feedXss||0),0);
     await p.locator('[data-feed-pager] input').fill('3');await p.locator('[data-feed-pager] button[type=submit]').click();
     assert.equal(await p.locator('[data-feed-items] > .item').count(),2);
     assert.equal(await p.locator('[data-feed-items] > .item').first().getAttribute('data-moment-key'),'feed-9');
     assert.equal(await p.locator('[data-feed-next]').isDisabled(),true);
     await p.locator('[data-feed-previous]').click();assert.equal(await p.locator('[data-feed-items] > .item').count(),3);
     await p.locator('[data-moment-page-jump] input').fill('2');await Promise.all([p.waitForURL(/\/moments\/page\/2\?tag=/),p.locator('[data-moment-page-jump] button').click()]);
     await p.waitForLoadState('networkidle');assert.equal(await p.locator('.content > .list > .item').count(),fixture.publicMoments-10);assert.equal(new URL(p.url()).searchParams.get('tag'),'山川');
     assert.equal(await p.locator('[data-moment-key="moment-fixture-13"]').count(),0);
    });
    await check(label+' exact lazy comment identity, jump and newest public Moment comments',async()=>{
     await goto(p,'/moments/moment-fixture-12#post-comment');
     await p.waitForSelector('comment-widget');
     assert.deepEqual(await p.locator('comment-widget').evaluate(el=>[el.group,el.kind,el.name]),['moment.halo.run','Moment','moment-fixture-12']);
     assert.equal(await p.locator('comment-widget').count(),1);
     assert.equal(await p.locator('#jump-comment').count(),1);
     await p.locator('.moment-comment-link').click();assert.equal(await p.evaluate(()=>document.activeElement?.id),'comment-title');
     const card=p.locator('[data-newest-comments]');await card.scrollIntoViewIfNeeded();await p.waitForSelector('[data-comments-state="loaded"]');
     const text=await card.textContent();assert.match(text,/瞬间测试评论 public/);assert.match(text,/瞬间测试评论 old/);assert.doesNotMatch(text,/瞬间测试评论 (private|pending|hidden)/);
     assert.ok((await card.locator('.newest-comment-link').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')))).every(href=>href.startsWith('/moments/')));
     assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
     assert.deepEqual(errors,[]);
     if(engine==='chromium'){const file=label+'-moment.png';await p.screenshot({path:path.join(out,file),fullPage:true});report.screenshots.push(file);}
    });
    await context.close();
   }
   const context=await browser.newContext({locale:'zh-CN'});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const p=await context.newPage();
   await check(engine+' empty/malformed/unavailable feed retains native moments and retry',async()=>{
    for(const mode of ['empty','malformed','failure']) {
     await p.route('**/lab/moments-feed.json',r=>r.fulfill(mode==='empty'?{json:[]}:mode==='malformed'?{body:'{broken',contentType:'application/json'}:{status:503,body:'unavailable'}));
     await goto(p,'/moments');await p.waitForSelector(mode==='empty'?'[data-feed-state="loaded"]':'[data-feed-state="failed"]');
     assert.equal(await p.locator('.content > .list > .item').count(),10);
     if(mode!=='empty'){assert.equal(await p.locator('[data-feed-retry]').isVisible(),true);await p.unroute('**/lab/moments-feed.json');await p.locator('[data-feed-retry]').click();await p.waitForSelector('[data-feed-state="loaded"]');}
     else {assert.equal(await p.locator('[data-feed-items] > .item').count(),0);await p.unroute('**/lab/moments-feed.json');}
    }
   });
   await check(engine+' private/missing moments expose no content or comments',async()=>{
    for(const name of ['moment-fixture-13','does-not-exist',...(fixture.pendingRetained?['moment-fixture-14']:[])]) {
     const r=await p.goto(base+'/moments/'+name,{waitUntil:'networkidle'});assert.ok([200,404].includes(r.status()));
     assert.equal(await p.locator('comment-widget,[data-comment-lazy],.content > .list > .item').count(),0);
    }
   });
   await context.close();
  } finally { await browser.close(); }
 }
 // Explicit integration variants run on the same isolated fixture, with config restoration.
 const browser=await pw.chromium.launch({headless:true,channel:'chromium',env:browserEnvironment()});
 try {
  const context=await browser.newContext();const p=await context.newPage();
  await check('eager official component uses exact Moment identity',async()=>{
   const cfg=structuredClone(initialConfig);cfg.comments.lazyload=false;assert((await admin.put(configPath,{data:cfg})).ok());
   await goto(p,'/moments/moment-fixture-12#post-comment');await p.waitForSelector('comment-widget');
   assert.deepEqual(await p.locator('comment-widget').evaluate(el=>[el.group,el.kind,el.name]),['moment.halo.run','Moment','moment-fixture-12']);
  });
  await check('disabled official widget removes comment controls without breaking content',async()=>{
   assert((await admin.put(pluginPath,{data:{enable:false,async:false}})).ok());
   await goto(p,'/moments/moment-fixture-12');assert.equal(await p.locator('#post-comment,.moment-comment-link,[data-newest-comments]').count(),0);assert.equal(await p.locator('.content > .list > .item').count(),1);
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
