import {test, afterEach} from 'bun:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {parse} from 'yaml';
import {defaultsFromSettings} from '../scripts/config-migration.mjs';
import {PIN,PROFILE,settings,sha256,validateProfile,writeJson,evidence,localBase,ownRuntime} from '../scripts/perf/support.mjs';
import {median,regressed,budgets,validateLhr} from '../scripts/perf/metrics.mjs';
import {compare,readRun} from '../scripts/perf/compare.mjs';
import {longform} from '../scripts/perf/longform.mjs';

const cleanup = [];
afterEach(async () => { for (const remove of cleanup.splice(0)) await remove(); });
function lhr(device='mobile',url='http://127.0.0.1:18100/',values={}){
 const metrics={lcp:1000,tbt:100,cls:.01,...values};return {lighthouseVersion:PIN.lighthouse,requestedUrl:url,finalDisplayedUrl:url,configSettings:settings(device),audits:{'errors-in-console':{score:1,details:{items:[]}},'largest-contentful-paint':{numericValue:metrics.lcp},'total-blocking-time':{numericValue:metrics.tbt},'cumulative-layout-shift':{numericValue:metrics.cls},'network-requests':{details:{items:[['js',100000],['css',50000]].map(([type,size])=>({url:'http://127.0.0.1:18100/themes/halo-butterfly-next/assets/index.'+type,transferSize:size/2,resourceSize:size,statusCode:200,finished:true}))}}}};
}
async function cohort(root){
 for(const profile of PIN.profiles)for(const route of PIN.routes){const dir=path.join(root,profile,route);await mkdir(dir,{recursive:true});const data=Buffer.from('fixed-package');await writeFile(path.join(dir,'theme.zip'),data);
 const identity={sourceSha:'a'.repeat(40),packageSha256:sha256(data),haloJarSha256:'b'.repeat(64),fixtureSha256:'c'.repeat(64),configSha256:'d'.repeat(64),contentSha256:'e'.repeat(64),pluginsSha256:'f'.repeat(64)};
 const base='http://127.0.0.1:18100',routes=Object.fromEntries(PIN.routes.map(route=>[route,'/'+route]));const plugins=PROFILE.profiles[profile][route].map(name=>({name,enabled:true,version:(PROFILE.plugins.find(p=>p.name===name)||PROFILE.probe).version}));const requiredPlugins=PROFILE.requiredPlugins[route];const station={identity,base,profile,route,plugins,requiredPlugins};await writeJson(path.join(dir,'station.json'),station);
 const run={schema:1,profile,route,actualPlugins:plugins,requiredPlugins,base,routes,identity,result:'complete-samples',stationUnchanged:true,runner:{sourceSha:'a'.repeat(40),workingTreeClean:true},tools:{lighthouse:PIN.lighthouse,chrome:{version:PIN.chrome.version,executableSha256:PIN.chrome.executableSha256,treeSha256:PIN.chrome.treeSha256||'1'.repeat(64)}},machine:{cpu:'same'},samples:[],station:await evidence(path.join(dir,'station.json'),dir),artifact:await evidence(path.join(dir,'theme.zip'),dir)};
 for(const device of PIN.devices)for(let index=0;index<5;index++){
 const prefix=path.join(dir,`${route}-${device}-${index}`);await writeJson(prefix+'.lhr.json',lhr(device,base+routes[route]));await writeJson(prefix+'.trace.json',{traceEvents:[{name:'navigationStart'}]});await writeJson(prefix+'.devtools.json',[{method:'Network.requestWillBeSent'}]);run.samples.push({route,device,index,status:'passed',lhr:await evidence(prefix+'.lhr.json',dir),trace:await evidence(prefix+'.trace.json',dir),devtoolsLog:await evidence(prefix+'.devtools.json',dir)});
 }await writeJson(path.join(dir,'report.json'),run);}
}
async function mutateRun(root,profile,change,route='home'){const file=path.join(root,profile,route,'report.json'),run=JSON.parse(await readFile(file));await change(run);await writeJson(file,run);}
test('性能引擎冻结 Lighthouse、Chrome 可执行文件和应用树摘要',()=>{
 assert.equal(PIN.lighthouse,'13.4.1');
 assert.equal(PIN.chrome.version,'153.0.8010.12');
 assert.match(PIN.chrome.executableSha256,/^[a-f0-9]{64}$/);
 assert.match(PIN.chrome.treeSha256,/^[a-f0-9]{64}$/);
 assert.notEqual(PIN.chrome.executableSha256,PIN.chrome.treeSha256);
});
test('PERF预算使用5次中位数及百分比和绝对增量双条件，包括零基线',()=>{
 assert.equal(median([1000,10,20,30,40]),30);assert.throws(()=>median([1,2,3,4]));assert.throws(()=>median([1,2,3,4,NaN]));
 assert.equal(regressed(0,100,.1,100),false);assert.equal(regressed(0,100.01,.1,100),true);assert.equal(regressed(2000,2101,.1,100),false);assert.equal(regressed(1000,1101,.1,100),true);assert.equal(regressed(100000,120480,.1,20480),false);assert.equal(regressed(100000,120481,.1,20480),true);
 const b={lcp:2500,tbt:200,cls:.08,themeJsBytes:100000,themeCssBytes:200000},c={...b,cls:.10};assert.ok(Object.values(budgets(b,c).absolute).every(Boolean));assert.equal(budgets(b,c).regression.cls,true);assert.equal(budgets(b,{...c,cls:.1001}).regression.cls,false);
});
test('LHR拒绝页面/工具错误、缺失非有限指标、错误限速和失败或外部资源',()=>{
 const options={url:'http://127.0.0.1:18100/',device:'mobile'};assert.equal(validateLhr(lhr(),options).themeJsBytes,100000);
 for(const edit of [x=>x.runtimeError={code:'NO_FCP'},x=>x.audits['errors-in-console'].details.items.push({description:'TypeError'}),x=>delete x.audits['errors-in-console'],x=>delete x.audits['total-blocking-time'],x=>x.audits['total-blocking-time'].numericValue=Infinity,x=>x.lighthouseVersion='wrong',x=>x.finalDisplayedUrl+='error',x=>x.configSettings.screenEmulation.width=360,x=>x.configSettings.throttling.rttMs=40,x=>x.audits['network-requests'].details.items[0].finished=false,x=>x.audits['network-requests'].details.items[0].statusCode=404,x=>x.audits['network-requests'].details.items[0].url='https://example.invalid/a.js']){const value=lhr();edit(value);assert.throws(()=>validateLhr(value,options));}
});
test('本地地址与独立运行目录保护拒绝远程站/用户资料和已占目录',async ()=>{
 for(const url of ['https://127.0.0.1:18100/','http://localhost:18100','http://127.0.0.1:18100/path','http://a:b@127.0.0.1:18100'])assert.throws(()=>localBase(url));
 const dir=await mkdtemp(path.join(os.tmpdir(),'perf-owner-'));cleanup.push(()=>rm(dir,{recursive:true,force:true}));await writeFile(path.join(dir,'existing'),'x');await assert.rejects(ownRuntime(dir));
});
test('完整两profile预算可通过但不冒充PERF03故障/按需或完整合同通过',async ()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'perf-full-'));cleanup.push(()=>rm(dir,{recursive:true,force:true}));await cohort(path.join(dir,'baseline'));await cp(path.join(dir,'baseline'),path.join(dir,'candidate'),{recursive:true});const result=await compare(path.join(dir,'baseline'),path.join(dir,'candidate'));assert.equal(result.cases.length,16);assert.equal(result.budgetResult,'passed');assert.equal(result.result,'incomplete');assert.equal(result.contractAcceptance,false);assert.equal(result.scenarios['PERF-01'],'passed');assert.equal(result.scenarios['PERF-02'],'passed');assert.equal(result.scenarios['PERF-03'],'incomplete');
});
test('主题首屏JS/CSS体积超预算使PERF-03失败，不能因按需未验写成incomplete',async ()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'perf-size-'));cleanup.push(()=>rm(dir,{recursive:true,force:true}));await cohort(path.join(dir,'baseline'));await cp(path.join(dir,'baseline'),path.join(dir,'candidate'),{recursive:true});
 await mutateRun(path.join(dir,'candidate'),'default',async r=>{for(const s of r.samples.filter(s=>s.route==='home'&&s.device==='mobile')){const f=path.join(dir,'candidate/default/home',s.lhr.path),value=JSON.parse(await readFile(f));value.audits['network-requests'].details.items[0].resourceSize=120481;await writeJson(f,value);s.lhr=await evidence(f,path.join(dir,'candidate/default/home'));}},'home');
 const result=await compare(path.join(dir,'baseline'),path.join(dir,'candidate'));assert.equal(result.result,'failed');assert.equal(result.budgetResult,'failed');assert.equal(result.scenarios['PERF-01'],'passed');assert.equal(result.scenarios['PERF-02'],'passed');assert.equal(result.scenarios['PERF-03'],'failed');assert.deepEqual(result.failures,['default/home/mobile']);
});
test('比较拒绝缺profile/缺样本/重复样本/身份漂移和原始证据篡改',async ()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'perf-reject-'));cleanup.push(()=>rm(dir,{recursive:true,force:true}));await cohort(path.join(dir,'baseline'));
 for(const [name,edit] of [['dirty',r=>r.runner.workingTreeClean=false],['dependency',r=>r.requiredPlugins=['PluginPhotos']],['sample',r=>r.samples.pop()],['duplicate',r=>r.samples[1].index=0],['failed',r=>r.samples[0].status='failed'],['artifact',r=>r.identity.packageSha256='1'.repeat(64)],['machine',r=>r.machine.cpu='other'],['tool',r=>r.tools.chrome.version='other'],['tree',r=>r.tools.chrome.treeSha256='2'.repeat(64)],['config',r=>r.identity.configSha256='1'.repeat(64)],['path',r=>r.samples[0].trace.path='../outside.json']]){
 const target=path.join(dir,name);await cp(path.join(dir,'baseline'),target,{recursive:true});await mutateRun(target,'default',edit);const result=await compare(path.join(dir,'baseline'),target);assert.equal(result.budgetResult,'incomplete',name);
 }
 const tampered=path.join(dir,'tampered');await cp(path.join(dir,'baseline'),tampered,{recursive:true});await writeFile(path.join(tampered,'default/home/home-mobile-0.lhr.json'),'{}');await assert.rejects(readRun(path.join(tampered,'default/home'),'default','home'),/hash mismatch/);
 const missing=await compare(path.join(dir,'baseline'),path.join(dir,'absent'));assert.equal(missing.cases.length,0);assert.equal(missing.result,'incomplete');
});
test('单页超预算不会被其他页面平均掩盖，且不能使用Lighthouse总分代替原指标',async ()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'perf-page-'));cleanup.push(()=>rm(dir,{recursive:true,force:true}));await cohort(path.join(dir,'baseline'));await cp(path.join(dir,'baseline'),path.join(dir,'candidate'),{recursive:true});
 await mutateRun(path.join(dir,'candidate'),'default',async r=>{for(const s of r.samples.filter(s=>s.route==='longform'&&s.device==='mobile')){const f=path.join(dir,'candidate/default/longform',s.lhr.path),value=JSON.parse(await readFile(f));value.categories={performance:{score:1}};value.audits['largest-contentful-paint'].numericValue=3000;await writeJson(f,value);s.lhr=await evidence(f,path.join(dir,'candidate/default/longform'));}},'longform');
 const result=await compare(path.join(dir,'baseline'),path.join(dir,'candidate'));assert.equal(result.result,'failed');assert.deepEqual(result.failures,['default/longform/mobile']);
});
test('长文夹具固定20节8代码2表12本地图，篡改/外部图/缺章节不放行',async ()=>{
 const original=await longform();assert.ok(original.body.length>15000);const dir=await mkdtemp(path.join(os.tmpdir(),'perf-long-'));cleanup.push(()=>rm(dir,{recursive:true,force:true}));await cp(new URL('../fixtures/performance/longform/',import.meta.url),dir,{recursive:true});await writeFile(path.join(dir,'article.html'),'short');await assert.rejects(longform(dir),/hash mismatch/);
 for(const replacement of [original.body.replace('id="perf-section-20"','id="removed"').replace('<h2 id="removed">','<h3 id="removed">'),original.body.replace('/lab/perf-chart-01.svg','https://example.invalid/photo.svg')]){const meta=structuredClone(original.meta);meta.files['article.html']=sha256(replacement);await writeFile(path.join(dir,'article.html'),replacement);await writeJson(path.join(dir,'fixture.json'),meta);await assert.rejects(longform(dir));}
 const meta=JSON.parse(await readFile(path.join(dir,'fixture.json')));meta.files['../outside']='x';await writeJson(path.join(dir,'fixture.json'),meta);await assert.rejects(longform(dir));
});

