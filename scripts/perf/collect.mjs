import {mkdir,readFile,writeFile,readdir,cp,rm} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import {ROOT,FIXTURE,RUNTIME,PIN,assert,options,ownRuntime,readJson,writeJson,sha256,treeDigest,machine,sourceIdentity,settings,safeName,localBase,evidence,digestObject} from './support.mjs';
import {longform} from './longform.mjs';
import {validateLhr} from './metrics.mjs';
const execute=promisify(execFile);
const args=options(process.argv.slice(2),['--lab-runtime','--package','--profile','--route','--cohort','--cpu-window','--limit']);
for(const required of ['lab-runtime','package','profile','route','cohort','cpu-window'])assert(args[required],'Missing --'+required);
assert(PIN.profiles.includes(args.profile),'Unknown profile');assert(PIN.routes.includes(args.route),'Unknown route');safeName(args.cohort);assert(args['cpu-window'].length>=5,'Record the coordinator-assigned exclusive CPU window');
const limit=Number(args.limit||10);assert(Number.isInteger(limit)&&limit>=1&&limit<=10,'--limit must be 1..10 (partial runs cannot pass)');
await ownRuntime();await longform();
const install=await readJson(path.join(RUNTIME,'installation.json'));
assert(install.lighthouse===PIN.lighthouse&&install.dependencyLockSha256===sha256(await readFile(path.join(FIXTURE,'pnpm-lock.yaml'))),'Tool lock changed; reinstall and remeasure both sides');
assert(sha256(await readFile(install.chrome.binary))===PIN.chrome.executableSha256&&install.chrome.version===PIN.chrome.version&&install.chrome.treeSha256===PIN.chrome.treeSha256&&await treeDigest(install.chrome.app)===PIN.chrome.treeSha256,'Pinned Chrome application changed');
const cli=path.join(RUNTIME,'deps/node_modules/lighthouse/cli/index.js');assert((await readJson(path.join(path.dirname(cli),'../package.json'))).version===PIN.lighthouse,'Installed Lighthouse changed');
const runner=sourceIdentity();assert(limit<10||runner.workingTreeClean,'Commit the exact runner before full sampling; dirty pilots remain incomplete');
const output=path.join(RUNTIME,'runs',args.cohort,args.profile,args.route),lock='/private/tmp/halo-butterfly-next-performance-cpu.lock';
await mkdir(lock);await writeJson(path.join(lock,'owner.json'),{pid:process.pid,runtime:RUNTIME,cpuWindow:args['cpu-window'],startedAt:new Date().toISOString()});
let report;
try{
 await mkdir(output,{recursive:true});assert((await readdir(output)).length===0,'Refusing to overwrite an existing performance run');
 const snapshot=async()=>JSON.parse((await execute('python3',[path.join(ROOT,'scripts/perf/station.py'),'inspect','--lab-runtime',path.resolve(args['lab-runtime']),'--package',path.resolve(args.package),'--profile',args.profile,'--route',args.route],{timeout:60000,maxBuffer:16*1024*1024})).stdout);
 const station=await snapshot();localBase(station.base);assert(station.result==='passed','Station preflight did not pass');
 await writeJson(path.join(output,'station.json'),station);await cp(path.resolve(args.package),path.join(output,'theme.zip'));
 const routes={...station.routes};
 // Warm the real Halo JVM/template routes without warming the future browser cache.
 for(const route of [args.route]){
  let target=new URL(routes[route],station.base),redirects=0;
  for(let count=0;count<3;count++){
   const response=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(15000)});
   if(response.status>=300&&response.status<400){const next=new URL(response.headers.get('location'),target);assert(next.origin===station.base,'Nonlocal warm-up redirect');target=next;count--;assert(++redirects<=3,'Too many redirects');continue;}
   assert(response.status===200&&response.headers.get('content-type')?.includes('text/html'),'Required route unavailable: '+route);
   const html=await response.text();assert(!/<title>[^<]*(?:Error|错误)|Whitelabel Error Page|Internal Server Error/i.test(html),'Error page in performance route');
   if(route==='longform')assert(html.includes('perf-section-20')&&html.includes('perf-end'),'Longform not rendered');
   if(route==='photos')assert(html.includes('合成图片')&&html.includes('/lab/'),'Gallery fixture not rendered');
   if(route==='public-layout')assert(html.includes('layout-probe-head-content'),'Real plugin-owned public page missing');
  }
  routes[route]=target.pathname+target.search;
 }
 const currentMachine=machine();assert(currentMachine.platform===PIN.chrome.platform&&currentMachine.arch===PIN.chrome.arch&&Number(process.versions.node.split('.')[0])===PIN.nodeMajor,'Wrong performance host/runtime');
 report={schema:1,kind:'performance-samples',result:'incomplete',contractAcceptance:false,profile:args.profile,route:args.route,requiredPlugins:station.requiredPlugins,actualPlugins:station.plugins,base:station.base,routes,identity:station.identity,runner,tools:{lighthouse:install.lighthouse,dependencyLockSha256:install.dependencyLockSha256,chrome:{version:install.chrome.version,executableSha256:install.chrome.executableSha256,treeSha256:install.chrome.treeSha256}},machine:currentMachine,cpuWindow:args['cpu-window'],startedAt:new Date().toISOString(),loadBefore:os.loadavg(),station:await evidence(path.join(output,'station.json'),output),artifact:await evidence(path.join(output,'theme.zip'),output),samples:[],limitations:['Cold fresh Chrome process per navigation; Halo warm-up is separate. No GUI/user browser is used.','Initial navigation network through Lighthouse gather completion, no scrolling or interaction; late async loading and failed-provider recovery require separate PERF-03 evidence.','Default home/longform have no enabled optional plugins; default gallery/public page enable only their route dependency. Recommended enables the fixed four-plugin combination. P/P+ in the acceptance contract are page sets, not these profiles.','--limit diagnostic runs and any missing/failed sample remain incomplete. Each route needs 10 samples; a complete two-profile cohort requires 80 samples.']};
 await writeJson(path.join(output,'report.json'),report);
 for(const route of [args.route])for(const device of PIN.devices)for(let index=0;index<5;index++){
  if(report.samples.length>=limit)continue;
  const directory=path.join(output,`${route}-${device}-${index}`);await mkdir(directory);const config=path.join(directory,'config.json');await writeJson(config,{extends:'lighthouse:default',settings:settings(device)});
  const requested=new URL(routes[route],station.base).href;
  const command=[cli,requested,'--output=json','--output-path='+path.join(directory,'lhr.json'),'--save-assets','--config-path='+config,'--chrome-flags=--headless=new','--chrome-flags=--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"','--port=0','--quiet'];
  // No inherited connection/profile flags, remote endpoint or user profile discovery.
  const env={...process.env,CHROME_PATH:install.chrome.binary,TMPDIR:directory,TMP:directory,TEMP:directory};
  for(const key of ['CHROME_FLAGS','LIGHTHOUSE_CHROMIUM_PATH','PUPPETEER_EXECUTABLE_PATH','PLAYWRIGHT_BROWSERS_PATH','SELENIUM_REMOTE_URL','LANTERN_DEBUG'])delete env[key];
  let child;const sample={route,device,index,status:'failed',requestedUrl:requested,startedAt:new Date().toISOString(),command:[process.execPath,...command]};
  try{
   const pending=execute(process.execPath,command,{cwd:directory,env,detached:true,timeout:180000,maxBuffer:16*1024*1024});child=pending.child;sample.processGroupPid=child?.pid;const result=await pending;await writeFile(path.join(directory,'stdout.log'),result.stdout);await writeFile(path.join(directory,'stderr.log'),result.stderr);
   const names=await readdir(directory),trace=names.filter(n=>n.endsWith('.trace.json')),devtools=names.filter(n=>n.endsWith('.devtoolslog.json'));assert(trace.length===1&&devtools.length===1,'Expected exactly one raw trace and devtools log');
   const lhr=await readJson(path.join(directory,'lhr.json'));sample.metrics=validateLhr(lhr,{url:requested,device});
   sample.lhr=await evidence(path.join(directory,'lhr.json'),output);sample.trace=await evidence(path.join(directory,trace[0]),output);sample.devtoolsLog=await evidence(path.join(directory,devtools[0]),output);sample.status='passed';
  }catch(error){sample.error=error.message;await writeFile(path.join(directory,'failure.log'),String(error.stdout||'')+'\n'+String(error.stderr||'')+'\n'+error.message);}finally{if(child?.pid){try{process.kill(-child.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}}}
  sample.finishedAt=new Date().toISOString();report.samples.push(sample);await writeJson(path.join(output,'report.json'),report);console.log(`${route}/${device}/${index+1}: ${sample.status}`);
 }
 const after=await snapshot();assert(digestObject(after)===digestObject(station),'Station identity/content/config/plugin state drifted during samples');report.stationUnchanged=true;report.finishedAt=new Date().toISOString();report.loadAfter=os.loadavg();report.result=report.samples.length===10&&report.samples.every(s=>s.status==='passed')?'complete-samples':'incomplete';await writeJson(path.join(output,'report.json'),report);console.log('Saved '+path.join(output,'report.json'));if(report.result!=='complete-samples')process.exitCode=2;
}catch(error){if(report){report.result='incomplete';report.error=error.message;await writeJson(path.join(output,'report.json'),report);}throw error;}finally{await rm(lock,{recursive:true,force:true});}
