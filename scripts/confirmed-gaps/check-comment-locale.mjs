/** Real theme/PJAX rendering with a deterministic anonymous public-comment response. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl,validatePackage,sha256} from '../browser/support.mjs';
const lab=path.resolve(process.env.LAB_RUNTIME||'');assert(lab.startsWith(path.join(REPO,'.runtime/')));
const base=validateBaseUrl(process.env.BASE_URL,JSON.parse(await readFile(path.join(lab,'lab.json'))));
const installed=JSON.parse(await readFile(path.join(lab,'installed-package.json')));
validatePackage(installed,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha256(await readFile(path.join(REPO,'dist',installed.name))));
Object.assign(process.env,browserEnvironment());const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const output=path.resolve(process.argv[2]||'.runtime/confirmed-gaps/comment-locale');await mkdir(output,{recursive:true});
const report={installed,cases:[],limitations:['Synthetic public comment responses; real theme, Halo routes and headless browser engines. No service/device acceptance.']};
const save=()=>writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const engine of ['chromium','firefox','webkit']){
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
 try{
  const context=await browser.newContext({locale:'en',timezoneId:'Asia/Shanghai'});let requests=0;const errors=[];
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
   if(url.pathname!='/apis/api.halo.run/v1alpha1/comments')return route.continue();requests++;
   const name=url.searchParams.get('name'),kind=url.searchParams.get('kind'),group=url.searchParams.get('group');
   return route.fulfill({json:{items:[{metadata:{name:'locale-'+kind+'-'+name},spec:{subjectRef:{name,kind,group},approved:true,hidden:false,creationTime:'2026-10-13T12:04:00Z',content:'<img src="/unused-fixture">'},owner:{}}],total:1,page:1,size:6}});
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(20000);
  const row={engine,requests:[],checks:[]};report.cases.push(row);
  try{
   await p.goto(base+'/archives/?language=en',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.MainApp?.useCommon);await p.evaluate(()=>window.commentLocaleSentinel=true);assert(Number(await p.locator('[data-newest-comments]').getAttribute('data-storage'))>0,'This cache scenario requires an explicitly enabled cache fixture');
   for(const [index,locale] of ['en','ja','ja','en','en'].entries()){
    if(index){await p.evaluate(route=>{const a=document.createElement('a');a.href=route;document.body.append(a);a.click();a.remove()},'/archives/?language='+locale+'&probe='+index);await p.waitForFunction(locale=>document.documentElement.lang===locale&&!document.documentElement.classList.contains('theme-navigating')&&!!window.MainApp?.useCommon,locale,{polling:100});assert.equal(await p.evaluate(()=>window.commentLocaleSentinel),true);}
    await p.locator('[data-newest-comments]').scrollIntoViewIfNeeded();await p.waitForSelector('[data-comments-state="loaded"]');
    const data=await p.evaluate(()=>({lang:document.documentElement.lang,expected:MainApp.messages['ui.imagePlaceholder'],guest:MainApp.messages['ui.guest'],rows:[...document.querySelectorAll('.newest-comment-link')].map(e=>({excerpt:e.querySelector('.newest-comment-excerpt').textContent,byline:e.querySelector('.newest-comment-byline').textContent,time:e.querySelector('time').textContent,expectedTime:new Intl.DateTimeFormat(document.documentElement.lang,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(e.querySelector('time').dateTime))}))}));
    assert.equal(data.lang,locale);assert(data.rows.length>0);for(const item of data.rows){assert.equal(item.excerpt,data.expected);assert(item.byline.startsWith(data.guest+' · '));assert.equal(item.time,item.expectedTime);}
    row.requests.push(requests);row.checks.push(locale+' translated excerpt, Guest and date');
    if(index===3)await p.evaluate(()=>{const key='halo-butterfly-next.newest-comments.v1',cache=JSON.parse(sessionStorage.getItem(key));for(const entry of Object.values(cache))delete entry.locale;sessionStorage.setItem(key,JSON.stringify(cache));});
   }
   assert(row.requests[0]>0);assert(row.requests[1]>row.requests[0]);assert.equal(row.requests[2],row.requests[1],'Same locale must reuse cached comments');assert(row.requests[3]>row.requests[2]);assert(row.requests[4]>row.requests[3],'Legacy entries must refresh');assert.deepEqual(errors,[]);row.pass=true;console.log(engine,'passed');
  }catch(error){row.pass=false;row.error=String(error.stack||error);row.url=p.url();throw error;}finally{await context.close();await save();}
 }finally{await browser.close();}
}
