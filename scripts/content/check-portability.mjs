/** Temporarily activate fresh Halo's bundled Earth theme, then restore the candidate. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {validateBaseUrl} from '../browser/support.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const lab=resolve(process.env.LAB_RUNTIME || join(root,'.runtime/content/halo-lab'));
const runtime=resolve(process.env.CONTENT_BROWSER_RUNTIME || join(root,'.runtime/browser-matrix'));
const output=resolve(process.argv[2] || join(root,'.runtime/content/portability-runs',String(Date.now())));
await mkdir(output,{recursive:true});
const marker=JSON.parse(await readFile(join(lab,'lab.json')));
const base=validateBaseUrl(`http://127.0.0.1:${marker.ports.halo}/`,marker);
const fixture=JSON.parse(await readFile(join(lab,'content-fixture.json')));
const env={...process.env,LAB_RUNTIME:lab,HALO_PORT:String(marker.ports.halo),HEXO_PORT:String(marker.ports.hexo)};
const activate=command=>execFileSync('python3',['-B',join(root,'scripts/content/lab.py'),command],{cwd:root,env,encoding:'utf8'});
const temp=join(root,'.runtime/content/tmp');await mkdir(temp,{recursive:true});
Object.assign(process.env,{PLAYWRIGHT_BROWSERS_PATH:join(runtime,'browsers'),PLAYWRIGHT_SKIP_BROWSER_GC:'1',TMPDIR:temp,TMP:temp,TEMP:temp});
const pw=await import(pathToFileURL(join(runtime,'deps/node_modules/playwright/index.mjs')));
const report={sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),fixture,theme:'theme-earth',themeVersion:'1.15.3',checks:[],limitations:['Bundled Earth theme only; no assertion that every theme/editor preserves HTML.']};
let browser;
try{
 console.log(activate('theme-earth').trim());
 for(const engine of ['chromium','firefox','webkit']){
  browser=await pw[engine].launch({headless:true,env:process.env,...(engine==='chromium'?{channel:'chromium'}:{})});
  for(const [i,route] of fixture.routes.entries()){
   const viewport=i?{width:390,height:844}:{width:1440,height:1000};
   const context=await browser.newContext({viewport,locale:'zh-CN'});const page=await context.newPage();
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);
   const html=await response.text();assert(!html.includes('/themes/halo-butterfly-next/'),'must actually use a different theme');
   for(const id of ['docker-text','local-target','nested-target'])assert.equal(await page.locator('#'+id).isVisible(),true);
   assert.equal(await page.locator('.content-tab-list').count(),0);
   assert.equal(await page.locator('#photo-gallery figure').first().locator('a').getAttribute('href'),'/lab/cover-turquoise-coast.webp');
   assert.equal(await page.locator('#group-gallery figcaption').first().isVisible(),true);
   assert.equal(await page.locator('[data-content-cards] a').count(),2);
   assert.equal(await page.locator('ol[data-content-timeline] > li').count(),2);
   await page.locator('#answer-details summary').click();assert.equal(await page.locator('#answer-target').isVisible(),true);
   await page.locator('#content-tabs').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:join(output,`${engine}-${i?'mobile-page':'desktop-post'}.png`)});
   report.checks.push({engine,route,viewport,status:'passed'});await context.close();
  }
  await browser.close();browser=null;
 }
 report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);process.exitCode=1;console.error(report.error);}
finally{
 await browser?.close();
 try{console.log(activate('theme-current').trim());report.restoredCandidate=true;}
 catch(error){report.status='failed';report.restoreError=String(error);process.exitCode=1;}
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,output}));
}
