/** Real Halo language matrix, with isolated headless browsers and loopback-only requests. */
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {validateBaseUrl} from '../browser/support.mjs';
const root=fileURLToPath(new URL('../../', import.meta.url));
const base=validateBaseUrl(process.env.BASE_URL, JSON.parse(await readFile(path.join(process.env.LAB_RUNTIME || path.join(root, '.runtime/comparison'), 'lab.json'), 'utf8')));
process.env.PLAYWRIGHT_BROWSERS_PATH=root+'/.runtime/browser-matrix/browsers';
const engines=await import(root+'/.runtime/browser-matrix/deps/node_modules/playwright/index.mjs');
const engine=process.env.BROWSER || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
const out=root+'/.runtime/i18n-validation/'+engine;await mkdir(out,{recursive:true});
const browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
const languages={en:'Categories',ja:'カテゴリー',ko:'카테고리','zh-CN':'分类','zh-HK':'分類','zh-TW':'分類',de:'Categories','en-GB':'Categories','zh-SG':'分类'};
const report={engine,version:browser.version(),cases:[]};
try {
for(const [lang,title] of Object.entries(languages)) {
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(base+'/categories?language='+lang,{waitUntil:'networkidle',timeout:30000});
 assert.equal(response.status(),200);assert.equal(await page.locator('h1.above-title').textContent(),title);
 const actual=await page.evaluate(()=>({lang:document.documentElement.lang,copy:window.MainApp.messages['ui.copyCode'],missing:/\?\?ui\./.test(document.documentElement.outerHTML),overflow:document.documentElement.scrollWidth>innerWidth+1,pinned:getComputedStyle(document.documentElement).getPropertyValue('--message-pinned')}));
 assert.equal(actual.lang,lang==='de'?'en':lang);assert.ok(actual.pinned.startsWith('"'), 'CSS messages must be quoted strings');assert.equal(actual.missing,false);assert.equal(actual.overflow,false);assert.deepEqual(errors,[]);
 report.cases.push({language:lang,route:'/categories',status:response.status(),...actual,errors});
 await ctx.close();
}
for(const [width,scheme] of [[1440,'light'],[390,'light'],[390,'dark']]) {
 const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,locale:'en'});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const page=await ctx.newPage();
 for(const route of ['/','/archives','/tags','/archives/preview-1','/about-preview','/no-such-i18n-route']) {
  const errors=[];const listener=e=>errors.push(e.message);page.on('pageerror',listener);
  const response=await page.goto(base+route+'?language=en',{waitUntil:'networkidle',timeout:30000});
  assert.equal(response.status(),route.includes('no-such')?404:200);
  const state=await page.evaluate(()=>({lang:document.documentElement.lang,contentLang:document.querySelector('article.render')?.lang,og:document.querySelector('meta[property="og:locale"]')?.content,missing:/\?\?ui\./.test(document.documentElement.outerHTML),overflow:document.documentElement.scrollWidth>innerWidth+1,color:document.documentElement.dataset.colorScheme,shareInputs:document.querySelectorAll('[data-share-url]').length,copyrightLinks:document.querySelectorAll('.copy-right .declaration a').length}));
  assert.equal(state.lang,'en');assert.equal(state.missing,false);assert.equal(state.overflow,false);assert.deepEqual(errors,[]);
  if(route==='/archives/preview-1'){assert.equal(state.contentLang,'ja');assert.equal(state.og,'ja');assert.equal(state.shareInputs,1);}
  if(route==='/about-preview'){assert.equal(state.contentLang,'ko');assert.equal(state.og,'ko');}
  report.cases.push({route,width,scheme,status:response.status(),...state,errors});
  if(route==='/archives/preview-1') await page.screenshot({path:out+`/post-${width}-${scheme}.png`,fullPage:true});
  page.off('pageerror',listener);
 }
 await ctx.close();
}
const ctx=await browser.newContext({javaScriptEnabled:false,locale:'ja',viewport:{width:390,height:844}});const page=await ctx.newPage();
await page.goto(base+'/categories?language=ja');assert.equal(await page.locator('h1.above-title').textContent(),'カテゴリー');report.cases.push({route:'/categories',language:'ja',javascript:false,pass:true});await ctx.close();
} finally {await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({cases:report.cases.length,report:out+'/report.json'}));
