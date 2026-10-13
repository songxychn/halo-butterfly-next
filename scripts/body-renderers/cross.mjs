/** Only this task's owned Halo: charts/scores and gallery on the same article/page. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer,request} from 'node:http';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {REPO,RUNTIME,browserEnvironment,sha256} from '../browser/support.mjs';
const seed=`import sys,json,html;sys.path.insert(0,'scripts/body-renderers');import lab
assert json.loads((lab.lab.RUNTIME/'lab.json').read_text()).get('owner')=='halo-butterfly-next-comparison'
assert lab.lab.owned_process('halo')
c=lab.lab.Client();good,bad=lab.content()
images=[{'url':'/lab/cover.svg','alt':'横图'},{'url':'/lab/avatar.svg','alt':'方图'}]
body=good+'<div id="mixed-gallery" class="gallery-container" data-type="data" data-button="true" data-first="1" data-limit="1"><div class="gallery-items">'+html.escape(json.dumps(images))+'</div></div>'
for plural,kind,key,name in [('posts','Post','post','body-gallery-cross-v2'),('singlepages','SinglePage','page','body-gallery-cross-page-v2')]:
 console='/apis/api.console.halo.run/v1alpha1/'+plural
 try:
  existing=c.api('/apis/content.halo.run/v1alpha1/'+plural+'/'+name)
  assert c.api(console+'/'+name+'/release-content')['content']==body,'Fixture changed; preserve it'
 except lab.lab.ApiError as e:
  if e.status!=404:raise
  c.api(console,'POST',{key:{'apiVersion':'content.halo.run/v1alpha1','kind':kind,'metadata':{'name':name},'spec':{'title':'正文图表乐谱与图库交叉','slug':name,'owner':c.auth['username'],'allowComment':False,'deleted':False,'publish':False,'pinned':False,'priority':0,'visible':'PUBLIC','excerpt':{'autoGenerate':True},'cover':'','tags':[],'categories':[]}},'content':{'content':body,'raw':body,'rawType':'HTML'}})
  c.api(console+'/'+name+'/publish','PUT')
print('Cross fixtures ready')`;
execFileSync('python3',['-c',seed],{cwd:REPO,stdio:['ignore','pipe','inherit']});
const installed=JSON.parse(await readFile(REPO+'/.runtime/body-renderers/halo-lab/installed-package.json'));
const digest=sha256(await readFile(REPO+'/dist/halo-butterfly-next-0.1.0-alpha.4.zip'));assert.equal(installed.sha256,digest);
const proxy=createServer((req,res)=>{if(!['GET','HEAD'].includes(req.method)&&!(req.method==='POST'&&req.url==='/apis/api.halo.run/v1alpha1/trackers/counter')){res.writeHead(405).end();return;}const up=request({hostname:'127.0.0.1',port:18531,path:req.url,method:req.method,agent:false,headers:{...req.headers,host:'127.0.0.1:18531',connection:'close'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});up.on('error',()=>res.writeHead(502).end());req.pipe(up);});
await new Promise(r=>proxy.listen(18535,'127.0.0.1',r));
const report={sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:REPO,encoding:'utf8'}).trim(),packageSha256:digest,transport:'diagnostic upstream Connection: close',results:[]};
const env=browserEnvironment();Object.assign(process.env,env);const pw=createRequire(RUNTIME+'/deps/package.json')('playwright');
try {
 for(const engine of ['chromium','firefox','webkit']) {
  const browser=await pw[engine].launch({headless:true,env,...engine==='chromium'?{channel:'chromium'}:{}});
  try {for(const width of [1440,390])for(const mode of ['light','dark'])for(const route of ['/archives/body-gallery-cross-v2/','/body-gallery-cross-page-v2/']) {
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();const result={engine,width,mode,route,status:'running',errors:[]};report.results.push(result);page.on('pageerror',e=>result.errors.push(e.message));
   try {
    await page.goto('http://127.0.0.1:18535'+route,{waitUntil:'domcontentloaded'});await page.evaluate(mode=>MainApp.useTheme.setMode(mode),mode);
    await page.waitForFunction(()=>document.querySelectorAll('[data-render-state=rendered]').length===6&&document.querySelector('#mixed-gallery .item'));
    assert.equal(await page.locator('#mixed-gallery .item').count(),1);await page.locator('#mixed-gallery button').click();await page.waitForFunction(()=>document.querySelectorAll('#mixed-gallery .item').length===2);
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#mixed-gallery .item img')).length===2&&Array.from(document.querySelectorAll('#mixed-gallery .item img')).every(img=>img.complete&&img.naturalWidth>0)&&document.querySelectorAll('#mixed-gallery .theme-lightbox-trigger').length===2);
    await page.locator('#mixed-gallery .theme-lightbox-trigger').first().click();await page.locator('.theme-image-viewer').waitFor({state:'visible'});assert.equal(await page.locator('.viewer-list > li').count(),2);await page.keyboard.press('Escape');await page.locator('.theme-image-viewer').waitFor({state:'hidden'});
    assert.equal(await page.locator('.theme-render-output > svg').count(),4);assert.equal(await page.locator('.theme-render-output canvas').count(),2);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(result.errors,[]);result.status='passed';
   }catch(e){result.status='failed';result.failure=e.message;}
   finally{await context.close();}
  }}finally{await browser.close();}
 }
}finally{proxy.close();await writeFile(REPO+'/.runtime/body-renderers/cross-report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report.results));if(report.results.some(r=>r.status!=='passed'))process.exitCode=1;
