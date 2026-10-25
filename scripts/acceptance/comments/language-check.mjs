/** Anonymous native-language matrix; no author text rewriting or forced UI locale. */
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO,RUNTIME,browserEnvironment,validateBaseUrl} from '../../browser/support.mjs';
import {closeNavigationCase} from '../navigation/finalize.mjs';

const file=await realpath(process.argv[2]);
assert(file.startsWith(path.join(REPO,'.runtime')+path.sep));
const fixture=JSON.parse(await readFile(file)),output=path.dirname(file),runtime=await realpath(fixture.runtime);
assert.equal(fixture.owner,'comment-usage-followup-owner');
assert.equal(await readFile(path.join(runtime,'acceptance-comments.lock'),'utf8'),fixture.runId);
assert.deepEqual(JSON.parse(await readFile(path.join(runtime,'installed-package.json'))),fixture.installed);
const base=validateBaseUrl(fixture.base,JSON.parse(await readFile(path.join(runtime,'lab.json'))));
Object.assign(process.env,browserEnvironment());
const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const copyText={en:'Copy code',ko:'코드 복사','zh-TW':'複製程式碼'};
const report={name:fixture.name,subject:fixture.post,installed:fixture.installed,cases:[]};
const save=()=>writeFile(path.join(output,fixture.name+'-browser.json'),JSON.stringify(report,null,2)+'\n');
for(const engine of ['chromium','firefox','webkit'])for(const width of [390,1440]){
 const row={engine,width,status:'failed',requests:[],pageErrors:[],consoleErrors:[]};report.cases.push(row);
 let browser,context,page;
 try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  row.browserVersion=browser.version();
  context=await browser.newContext({viewport:{width,height:1000},locale:fixture.accept});
  if(fixture.cookie)await context.addCookies([{name:'language',value:fixture.cookie,url:base}]);
  page=await context.newPage();page.setDefaultTimeout(20000);
  const requests=new Map();
  page.on('pageerror',e=>row.pageErrors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')row.consoleErrors.push(e.text());});
  page.on('request',r=>{const item={url:r.url(),method:r.method(),state:'pending'};requests.set(r,item);row.requests.push(item);});
  page.on('response',r=>{const item=requests.get(r.request());if(item)item.httpStatus=r.status();});
  page.on('requestfinished',r=>{if(requests.has(r))requests.get(r).state='finished';});
  page.on('requestfailed',r=>{if(requests.has(r)){requests.get(r).state='failed';requests.get(r).error=r.failure()?.errorText;}});
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   const tracker=req.method()==='POST'&&url.pathname==='/apis/api.halo.run/v1alpha1/trackers/counter'&&req.postDataJSON()?.name===fixture.post.name;
   if(url.origin!==base||(!['GET','HEAD','OPTIONS'].includes(req.method())&&!tracker))return route.abort('blockedbyclient');
   return route.continue();
  });
  const response=await page.goto(base+fixture.post.path+'?language='+encodeURIComponent(fixture.query),{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);
  await page.waitForFunction(()=>!!window.MainApp?.messages);
  row.observed=await page.evaluate(()=>({ui:document.documentElement.lang,body:document.querySelector('article.render')?.lang,og:document.querySelector('meta[property="og:locale"]')?.content}));
  assert.deepEqual(row.observed,fixture.expected);
  row.copy=await page.evaluate(()=>window.MainApp.messages['ui.copyCode']);assert.equal(row.copy,copyText[fixture.expected.ui]);
  assert((await page.locator('article.render').innerText()).includes('Owned local comment acceptance fixture.'));
  assert.equal(await page.evaluate(()=>/\?\?ui\./.test(document.documentElement.outerHTML)),false);
  await page.waitForLoadState('networkidle',{timeout:5000});
  row.status='passed';
 }catch(error){row.error=error.stack||String(error);}
 finally{await closeNavigationCase(row,[context,browser],target=>target.close());await save();}
}
report.passed=report.cases.filter(c=>c.status==='passed').length;
report.status=report.passed===6?'passed-tested-scope':'failed';await save();
console.log(fixture.name,report.passed+'/6');process.exitCode=report.status==='failed'?1:0;
