/** Invoked while umami-check.py owns the synthetic upstream and lab configuration. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {RUNTIME, browserEnvironment, validateBaseUrl} from '../browser/support.mjs';
assert(process.env.LAB_RUNTIME&&process.env.BASE_URL,'Parent runner must specify its owned lab');
const identity=JSON.parse(await readFile(path.join(process.env.LAB_RUNTIME,'lab.json'),'utf8'));
const base=validateBaseUrl(process.env.BASE_URL,identity);
Object.assign(process.env,browserEnvironment());
const {chromium}=await import(pathToFileURL(path.join(RUNTIME,'deps/node_modules/playwright/index.mjs')));
const browser=await chromium.launch({headless:true,channel:'chromium'});
try {
 const context=await browser.newContext();
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const page=await context.newPage();
 const requests=[];
 page.on('request',request=>requests.push(request));
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('[data-umami-stat="site_uv"]')?.textContent==='120');
 for(const [key,value] of Object.entries({site_uv:'120',site_pv:'456'})) {
  const nodes=await page.locator(`[data-umami-stat="${key}"]`).allTextContents();
  assert(nodes.length>0,key);assert(nodes.every(text=>text===value),key);
 }
 assert(!(await page.content()).includes('platform-demand-synthetic-key'));
 await page.goto(base+'/archives/demand-none/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('[data-umami-stat="page_pv"]')?.textContent==='78');
 const stats=requests.filter(request=>request.url().includes('/apis/api.umami.halo.run/v1alpha1/stats'));
 assert.equal(stats.length,2);
 assert.equal(new URL(stats[0].url()).searchParams.get('path'),null);
 assert.equal(new URL(stats[1].url()).searchParams.get('path'),'/archives/demand-none/');
 for(const request of stats){const headers=await request.allHeaders();assert(!headers.authorization&&!headers.cookie);}
 assert(!(await page.content()).includes('platform-demand-synthetic-key'));
 console.log('Umami theme: home site UV 120/PV 456, post PV 78; one anonymous same-origin request per page; no credential in HTML');
 await context.close();
} finally {await browser.close();}
