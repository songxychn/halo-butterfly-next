import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PIN,assert,readJson,readEvidence,readEvidenceBytes,writeJson,digestObject,sha256,validateProfile,localBase} from './support.mjs';
import {validateLhr,summarize,budgets} from './metrics.mjs';

async function readEnvelope(directory,profile,route){
 const run=await readJson(path.join(directory,'report.json'));assert(run.schema===1&&run.profile===profile&&run.route===route&&['complete-samples','incomplete'].includes(run.result),'Incomplete/wrong profile run');
 assert(Array.isArray(run.samples)&&run.samples.every(s=>s.route===route&&PIN.devices.includes(s.device)),'Unknown route/device sample coverage');
 assert(run.identity&&run.tools&&run.machine&&run.stationUnchanged===true&&run.runner?.workingTreeClean===true&&/^[a-f0-9]{40}$/.test(run.runner?.sourceSha||''),'Missing run identity or stable station proof');
 assert(/^[a-f0-9]{40}$/.test(run.identity.sourceSha),'Missing exact source identity');
 for(const key of ['packageSha256','haloJarSha256','fixtureSha256','configSha256','contentSha256','pluginsSha256','pluginConfigSha256'])assert(/^[a-f0-9]{64}$/.test(run.identity[key]||''),'Missing exact run identity: '+key);
 assert(run.tools.lighthouse===PIN.lighthouse&&run.tools.chrome?.version===PIN.chrome.version&&run.tools.chrome?.executableSha256===PIN.chrome.executableSha256&&run.tools.chrome?.treeSha256===PIN.chrome.treeSha256,'Unpinned browser or Lighthouse identity');
 localBase(run.base);
 const station=await readEvidence(directory,run.station);assert(digestObject(station.identity)===digestObject(run.identity)&&station.profile===profile&&station.route===route&&station.base===run.base,'Station evidence identity mismatch');
 assert(sha256(await readEvidenceBytes(directory,run.artifact))===run.identity.packageSha256,'Actual package bytes do not match declared identity');
 validateProfile(station,profile,route);assert(digestObject(run.actualPlugins)===digestObject(station.plugins)&&digestObject(run.requiredPlugins)===digestObject(station.requiredPlugins),'Route/plugin manifest differs from raw station evidence');
 return run;
}
async function readCell(directory,run,route,device){
 const entries=run.samples.filter(s=>s.device===device);assert(entries.length===PIN.samples&&new Set(entries.map(s=>s.index)).size===PIN.samples&&entries.every(s=>Number.isInteger(s.index)&&s.index>=0&&s.index<PIN.samples&&s.status==='passed'),'Missing/duplicate/extra/failed sample');
 const collected=[];
 for(const s of entries){
  const lhr=await readEvidence(directory,s.lhr),trace=await readEvidence(directory,s.trace),devtools=await readEvidence(directory,s.devtoolsLog);
  assert(Array.isArray(trace.traceEvents)&&trace.traceEvents.length>0,'Missing raw trace events');assert(Array.isArray(devtools)&&devtools.some(x=>x.method==='Network.requestWillBeSent'),'Missing raw network protocol log');
  const url=new URL(run.routes[route],run.base).href;collected.push(validateLhr(lhr,{url,device}));
 }
 assert(new Set(collected.map(s=>s.resolvedConfigHash)).size===1,'Resolved sample configurations differ');
 return {median:summarize(collected),resolvedConfigHash:collected[0].resolvedConfigHash};
}
// Strict full-run reader remains available to callers requiring all ten samples.
export async function readRun(directory,profile,route){
 const run=await readEnvelope(directory,profile,route);
 assert(run.result==='complete-samples'&&run.samples.length===PIN.devices.length*PIN.samples,'Missing/extra sample coverage or incomplete run');
 const values={};for(const device of PIN.devices)values[route+'/'+device]=await readCell(directory,run,route,device);
 return {run,values};
}
function cohortKey(run){return {sourceSha:run.identity.sourceSha,packageSha256:run.identity.packageSha256,configSha256:run.identity.configSha256,haloJarSha256:run.identity.haloJarSha256,base:run.base,tools:run.tools,machine:run.machine,runner:run.runner};}
async function readCohort(root,side,incomplete){
 const runs=new Map();
 for(const profile of PIN.profiles)for(const route of PIN.routes){
  const directory=path.join(root,profile,route);
  try{
   const run=await readEnvelope(directory,profile,route),values={};
   runs.set(profile+'/'+route,{run,values});
   for(const device of PIN.devices){
    try{values[route+'/'+device]=await readCell(directory,run,route,device);}
    catch(error){incomplete.push({side,profile,route,device,reason:error.message});}
   }
  }catch(error){incomplete.push({side,profile,route,reason:error.message});}
 }
 // Never choose whichever mixed-source route happened to be read first.
 if(new Set([...runs.values()].map(({run})=>digestObject(cohortKey(run)))).size>1){
  incomplete.push({side,reason:'Mixed source/package/config/tools within '+side+' cohort'});runs.clear();
 }
 return runs;
}
export async function compare(baseline,candidate){
 const report={schema:1,kind:'performance-budget-comparison',result:'incomplete',contractAcceptance:false,candidateAbsoluteCases:[],cases:[],failures:[],incomplete:[]};
 const candidates=await readCohort(candidate,'candidate',report.incomplete);
 const baselines=await readCohort(baseline,'baseline',report.incomplete);
 const failed=new Set(),expected=PIN.profiles.length*PIN.routes.length*PIN.devices.length;
 for(const profile of PIN.profiles)for(const route of PIN.routes){
  const b=candidates.get(profile+'/'+route),a=baselines.get(profile+'/'+route);
  if(b)for(const [key,value] of Object.entries(b.values)){
   // Absolute budgets use only the candidate; no baseline is substituted.
   const checks=budgets(value.median,value.median).absolute;
   report.candidateAbsoluteCases.push({profile,case:key,candidate:value.median,checks});
   if(Object.values(checks).some(v=>!v))failed.add(profile+'/'+key);
  }
  if(!a||!b)continue;
  try{
   for(const key of ['tools','machine'])assert(digestObject(a.run[key])===digestObject(b.run[key]),'Baseline/candidate '+key+' differ; remeasure both');
   assert(a.run.base===b.run.base,'Baseline/candidate base differ; remeasure both');
   for(const key of ['haloJarSha256','fixtureSha256','configSha256','contentSha256','pluginsSha256','pluginConfigSha256'])assert(a.run.identity[key]&&a.run.identity[key]===b.run.identity[key],'Baseline/candidate identity mismatch: '+key);
   for(const device of PIN.devices){
    const key=route+'/'+device;if(!a.values[key]||!b.values[key])continue;
    try{
     assert(a.values[key].resolvedConfigHash===b.values[key].resolvedConfigHash,'Baseline/candidate resolved Lighthouse config differs');
     const checks=budgets(a.values[key].median,b.values[key].median);report.cases.push({profile,case:key,baseline:a.values[key].median,candidate:b.values[key].median,checks});
     if(Object.values(checks).some(group=>Object.values(group).some(v=>!v)))failed.add(profile+'/'+key);
    }catch(error){report.incomplete.push({profile,route,device,reason:error.message});}
   }
  }catch(error){report.incomplete.push({profile,route,reason:error.message});}
 }
 report.failures=[...failed];
 const absoluteFailed=report.candidateAbsoluteCases.some(c=>Object.values(c.checks).some(v=>!v));
 const pairedStatus=group=>report.cases.some(c=>Object.values(c.checks[group]).some(v=>!v))?'failed':report.cases.length===expected?'passed':'incomplete';
 const sizeFailed=pairedStatus('size')==='failed';
 report.scenarios={
  'PERF-01':absoluteFailed?'failed':report.candidateAbsoluteCases.length===expected?'passed':'incomplete',
  'PERF-02':pairedStatus('regression'),
  'PERF-03':sizeFailed?'failed':'incomplete'
 };
 report.budgetResult=report.failures.length?'failed':report.candidateAbsoluteCases.length===expected&&report.cases.length===expected?'passed':'incomplete';
 if(sizeFailed)report.incomplete.push({scenario:'PERF-03',reason:'Theme first-navigation JS/CSS size budget failed. On-demand component loading and failed-provider Loading recovery remain uncertified and still require separate fault-injection evidence.'});
 else report.incomplete.push({scenario:'PERF-03',reason:'Navigation resource budgets do not establish on-demand component loading or failed-provider Loading recovery. Separate real fault-injection evidence is required; this command cannot certify full PERF-03.'});
 report.result=report.failures.length?'failed':'incomplete';return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert(process.argv.length===5,'Usage: bun scripts/perf/compare.mjs baseline-cohort-dir candidate-cohort-dir output.json');
 const result=await compare(path.resolve(process.argv[2]),path.resolve(process.argv[3]));await writeJson(path.resolve(process.argv[4]),result);console.log(JSON.stringify({result:result.result,budgetResult:result.budgetResult,candidateAbsoluteCases:result.candidateAbsoluteCases.length,cases:result.cases.length,failures:result.failures,incomplete:result.incomplete}));process.exitCode=result.result==='failed'?1:2;
}
