/** Installed-package checks against a fresh, explicitly owned loopback Halo lab. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateBaseUrl,validatePackage} from '../browser/support.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const lab=resolve(process.env.LAB_RUNTIME || join(root,'.runtime/content/halo-lab'));
const runtime=resolve(process.env.CONTENT_BROWSER_RUNTIME || join(root,'.runtime/browser-matrix'));
const output=resolve(process.argv[2] || join(root,'.runtime/content/halo-runs',String(Date.now())));
await mkdir(output,{recursive:true});
const marker=JSON.parse(await readFile(join(lab,'lab.json')));
const base=validateBaseUrl(`http://127.0.0.1:${marker.ports.halo}/`,marker);
const installed=JSON.parse(await readFile(join(lab,'installed-package.json')));
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty=!!execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8'}).trim();
assert.equal(dirty,false,'Commit the implementation before binding installed-package evidence');
const sha=value=>createHash('sha256').update(value).digest('hex');
validatePackage(installed,sourceSha,sha(await readFile(join(root,'dist',installed.name))));
const content=JSON.parse(await readFile(join(lab,'content-fixture.json')));
assert.equal(content.sha256,sha(await readFile(join(root,'fixtures/content-extensions/article.html'))));
const report={sourceSha,sourceDirty:dirty,installed,fixture:content,haloVersion:'2.26.1',checks:[],limitations:['Authenticated Halo HTML API input; not a GUI editor save/reopen roundtrip.','No actual phone/Safari/screen-reader acceptance or full Hexo tag parity.']};
const temp=join(root,'.runtime/content/tmp');await mkdir(temp,{recursive:true});
Object.assign(process.env,{PLAYWRIGHT_BROWSERS_PATH:join(runtime,'browsers'),PLAYWRIGHT_SKIP_BROWSER_GC:'1',TMPDIR:temp,TMP:temp,TEMP:temp});
const pw=await import(pathToFileURL(join(runtime,'deps/node_modules/playwright/index.mjs')));
const failures=[];let browser;
try{
 for(const pageType of ['post','single'])for(const ext of ['css','js']){
  const pathname=`/themes/halo-butterfly-next/assets/${ext}/${pageType}.min.${ext}`;
  const response=await fetch(base+pathname,{signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200);assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(await readFile(join(root,'templates/assets',ext,`${pageType}.min.${ext}`))));
 }
 for(const engine of ['chromium','firefox','webkit']){
  browser=await pw[engine].launch({headless:true,env:process.env,...(engine==='chromium'?{channel:'chromium'}:{})});
  for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}])for(const color of ['light','dark'])for(const route of content.routes){
   const name=`${engine}-${viewport.name}-${color}-${route.includes('archives')?'post':'page'}`;
   const result={name,engine,viewport:viewport.name,color,route,errors:[],requestFailures:[]};
   const context=await browser.newContext({viewport,locale:'zh-CN',colorScheme:color});
   await context.addInitScript(color=>localStorage.setItem('halo-butterfly-next.color-scheme',color),color);
   const page=await context.newPage();page.setDefaultTimeout(15000);
   page.on('pageerror',e=>result.errors.push(e.message));page.on('requestfailed',r=>result.requestFailures.push({url:r.url(),error:r.failure()?.errorText}));
   try{
    const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);
    await page.waitForFunction(()=>document.querySelector('#deploy-tabs')?.hasAttribute('data-content-tabs-ready') && window.MainApp?.modules?.Render);
    assert.equal(await page.locator('html').getAttribute('data-color-scheme'),color);
    assert.equal(await page.locator('#docker-panel').isVisible(),true);assert.equal(await page.locator('#local-panel').isVisible(),false);
    const tabs=page.locator('#deploy-tabs > .content-tab-list');await tabs.getByRole('tab',{name:'Docker 部署',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#local-target').isVisible(),true);
    await tabs.getByRole('tab',{name:'Docker 部署',exact:true}).click();await page.locator('#jump-nested').click();assert.equal(await page.locator('#nested-target').isVisible(),true);
    await page.locator('#jump-answer').click();assert.equal(await page.locator('#answer-target').isVisible(),true);
    assert.equal(await page.locator('#photo-gallery').evaluate(e=>getComputedStyle(e).display),'grid');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    const photo=page.locator('#photo-gallery figure').first().locator('a');await photo.click();await page.locator('.theme-image-viewer').waitFor({state:'visible'});
    assert.equal(await page.locator('.viewer-list > li').count(),2);await page.keyboard.press('Escape');await page.locator('.theme-image-viewer').waitFor({state:'detached'});
    await page.locator('#content-tabs').scrollIntoViewIfNeeded();await page.screenshot({path:join(output,name+'.png')});
    assert.deepEqual(result.errors,[]);assert.deepEqual(result.requestFailures,[]);result.status='passed';
   }catch(error){result.status='failed';result.error=String(error.stack||error);failures.push(name);}
   finally{await context.close();report.checks.push(result);await writeFile(join(output,'progress.json'),JSON.stringify(report,null,2)+'\n');console.log(name+': '+result.status);}
  }
  // No theme script: all authored content remains readable in actual Halo output.
  const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();await page.goto(base+content.routes[0],{waitUntil:'domcontentloaded',timeout:30000});
  for(const id of ['docker-text','local-target','nested-target'])assert.equal(await page.locator('#'+id).isVisible(),true);
  await page.locator('#answer-details summary').click();assert.equal(await page.locator('#answer-target').isVisible(),true);
  report.checks.push({engine,mode:'no-js',status:'passed'});await context.close();await browser.close();browser=null;
 }
 report.status=failures.length?'failed':'passed';if(failures.length)process.exitCode=1;
}catch(error){report.status='failed';report.error=String(error.stack||error);process.exitCode=1;console.error(report.error);}
finally{await browser?.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,output}));}
