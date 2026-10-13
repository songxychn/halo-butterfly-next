/** Generated bundles on synthetic pages, or real installed Halo fixture routes. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {browserEnvironment,RUNTIME,sha256,validateBaseUrl,validatePackage} from '../browser/support.mjs';
import {galleryBody} from '../../fixtures/gallery/content.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const output=resolve(process.env.GALLERY_OUTPUT || join(root,'.runtime/gallery/runs/'+Date.now()));
await mkdir(output,{recursive:true});
Object.assign(process.env,browserEnvironment());
const playwright=await import(pathToFileURL(join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
let base;
const startup=(await readFile(join(root,'templates/views/config.html'),'utf8')).match(/<script\b[^>]*\bid="baseScript"[^>]*>([^]*?)<\/script>/)?.[1];
assert(startup);
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,base || 'http://127.0.0.1');
  res.setHeader('Access-Control-Allow-Origin','*');
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(url.pathname.startsWith('/assets/')){
   const file=resolve(root,'templates','.'+url.pathname);assert(file.startsWith(join(root,'templates/assets')+'/'));
   res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile(file));return;
  }
  if(/^\/gallery-[0-2]\.svg$/.test(url.pathname)){
   const sizes=[[900,600],[400,800],[1200,400]][+url.pathname.match(/\d/)[0]];
   res.setHeader('Content-Type','image/svg+xml');res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${sizes[0]}" height="${sizes[1]}"><rect width="100%" height="100%" fill="#365e7a"/><circle cx="200" cy="200" r="120" fill="#edcf9a"/></svg>`);return;
  }
  if(url.pathname==='/missing.jpg'){res.writeHead(404);res.end();return;}
  if(url.pathname==='/missing-gallery.js'){res.writeHead(404);res.end();return;}
  if(url.pathname.endsWith('.json')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify([{url:'gallery-0.svg',alt:'远端 <img onerror="window.injected=1">',title:'远端标题'}, {url:'gallery-1.svg',alt:'竖图'}, {url:'gallery-2.svg',alt:'横图'}]));return;}
  const entry=url.pathname.includes('single')?'single':'post';
  const ordinary=url.pathname==='/ordinary';
  res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>正文图库</title><script>${startup}</script><link rel="stylesheet" href="/assets/css/${entry}.min.css"></head><body><div id="Butterfly" class="${entry}"><main class="main"><section class="content"><article class="render">${ordinary?'<h2>普通正文</h2>':galleryBody(base)}</article></section></main></div><script>Object.assign(MainApp.conf,{assets_link:'/assets/',style_mode:'user',enable_code:false,enable_h_icon:false});${url.searchParams.get('override')==='fail'?"MainApp.resources.option.gallery='/missing-gallery.js';":''}</script><script defer src="/assets/js/${entry}.min.js"></script></body></html>`);
 }catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise(r=>server.listen(Number(process.env.GALLERY_DATA_PORT || 0),'127.0.0.1',r));
base=`http://127.0.0.1:${server.address().port}`;
const info=process.argv[2]?JSON.parse(await readFile(resolve(process.argv[2]),'utf8')):null;
if(info){assert(info.owner==='halo-butterfly-next-gallery');assert(info.dataBase===base,'Fixture data server must use the recorded port');}
const origin=info?validateBaseUrl(info.base,JSON.parse(await readFile(join(info.runtime,'lab.json'),'utf8'))):base;
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const artifactSha256=sha256(await readFile(join(root,'dist/halo-butterfly-next-0.1.0-alpha.4.zip')));
if(info)validatePackage(JSON.parse(await readFile(join(info.runtime,'installed-package.json'),'utf8')),sourceSha,artifactSha256);
const report={sourceSha,artifactSha256,workingTreeClean:!execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),haloVersion:info?'2.26.1':null,startedAt:new Date().toISOString(),cases:[],limitations:['Headless browsers, not physical devices or actual Safari.','No full dual-site/1.0 acceptance.']};
if(!info)report.limitations.push('Synthetic generated pages, not installed Halo.');
try {
 for(const engine of ['chromium','firefox','webkit']){
  const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
  try {
   for(const width of [1440,390])for(const mode of ['light','dark'])for(const entry of ['post','single']){
    const context=await browser.newContext({viewport:{width,height:900},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
    const page=await context.newPage();const errors=[],requests=[];let retry=0;
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await context.addInitScript(mode=>localStorage.setItem('halo-butterfly-next.color-scheme',mode),mode);
    await page.route('**/*',route=>{
     const url=route.request().url();
     // Remote JSON has article-relative URLs, as in Butterfly; route the
     // synthetic image bytes on both the data server and real Halo origin.
     if(info && /\/gallery-[0-2]\.svg$/.test(new URL(url).pathname))return route.fetch({url:base+new URL(url).pathname}).then(response=>route.fulfill({response}));
     if(url===base+'/retry.json' && retry++===0)return route.fulfill({status:500,body:'synthetic failure',headers:{'Access-Control-Allow-Origin':'*'}});
     if(![base,origin].includes(new URL(url).origin) && !url.startsWith('data:'))return route.abort();
     return route.continue();
    });
    const result={engine,width,mode,entry,checks:[],status:'running'};report.cases.push(result);
    try {
     await page.goto(info?origin+info.routes[entry]:base+'/'+entry,{waitUntil:'load'});
     const gallery=page.locator('#button-gallery');
     await gallery.locator('.gallery-status').filter({hasText:'已加载 2 / 9'}).waitFor();
     assert.equal(await gallery.locator('.item').count(),2);assert.equal(await gallery.locator('.theme-lightbox-trigger').count(),2);
     assert(requests.filter(u=>new URL(u).pathname.endsWith('/js/gallery.min.js')).length===1);
     result.checks.push('first batch only; engine loaded once');
     await gallery.locator('button').focus();await page.keyboard.press('Enter');
     await gallery.locator('.gallery-status').filter({hasText:'已加载 5 / 9'}).waitFor();
     await gallery.locator('button').click();await gallery.locator('.gallery-status').filter({hasText:'已加载 8 / 9'}).waitFor();
     await gallery.locator('button').focus();await page.keyboard.press('Enter');
     await gallery.locator('.gallery-status').filter({hasText:'已加载 9 / 9'}).waitFor();
     await page.waitForFunction(()=>document.activeElement?.matches('#button-gallery .theme-lightbox-trigger'));
     assert.equal(await gallery.locator('button:visible').count(),0);result.checks.push('keyboard batches; final focus stays in gallery');
     await page.waitForFunction(()=>document.querySelector('#button-gallery .gallery-items').clientHeight>0);
     const geometry=await gallery.evaluate(g=>{
      const host=g.querySelector('.gallery-items').getBoundingClientRect();const items=[...g.querySelectorAll('.item')].map(i=>i.getBoundingClientRect());
      return items.every(i=>i.width>0 && i.height>0 && i.left>=host.left-1 && i.right<=host.right+1 && i.top>=host.top-1 && i.bottom<=host.bottom+1) && items.every((a,i)=>items.slice(i+1).every(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1));
     });assert(geometry);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));result.checks.push('mixed aspect ratios; no overlap or page overflow');
     await gallery.locator('.theme-lightbox-trigger').first().click();
     await page.locator('.theme-image-viewer').waitFor({state:'visible'});
     assert.equal(await page.locator('.viewer-list > li').count(),9);
     await page.keyboard.press('Escape');await page.locator('.theme-image-viewer').waitFor({state:'hidden'});result.checks.push('lightbox isolates gallery group and restores focus');
     await page.locator('#remote-gallery .gallery-status').filter({hasText:'已加载 2 / 3'}).waitFor();
     assert.equal(await page.evaluate(()=>window.injected),undefined);result.checks.push('remote relative URLs; metadata rendered as text');
     await page.locator('#retry-gallery button').filter({hasText:'重试'}).click();
     await page.locator('#retry-gallery .gallery-status').filter({hasText:'已加载 2 / 3'}).waitFor();result.checks.push('HTTP failure has usable retry');
     await page.locator('#bad-gallery [data-no-lightbox]').waitFor();assert.equal(await page.locator('#bad-gallery .theme-lightbox-trigger').count(),0);
     assert.equal(await page.locator('#empty-gallery .gallery-status').textContent(),'暂无图片');
     assert.match(await page.locator('#invalid-gallery .gallery-status').textContent(),/加载失败/);result.checks.push('bad image placeholder; empty/invalid JSON visible');
     assert.equal(await page.locator('figure.gallery-group .theme-lightbox-trigger').count(),0);
     assert.equal(await page.locator('figure.gallery-group a[aria-label="旅行相册"]').count(),1);result.checks.push('album card remains a native named link');
     await page.evaluate(()=>document.querySelector('#hidden-wrapper').style.display='block');
     await page.waitForFunction(()=>[...document.querySelectorAll('#hidden-gallery .item')].every(i=>i.getBoundingClientRect().width>0));result.checks.push('hidden gallery recovers after reveal');
     const auto=page.locator('#auto-gallery');
     for(let i=0;i<12;i++){
      await auto.locator('.gallery-sentinel').scrollIntoViewIfNeeded();
      const text=await auto.locator('.gallery-status').textContent();if(text.includes('18 / 18'))break;
      await page.waitForTimeout(100);
     }
     await auto.locator('.gallery-status').filter({hasText:'已加载 18 / 18'}).waitFor();assert.equal(await auto.locator('.item').count(),18);result.checks.push('automatic batches complete without duplicates');
     assert.deepEqual(errors,[]);result.status='passed';
     if(engine==='chromium')await page.screenshot({path:join(output,`${info?'halo':'synthetic'}-${entry}-${width}-${mode}.png`),fullPage:true});
    }catch(error){result.status='failed';result.error=error.message;throw error;}finally{await context.close();}
   }
   if(!info){
    const context=await browser.newContext({viewport:{width:320,height:844}});const page=await context.newPage();
    const result={engine,width:320,entry:'lifecycle',checks:[],status:'running'};report.cases.push(result);
    try{
     await page.route('**/pending.json',route=>new Promise(resolve=>{setTimeout(()=>route.fulfill({contentType:'application/json',body:'[]'}).catch(()=>{}).finally(resolve),1000);}));
     await page.goto(base+'/post');await page.locator('#button-gallery .gallery-status').filter({hasText:'已加载 2 / 9'}).waitFor();
     await page.evaluate(()=>{
      const root=document.querySelector('article.render');
      window[Symbol.for('halo-butterfly-next.article-gallery')](root);window[Symbol.for('halo-butterfly-next.article-gallery')](root);
     });
     assert.equal(await page.locator('#button-gallery .gallery-status').count(),1);result.checks.push('repeated initialization remains singular');
     await page.evaluate(()=>{
      const root=document.querySelector('article.render');const pending=document.createElement('div');pending.id='pending-gallery';pending.className='gallery-container';pending.dataset.type='url';
      const data=document.createElement('div');data.className='gallery-items';data.textContent='/pending.json';pending.append(data);root.append(pending);
      window[Symbol.for('halo-butterfly-next.article-gallery')](root);
      window[Symbol.for('halo-butterfly-next.page-scope')].dispose();delete window[Symbol.for('halo-butterfly-next.page-scope')];
     });
     await page.waitForTimeout(1100);
     assert.equal(await page.locator('#pending-gallery .gallery-status').count(),0);assert.equal(await page.locator('.gallery-container .item').count(),0);
     assert.match(await page.locator('#button-gallery .gallery-items').textContent(),/gallery-0.svg/);result.checks.push('cleanup cancels pending data and preserves input for reinitialization');
     await page.evaluate(()=>window[Symbol.for('halo-butterfly-next.article-gallery')](document.querySelector('article.render')));
     await page.locator('#button-gallery .gallery-status').filter({hasText:'已加载 2 / 9'}).waitFor();
     assert.equal(await page.locator('#button-gallery .gallery-status').count(),1);result.checks.push('reinitialization after cleanup reloads original data');
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));result.status='passed';
    }catch(error){result.status='failed';result.error=error.message;throw error;}finally{await context.close();}
   }
   console.log(engine+': gallery desktop/mobile light/dark post/single passed');
  }finally{await browser.close();}
 }
 // No-gallery route proves the heavyweight engine is not in ordinary article requests.
 if(!info){const browser=await playwright.chromium.launch({headless:true,channel:'chromium'});try{const page=await browser.newPage();const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base+'/ordinary');assert(!requests.some(u=>u.includes('/js/gallery.min.js')));report.cases.push({entry:'ordinary',status:'passed',checks:['no gallery engine request']});}finally{await browser.close();}}
 if(!info){
  const browser=await playwright.chromium.launch({headless:true,channel:'chromium'});
  try{
   const page=await browser.newPage();const requests=[];page.on('request',r=>requests.push(r.url()));
   await page.goto(base+'/post?override=fail');await page.locator('#button-gallery .gallery-status').filter({hasText:'已加载 2 / 9'}).waitFor();
   assert(requests.some(u=>u.endsWith('/missing-gallery.js')));assert(requests.some(u=>u.includes('/assets/js/gallery.min.js')));
   report.cases.push({entry:'resource-fallback',status:'passed',checks:['custom script native error falls back to bundle']});
   const nojs=await browser.newContext({javaScriptEnabled:false});const staticPage=await nojs.newPage();
   await staticPage.goto(base+'/post');assert.equal(await staticPage.locator('figure.gallery-group a[aria-label="旅行相册"]').count(),1);
   assert.equal(await staticPage.locator('#button-gallery .gallery-items').isVisible(),false);
   assert.match(await staticPage.locator('#button-gallery').evaluate(el=>getComputedStyle(el,'::after').content),/JavaScript/);
   report.cases.push({entry:'no-script',status:'passed',checks:['visible no-JS explanation and native album link']});await nojs.close();
  }finally{await browser.close();}
 }
}finally{report.finishedAt=new Date().toISOString();report.result=report.cases.length=== (info?24:30) && report.cases.every(c=>c.status==='passed')?'passed':'failed';await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});server.closeAllConnections();await new Promise(r=>server.close(r));console.log('Gallery report: '+output);}