test('默认首页/长文关闭可选插件，图库/公共页仅声明必需依赖；不接受混合候选包',async ()=>{
 const station={requiredPlugins:[],plugins:[]};validateProfile(station,'default','home');validateProfile(station,'default','longform');
 assert.throws(()=>validateProfile({...station,plugins:[{name:'PluginPhotos',version:'2.1.2',enabled:true}]},'default','home'));
 assert.throws(()=>validateProfile(station,'default','photos'));
 const dir=await mkdtemp(path.join(os.tmpdir(),'perf-mixed-'));cleanup.push(()=>rm(dir,{recursive:true,force:true}));await cohort(path.join(dir,'baseline'));await cp(path.join(dir,'baseline'),path.join(dir,'candidate'),{recursive:true});
 await mutateRun(path.join(dir,'candidate'),'recommended',async r=>{r.identity.sourceSha='b'.repeat(40);const file=path.join(dir,'candidate/recommended/home/station.json');const raw=JSON.parse(await readFile(file));raw.identity.sourceSha=r.identity.sourceSha;await writeJson(file,raw);r.station=await evidence(file,path.dirname(file));});
 const report=await compare(path.join(dir,'baseline'),path.join(dir,'candidate'));assert.equal(report.budgetResult,'incomplete');assert.ok(report.incomplete.some(x=>x.reason.includes('Mixed source')));
});

test('性能配置冻结真实设置默认值，CLI在错误路由/样本数时先拒绝',async()=>{
 const raw=await readFile(new URL('../settings.yaml',import.meta.url));const frozen=JSON.parse(await readFile(new URL('../fixtures/performance/theme-defaults.json',import.meta.url)));
 assert.equal(frozen.settingsSha256,sha256(raw));assert.deepEqual(frozen.config,defaultsFromSettings(parse(raw.toString())));
 const args=['scripts/perf/collect.mjs','--lab-runtime','/not-a-real-lab','--package','/not-a-package','--profile','default','--route','home','--cohort','test','--cpu-window','not-assigned'];
 for(const extra of [['--limit','11'],['--limit','NaN']])assert.throws(()=>execFileSync(process.execPath,[...args,...extra],{cwd:new URL('..',import.meta.url),stdio:'pipe'}),e=>e.stderr.toString().includes('--limit must be 1..10'));
 const invalid=[...args];invalid[invalid.indexOf('home')]='unlisted';assert.throws(()=>execFileSync(process.execPath,invalid,{cwd:new URL('..',import.meta.url),stdio:'pipe'}),e=>e.stderr.toString().includes('Unknown route'));
});
