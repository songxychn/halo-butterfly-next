import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {RUNTIME,browserEnvironment,validateBaseUrl,sha256} from '../browser/support.mjs';
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i]]=process.argv[i+1];
for(const key of ['--runtime','--package','--plugin','--output'])assert(args[key],key+' required');assert.equal(args['--allow-synthetic-writes'],'yes');
const read=async f=>JSON.parse(await readFile(f,'utf8'));
const runtime=await realpath(args['--runtime']);assert(!path.relative(path.resolve('.runtime'),runtime).startsWith('..'));
const base=validateBaseUrl(process.env.BASE_URL,await read(path.join(runtime,'lab.json')));
assert.equal((await read(path.join(runtime,'moments-fixture.json'))).owner,'halo-butterfly-next-moments-fixture');
const installed=await read(path.join(runtime,'installed-package.json'));assert.equal(installed.sha256,sha256(await readFile(args['--package'])));
const plugin=await readFile(args['--plugin']);assert.equal(sha256(plugin),'96ec593d97912f6f3069cc184004389459ac842cea20212eb664c2ca19862f86');
Object.assign(process.env,browserEnvironment());const pw=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')).href);
const authFile=path.join(runtime,'moments-auth.private.json');assert.equal((await stat(authFile)).mode&0o077,0);const auth=await read(authFile);
const admin=await pw.request.newContext({baseURL:base,storageState:{cookies:auth.cookies,origins:[]},extraHTTPHeaders:{'X-CSRF-TOKEN':auth.csrf}});
async function api(url,method='get',data){const r=await admin[method](url,data?{data}:{});assert(r.ok(),`${method} ${url}: ${r.status()}`);return r.status()===204?null:r.json();}
const pluginPath='/apis/plugin.halo.run/v1alpha1/plugins/PluginLinks';const current=await admin.get(pluginPath);
if(current.status()===404){const r=await admin.post('/apis/api.console.halo.run/v1alpha1/plugins/install',{multipart:{file:{name:'plugin-links-2.3.0.jar',mimeType:'application/java-archive',buffer:plugin}}});assert(r.ok());}
else {assert(current.ok());assert.equal((await current.json()).spec.version,'2.3.0');}
await api('/apis/api.console.halo.run/v1alpha1/plugins/PluginLinks/plugin-state','put',{enable:true,async:false});
const owner='halo-butterfly-next-site-content-fixture';
async function ensure(plural,kind,name,spec){const endpoint='/apis/core.halo.run/v1alpha1/'+plural;const existing=await admin.get(endpoint+'/'+name);if(existing.ok()){assert.equal((await existing.json()).metadata.labels['site-content-fixture'],owner);return;}assert.equal(existing.status(),404);await api(endpoint,'post',{apiVersion:'core.halo.run/v1alpha1',kind,metadata:{name,labels:{'site-content-fixture':owner}},spec});}
await ensure('linkgroups','LinkGroup','site-content-group',{displayName:'本地测试分组',priority:0});
for(let i=1;i<=4;i++)await ensure('links','Link','site-content-link-'+i,{displayName:'本地链接 '+i,url:base+'/about-preview/?link='+i,logo:base+'/lab/avatar.svg',description:'本地描述 '+i,groupName:'site-content-group',priority:i});
const remote=[{name:'远端分组 <b>文字</b>',description:'远端组说明 <script>window.siteContentXss=1</script>',links:[{name:'远端一',url:base+'/about-preview/?remote=1',logo:'/lab/avatar.svg',description:'说明1'},{name:'远端二',url:base+'/about-preview/?remote=2',logo:'/lab/nonexistent.svg',description:'坏图应保留卡片'},{name:'远端三',url:base+'/?remote=3',description:'无图回退'}]}];
await writeFile(path.join(runtime,'halo/data/attachments/lab/site-content-links.json'),JSON.stringify(remote));
const configPath='/apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config';const original=await api(configPath);const config=structuredClone(original);
config.aside.social_position='both';config.aside.social=[{name:'测试社交',link:base+'/about-preview/',icon:'<i class="fas fa-star"></i><script>window.siteContentXss=2</script>',color:'#aa1122',dark_color:'#ffddee'},{name:'非法社交',link:'javascript:window.siteContentXss=3',icon:'<img src="x" onerror="window.siteContentXss=4">',color:'red;position:fixed'}];
config.footer.columns=[{width:2,sections:[{title:'导航分组一',items:[{title:'安全链接',url:'/about-preview/',html:''},{title:'非法链接仍为文字',url:'javascript:window.siteContentXss=5',html:''},{title:'',url:'',html:'<p><strong>列内富文本</strong><a href="javascript:window.siteContentXss=6">危险</a><img src="x" onerror="window.siteContentXss=7"></p>'}]}]},{width:1,sections:[{title:'导航分组二',items:[{title:'纯文本',url:'',html:''}]}]}];
config.footer.custom_html='<p><em>页脚富文本</em><a title="current-hash" href="#footer">页内</a><a title="relative-link" href="./relative">相对</a><a href="/about-preview/" onclick="window.siteContentXss=8">页面</a><iframe src="/login"></iframe><script>window.siteContentXss=9</script></p>';
config.links={random_order:true,group_descriptions:[{group:'site-content-group',description:'本地组说明\n第二行 <b>按文字显示</b>'}],source:'/lab/site-content-links.json'};
const out=path.resolve(args['--output']);await mkdir(out,{recursive:true});
const report={schema:1,startedAt:new Date().toISOString(),installed,plugins:{PluginLinks:'2.3.0'},checks:[],screenshots:[],limitations:['Synthetic local data and headless engines only; no full-release, real-device or external-availability acceptance.']};
const check=async(name,fn)=>{const row={name};report.checks.push(row);try{await fn();row.pass=true;}catch(e){row.pass=false;row.error=String(e.stack||e);throw e;}finally{await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}};
async function goto(p,route){const r=await p.goto(base+route,{waitUntil:'networkidle',timeout:30000});assert.equal(r.status(),200);await p.waitForFunction(()=>!!window.MainApp?.useCommon);}
try {
 await api(configPath,'put',config);
 for(const engine of ['chromium','firefox','webkit']){
  const browser=await pw[engine].launch({headless:true,env:browserEnvironment(),...(engine==='chromium'?{channel:'chromium'}:{})});
  try{
   for(const width of [1440,390])for(const scheme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:width===390?844:1000},colorScheme:scheme,locale:'zh-CN'});await context.addInitScript(s=>localStorage.setItem('halo-butterfly-next.color-scheme',s),scheme);await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));const label=`${engine}-${width}-${scheme}`;
    await check(label+' social placement/colors, footer columns and sanitized HTML',async()=>{
     await goto(p,'/');assert.equal(await p.locator('html').getAttribute('data-color-scheme'),scheme);assert.equal(await p.locator('.above-info .theme-social').count(),1);assert.equal(await p.locator('.aside-user .theme-social').count(),1);
     for(const selector of ['.above-info .theme-social','.aside-user .theme-social']){const link=p.locator(selector+' a').first();assert.equal(await link.evaluate(el=>getComputedStyle(el).color),scheme==='dark'?'rgb(255, 221, 238)':'rgb(170, 17, 34)');assert.equal(await p.locator(selector+' a').nth(1).getAttribute('href'),null);assert.equal(await p.locator(selector+' script,'+selector+' [onerror]').count(),0);}
     assert.equal(await p.locator('.footer-columns > .footer-flex-items').count(),2);assert.equal(await p.locator('[data-footer-grow]').first().evaluate(el=>getComputedStyle(el).flexGrow),'2');assert.equal(await p.locator('.footer-columns strong').textContent(),'列内富文本');assert.equal(await p.locator('.footer_custom_text em').textContent(),'页脚富文本');assert.equal(await p.locator('[data-site-html] script,[data-site-html] iframe,[data-site-html] [onclick],[data-site-html] [onerror],[data-site-html] [href^="javascript:"]').count(),0);assert.equal(await p.evaluate(()=>window.siteContentXss||0),0);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
     if(engine==='chromium'){await p.locator('.footer-columns').scrollIntoViewIfNeeded();const file=label+'-footer.png';await p.screenshot({path:path.join(out,file)});report.screenshots.push(file);}
    });
    await check(label+' native descriptions, remote grouped cards, bad-image fallback and random membership',async()=>{
     await goto(p,'/links');await p.waitForSelector('[data-links-state="loaded"]');assert.equal(await p.locator('[data-site-html] a[title="current-hash"]').getAttribute('href'),base+'/links#footer');assert.equal(await p.locator('[data-site-html] a[title="relative-link"]').getAttribute('href'),base+'/relative');assert.match(await p.locator('.groups:not(.remote-links) .group-description').textContent(),/本地组说明/);assert.equal(await p.locator('[data-link-list][data-link-shuffled=true]').count(),1);assert.equal(await p.locator('[data-link-list] > .link').count(),4);assert.deepEqual((await p.locator('[data-link-list] .n').allTextContents()).sort(),['本地链接 1','本地链接 2','本地链接 3','本地链接 4']);assert.equal(await p.locator('[data-links-items] .link').count(),3);assert.equal(await p.locator('[data-links-items] script').count(),0);assert.match(await p.locator('[data-links-items] .group-description').textContent(),/<script>/);assert.equal(await p.evaluate(()=>window.siteContentXss||0),0);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
     const bad=p.locator('[data-links-items] .link').filter({has:p.locator('.n',{hasText:'远端二'})});await bad.scrollIntoViewIfNeeded();await p.waitForFunction(()=>!document.querySelector('[data-links-items] img[src$="nonexistent.svg"]'));assert.equal(await bad.locator('.friend-initial').isVisible(),true);
     if(engine==='chromium'){await p.locator('[data-remote-links]').scrollIntoViewIfNeeded();const file=label+'-links.png';await p.screenshot({path:path.join(out,file)});report.screenshots.push(file);}
    });await context.close();
   }
   const context=await browser.newContext();await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const p=await context.newPage();
   await check(engine+' empty/invalid/error remote data preserves native cards and retries',async()=>{
    for(const mode of ['empty','invalid','error']){await p.route('**/lab/site-content-links.json',r=>r.fulfill(mode==='empty'?{json:[]}:mode==='invalid'?{json:[{name:'bad',links:[{name:'x',url:'javascript:bad'}]}]}:{status:503,body:'unavailable'}));await goto(p,'/links');await p.waitForSelector(mode==='empty'?'[data-links-state="loaded"]':'[data-links-state="failed"]');assert.equal(await p.locator('[data-link-list] .link').count(),4);if(mode==='empty'){assert.equal(await p.locator('[data-links-items] .link').count(),0);await p.unroute('**/lab/site-content-links.json');}else{assert.equal(await p.locator('[data-links-retry]').isVisible(),true);await p.unroute('**/lab/site-content-links.json');await p.locator('[data-links-retry]').click();await p.waitForSelector('[data-links-state="loaded"]');}}
   });await context.close();
  }finally{await browser.close();}
 }
 const browser=await pw.chromium.launch({headless:true,channel:'chromium',env:browserEnvironment()});
 try{
  const context=await browser.newContext();const p=await context.newPage();
  await check('social placement options and hidden hero fallback',async()=>{
   for(const position of ['aside','header','none']){config.aside.social_position=position;await api(configPath,'put',config);await goto(p,'/');assert.equal(await p.locator('.above-info .theme-social').count(),position==='header'?1:0);assert.equal(await p.locator('.aside-user .theme-social').count(),position==='aside'?1:0);}
   config.aside.social_position='header';config.image.disable_top_img=true;await api(configPath,'put',config);await goto(p,'/');assert.equal(await p.locator('.content > .theme-social').count(),1);
  });await context.close();
  const plain=await browser.newContext({javaScriptEnabled:false});const q=await plain.newPage();
  await check('no-script footer/link/social content remains safe and native links readable',async()=>{
   const r=await q.goto(base+'/links');assert.equal(r.status(),200);assert.equal(await q.locator('[data-link-list] .link[href]').count(),4);assert.equal(await q.locator('[data-site-html] script,[data-site-html] iframe,[data-social-icon] script').count(),0);assert.match(await q.locator('.footer_custom_text[data-site-html]').textContent(),/页脚富文本/);assert.equal(await q.locator('.footer-columns a[href^="javascript:"]').count(),0);
  });await plain.close();
 }finally{await browser.close();}
}finally{await api(configPath,'put',original);await admin.dispose();report.finishedAt=new Date().toISOString();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(x=>!x.pass).length,out}));
