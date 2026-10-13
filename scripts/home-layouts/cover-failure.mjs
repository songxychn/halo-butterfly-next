import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {RUNTIME,browserEnvironment,validateBaseUrl} from '../browser/support.mjs';
const m=JSON.parse(await readFile(process.argv[2],'utf8'));
validateBaseUrl(m.halo,JSON.parse(await readFile(path.join(m.runtime,'lab.json'),'utf8')));
Object.assign(process.env,browserEnvironment());const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));const rows=[];
for(const engine of ['chromium','firefox','webkit']){const browser=await pw[engine].launch({headless:true,env:browserEnvironment(),...(engine==='chromium'?{channel:'chromium'}:{})});try{
 for(const [size,width,mode] of [['desktop',1440,'light'],['mobile',390,'dark']])for(const failure of ['cover','cover-and-fallback']){
 const row={engine,layout:m.layout,size,width,mode,failure};rows.push(row);const ctx=await browser.newContext({viewport:{width,height:1000},colorScheme:mode});const errors=[],failedRequests=[],injected=[];
 await ctx.addInitScript(mode=>localStorage.setItem('halo-butterfly-next.color-scheme',mode),mode);
 await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==m.halo)return route.abort();if(/^\/lab\/cover-.*\.webp$/.test(u.pathname)||failure==='cover-and-fallback'&&u.pathname==='/lab/avatar.svg'){injected.push(u.pathname);return route.fulfill({status:404,contentType:'text/plain',body:'Owned cover failure fixture'});}return route.continue();});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failedRequests.push({url:r.url(),failure:r.failure()?.errorText}));
 try{const response=await page.goto(m.halo,{waitUntil:'networkidle',timeout:30000});assert.equal(response.status(),200);const cover=page.locator('.essay > .item > .cover img').first();await page.locator('.essay > .item').first().scrollIntoViewIfNeeded();
 await cover.waitFor({state:'attached'});await page.waitForFunction(({failed})=>{const image=document.querySelector('.essay > .item > .cover img');return failed?image.classList.contains('image-failed')&&!image.hasAttribute('src'):image.complete&&image.naturalWidth>0&&new URL(image.src).pathname==='/lab/avatar.svg';},{failed:failure==='cover-and-fallback'},{timeout:15000});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert(injected.length>0);assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);assert.equal(await page.locator('html').getAttribute('data-color-scheme'),mode);
 row.actual=await page.evaluate(()=>{const icon=document.querySelector('.essay .publishTime i'),style=getComputedStyle(icon,'::before');const cards=[...document.querySelectorAll('.essay > .item')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});return {icon:{content:style.content,fontFamily:style.fontFamily,fontWeight:style.fontWeight},overflow:document.documentElement.scrollWidth-innerWidth,cards};});assert.equal(row.actual.icon.content,'"\uf073"');assert.equal(row.actual.icon.fontWeight,'400');assert(row.actual.overflow<=1);
 for(let i=0;i<row.actual.cards.length;i++)for(let j=i+1;j<row.actual.cards.length;j++){const a=row.actual.cards[i],b=row.actual.cards[j];assert(!(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1));}
 await page.screenshot({path:path.join(m.output,`${m.layout}-${engine}-${size}-${failure}.png`)});row.pass=true;
 }catch(e){row.pass=false;row.error=String(e.stack||e);row.errors=errors;row.failedRequests=failedRequests;await writeFile(path.join(m.output,`failed-${m.layout}-${engine}-${size}-${failure}.html`),await page.content());}finally{row.injected=injected;await ctx.close();}
 }
}finally{await browser.close();}}
await writeFile(path.join(m.output,`report-${m.layout}.json`),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify({layout:m.layout,total:rows.length,failed:rows.filter(r=>!r.pass).length}));
if(rows.some(r=>!r.pass))process.exitCode=1;
