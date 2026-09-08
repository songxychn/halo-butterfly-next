import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PIN,assert,readJson,readEvidence,readEvidenceBytes,writeJson,digestObject,sha256,validateProfile,localBase} from './support.mjs';
import {validateLhr,summarize,budgets} from './metrics.mjs';
export async function readRun(directory,profile,route){
 const run=await readJson(path.join(directory,'report.json'));assert(run.schema===1&&run.profile===profile&&run.route===route&&run.result==='complete-samples','Incomplete/wrong profile run');
 assert(run.samples.length===PIN.devices.length*PIN.samples,'Missing/extra sample coverage');assert(run.identity&&run.tools&&run.machine&&run.stationUnchanged===true&&run.runner?.workingTreeClean===true&&/^[a-f0-9]{40}$/.test(run.runner?.sourceSha||''),'Missing run identity or stable station proof');
 assert(run.tools.lighthouse===PIN.lighthouse&&run.tools.chrome?.version===PIN.chrome.version&&run.tools.chrome?.executableSha256===PIN.chrome.executableSha256&&/^[a-f0-9]{64}$/.test(run.tools.chrome?.treeSha256||''),'Unpinned browser or Lighthouse identity');
 localBase(run.base);
 const station=await readEvidence(directory,run.station);assert(digestObject(station.identity)===digestObject(run.identity)&&station.profile===profile&&station.route===route&&station.base===run.base,'Station evidence identity mismatch');
 assert(sha256(await readEvidenceBytes(directory,run.artifact))===run.identity.packageSha256,'Actual package bytes do not match declared identity');
 validateProfile(station,profile,route);assert(digestObject(run.actualPlugins)===digestObject(station.plugins)&&digestObject(run.requiredPlugins)===digestObject(station.requiredPlugins),'Route/plugin manifest differs from raw station evidence');
 const values={};
 for(const device of PIN.devices){
  const entries=run.samples.filter(s=>s.route===route&&s.device===device);assert(entries.length===5&&new Set(entries.map(s=>s.index)).size===5&&entries.every(s=>Number.isInteger(s.index)&&s.index>=0&&s.index<5&&s.status==='passed'),'Missing/duplicate/failed sample');
  const collected=[];
  for(const s of entries){
   const lhr=await readEvidence(directory,s.lhr),trace=await readEvidence(directory,s.trace),devtools=await readEvidence(directory,s.devtoolsLog);
   assert(Array.isArray(trace.traceEvents)&&trace.traceEvents.length>0,'Missing raw trace events');assert(Array.isArray(devtools)&&devtools.some(x=>x.method==='Network.requestWillBeSent'),'Missing raw network protocol log');
   const url=new URL(run.routes[route],run.base).href;collected.push(validateLhr(lhr,{url,device}));
  }
  assert(new Set(collected.map(s=>s.resolvedConfigHash)).size===1,'Resolved sample configurations differ');
  values[route+'/'+device]={median:summarize(collected),resolvedConfigHash:collected[0].resolvedConfigHash};
 }
 return {run,values};
}
export async function compare(baseline,candidate){
 const cohortIdentity={};
 const report={schema:1,kind:'performance-budget-comparison',result:'incomplete',contractAcceptance:false,cases:[],failures:[],incomplete:[]};
 for(const profile of PIN.profiles)for(const route of PIN.routes){
  try{
   const a=await readRun(path.join(baseline,profile,route),profile,route),b=await readRun(path.join(candidate,profile,route),profile,route);
   for(const [side,data] of [['baseline',a],['candidate',b]]){
    const identity={sourceSha:data.run.identity.sourceSha,packageSha256:data.run.identity.packageSha256,configSha256:data.run.identity.configSha256,haloJarSha256:data.run.identity.haloJarSha256,base:data.run.base,tools:data.run.tools,machine:data.run.machine,runner:data.run.runner};
    if(cohortIdentity[side])assert(digestObject(cohortIdentity[side])===digestObject(identity),'Mixed source/package/config/tools within '+side+' cohort');else cohortIdentity[side]=identity;
   }
   for(const key of ['tools','machine'])assert(digestObject(a.run[key])===digestObject(b.run[key]),'Baseline/candidate '+key+' differ; remeasure both');
   for(const key of ['haloJarSha256','fixtureSha256','configSha256','contentSha256','pluginsSha256'])assert(a.run.identity[key]&&a.run.identity[key]===b.run.identity[key],'Baseline/candidate identity mismatch: '+key);
   for(const side of [a,b])assert(/^[a-f0-9]{40}$/.test(side.run.identity.sourceSha)&&/^[a-f0-9]{64}$/.test(side.run.identity.packageSha256),'Missing exact source/package identity');
   for(const key of Object.keys(a.values)){
    assert(a.values[key].resolvedConfigHash===b.values[key].resolvedConfigHash,'Baseline/candidate resolved Lighthouse config differs');
    const checks=budgets(a.values[key].median,b.values[key].median);report.cases.push({profile,case:key,baseline:a.values[key].median,candidate:b.values[key].median,checks});
    if(Object.values(checks).some(group=>Object.values(group).some(v=>!v)))report.failures.push(profile+'/'+key);
   }
  }catch(e){report.incomplete.push({profile,route,reason:e.message});}
 }
 report.budgetResult=report.failures.length?'failed':report.incomplete.length?'incomplete':'passed';
 report.scenarios={'PERF-01':report.budgetResult==='incomplete'?'incomplete':report.cases.some(c=>Object.values(c.checks.absolute).some(v=>!v))?'failed':'passed','PERF-02':report.budgetResult==='incomplete'?'incomplete':report.cases.some(c=>Object.values(c.checks.regression).some(v=>!v))?'failed':'passed','PERF-03':'incomplete'};
 report.incomplete.push({scenario:'PERF-03',reason:'Navigation resource budgets do not establish on-demand component loading or failed-provider Loading recovery. Separate real fault-injection evidence is required; this command cannot certify full PERF-03.'});
 report.result=report.failures.length?'failed':'incomplete';return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert(process.argv.length===5,'Usage: node scripts/perf/compare.mjs baseline-cohort-dir candidate-cohort-dir output.json');
 const result=await compare(path.resolve(process.argv[2]),path.resolve(process.argv[3]));await writeJson(path.resolve(process.argv[4]),result);console.log(JSON.stringify({result:result.result,budgetResult:result.budgetResult,cases:result.cases.length,failures:result.failures,incomplete:result.incomplete}));process.exitCode=result.result==='failed'?1:2;
}
