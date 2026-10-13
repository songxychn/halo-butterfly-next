/** Real Halo author/listing options acceptance; mutations are confined to an owned local lab. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateBaseUrl} from '../browser/support.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const base=validateBaseUrl(process.env.BASE_URL,JSON.parse(await readFile(path.join(process.env.LAB_RUNTIME||path.join(root,'.runtime/comparison'),'lab.json'),'utf8')));
assert.equal(Number(new URL(base).port),Number(process.env.HALO_PORT),'HALO_PORT must identify the same owned lab');
process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'.runtime/browser-matrix/browsers');
const engine=process.env.BROWSER||'chromium';assert.ok(['chromium','firefox','webkit'].includes(engine));
const engines=await import(path.join(root,'.runtime/browser-matrix/deps/node_modules/playwright/index.mjs'));
const browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
const out=path.join(root,'.runtime/author-options',engine);await mkdir(out,{recursive:true});
const report={engine,version:browser.version(),cases:[]};
try{
for(const mode of ['configured','inherit','unsafe']){
 execFileSync('python3',[path.join(root,'scripts/author-options/lab.py'),mode],{cwd:root,env:process.env,stdio:'pipe'});
 for(const [width,scheme] of [[1440,'light'],[390,'light'],[390,'dark']]){
  const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,locale:'en'});
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const page=await ctx.newPage();
  for(const route of ['/archives/preview-1','/about-preview','/tags','/archives','/archives/2026/08']){
   const errors=[];const listener=e=>errors.push(e.message);page.on('pageerror',listener);
   const response=await page.goto(base+route+'?language=en',{waitUntil:'networkidle',timeout:30000});assert.equal(response.status(),200);
   const state=await page.evaluate(()=>({aside:document.querySelectorAll('main>.aside').length,confAside:window.MainApp.conf.enable_aside,shrink:window.MainApp.conf.code_shrink,expanders:[...document.querySelectorAll('.code-expander')].map(x=>x.getAttribute('aria-expanded')),author:document.querySelector('.copy-right .author a')?.textContent,authorHref:document.querySelector('.copy-right .author a')?.getAttribute('href'),url:document.querySelector('.copy-right .permalink')?.getAttribute('href'),info:document.querySelector('.copy-right .declaration .text')?.textContent,infoTags:document.querySelectorAll('.copy-right .declaration b').length,license:document.querySelector('.copy-right .declaration a')?.getAttribute('href'),date:document.querySelector('.publishTime time')?.textContent,title:document.querySelector('h1.above-title')?.textContent,yearGroups:document.querySelectorAll('.axis-list .year').length,monthGroups:document.querySelectorAll('.axis-list .month').length,tags:[...document.querySelectorAll('[data-tag-cloud] a')].map(x=>({name:x.textContent,font:x.style.fontSize})),overflow:document.documentElement.scrollWidth>innerWidth+1}));
   assert.deepEqual(errors,[]);assert.equal(state.overflow,false);
   if(route==='/archives/preview-1'||route==='/about-preview'){
    assert.equal(state.aside,mode==='unsafe'?0:1);assert.equal(state.confAside,mode!=='unsafe');
    assert.equal(state.shrink,mode==='configured'?'collapsed':mode==='unsafe'?'disabled':'expanded');
   }
   if(route==='/archives/preview-1'){
    assert.equal(state.infoTags,0);
    if(mode==='configured'){assert.equal(state.author,'A <B>');assert.equal(state.authorHref,'/about-preview');assert.equal(state.url,'https://example.invalid/original%20post');assert.equal(state.info,'<b>Plain statement</b>');assert.deepEqual(state.expanders,['false']);assert.match(state.date,/2026\/08\/19/);}
    if(mode==='unsafe'){assert.equal(state.authorHref,'/');assert.ok(state.url.startsWith(base+'/archives/preview-1'));assert.equal(state.license,'https://creativecommons.org/licenses/by-nc-sa/4.0/');assert.equal(state.expanders.length,0);assert.match(state.date,/2026-08-19/);}
    if(mode==='inherit'){assert.equal(state.author,'Fixture Maintainer');assert.deepEqual(state.expanders,['true']);}
    await page.screenshot({path:path.join(out,`${mode}-${width}-${scheme}.png`),fullPage:true});
   }
   if(route==='/tags'){assert.deepEqual(state.tags.map(x=>x.name),['Zulu','Butterfly']);assert.ok(state.tags.every(x=>/^\d+(?:\.\d+)?rem$/.test(x.font)));}
   if(route==='/archives'){assert.equal(state.title,mode==='unsafe'?'Author archives':'归档');assert.equal(state.yearGroups,0);assert.ok(state.monthGroups>0);}
   if(route==='/archives/2026/08')assert.equal(state.title,'2026-08');
   report.cases.push({mode,width,scheme,route,status:response.status(),state,errors});page.off('pageerror',listener);
  }
  await ctx.close();
 }
}
const ctx=await browser.newContext({javaScriptEnabled:false});const page=await ctx.newPage();
await page.goto(base+'/archives/2026/08?language=en');assert.equal(await page.locator('h1.above-title').textContent(),'2026-08');report.cases.push({javascript:false,route:'/archives/2026/08',pass:true});
await page.goto(base+'/tags?language=en');assert.ok(await page.locator('[data-tag-cloud] a').count()>=3);report.cases.push({javascript:false,route:'/tags',pass:true});await ctx.close();
}finally{await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({engine,cases:report.cases.length,report:path.join(out,'report.json')}));
