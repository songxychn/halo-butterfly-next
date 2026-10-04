/** Isolated real-browser regression; no Halo, existing browser, or external writes. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve, join, dirname} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {build} from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runtime = resolve(process.env.LIGHTBOX_BROWSER_RUNTIME || join(root, '.runtime/browser-matrix'));
const output = resolve(process.argv[2] || join(root, '.evidence/lightbox/run-' + Date.now()));
await mkdir(dirname(output), {recursive: true});
await mkdir(output);
process.env.PLAYWRIGHT_BROWSERS_PATH = join(runtime, 'browsers');
process.env.PLAYWRIGHT_SKIP_BROWSER_GC = '1';
const temp = join(root, '.runtime/lightbox/tmp');
await mkdir(temp, {recursive: true});
Object.assign(process.env, {TMPDIR: temp, TMP: temp, TEMP: temp});
const playwright = await import(pathToFileURL(join(runtime, 'deps/node_modules/playwright/index.mjs')));
const axeSource = process.env.LIGHTBOX_AXE_PATH ? await readFile(process.env.LIGHTBOX_AXE_PATH, 'utf8') : null;
const entry = join(output, 'entry.js');
await writeFile(entry, `import AmplifyImg from ${JSON.stringify(join(root, 'src/js/modules/AmplifyImg.ts'))}; window.initializeLightbox=()=>new AmplifyImg();window.initializeLightbox();`);
const result = await build({configFile:false,logLevel:'error',build:{write:false,target:'es2022',lib:{entry,name:'LightboxFixture',formats:['iife']}}});
const bundle = (Array.isArray(result) ? result[0] : result).output.find(x=>x.type==='chunk').code;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#367"/><circle cx="400" cy="300" r="180" fill="#ec8"/></svg>';
const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>Lightbox fixture</title><style>body{margin:0}.content{max-width:700px}img{width:180px}a,button{margin:10px}</style></head><body><button id="outside">outside</button><div id="was-inert" inert>previous inert</div><main class="main"><section class="content"><img id="one" src="/one.svg" alt="第一张"><img id="two" src="/two.svg" alt="第二张"><a id="linked" href="/full.svg"><img src="/thumb.svg" alt="原图链接"></a><a id="external" href="/destination"><img src="/external.svg" alt="外链"></a><a id="download" href="/download.svg" download><img src="/download.svg" alt="下载"></a><span data-lightbox-group="separate"><img id="grouped" src="/group.svg" alt="分组图片"></span><a id="multi" href="/full.svg"><img id="multi-first" src="/multi-first.svg" alt="共享链接第一张"><img id="multi-second" src="/multi-second.svg" alt="共享链接第二张"></a><img id="lazy" src="/placeholder.svg" data-lazy-src="/lazy.svg" alt="延迟原图"></section></main><script src="/bundle.js"></script></body></html>`;
const server = createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':req.url.endsWith('.svg')?'image/svg+xml':'text/html');res.end(req.url==='/bundle.js'?bundle:req.url.endsWith('.svg')?svg:html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base = `http://127.0.0.1:${server.address().port}`;
const digest = value => createHash('sha256').update(value).digest('hex');
const report = {sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTreeClean:!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),viewer:'1.14.0',runnerSha256:digest(await readFile(fileURLToPath(import.meta.url))),bundleSha256:digest(bundle),checks:[],limitations:['Synthetic page, not installed Halo or actual Safari/phone hardware.']};
let browser;
try {
  for (const engine of ['chromium','firefox','webkit']) {
    browser = await playwright[engine].launch({headless:true,...(engine==='chromium'?{channel:'chromium'}:{})});
    for (const width of [1440,390]) {
      const context = await browser.newContext({viewport:{width,height:900},...(engine==='chromium'&&width===390?{hasTouch:true}:{})});
      const page = await context.newPage();
      const errors=[];page.on('pageerror', e=>errors.push(e.message));
      await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
      await page.goto(base);
      const trigger = page.locator('#one').locator('..');
      const dialog = page.locator('.theme-image-viewer');
      const activeImage = page.locator('.viewer-canvas > img');
      const waitViewed = ()=>activeImage.waitFor({state:'visible'});
      await page.evaluate(()=>{window.initializeLightbox();window.initializeLightbox()});
      assert.equal(await page.locator('style[data-theme-lightbox]').count(),1);
      assert.equal(await page.locator('.theme-lightbox-trigger .theme-lightbox-trigger').count(),0);
      assert.equal(await page.locator('#external').getAttribute('class'),null);
      assert.equal(await page.locator('#download').getAttribute('class'),null);
      await trigger.focus();await page.keyboard.press('Enter');await waitViewed();
      assert.equal(await dialog.getAttribute('role'),'dialog');
      assert(await page.locator('#outside').evaluate(e=>e.inert||e.closest('[inert]')!==null));
      for(let i=0;i<24;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('.theme-lightbox')))}
      await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.viewer-canvas>img')?.alt==='第二张');
      await page.getByRole('button',{name:'向右旋转',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.viewer-canvas>img').style.transform.includes('rotate(90deg)'));
      await page.getByRole('button',{name:'水平翻转',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.viewer-canvas>img').style.transform.includes('scaleX(-1)'));
      await page.getByRole('button',{name:'垂直翻转',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.viewer-canvas>img').style.transform.includes('scaleY(-1)'));
      await page.getByRole('button',{name:'原始尺寸',exact:true}).click();
      await page.waitForFunction(()=>parseFloat(document.querySelector('.viewer-canvas>img').style.width)===1200);
      await page.getByRole('button',{name:'缩小',exact:true}).click();
      await page.waitForFunction(()=>parseFloat(document.querySelector('.viewer-canvas>img').style.width)<1200);
      await page.getByRole('button',{name:'重置',exact:true}).click();
      await page.getByRole('button',{name:'显示或隐藏缩略图',exact:true}).focus();await page.keyboard.press('Enter');
      assert(await page.locator('.viewer-navbar').evaluate(e=>e.hidden));
      await page.keyboard.press('Space');assert.equal(await page.locator('.viewer-navbar').evaluate(e=>e.hidden),false);
      await page.getByRole('button',{name:'播放幻灯片',exact:true}).click();
      await page.locator('.viewer-player:not(.viewer-hide)').waitFor();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
      assert(await trigger.evaluate(e=>document.activeElement===e));
      assert.equal(await page.locator('#outside').evaluate(e=>e.inert),false);
      assert(await page.locator('#was-inert').evaluate(e=>e.inert));
      await page.locator('#linked').click();await waitViewed();assert((await activeImage.getAttribute('src')).endsWith('/full.svg'));
      await page.getByRole('button',{name:'关闭图片',exact:true}).click();await dialog.waitFor({state:'detached'});
      assert(await page.locator('#linked').evaluate(e=>document.activeElement===e));
      await page.locator('#grouped').click();await waitViewed();assert.equal(await page.locator('.viewer-list>li').count(),1);
      await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
      await page.locator('#lazy').click();await waitViewed();assert((await activeImage.getAttribute('src')).endsWith('/lazy.svg'));
      await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
      await page.evaluate(()=>{const i=document.createElement('img');i.id='dynamic';i.src='/dynamic.svg';i.alt='<img src=x onerror=alert(1)>';document.querySelector('.content').append(i)});
      await page.locator('#dynamic').locator('..').getAttribute('role');
      await page.locator('#dynamic').click();await waitViewed();
      assert.equal(await page.locator('.viewer-title img').count(),0);
      assert((await page.locator('.viewer-title').textContent()).includes('<img src=x'));
      if (axeSource) {
        await page.addScriptTag({content:axeSource});
        const axe = await page.evaluate(async()=>({version:window.axe.version,...await window.axe.run('.theme-lightbox',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})}));
        await writeFile(join(output,`${engine}-${width}-axe.json`),JSON.stringify(axe,null,2));
        assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
        report.checks.push({engine,width,result:axe.incomplete.length?'needs-manual-review':'passed',axeVersion:axe.version,violations:axe.violations.length,incomplete:axe.incomplete.length});
        if (axe.incomplete.length) process.exitCode=2;
      }
      await page.screenshot({path:join(output,`${engine}-${width}.png`)});
      await page.locator('.viewer-canvas').click({position:{x:5,y:80}});await dialog.waitFor({state:'detached'});
      assert(await page.locator('#dynamic').locator('..').evaluate(e=>document.activeElement===e));
      if(engine==='chromium'&&width===390){
        await page.locator('#one').tap();await waitViewed();
        const cdp=await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:320,y:450}]});
        for(let x=300;x>=60;x-=30)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:450}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await page.waitForFunction(()=>document.querySelector('.viewer-canvas>img')?.alt==='第二张');
        const before=await activeImage.evaluate(e=>parseFloat(e.style.width));
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:160,y:450},{id:2,x:230,y:450}]});
        for(let n=0;n<5;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:150-n*20,y:450},{id:2,x:240+n*20,y:450}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await page.waitForFunction(w=>parseFloat(document.querySelector('.viewer-canvas>img').style.width)>w,before);
        await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
        await cdp.detach();
        report.checks.push({engine,width,result:'passed',behaviors:['touch-tap','touch-swipe','touch-pinch']});
      }
      await page.locator('#multi-second').click();await waitViewed();
      assert.equal(await activeImage.getAttribute('alt'),'共享链接第二张');
      assert((await page.locator('.viewer-title').textContent()).includes('共享链接第二张'));
      assert.equal(await page.locator('#multi').getAttribute('aria-label'),'查看图片组（2 张）');
      await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
      assert(await page.locator('#multi').evaluate(e=>document.activeElement===e));
      await page.keyboard.press('Enter');await waitViewed();
      assert.equal(await activeImage.getAttribute('alt'),'共享链接第一张');
      await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
      await page.locator('#external').click();await page.waitForURL(base+'/destination');
      assert.deepEqual(errors,[]);
      report.checks.push({engine,width,result:'passed',behaviors:['reinitialize','keyboard-open','focus-trap','arrows','rotate','flips','one-to-one','zoom','reset','thumbnails','slideshow','escape','close-button','backdrop','focus-return','image-links','shared-anchor-selected-image','external/download-links','groups','lazy-url','dynamic-image','safe-title']});
      await context.close();
    }
    await browser.close();browser=null;
  }
} catch(error){report.error=error.stack;process.exitCode=1;console.error(error)} finally {await browser?.close();await new Promise(r=>server.close(r));report.result=process.exitCode===1?'failed':process.exitCode===2?'needs-manual-review':'passed';await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
