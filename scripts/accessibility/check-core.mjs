/** Automated WCAG rule scan on owned Halo core routes; never a manual accessibility sign-off. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {validateBaseUrl,requestPolicy,ROUTES} from '../browser/support.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
assert.ok(process.env.LAB_RUNTIME,'Explicit LAB_RUNTIME required');const lab=resolve(process.env.LAB_RUNTIME);
const base=validateBaseUrl(process.env.BASE_URL,JSON.parse(await readFile(join(lab,'lab.json'))));
const installed=await readFile(join(lab,'installed-package.json'),'utf8');
const runtime=join(root,'.runtime/browser-matrix'),axeRoot=join(root,'.runtime/plugin-a11y/node_modules/axe-core');
assert.equal(JSON.parse(await readFile(join(axeRoot,'package.json'))).version,'4.12.1');
const axePath=join(axeRoot,'axe.min.js');process.env.PLAYWRIGHT_BROWSERS_PATH=join(runtime,'browsers');
const {chromium}=await import(pathToFileURL(join(runtime,'deps/node_modules/playwright/index.mjs')));
const output=resolve(process.argv[2]||join(root,'.runtime/accessibility',String(Date.now())));await mkdir(output,{recursive:true});
const report={theme:JSON.parse(installed),axeVersion:'4.12.1',axeSha256:createHash('sha256').update(await readFile(axePath)).digest('hex'),base,scope:'Core ten routes, Chromium, desktop/mobile light/dark, automated WCAG 2 A/AA, 2.1 AA, 2.2 AA rules. No screen reader, physical device, visual/interaction/manual WCAG conformance claim.',cases:[]};
const browser=await chromium.launch({headless:true,channel:'chromium'});report.browserVersion=browser.version();
try{
 for(const width of [1440,390])for(const mode of ['light','dark'])for(const route of ROUTES){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},colorScheme:mode,locale:'zh-CN',storageState:{cookies:[],origins:[{origin:base,localStorage:[{name:'halo-butterfly-next.color-scheme',value:mode}]}]}});
  const page=await context.newPage();const row={width,mode,route,errors:[],blocked:[]};page.on('pageerror',e=>row.errors.push(e.message));
  await context.route('**/*',r=>{if(requestPolicy(r.request().url(),r.request().method(),base)==='blocked'){row.blocked.push(r.request().url());return r.abort();}return r.continue();});
  try{
   const response=await page.goto(base+route,{waitUntil:'networkidle',timeout:30000});assert.equal(response.status(),200);
   await page.waitForFunction(()=>document.fonts.status==='loaded'&&!document.body.classList.contains('loading'));assert.equal(await page.locator('html').getAttribute('data-color-scheme'),mode);
   await page.addScriptTag({path:axePath});const audit=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
   row.violations=audit.violations;row.incomplete=audit.incomplete;row.passRuleCount=audit.passes.length;row.status=audit.violations.length||row.errors.length||row.blocked.length?'failed':'passed';
  }catch(error){row.status='failed';row.error=String(error.stack||error);}
  finally{await context.close();report.cases.push(row);await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({width,mode,route,status:row.status,violations:row.violations?.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length})),error:row.error}));}
 }
 assert.equal(await readFile(join(lab,'installed-package.json'),'utf8'),installed,'Installed candidate changed during audit');
 report.status=report.cases.every(x=>x.status==='passed')?'passed':'failed';if(report.status==='failed')process.exitCode=1;
}finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
