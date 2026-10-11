import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { browserEnvironment, RUNTIME, REPO, sha256 } from '../browser/support.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((list, item, i, all) => i % 2 ? list : [...list, [item.replace(/^--/, ''), all[i + 1]]], []));
if (!['baseline', 'candidate'].includes(args.phase)) throw new Error('--phase baseline|candidate required');
const lab = path.resolve(process.env.LAB_RUNTIME || path.join(REPO, '.runtime/math/halo-lab'));
const marker = JSON.parse(await readFile(path.join(lab, 'lab.json')));
assert.equal(marker.owner, 'halo-butterfly-next-comparison');
const base = `http://127.0.0.1:${marker.ports.halo}`;
const installed = JSON.parse(await readFile(path.join(lab, 'installed-package.json')));
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {cwd:REPO,encoding:'utf8'}).trim();
const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:REPO,encoding:'utf8'}).trim();
const fixtures = JSON.parse(await readFile(path.join(REPO, 'fixtures/math/content.json')));
const env = browserEnvironment();
Object.assign(process.env, env);
const require = createRequire(path.join(RUNTIME, 'deps/package.json'));
const pw = require('playwright');
const output = path.join(REPO, '.runtime/math/runs', args.label || args.phase);
await mkdir(output, {recursive:true});
const results=[];
const routes = args.routes === 'core' ? ['/archives/math-inherit/', '/math-page/'] : args.phase === 'baseline' ? ['/archives/math-inherit/'] : ['/archives/math-inherit/', '/math-page/', '/archives/math-off/', '/math-page-off/', '/archives/math-on/', '/math-page-on/'];
const globalOn = args.global !== 'off';
for (const engine of (args.engine ? [args.engine] : ['chromium','firefox','webkit'])) {
 const browser = await pw[engine].launch({headless:true,env,...(engine==='chromium'?{channel:'chromium'}:{})});
 try {
 for (const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]) {
 for (const color of ['light','dark']) {
 for (const route of routes) {
 const name = `${engine}-${viewport.name}-${color}-${route.split('/').filter(Boolean).at(-1)}`;
 const context=await browser.newContext({viewport,locale:'zh-CN',colorScheme:color});
 const page=await context.newPage();
 const result={name,route,engine,viewport,color,failures:[],errors:[],resources:[]};
 page.on('pageerror',e=>result.errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('plugin-katex'))result.resources.push({url:r.url(),status:r.status()});});
 if (args.resources === 'blocked') await page.route('**/plugins/plugin-katex/**',r=>r.abort());
 await page.addInitScript(color=>localStorage.setItem('halo-butterfly-next.color-scheme',color),color);
 try {
  const response=await page.goto(base+route,{waitUntil:'networkidle',timeout:30000});
  assert.equal(response.status(),200);
  await page.locator('#math-inline').waitFor({state:'attached'});
  // Theme setting is authoritative for screenshots; exercise its normal toggle if needed.
  
  await page.evaluate(color=>{window.MainApp.useTheme.setMode(color);},color).catch(()=>{});
  await page.waitForTimeout(150);
  result.state=await page.evaluate(()=>({conf:window.MainApp.conf,htmlClasses:document.documentElement.className,colorScheme:document.documentElement.dataset.colorScheme}));
  assert.equal(result.state.colorScheme,color);
  result.native=await page.evaluate(()=>({count:document.querySelectorAll('article.render math').length,annotations:[...document.querySelectorAll('article.render annotation')].map(e=>e.textContent),number:document.querySelector('#math-numbered math').textContent,prose:document.querySelector('article.render p').textContent}));
  assert.equal(result.native.count,8);
  assert.deepEqual(result.native.annotations,fixtures.map(f=>f.tex));
  assert.ok(result.native.number.includes('(7)'));
  assert.ok(result.native.prose.includes('$5'));
  if(args.phase==='candidate') {
   const enabled=route.includes('-off')?false:route.includes('-on')?true:globalOn;
   assert.equal(result.state.conf.math_enabled,enabled);
   result.layout=await page.evaluate(()=>{
    const long=document.querySelector('#math-long').closest('.theme-math-block')?.querySelector('.theme-math-scroll');
    return {shells:document.querySelectorAll('.theme-math-block,.theme-math-inline').length,buttons:document.querySelectorAll('.theme-math-copy').length,source:document.querySelectorAll('[data-math-source-view]').length,bodyWidth:document.documentElement.scrollWidth,viewport:innerWidth,long:long&&{width:long.clientWidth,scroll:long.scrollWidth,tabIndex:long.tabIndex,color:getComputedStyle(long).color},code:document.querySelector('article.render pre').textContent};
   });
   assert.equal(result.layout.shells,8);
   assert.equal(result.layout.buttons,7);
   assert.equal(result.layout.source,enabled?0:8);
   assert.ok(result.layout.bodyWidth<=result.layout.viewport+1,'formula widens page');
   assert.ok(result.layout.long.scroll>result.layout.long.width,'fixture must overflow locally');
   assert.equal(result.layout.long.tabIndex,0);
   assert.ok(result.layout.code.includes('$x$'));
   const scroll=page.locator('#math-long').locator('..');
   await scroll.focus();await page.keyboard.press('ArrowRight');
   await page.waitForFunction(()=>document.querySelector('#math-long').parentElement.scrollLeft>0,{},{timeout:5000});
   await page.evaluate(()=>{window.__copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copied.push(text)}});});
   await page.locator('#math-fraction').locator('../..').locator('.theme-math-copy').click();
   assert.deepEqual(await page.evaluate(()=>window.__copied),[fixtures[1].tex]);
   assert.equal(await page.locator('#math-fraction').locator('../..').locator('[role=status]').textContent(),'已复制');
   await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('denied');};});
   await page.locator('#math-fraction').locator('../..').locator('.theme-math-copy').click();
   assert.ok((await page.locator('#math-fraction').locator('../..').locator('[role=status]').textContent()).includes('复制失败'));
   const selection=await page.evaluate(()=>{
    const node=document.querySelector('#math-inline'),r=document.createRange();r.selectNodeContents(node);getSelection().removeAllRanges();getSelection().addRange(r);
    let written='';const data=new DataTransfer();Object.defineProperty(data,'setData',{value:(type,value)=>{if(type==='text/plain')written=value;}});
    const event=new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:data});node.dispatchEvent(event);
    return {text:written,prevented:event.defaultPrevented};
   });
   assert.deepEqual(selection,{text:fixtures[0].tex,prevented:true});
   if(engine==='chromium' && viewport.name==='desktop' && color==='light' && route.endsWith('math-inherit/')) {
    const built=await Bun.build({entrypoints:[path.join(REPO,'src/js/core/math.ts')],target:'browser',format:'esm'});
    const script=await built.outputs[0].text();
    await page.evaluate(async script=>{
     const mod=await import(URL.createObjectURL(new Blob([script],{type:'text/javascript'})));
     const article=document.querySelector('article.render'),math=article.querySelector('math');
     // The existing binding must be idempotent and retain the exact semantic node.
     mod.enhanceMath(article,{});mod.enhanceMath(article,{});
     if(math!==article.querySelector('math'))throw new Error('math identity changed');
     window.__mathModule=mod;
     const extra=document.createElement('span');extra.className='math-inline';extra.id='late-math';extra.textContent='<img src=x onerror=alert(1)> \\alpha';article.append(extra);
    },script);
    await page.waitForFunction(()=>document.querySelector('#late-math').closest('.theme-math-inline'));
    assert.equal(await page.locator('#late-math img').count(),0);
    assert.equal(await page.locator('.theme-math-block,.theme-math-inline').count(),9);
    await page.evaluate(()=>document.querySelector('#late-math').closest('.theme-math-inline').remove());
    const optionsCheck=await page.evaluate(()=>{
     const root=document.createElement('article');root.className='render';
     const raw=document.createElement('span');raw.className='math-inline';raw.textContent='<img src=x> \\alpha';
     const plain=document.createElement('p');plain.textContent='$20 and ordinary text';root.append(raw,plain);document.body.append(root);
     const original=raw;const dispose=window.__mathModule.enhanceMath(root,{enabled:false,copyTex:false,hideScrollbar:true});
     window.__mathModule.enhanceMath(root,{enabled:false,copyTex:false});
     const range=document.createRange();range.setStart(raw.firstChild,0);range.setEnd(raw.firstChild,2);getSelection().removeAllRanges();getSelection().addRange(range);
     const event=new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:new DataTransfer()});raw.dispatchEvent(event);
     const data={same:root.querySelector('.math-inline')===original,source:root.querySelector('.theme-math-source').textContent,buttons:root.querySelectorAll('button').length,shells:root.querySelectorAll('.theme-math-inline').length,hidden:raw.hasAttribute('data-math-source-view'),images:root.querySelectorAll('img').length,partialPrevented:event.defaultPrevented,plain:plain.textContent};
     dispose();root.remove();return data;
    });
    assert.deepEqual(optionsCheck,{same:true,source:'<img src=x> \\alpha',buttons:0,shells:1,hidden:true,images:0,partialPrevented:false,plain:'$20 and ordinary text'});
   }
  }
  assert.deepEqual(result.errors,[]);
  if(args.resources !== 'blocked') assert.ok(result.resources.every(r=>r.status===200), 'plugin resource error');
  if(route==='/archives/math-inherit/') {
   await page.locator('#math-fixtures').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
  }
 } catch(error) {result.failures.push(String(error));}
 result.status=result.failures.length?'failed':'passed';results.push(result);
 console.log(name,result.status,result.failures.join('; '));
 await context.close();
 }
 }
 }
 } finally {await browser.close();}
}
const report={head,dirty:Boolean(dirty),installed,pluginLock:JSON.parse(await readFile(path.join(REPO,'fixtures/math/versions.json'))),phase:args.phase,global:globalOn,resources:args.resources||'normal',results};
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log('Results:',results.filter(r=>r.status==='passed').length+'/'+results.length,output);
if(results.some(r=>r.status==='failed'))process.exitCode=1;
