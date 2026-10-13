/** Owned headless browser regression for navigation lifecycle and loading options. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {browserEnvironment, RUNTIME, REPO} from '../browser/support.mjs';
Object.assign(process.env,browserEnvironment());
const {chromium,firefox,webkit}=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const startup=(await readFile(path.join(REPO,'templates/views/config.html'),'utf8')).match(/<script[^>]*id="baseScript"[^>]*>([\s\S]*?)<\/script>/)[1];
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#367"/></svg>';
function fixture(url) {
  const post=url.pathname==='/post/'; const entry=post?'post':url.pathname==='/plugin/'?'plugin':'index';
  const native=url.searchParams.get('native')!=='false',lazy=url.searchParams.get('lazy')!=='false';
  return `<!doctype html><html lang="zh-CN" data-theme-navigation="1"><head><meta charset="UTF-8"><title>${entry}</title><meta name="description" content="${entry}"><link rel="canonical" href="${url.pathname}">
  <script data-theme-script="config" id="baseScript">${startup};Object.assign(MainApp.conf,{assets_link:'/assets/',style_mode:'user',pjax_enable:${url.searchParams.get('pjax')!=='false'},pjax_exclude:'/excluded/',instantpage:true,snackbar_enable:true,snackbar_position:'bottom-right',enable_aside:false,enable_webInfo:false,lazyload_enable:${lazy},lazyload_native:${native},lazyload_blur:true,enable_above:false,enable_subtitle:false,enable_code:true,enable_code_copy:true});MainApp.prismSource='/assets/plugins/prism/prism.min.js';</script>
  <link rel="stylesheet" href="/assets/css/${entry}.min.css"><style>body{margin:0}.main{display:block!important}.content{width:100%!important}.spacer{height:1500px}a,button{margin:8px}#mobile-navigation{position:fixed;right:0;top:0;z-index:9;background:white}</style>
  ${url.pathname==='/unsafe/'?'<script type="text/ecmascript">window.pluginCounter=(window.pluginCounter||0)+1</script>':''}</head><body>
  <div id="Butterfly" class="${entry}"><header class="header"><nav class="nav"><div class="nav-title"><a href="/">Home</a></div><ul class="menu"><li><a href="/post/">Post</a></li></ul><div class="controls"><button class="bars">Menu</button></div></nav></header><div id="mobile-navigation" hidden inert><button class="side-bar-close">Close</button><a href="/post/">Post</a></div><div class="mask" hidden></div>
  <main class="main"><section class="content"><h1>${entry}</h1><div class="home-layout"><a id="next" href="${post?'/':'/post/'}">Next</a><a id="excluded" href="/excluded/">Excluded</a><a id="unsafe" href="/unsafe/">Plugin</a><a id="failure" href="/failure/">Failure</a><a id="slow" href="/slow/">Slow</a><a id="missing-css" href="/missing-css/">Bad CSS</a><a id="jump" href="/post/#chapter">Chapter</a></div><button id="darkmode">Mode</button>
  ${post?'<article class="render"><h2 id="chapter">Chapter</h2><pre><code class="language-javascript">const example = 1;</code></pre><img src="/image.svg" alt="photo"></article>':''}
  <div class="spacer"></div><img id="late-image" data-theme-image data-lazy-src="/image.svg?late" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="late"><div class="spacer"></div></section></main></div>
  <script data-theme-script="entry" defer src="/assets/js/${entry}.min.js"></script></body></html>`;
}
let base;
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,base);
    if(url.pathname==='/favicon.ico'){res.statusCode=204;res.end();return;}
    if(url.pathname==='/image.svg'){res.setHeader('Content-Type','image/svg+xml');res.end(svg);return;}
    if(url.pathname.startsWith('/assets/')){
      const file=path.resolve(REPO,'templates','.'+url.pathname);assert(file.startsWith(path.join(REPO,'templates/assets')+path.sep));
      res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/octet-stream');res.end(await readFile(file));return;
    }
    if(url.pathname==='/slow/') await new Promise(resolve=>setTimeout(resolve,1200));
    res.setHeader('Content-Type','text/html; charset=utf-8');
    if(url.pathname==='/failure/') res.statusCode=500;
    let html=fixture(url);
    if(url.pathname==='/missing-css/') html=html.replace('/assets/css/index.min.css','/assets/css/missing.css');
    res.end(html);
  }catch {res.statusCode=404;res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
const results=[];let browser;
try {
  for(const [engine,api] of Object.entries({chromium,firefox,webkit})) {
    if (process.env.ENGINE && process.env.ENGINE!==engine) continue;
    browser=await api.launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
    for(const width of [1440,390]) {
      const context=await browser.newContext({viewport:{width,height:900}});
      const page=await context.newPage();const errors=[];page.on('console',message=>{if(process.env.DEBUG_NAV) console.log(engine,width,message.text());});page.on('pageerror',error=>{errors.push(error.message);console.log(engine,width,'PAGE ERROR',error.message,error.stack);});
      await page.goto(base);await page.waitForFunction(()=>!!window.MainApp?.useCommon);
      await page.evaluate(()=>window.navigationSentinel='persistent');
      console.log(engine,width,'cycles');
      for(let i=0;i<6;i++) {
        await page.locator('#next').click();
        await page.waitForFunction(()=>!document.documentElement.classList.contains('theme-navigating')&&!!window.MainApp?.useCommon);
        assert.equal(await page.evaluate(()=>window.navigationSentinel),'persistent',`${engine}: navigation stayed in document`);
        assert.equal(await page.title(),i%2===0?'post':'index');
        if(i%2===0) {await page.waitForSelector('.code-toolbar');assert.equal(await page.locator('.code-toolbar').count(),1);}
        if(width===390){await page.locator('.bars').click();assert.equal(await page.locator('.bars').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('.bars').getAttribute('aria-expanded'),'false');}
        await page.locator('#darkmode').click();
        assert.equal(await page.locator('html').getAttribute('data-color-scheme'),i%2===0?'dark':'light');
        assert.equal(await page.locator('.theme-notice').count(),1);
        assert.equal(await page.locator('meta[name=description]').getAttribute('content'),i%2===0?'post':'index');
      }
      console.log(engine,width,'history');
      await page.evaluate(()=>{const a=document.createElement('a');a.href='/plugin/';document.body.append(a);a.click();});
      await page.waitForFunction(()=>document.title==='plugin'&&!document.documentElement.classList.contains('theme-navigating'));
      assert.equal(await page.evaluate(()=>window.navigationSentinel),'persistent','Script-free public plugin layout supports its theme lifecycle');
      await page.locator('#next').click();await page.waitForFunction(()=>document.title==='post'&&!document.documentElement.classList.contains('theme-navigating'));
      await page.locator('#next').click();await page.waitForFunction(()=>document.title==='index'&&!document.documentElement.classList.contains('theme-navigating'));
      await page.evaluate(()=>scrollTo({top:650,behavior:'instant'}));await page.waitForFunction(()=>history.state?.butterflyNavigation?.y>=600);
      await page.locator('#next').evaluate(el=>el.click());await page.waitForFunction(()=>document.title==='post'&&!document.documentElement.classList.contains('theme-navigating'));
      await page.goBack();await page.waitForFunction(()=>document.title==='index'&&!document.documentElement.classList.contains('theme-navigating'));
      assert((await page.evaluate(()=>scrollY))>=600,engine+' scroll history');
      await page.goForward();await page.waitForFunction(()=>document.title==='post'&&!document.documentElement.classList.contains('theme-navigating'));
      assert.equal(await page.evaluate(()=>window.navigationSentinel),'persistent');
      await page.evaluate(()=>MainApp.useMessage.info('<img src=x onerror=alert(1)>'));
      assert.equal(await page.locator('.theme-notice img').count(),0);
      await page.locator('.theme-notice button').last().click();
      console.log(engine,width,'fallbacks');
      for(const link of ['excluded','unsafe','failure','missing-css']) {
        console.log(engine,width,'fallback',link);
        await page.goto(base);await page.waitForFunction(()=>!!MainApp.useCommon);await page.evaluate(()=>window.navigationSentinel='persistent');
        await page.locator('#'+link).click();await page.waitForFunction(()=>window.navigationSentinel===undefined);
      }
      await page.goto(base);await page.waitForFunction(()=>!!MainApp.useCommon);await page.evaluate(()=>window.navigationSentinel='persistent');
      console.log(engine,width,'race');
      await page.locator('#slow').click();await page.locator('#next').click();
      await page.waitForFunction(()=>document.title==='post'&&!document.documentElement.classList.contains('theme-navigating'));
      await page.waitForTimeout(1400);assert.equal(new URL(page.url()).pathname,'/post/');assert.equal(await page.evaluate(()=>window.navigationSentinel),'persistent');
      console.log(engine,width,'images');
      await page.goto(base+'/?native=false');await page.waitForFunction(()=>!!MainApp.useCommon);
      assert(await page.locator('#late-image').getAttribute('data-lazy-src'));
      await page.locator('#late-image').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('#late-image').dataset.lazySrc);
      await page.goto(base+'/?lazy=false&native=false');await page.waitForFunction(()=>!!MainApp.useCommon);
      assert.equal(await page.locator('#late-image').getAttribute('data-lazy-src'),null);
      assert.equal(await page.locator('#late-image').getAttribute('loading'),'eager');
      console.log(engine,width,'prefetch');
      await page.goto(base+'/?pjax=false');await page.waitForFunction(()=>!!MainApp.useCommon);await page.evaluate(()=>window.navigationSentinel='persistent');
      await page.locator('#next').focus();await page.waitForSelector('link[rel=prefetch]',{state:'attached'});
      await page.locator('#next').click();await page.waitForFunction(()=>window.navigationSentinel===undefined);
      assert.deepEqual(errors,[],`${engine}/${width}`);
      results.push({engine,width,cycles:6,status:'passed'});await context.close();
    }
    await browser.close();browser=null;console.log(engine+': desktop/mobile navigation checks passed');
  }
  await mkdir(path.join(REPO,'.runtime/navigation-loading'),{recursive:true});
  await writeFile(path.join(REPO,'.runtime/navigation-loading/browser.json'),JSON.stringify({results,limitation:'Synthetic theme pages; real Halo verified separately.'},null,2)+'\n');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
